import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import {
  injectSocialMetaIntoHtml,
  prerenderDirectoryPostBodyIntoHtml,
} from '../functions/_middleware';
import { CONFIG } from '../src/config';
import { DirectoryPostDetail } from '../src/post-renderer';
import {
  getRemoteSocialPreviewSource,
  resolveDirectoryPostPreviewImage,
} from '../src/social-preview';

export interface ImageDimensions {
  width: number;
  height: number;
  mimeType: 'image/jpeg' | 'image/png' | 'image/webp';
}

const BUILD_FETCH_CONCURRENCY = 6;

export function detectImageMetadata(bytes: Uint8Array): ImageDimensions | null {
  if (bytes.length < 24) return null;

  // PNG: 89 50 4E 47 0D 0A 1A 0A + IHDR width/height at bytes 16..23
  if (
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47
  ) {
    const width =
      ((bytes[16] << 24) >>> 0) |
      (bytes[17] << 16) |
      (bytes[18] << 8) |
      bytes[19];
    const height =
      ((bytes[20] << 24) >>> 0) |
      (bytes[21] << 16) |
      (bytes[22] << 8) |
      bytes[23];
    if (width > 0 && height > 0) {
      return { width, height, mimeType: 'image/png' };
    }
    return null;
  }

  // JPEG: FF D8 ... SOFn marker
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    let offset = 2;
    while (offset + 8 < bytes.length) {
      if (bytes[offset] !== 0xff) break;
      while (offset < bytes.length && bytes[offset] === 0xff) {
        offset++;
      }
      if (offset >= bytes.length) break;
      const marker = bytes[offset++];

      if (marker === 0xd9 || marker === 0xda) break;
      if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
        continue;
      }
      if (offset + 2 > bytes.length) break;

      const segLength = (bytes[offset] << 8) | bytes[offset + 1];
      if (segLength < 2 || offset + segLength > bytes.length) break;

      const isSofMarker =
        marker >= 0xc0 &&
        marker <= 0xcf &&
        marker !== 0xc4 &&
        marker !== 0xc8 &&
        marker !== 0xcc;

      if (isSofMarker && segLength >= 7) {
        const height = (bytes[offset + 3] << 8) | bytes[offset + 4];
        const width = (bytes[offset + 5] << 8) | bytes[offset + 6];
        if (width > 0 && height > 0) {
          return { width, height, mimeType: 'image/jpeg' };
        }
      }

      offset += segLength;
    }
    return { width: 1200, height: 630, mimeType: 'image/jpeg' };
  }

  // WebP: RIFF....WEBP
  if (
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50
  ) {
    return { width: 1200, height: 630, mimeType: 'image/webp' };
  }

  return null;
}

export async function fetchVerifiedImageBytes(
  primaryUrl: string,
  fallbackUrl?: string,
  timeoutMs = 8000,
): Promise<{ bytes: Uint8Array; meta: ImageDimensions } | null> {
  const candidates: string[] = [primaryUrl];
  if (fallbackUrl && !candidates.includes(fallbackUrl)) {
    candidates.push(fallbackUrl);
  }

  let referer = 'https://postimg.cc/';

  for (let i = 0; i < candidates.length && i < 4; i++) {
    const candidate = candidates[i];
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(candidate, {
        headers: {
          Accept: 'image/jpeg,image/png,image/webp,image/*;q=0.9,*/*;q=0.1',
          Referer: referer,
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
        },
        redirect: 'follow',
        signal: controller.signal,
      });

      if (!response.ok) continue;
      if (response.url) {
        referer = response.url;
      }

      const buffer = new Uint8Array(await response.arrayBuffer());
      const meta = detectImageMetadata(buffer);
      if (meta) {
        return { bytes: buffer, meta };
      }

      const contentType = response.headers.get('content-type') || '';
      if (contentType.includes('text/html')) {
        const html = new TextDecoder().decode(buffer);
        const dlMatches = html.match(/https:\/\/i\.postimg\.cc\/[^"'\s<>]+\?dl=1/gi) || [];
        for (const matchUrl of dlMatches) {
          const cleanUrl = matchUrl.replaceAll('&amp;', '&');
          if (!candidates.includes(cleanUrl)) {
            candidates.push(cleanUrl);
          }
        }
      }
    } catch {
      // Ignore network errors in offline/sandboxed environments
    } finally {
      clearTimeout(timer);
    }
  }

  return null;
}

async function fetchCachedOrRemoteImage(
  cacheDir: string,
  remoteSource: string,
  fallbackUrl?: string,
): Promise<{ bytes: Uint8Array; meta: ImageDimensions } | null> {
  const cacheKey = crypto.createHash('sha256').update(remoteSource).digest('hex').slice(0, 24);
  const cachedPath = path.join(cacheDir, `${cacheKey}.bin`);

  if (fs.existsSync(cachedPath)) {
    const cachedBytes = new Uint8Array(fs.readFileSync(cachedPath));
    const meta = detectImageMetadata(cachedBytes);
    if (meta) {
      return { bytes: cachedBytes, meta };
    }
  }

  const fetched = await fetchVerifiedImageBytes(remoteSource, fallbackUrl);
  if (fetched) {
    fs.mkdirSync(cacheDir, { recursive: true });
    fs.writeFileSync(cachedPath, fetched.bytes);
  }
  return fetched;
}

async function runWithConcurrency<T>(
  items: T[],
  concurrency: number,
  worker: (item: T) => Promise<void>,
): Promise<void> {
  let cursor = 0;
  const runners = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (cursor < items.length) {
      const idx = cursor++;
      await worker(items[idx]);
    }
  });
  await Promise.all(runners);
}

