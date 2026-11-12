import { CONFIG } from '../src/config';
import {
  DirectoryPostDetail,
  renderDirectoryPostContentHtml,
  renderGroupCardHtml,
  sanitizeUrl,
} from '../src/post-renderer';
import {
  getRemoteSocialPreviewSource,
  resolveBlogPostPreviewImage,
  resolveDirectoryPostPreviewImage,
} from '../src/social-preview';

interface PagesAssetFetcher {
  fetch(input: Request | URL | string): Promise<Response>;
}

export interface PagesMiddlewareContext {
  request: Request;
  next: () => Promise<Response>;
  env: {
    ASSETS?: PagesAssetFetcher;
  };
}

export interface SocialMetaPayload {
  documentTitle: string;
  title: string;
  description: string;
  imageUrl: string;
  imageWidth: number;
  imageHeight: number;
  pageUrl: string;
  canonicalUrl?: string;
  jsonLd?: string;
}

const MAX_UPSTREAM_IMAGE_BYTES = 10 * 1024 * 1024; // 10 MB cap to protect Worker memory
const UPSTREAM_FETCH_TIMEOUT_MS = 5000;

function escapeAttr(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('"', '&quot;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');
}

function upsertTag(html: string, pattern: RegExp, replacement: string): string {
  if (pattern.test(html)) {
    return html.replace(pattern, replacement);
  }
  return html.replace('</head>', `    ${replacement}\n  </head>`);
}

function resolveMimeType(imageUrl: string): string {
  const lower = imageUrl.toLowerCase();
  if (lower.endsWith('.png')) return 'image/png';
  if (lower.endsWith('.webp')) return 'image/webp';
  return 'image/jpeg';
}

