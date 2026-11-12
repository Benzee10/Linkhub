import fs from 'node:fs';
import path from 'node:path';
import { BlogPost, escapeHtml, getBlogPostPath } from '../src/blog-renderer';
import {
  DirectoryPostDetail,
  DirectoryPostPreview,
} from '../src/post-renderer';

export const POSTS_PUBLIC_REL = path.join('public', 'posts');

export function loadAllDirectoryPosts(rootDir: string): DirectoryPostDetail[] {
  const postsDir = path.resolve(rootDir, POSTS_PUBLIC_REL);
  if (!fs.existsSync(postsDir)) return [];

  const files = fs
    .readdirSync(postsDir)
    .filter(f => f.endsWith('.json') && f !== 'index.json')
    .sort();

  const posts: DirectoryPostDetail[] = files.map(file => {
    const raw = fs.readFileSync(path.join(postsDir, file), 'utf-8');
    const parsed = JSON.parse(raw) as DirectoryPostDetail;
    const slug = file.replace(/\.json$/i, '');
    return {
      ...parsed,
      id: parsed.id || slug,
    };
  });

  return posts.sort((a, b) => {
    const orderA = typeof a.order === 'number' ? a.order : 999;
    const orderB = typeof b.order === 'number' ? b.order : 999;
    if (orderA !== orderB) return orderA - orderB;
    return a.id.localeCompare(b.id);
  });
}

export function buildDirectoryPostsIndex(posts: DirectoryPostDetail[]): DirectoryPostPreview[] {
  return posts.map(post => ({
    id: post.id,
    title: post.title,
    description: post.description,
    image: post.image,
    category: post.category,
    ...(post.keywords && post.keywords.length > 0 ? { keywords: post.keywords } : {}),
    ...(post.trending ? { trending: true } : {}),
  }));
}

export function syncPublicPostsIndexIfNeeded(rootDir: string, posts: DirectoryPostDetail[]): DirectoryPostPreview[] {
  const indexPayload = buildDirectoryPostsIndex(posts);
  const serialized = `${JSON.stringify(indexPayload, null, 2)}\n`;
  const publicIndexPath = path.resolve(rootDir, POSTS_PUBLIC_REL, 'index.json');
  const current = fs.existsSync(publicIndexPath) ? fs.readFileSync(publicIndexPath, 'utf-8') : '';
  if (current !== serialized) {
    fs.writeFileSync(publicIndexPath, serialized, 'utf-8');
  }
  return indexPayload;
}

export function buildSitemapXml(
  origin: string,
  blogPosts: BlogPost[],
  directoryPosts: DirectoryPostDetail[],
): string {
  const cleanOrigin = origin.replace(/\/+$/, '');
  const todayIso = new Date().toISOString().slice(0, 10);

  const entries: Array<{ loc: string; lastmod?: string; changefreq: string; priority: string }> = [
    { loc: `${cleanOrigin}/`, lastmod: todayIso, changefreq: 'daily', priority: '1.0' },
    { loc: `${cleanOrigin}/blog`, lastmod: todayIso, changefreq: 'weekly', priority: '0.9' },
  ];

  for (const post of blogPosts) {
    const postPath = getBlogPostPath(post);
    const lastmod = post.publishedTime ? post.publishedTime.slice(0, 10) : todayIso;
    entries.push({
      loc: `${cleanOrigin}${postPath}`,
      lastmod,
      changefreq: 'monthly',
      priority: '0.8',
    });
  }

  for (const post of directoryPosts) {
    entries.push({
      loc: `${cleanOrigin}/post?id=${encodeURIComponent(post.id)}`,
      lastmod: todayIso,
      changefreq: 'weekly',
      priority: post.trending ? '0.8' : '0.7',
    });
  }

  const urlsXml = entries
    .map(
      entry => `  <url>
    <loc>${escapeHtml(entry.loc)}</loc>
    ${entry.lastmod ? `<lastmod>${escapeHtml(entry.lastmod)}</lastmod>` : ''}
    <changefreq>${entry.changefreq}</changefreq>
    <priority>${entry.priority}</priority>
  </url>`,
    )
    .join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urlsXml}\n</urlset>\n`;
}

export function buildHomeJsonLd(origin: string): string {
  const cleanOrigin = origin.replace(/\/+$/, '');
  return JSON.stringify({
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Organization',
        name: 'LinkHub',
        url: `${cleanOrigin}/`,
        logo: `${cleanOrigin}/og-default.jpg`,
      },
      {
        '@type': 'WebSite',
        name: 'LinkHub',
        url: `${cleanOrigin}/`,
        description: 'The premium directory for high-quality WhatsApp group links and community safety guides.',
      },
    ],
  }).replaceAll('<', '\\u003c');
}

export function buildBlogIndexJsonLd(origin: string, blogPosts: BlogPost[]): string {
  const cleanOrigin = origin.replace(/\/+$/, '');
  return JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'Blog',
    name: 'LinkHub Blog & Community Guides',
    url: `${cleanOrigin}/blog`,
    description: 'Actionable tips, relationship insights, and community safety guides on LinkHub.',
    blogPost: blogPosts.map(p => ({
      '@type': 'BlogPosting',
      headline: p.title,
      url: `${cleanOrigin}${getBlogPostPath(p)}`,
      datePublished: p.publishedTime || undefined,
    })),
  }).replaceAll('<', '\\u003c');
}