export async function buildDirectoryPostSocialPreviews(
  rootDir: string,
  distDir: string,
  productionOrigin: string,
): Promise<void> {
  const postsDir = path.join(rootDir, 'public', 'posts');
  const postTemplatePath = path.join(distDir, 'post.html');
  if (!fs.existsSync(postsDir) || !fs.existsSync(postTemplatePath)) return;

  const postTemplateHtml = fs.readFileSync(postTemplatePath, 'utf-8');
  const cacheDir = path.join(rootDir, '.cache', 'social-previews');
  const emitVercelStaticRewrites = process.env.VERCEL === '1';
  const files = fs.readdirSync(postsDir).filter(f => f.endsWith('.json') && f !== 'index.json');

  // Deduplicate identical remote URLs in-memory so duplicate preview links only download once
  const inflightByUrl = new Map<string, Promise<{ bytes: Uint8Array; meta: ImageDimensions } | null>>();

  await runWithConcurrency(files, BUILD_FETCH_CONCURRENCY, async file => {
    const srcJsonPath = path.join(postsDir, file);
    const data = JSON.parse(fs.readFileSync(srcJsonPath, 'utf-8')) as DirectoryPostDetail;

    let width = data.socialPreviewImageWidth || 1200;
    let height = data.socialPreviewImageHeight || 630;
    const remoteSource = getRemoteSocialPreviewSource(data);
    const resolvedPreview = resolveDirectoryPostPreviewImage(data);

    if (remoteSource && resolvedPreview.startsWith('/')) {
      let fetchPromise = inflightByUrl.get(remoteSource);
      if (!fetchPromise) {
        fetchPromise = fetchCachedOrRemoteImage(
          cacheDir,
          remoteSource,
          data.socialPreviewImageFallback,
        );
        inflightByUrl.set(remoteSource, fetchPromise);
      }

      const fetched = await fetchPromise;
      if (fetched) {
        const targetAssetPath = path.join(distDir, resolvedPreview.replace(/^\/+/, ''));
        fs.mkdirSync(path.dirname(targetAssetPath), { recursive: true });
        fs.writeFileSync(targetAssetPath, fetched.bytes);
        width = fetched.meta.width;
        height = fetched.meta.height;

        const distPostJsonPath = path.join(distDir, 'posts', file);
        if (fs.existsSync(distPostJsonPath)) {
          const updatedData: DirectoryPostDetail = {
            ...data,
            socialPreviewImage: resolvedPreview,
            socialPreviewImageSource: remoteSource,
            socialPreviewImageWidth: width,
            socialPreviewImageHeight: height,
          };
          fs.writeFileSync(distPostJsonPath, `${JSON.stringify(updatedData, null, 2)}\n`, 'utf-8');
        }
      }
    }

    if (emitVercelStaticRewrites) {
      const absolutePreviewUrl = resolvedPreview.startsWith('http')
        ? resolvedPreview
        : `${productionOrigin}${resolvedPreview.startsWith('/') ? resolvedPreview : `/${resolvedPreview}`}`;
      const canonicalUrl = `${productionOrigin}/post?id=${encodeURIComponent(data.id)}`;

      let prerenderedPostHtml = injectSocialMetaIntoHtml(postTemplateHtml, {
        documentTitle: `${data.title} | LinkHub`,
        title: data.title,
        description: data.description,
        imageUrl: absolutePreviewUrl,
        imageWidth: width,
        imageHeight: height,
        pageUrl: canonicalUrl,
        canonicalUrl,
      });
      prerenderedPostHtml = prerenderDirectoryPostBodyIntoHtml(
        prerenderedPostHtml,
        data,
        CONFIG.JOIN_REDIRECT_LINK,
      );

      fs.writeFileSync(path.join(distDir, `post-${data.id}.html`), prerenderedPostHtml, 'utf-8');
    }
  });
}