export function injectSocialMetaIntoHtml(html: string, meta: SocialMetaPayload): string {
  const titleAttr = escapeAttr(meta.title);
  const descAttr = escapeAttr(meta.description);
  const imgAttr = escapeAttr(meta.imageUrl);
  const urlAttr = escapeAttr(meta.pageUrl);
  const canonicalAttr = escapeAttr(meta.canonicalUrl || meta.pageUrl);
  const mimeType = resolveMimeType(meta.imageUrl);

  let result = html.replace(/<title>[\s\S]*?<\/title>/i, `<title>${escapeHtml(meta.documentTitle)}</title>`);

  result = upsertTag(result, /<meta\s+name=["']description["'][^>]*>/i, `<meta name="description" content="${descAttr}" />`);
  result = upsertTag(result, /<link\s+rel=["']canonical["'][^>]*>/i, `<link rel="canonical" href="${canonicalAttr}" />`);
  result = upsertTag(result, /<meta\s+property=["']og:title["'][^>]*>/i, `<meta property="og:title" content="${titleAttr}" />`);
  result = upsertTag(result, /<meta\s+property=["']og:description["'][^>]*>/i, `<meta property="og:description" content="${descAttr}" />`);
  result = upsertTag(result, /<meta\s+property=["']og:url["'][^>]*>/i, `<meta property="og:url" content="${urlAttr}" />`);
  result = upsertTag(result, /<meta\s+property=["']og:image["'][^>]*>/i, `<meta property="og:image" content="${imgAttr}" />`);
  result = upsertTag(result, /<meta\s+property=["']og:image:secure_url["'][^>]*>/i, `<meta property="og:image:secure_url" content="${imgAttr}" />`);
  result = upsertTag(result, /<meta\s+property=["']og:image:type["'][^>]*>/i, `<meta property="og:image:type" content="${mimeType}" />`);
  result = upsertTag(result, /<meta\s+property=["']og:image:width["'][^>]*>/i, `<meta property="og:image:width" content="${meta.imageWidth}" />`);
  result = upsertTag(result, /<meta\s+property=["']og:image:height["'][^>]*>/i, `<meta property="og:image:height" content="${meta.imageHeight}" />`);
  result = upsertTag(result, /<meta\s+property=["']og:image:alt["'][^>]*>/i, `<meta property="og:image:alt" content="${titleAttr}" />`);

  result = upsertTag(result, /<meta\s+(?:property|name)=["']twitter:card["'][^>]*>/i, `<meta name="twitter:card" content="summary_large_image" />`);
  result = upsertTag(result, /<meta\s+(?:property|name)=["']twitter:url["'][^>]*>/i, `<meta name="twitter:url" content="${urlAttr}" />`);
  result = upsertTag(result, /<meta\s+(?:property|name)=["']twitter:title["'][^>]*>/i, `<meta name="twitter:title" content="${titleAttr}" />`);
  result = upsertTag(result, /<meta\s+(?:property|name)=["']twitter:description["'][^>]*>/i, `<meta name="twitter:description" content="${descAttr}" />`);
  result = upsertTag(result, /<meta\s+(?:property|name)=["']twitter:image["'][^>]*>/i, `<meta name="twitter:image" content="${imgAttr}" />`);
  result = upsertTag(result, /<meta\s+(?:property|name)=["']twitter:image:src["'][^>]*>/i, `<meta name="twitter:image:src" content="${imgAttr}" />`);

  result = upsertTag(result, /<meta\s+itemprop=["']image["'][^>]*>/i, `<meta itemprop="image" content="${imgAttr}" />`);
  result = upsertTag(result, /<link\s+rel=["']image_src["'][^>]*>/i, `<link rel="image_src" href="${imgAttr}" />`);

  if (meta.jsonLd) {
    result = upsertTag(
      result,
      /<script\s+type=["']application\/ld\+json["'][^>]*>[\s\S]*?<\/script>/i,
      `<script type="application/ld+json">${meta.jsonLd}</script>`,
    );
  }

  return result;
}

export function prerenderDirectoryPostBodyIntoHtml(
  html: string,
  post: DirectoryPostDetail,
  joinRedirectLink: string,
): string {
  const safeCategory = escapeHtml(post.category || 'Community');
  const safeTitle = escapeHtml(post.title);
  const safeDesc = escapeHtml(post.description);
  const safeIntro = escapeHtml(post.intro || '');
  const safeHeroSrc = escapeAttr(sanitizeUrl(post.image, '/og-default.jpg'));
  const groups = Array.isArray(post.groups) ? post.groups : [];
  const groupCountText = `${groups.length} Groups Available`;
  const groupsHtml = groups.map(g => renderGroupCardHtml(g, joinRedirectLink)).join('\n');
  const contentHtml = renderDirectoryPostContentHtml(post.content || '');

  let result = html.replace(
    /<header id="post-header"([^>]*)>/i,
    `<header id="post-header"$1 data-prerendered-id="${escapeAttr(post.id)}">`,
  );

  result = result.replace(
    /(<div id="post-category"[^>]*>)[\s\S]*?(<\/div>)/i,
    `$1${safeCategory}$2`,
  );
  result = result.replace(
    /(<h1 id="post-title"[^>]*>)[\s\S]*?(<\/h1>)/i,
    `$1${safeTitle}$2`,
  );
  result = result.replace(
    /(<p id="post-description"[^>]*>)[\s\S]*?(<\/p>)/i,
    `$1${safeDesc}$2`,
  );
  result = result.replace(
    /<img id="post-image"[^>]*>/i,
    `<img id="post-image" src="${safeHeroSrc}" alt="${escapeAttr(post.title)}" width="896" height="504" fetchpriority="high" decoding="async" class="w-full h-full object-cover" referrerpolicy="no-referrer" />`,
  );
  result = result.replace(
    /(<div id="post-intro"[^>]*>)[\s\S]*?(<\/div>)/i,
    `$1${safeIntro}$2`,
  );
  result = result.replace(
    /(<div id="post-content"[^>]*>)[\s\S]*?(<\/div>)/i,
    `$1${contentHtml}$2`,
  );
  result = result.replace(
    /(<span id="group-count"[^>]*>)[\s\S]*?(<\/span>)/i,
    `$1${escapeHtml(groupCountText)}$2`,
  );
  result = result.replace(
    /<!-- GROUPS_LIST_START -->[\s\S]*?<!-- GROUPS_LIST_END -->/,
    groupsHtml,
  );

  return result;
}

function resolveAbsoluteUrl(rawUrl: string, origin: string): string {
  if (rawUrl.startsWith('http://') || rawUrl.startsWith('https://')) {
    return rawUrl;
  }
  return new URL(rawUrl.startsWith('/') ? rawUrl : `/${rawUrl}`, origin).href;
}

function isSafePublicHttpUrl(rawUrl: string): boolean {
  try {
    const parsed = new URL(rawUrl);
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return false;
    const host = parsed.hostname.toLowerCase();
    if (
      host === 'localhost' ||
      host.endsWith('.local') ||
      host === '[::1]' ||
      /^127\./.test(host) ||
      /^10\./.test(host) ||
      /^192\.168\./.test(host) ||
      /^169\.254\./.test(host) ||
      /^172\.(1[6-9]|2\d|3[0-1])\./.test(host)
    ) {
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

async function readBoundedBytes(response: Response, maxBytes: number): Promise<Uint8Array | null> {
  const declaredLen = Number(response.headers.get('content-length') || '0');
  if (declaredLen > maxBytes) return null;

  if (!response.body) {
    const buf = new Uint8Array(await response.arrayBuffer());
    return buf.byteLength <= maxBytes ? buf : null;
  }

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value) {
        total += value.byteLength;
        if (total > maxBytes) {
          await reader.cancel();
          return null;
        }
        chunks.push(value);
      }
    }
  } finally {
    reader.releaseLock();
  }

  const out = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    out.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return out;
}

function detectImageMime(bytes: Uint8Array): string | null {
  if (bytes.length < 12) return null;
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return 'image/jpeg';
  }
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) {
    return 'image/png';
  }
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
    return 'image/webp';
  }
  return null;
}

async function proxyRemoteSocialImage(
  primaryUrl: string,
  fallbackUrl: string | undefined,
  method: string,
): Promise<Response | null> {
  const candidates = [primaryUrl];
  if (fallbackUrl && !candidates.includes(fallbackUrl)) {
    candidates.push(fallbackUrl);
  }

  for (let i = 0; i < candidates.length && i < 4; i++) {
    const candidate = candidates[i];
    if (!isSafePublicHttpUrl(candidate)) continue;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), UPSTREAM_FETCH_TIMEOUT_MS);
    try {
      const upstream = await fetch(candidate, {
        headers: {
          Accept: 'image/jpeg,image/png,image/webp,image/*;q=0.9,*/*;q=0.1',
          Referer: 'https://postimg.cc/',
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
        },
        redirect: 'follow',
        signal: controller.signal,
      });
      if (!upstream.ok) continue;

      const bytes = await readBoundedBytes(upstream, MAX_UPSTREAM_IMAGE_BYTES);
      if (!bytes) continue;

      const mime = detectImageMime(bytes);
      if (mime) {
        return new Response(method === 'HEAD' ? null : bytes, {
          status: 200,
          headers: {
            'Content-Type': mime,
            'Cache-Control': 'public, max-age=86400, s-maxage=604800',
            'Access-Control-Allow-Origin': '*',
          },
        });
      }

      const contentType = upstream.headers.get('content-type') || '';
      if (contentType.includes('text/html')) {
        const html = new TextDecoder().decode(bytes);
        const dlMatches = html.match(/https:\/\/i\.postimg\.cc\/[^"'\s<>]+\?dl=1/gi) || [];
        for (const matchUrl of dlMatches) {
          const cleanUrl = matchUrl.replaceAll('&amp;', '&');
          if (!candidates.includes(cleanUrl)) {
            candidates.push(cleanUrl);
          }
        }
      }
    } catch {
      // Try next candidate
    } finally {
      clearTimeout(timer);
    }
  }

  return null;
}

async function handlePreviewImageRequest(
  context: PagesMiddlewareContext,
  slug: string,
  origin: string,
): Promise<Response> {
  // Prefer static build-time downloaded image if present in dist/preview/<slug>.jpg
  const staticRes = await context.next();
  const staticType = staticRes.headers.get('content-type') || '';
  if (staticRes.status === 200 && staticType.startsWith('image/')) {
    return staticRes;
  }

  if (!context.env.ASSETS) {
    return staticRes;
  }

  try {
    const postRes = await context.env.ASSETS.fetch(
      new Request(new URL(`/posts/${slug}.json`, origin).href),
    );
    if (!postRes.ok) {
      return staticRes;
    }

    const postData = (await postRes.json()) as Record<string, unknown>;
    const sourceUrl = getRemoteSocialPreviewSource(postData) || '';
    const fallbackUrl =
      typeof postData.socialPreviewImageFallback === 'string'
        ? postData.socialPreviewImageFallback
        : undefined;

    if (!sourceUrl) {
      return staticRes;
    }

    const proxied = await proxyRemoteSocialImage(
      sourceUrl,
      fallbackUrl,
      context.request.method,
    );
    if (proxied) {
      return proxied;
    }
  } catch {
    // Fall through to static response
  }

  return staticRes;
}

function buildDirectoryJsonLd(
  title: string,
  description: string,
  canonicalUrl: string,
  groupsCount: number,
): string {
  return JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: title,
    description,
    url: canonicalUrl,
    isPartOf: {
      '@type': 'WebSite',
      name: 'LinkHub',
      url: CONFIG.SITE_ORIGIN,
    },
    mainEntity: {
      '@type': 'ItemList',
      numberOfItems: groupsCount,
    },
  }).replaceAll('<', '\\u003c');
}

export async function onRequest(context: PagesMiddlewareContext): Promise<Response> {
  const { request, env } = context;
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    return context.next();
  }

  const url = new URL(request.url);
  const { pathname } = url;

  const previewMatch = pathname.match(/^\/preview\/([a-z0-9-]+)\.(?:jpg|jpeg|png|webp)$/i);
  if (previewMatch) {
    return handlePreviewImageRequest(context, previewMatch[1], url.origin);
  }

  const isBlogPost = pathname === '/blog-post' || pathname === '/blog-post.html';
  const isDirectoryPost = pathname === '/post' || pathname === '/post.html';

  if (!isBlogPost && !isDirectoryPost) {
    return context.next();
  }

  const id = url.searchParams.get('id') || (isBlogPost ? 'romantic-ways-to-ask-her-to-be-your-girlfriend' : '');
  if (!id || !/^[a-z0-9-]+$/i.test(id) || !env.ASSETS) {
    return context.next();
  }

  try {
    let response = await context.next();
    if (response.status >= 300 && response.status < 400 && pathname.endsWith('.html')) {
      const cleanPathUrl = new URL(pathname.slice(0, -5), url.origin);
      const cleanResponse = await env.ASSETS.fetch(new Request(cleanPathUrl.href));
      if (cleanResponse.status === 200) {
        response = cleanResponse;
      }
    }

    const contentType = response.headers.get('content-type') || '';
    if (response.status !== 200 || !contentType.includes('text/html')) {
      return response;
    }

    const jsonPath = isBlogPost ? `/blogs/${id}.json` : `/posts/${id}.json`;
    const dataRes = await env.ASSETS.fetch(new Request(new URL(jsonPath, url.origin).href));
    if (!dataRes.ok) {
      return response;
    }

    const data = (await dataRes.json()) as Record<string, unknown>;
    const title = typeof data.title === 'string' ? data.title : '';
    if (!title) {
      return response;
    }

    const rawImage = isBlogPost
      ? resolveBlogPostPreviewImage({
          coverImage: String(data.coverImage || ''),
          socialPreviewImage: data.socialPreviewImage,
        })
      : resolveDirectoryPostPreviewImage({
          id,
          image: String(data.image || ''),
          socialPreviewImage: data.socialPreviewImage,
        });
    if (!rawImage) {
      return response;
    }

    const canonicalOrigin = CONFIG.SITE_ORIGIN.replace(/\/+$/, '');
    const description = isBlogPost
      ? String(data.description || data.excerpt || '')
      : String(data.description || '');
    const pageUrl =
      isBlogPost && typeof data.url === 'string' && data.url
        ? resolveAbsoluteUrl(data.url, url.origin)
        : url.href;
    const canonicalUrl = isBlogPost
      ? resolveAbsoluteUrl(typeof data.url === 'string' && data.url ? data.url : `/${id}`, canonicalOrigin)
      : `${canonicalOrigin}/post?id=${encodeURIComponent(id)}`;
    const imageWidth = typeof data.socialPreviewImageWidth === 'number' ? data.socialPreviewImageWidth : 1200;
    const imageHeight = typeof data.socialPreviewImageHeight === 'number' ? data.socialPreviewImageHeight : 630;

    const html = await response.text();
    const groupsCount = Array.isArray(data.groups) ? data.groups.length : 0;

    let updatedHtml = injectSocialMetaIntoHtml(html, {
      documentTitle: isBlogPost ? `${title} | LinkHub Blog` : `${title} | LinkHub`,
      title,
      description,
      imageUrl: resolveAbsoluteUrl(rawImage, url.origin),
      imageWidth,
      imageHeight,
      pageUrl,
      canonicalUrl,
      jsonLd: isDirectoryPost
        ? buildDirectoryJsonLd(title, description, canonicalUrl, groupsCount)
        : undefined,
    });

    if (isDirectoryPost) {
      updatedHtml = prerenderDirectoryPostBodyIntoHtml(
        updatedHtml,
        data as unknown as DirectoryPostDetail,
        CONFIG.JOIN_REDIRECT_LINK,
      );
    }

    const headers = new Headers(response.headers);
    headers.delete('content-length');
    headers.delete('etag');
    if (!headers.has('cache-control')) {
      headers.set('Cache-Control', 'public, max-age=300, s-maxage=3600, stale-while-revalidate=86400');
    }

    return new Response(request.method === 'HEAD' ? null : updatedHtml, {
      status: response.status,
      statusText: response.statusText,
      headers,
    });
  } catch {
    return context.next();
  }
}
