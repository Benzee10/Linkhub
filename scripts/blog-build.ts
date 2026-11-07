import fs from 'node:fs';
import path from 'node:path';
import {
  BlogPost,
  BlogPostPreview,
  escapeHtml,
  getBlogPostPath,
  renderBlogBodyHtml,
  renderBlogTagsHtml,
  toBlogPostPreview,
} from '../src/blog-renderer';
import { resolveBlogPostPreviewImage } from '../src/social-preview';

export const BLOGS_DIR_NAME = 'blogs';

function parseDateTimestamp(dateText: string): number {
  const parsed = Date.parse(dateText);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function loadAllBlogPosts(rootDir: string): BlogPost[] {
  const blogsDir = path.resolve(rootDir, BLOGS_DIR_NAME);
  if (!fs.existsSync(blogsDir)) return [];

  const entries = fs
    .readdirSync(blogsDir)
    .filter(file => file.endsWith('.json') && file !== 'index.json')
    .sort();

  const posts: BlogPost[] = entries.map(filename => {
    const filePath = path.join(blogsDir, filename);
    const raw = fs.readFileSync(filePath, 'utf-8');
    const parsed = JSON.parse(raw) as BlogPost;
    const slugFromFilename = filename.replace(/\.json$/i, '');
    return {
      ...parsed,
      id: parsed.id || slugFromFilename,
      url: getBlogPostPath({ id: parsed.id || slugFromFilename, url: parsed.url }),
    };
  });

  return posts.sort((a, b) => {
    const orderA = typeof a.order === 'number' ? a.order : 999;
    const orderB = typeof b.order === 'number' ? b.order : 999;
    if (orderA !== orderB) return orderA - orderB;
    return parseDateTimestamp(b.date) - parseDateTimestamp(a.date);
  });
}

export function loadBlogPostById(rootDir: string, id: string): BlogPost | null {
  if (!/^[a-z0-9-]+$/i.test(id)) return null;
  const directPath = path.resolve(rootDir, BLOGS_DIR_NAME, `${id}.json`);
  if (fs.existsSync(directPath)) {
    const parsed = JSON.parse(fs.readFileSync(directPath, 'utf-8')) as BlogPost;
    return {
      ...parsed,
      id: parsed.id || id,
      url: getBlogPostPath({ id: parsed.id || id, url: parsed.url }),
    };
  }
  return loadAllBlogPosts(rootDir).find(post => post.id === id) ?? null;
}

export function buildBlogIndex(posts: BlogPost[]): BlogPostPreview[] {
  return posts.map(toBlogPostPreview);
}

function resolveOriginUrl(rawPathOrUrl: string, origin: string): string {
  if (rawPathOrUrl.startsWith('http://') || rawPathOrUrl.startsWith('https://')) {
    return rawPathOrUrl;
  }
  const cleanOrigin = origin.replace(/\/+$/, '');
  const cleanPath = rawPathOrUrl.startsWith('/') ? rawPathOrUrl : `/${rawPathOrUrl}`;
  return `${cleanOrigin}${cleanPath}`;
}

function upsertHeadTag(html: string, pattern: RegExp, replacement: string): string {
  if (pattern.test(html)) {
    return html.replace(pattern, replacement);
  }
  return html.replace('</head>', `    ${replacement}\n  </head>`);
}

export function prerenderBlogPostHtml(
  templateHtml: string,
  post: BlogPost,
  origin: string,
  joinRedirectLink: string,
): string {
  const cleanOrigin = origin.replace(/\/+$/, '');
  const pageUrl = resolveOriginUrl(getBlogPostPath(post), cleanOrigin);
  const rawPreviewImage = resolveBlogPostPreviewImage(post);
  const previewImageUrl = resolveOriginUrl(rawPreviewImage, cleanOrigin);
  const imageWidth = post.socialPreviewImageWidth || 1200;
  const imageHeight = post.socialPreviewImageHeight || 630;
  const mimeType = previewImageUrl.toLowerCase().endsWith('.png') ? 'image/png' : 'image/jpeg';
  const description = post.description || post.excerpt;
  const titleAttr = escapeHtml(post.title);
  const descAttr = escapeHtml(description);
  const urlAttr = escapeHtml(pageUrl);
  const imgAttr = escapeHtml(previewImageUrl);
  const coverAltAttr = escapeHtml(post.coverImageAlt || post.title);
  const authorDisplay = post.authorRole ? `${post.author} (${post.authorRole})` : post.author;

  let html = templateHtml.replaceAll('%LINKHUB_ORIGIN%', cleanOrigin);

  html = html.replace(/<title>[\s\S]*?<\/title>/i, `<title>${escapeHtml(`${post.title} | LinkHub`)}</title>`);
  html = upsertHeadTag(html, /<meta\s+name=["']description["'][^>]*>/i, `<meta name="description" content="${descAttr}" />`);
  html = upsertHeadTag(html, /<meta\s+property=["']og:type["'][^>]*>/i, `<meta property="og:type" content="article" />`);
  html = upsertHeadTag(html, /<meta\s+property=["']og:url["'][^>]*>/i, `<meta property="og:url" content="${urlAttr}" />`);
  html = upsertHeadTag(html, /<meta\s+property=["']og:title["'][^>]*>/i, `<meta property="og:title" content="${titleAttr}" />`);
  html = upsertHeadTag(html, /<meta\s+property=["']og:description["'][^>]*>/i, `<meta property="og:description" content="${descAttr}" />`);
  html = upsertHeadTag(html, /<meta\s+property=["']og:image["'][^>]*>/i, `<meta property="og:image" content="${imgAttr}" />`);
  html = upsertHeadTag(html, /<meta\s+property=["']og:image:secure_url["'][^>]*>/i, `<meta property="og:image:secure_url" content="${imgAttr}" />`);
  html = upsertHeadTag(html, /<meta\s+property=["']og:image:type["'][^>]*>/i, `<meta property="og:image:type" content="${mimeType}" />`);
  html = upsertHeadTag(html, /<meta\s+property=["']og:image:width["'][^>]*>/i, `<meta property="og:image:width" content="${imageWidth}" />`);
  html = upsertHeadTag(html, /<meta\s+property=["']og:image:height["'][^>]*>/i, `<meta property="og:image:height" content="${imageHeight}" />`);
  html = upsertHeadTag(html, /<meta\s+property=["']og:image:alt["'][^>]*>/i, `<meta property="og:image:alt" content="${coverAltAttr}" />`);

  html = upsertHeadTag(html, /<meta\s+itemprop=["']image["'][^>]*>/i, `<meta itemprop="image" content="${imgAttr}" />`);
  html = upsertHeadTag(html, /<link\s+rel=["']image_src["'][^>]*>/i, `<link rel="image_src" href="${imgAttr}" />`);
  html = upsertHeadTag(html, /<link\s+rel=["']canonical["'][^>]*>/i, `<link rel="canonical" href="${urlAttr}" />`);

  html = upsertHeadTag(html, /<meta\s+(?:property|name)=["']twitter:card["'][^>]*>/i, `<meta name="twitter:card" content="summary_large_image" />`);
  html = upsertHeadTag(html, /<meta\s+(?:property|name)=["']twitter:url["'][^>]*>/i, `<meta name="twitter:url" content="${urlAttr}" />`);
  html = upsertHeadTag(html, /<meta\s+(?:property|name)=["']twitter:title["'][^>]*>/i, `<meta name="twitter:title" content="${titleAttr}" />`);
  html = upsertHeadTag(html, /<meta\s+(?:property|name)=["']twitter:description["'][^>]*>/i, `<meta name="twitter:description" content="${descAttr}" />`);
  html = upsertHeadTag(html, /<meta\s+(?:property|name)=["']twitter:image["'][^>]*>/i, `<meta name="twitter:image" content="${imgAttr}" />`);
  html = upsertHeadTag(html, /<meta\s+(?:property|name)=["']twitter:image:src["'][^>]*>/i, `<meta name="twitter:image:src" content="${imgAttr}" />`);
  html = upsertHeadTag(html, /<meta\s+(?:property|name)=["']twitter:image:alt["'][^>]*>/i, `<meta name="twitter:image:alt" content="${coverAltAttr}" />`);

  if (post.publishedTime) {
    html = upsertHeadTag(
      html,
      /<meta\s+property=["']article:published_time["'][^>]*>/i,
      `<meta property="article:published_time" content="${escapeHtml(post.publishedTime)}" />`,
    );
  }

  // Pre-render article header, cover, body, and tags so crawlers and readers get instant HTML
  html = html.replace(
    /<article\b([^>]*)>/i,
    `<article$1 data-prerendered-id="${escapeHtml(post.id)}" data-share-path="${escapeHtml(getBlogPostPath(post))}">`,
  );
  html = html.replace(
    /(<div id="blog-category"[^>]*>)[\s\S]*?(<\/div>)/i,
    `$1${escapeHtml(post.category)}$2`,
  );
  html = html.replace(
    /(<h1 id="blog-title"[^>]*>)[\s\S]*?(<\/h1>)/i,
    `$1${escapeHtml(post.title)}$2`,
  );
  html = html.replace(
    /(<p id="blog-excerpt"[^>]*>)[\s\S]*?(<\/p>)/i,
    `$1${escapeHtml(post.excerpt)}$2`,
  );
  html = html.replace(
    /(<span id="blog-author"[^>]*>)[\s\S]*?(<\/span>)/i,
    `$1${escapeHtml(authorDisplay)}$2`,
  );
  html = html.replace(
    /(<span id="blog-date"[^>]*>)[\s\S]*?(<\/span>)/i,
    `$1${escapeHtml(post.date)}$2`,
  );
  html = html.replace(
    /(<span id="blog-read-time"[^>]*>)[\s\S]*?(<\/span>)/i,
    `$1${escapeHtml(post.readTime)}$2`,
  );
  html = html.replace(
    /<img id="blog-cover"[^>]*>/i,
    `<img id="blog-cover" src="${escapeHtml(post.coverImage)}" alt="${coverAltAttr}" class="w-full h-full object-cover" />`,
  );
  html = html.replace(
    /(<div id="blog-body"[^>]*>)[\s\S]*?(<\/div>\s*\n\s*<!-- Tags -->)/i,
    `$1\n${renderBlogBodyHtml(post, joinRedirectLink)}\n          $2`,
  );
  html = html.replace(
    /(<div id="blog-tags"[^>]*>)[\s\S]*?(<\/div>)/i,
    `$1${renderBlogTagsHtml(post.tags)}$2`,
  );

  return html;
}
