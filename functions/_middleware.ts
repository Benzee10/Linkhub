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

interface SocialMetaPayload {
  documentTitle: string;
  title: string;
  description: string;
  imageUrl: string;
  imageWidth: number;
  imageHeight: number;
  pageUrl: string;
}

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

export function injectSocialMetaIntoHtml(html: string, meta: SocialMetaPayload): string {
  const titleAttr = escapeAttr(meta.title);
  const descAttr = escapeAttr(meta.description);
  const imgAttr = escapeAttr(meta.imageUrl);
  const urlAttr = escapeAttr(meta.pageUrl);
  const mimeType = meta.imageUrl.toLowerCase().endsWith('.png') ? 'image/png' : 'image/jpeg';

  let result = html.replace(/<title>[\s\S]*?<\/title>/i, `<title>${escapeHtml(meta.documentTitle)}</title>`);

  result = upsertTag(result, /<meta\s+name=["']description["'][^>]*>/i, `<meta name="description" content="${descAttr}" />`);
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

  return result;
}

function resolveAbsoluteUrl(rawUrl: string, origin: string): string {
  if (rawUrl.startsWith('http://') || rawUrl.startsWith('https://')) {
    return rawUrl;
  }
  return new URL(rawUrl.startsWith('/') ? rawUrl : `/${rawUrl}`, origin).href;
}

export async function onRequest(context: PagesMiddlewareContext): Promise<Response> {
  const { request, env } = context;
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    return context.next();
  }

  const url = new URL(request.url);
  const { pathname } = url;
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

    const data = await dataRes.json() as Record<string, unknown>;
    const title = typeof data.title === 'string' ? data.title : '';
    if (!title) {
      return response;
    }

    const rawImage = isBlogPost
      ? String(data.socialPreviewImage || data.coverImage || '')
      : String(data.image || '');
    if (!rawImage) {
      return response;
    }

    const description = isBlogPost
      ? String(data.description || data.excerpt || '')
      : String(data.description || '');
    const pageUrl = isBlogPost && typeof data.url === 'string' && data.url
      ? resolveAbsoluteUrl(data.url, url.origin)
      : url.href;
    const imageWidth = typeof data.socialPreviewImageWidth === 'number' ? data.socialPreviewImageWidth : 1200;
    const imageHeight = typeof data.socialPreviewImageHeight === 'number' ? data.socialPreviewImageHeight : 630;

    const html = await response.text();
    const updatedHtml = injectSocialMetaIntoHtml(html, {
      documentTitle: isBlogPost ? `${title} | LinkHub Blog` : `${title} | LinkHub`,
      title,
      description,
      imageUrl: resolveAbsoluteUrl(rawImage, url.origin),
      imageWidth,
      imageHeight,
      pageUrl,
    });

    const headers = new Headers(response.headers);
    headers.delete('content-length');
    headers.delete('etag');

    return new Response(request.method === 'HEAD' ? null : updatedHtml, {
      status: response.status,
      statusText: response.statusText,
      headers,
    });
  } catch {
    return context.next();
  }
}
