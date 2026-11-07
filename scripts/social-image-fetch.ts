import fs from 'node:fs';
import path from 'node:path';
import { injectSocialMetaIntoHtml } from '../functions/_middleware';

export interface ImageDimensions {
  width: number;
  height: number;
  mimeType: 'image/jpeg' | 'image/png' | 'image/webp';
}

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
  timeoutMs = 12000,
): Promise<{ bytes: Uint8Array; meta: ImageDimensions } | null> {
  const candidates: string[] = [primaryUrl];
  if (fallbackUrl && !candidates.includes(fallbackUrl)) {
    candidates.push(fallbackUrl);
  }

  for (let i = 0; i < candidates.length; i++) {
    const candidate = candidates[i];
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(candidate, {
        headers: {
          Accept: 'image/jpeg,image/png,image/webp,image/*;q=0.9,*/*;q=0.1',
          Referer: 'https://postimg.cc/',
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
        },
        redirect: 'follow',
        signal: controller.signal,
      });

      if (!response.ok) continue;

      const buffer = new Uint8Array(await response.arrayBuffer());
      const meta = detectImageMetadata(buffer);
      if (meta) {
        return { bytes: buffer, meta };
      }

      // If an image host (e.g. Postimages) returned an HTML viewer page, extract any ?dl=1 direct download link
      const contentType = response.headers.get('content-type') || '';
      if (contentType.includes('text/html')) {
        const html = new TextDecoder().decode(buffer);
        const dlMatch = html.match(/https:\/\/i\.postimg\.cc\/[^"'\s>]+\?dl=1/i);
        if (dlMatch && !candidates.includes(dlMatch[0])) {
          candidates.push(dlMatch[0]);
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

interface DirectoryPostRecord {
  id: string;
  title: string;
  description: string;
  image: string;
  socialPreviewImage?: string;
  socialPreviewImageSource?: string;
  socialPreviewImageFallback?: string;
  socialPreviewImageWidth?: number;
  socialPreviewImageHeight?: number;
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
  const files = fs.readdirSync(postsDir).filter(f => f.endsWith('.json') && f !== 'index.json');

  for (const file of files) {
    const srcJsonPath = path.join(postsDir, file);
    const data = JSON.parse(fs.readFileSync(srcJsonPath, 'utf-8')) as DirectoryPostRecord;
    if (!data.socialPreviewImage && !data.socialPreviewImageSource) {
      continue;
    }

    let width = data.socialPreviewImageWidth || 1200;
    let height = data.socialPreviewImageHeight || 630;

    // If a remote preview source URL is configured and the local preview path is relative, download it into dist/
    if (
      data.socialPreviewImageSource &&
      data.socialPreviewImage &&
      data.socialPreviewImage.startsWith('/')
    ) {
      const targetAssetPath = path.join(distDir, data.socialPreviewImage.replace(/^\/+/, ''));
      const fetched = await fetchVerifiedImageBytes(
        data.socialPreviewImageSource,
        data.socialPreviewImageFallback,
      );

      if (fetched) {
        fs.mkdirSync(path.dirname(targetAssetPath), { recursive: true });
        fs.writeFileSync(targetAssetPath, fetched.bytes);
        width = fetched.meta.width;
        height = fetched.meta.height;

        const distPostJsonPath = path.join(distDir, 'posts', file);
        if (fs.existsSync(distPostJsonPath)) {
          const updatedData: DirectoryPostRecord = {
            ...data,
            socialPreviewImageWidth: width,
            socialPreviewImageHeight: height,
          };
          fs.writeFileSync(distPostJsonPath, `${JSON.stringify(updatedData, null, 2)}\n`, 'utf-8');
        }
      }
    }

    const rawPreview = data.socialPreviewImage || data.socialPreviewImageSource || data.image;
    const absolutePreviewUrl = rawPreview.startsWith('http')
      ? rawPreview
      : `${productionOrigin}${rawPreview.startsWith('/') ? rawPreview : `/${rawPreview}`}`;
    const pageUrl = `${productionOrigin}/post.html?id=${encodeURIComponent(data.id)}`;

    const prerenderedPostHtml = injectSocialMetaIntoHtml(postTemplateHtml, {
      documentTitle: `${data.title} | LinkHub`,
      title: data.title,
      description: data.description,
      imageUrl: absolutePreviewUrl,
      imageWidth: width,
      imageHeight: height,
      pageUrl,
    });

    fs.writeFileSync(path.join(distDir, `post-${data.id}.html`), prerenderedPostHtml, 'utf-8');
  }
}
