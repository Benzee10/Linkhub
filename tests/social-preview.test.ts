import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { onRequest } from '../functions/_middleware';
import { CONFIG } from '../src/config';
import {
  buildBlogIndex,
  loadAllBlogPosts,
  loadBlogPostById,
  prerenderBlogPostHtml,
} from '../scripts/blog-build';
import {
  buildSitemapXml,
  loadAllDirectoryPosts,
} from '../scripts/posts-build';
import { detectImageMetadata } from '../scripts/social-image-fetch';
import { renderPostCardHtml } from '../src/post-renderer';
import {
  isConfiguredPreviewLink,
  SOCIAL_PREVIEW_PLACEHOLDER,
} from '../src/social-preview';

const rootDir = process.cwd();

test('CONFIG uses Adsterra smart link https://html-starter-6nu.pages.dev and site origin https://blog.novaqueens.name.ng', () => {
  assert.equal(CONFIG.AD_SMART_LINK, 'https://html-starter-6nu.pages.dev');
  assert.equal(CONFIG.SITE_ORIGIN, 'https://blog.novaqueens.name.ng');
});

test('all blog posts live in the single /blogs folder and prerender static SEO/Open Graph HTML pages with JSON-LD', () => {
  const posts = loadAllBlogPosts(rootDir);
  assert.equal(posts.length, 4);
  assert.deepEqual(
    posts.map(p => p.id),
    [
      'how-to-make-a-girl-miss-you',
      'romantic-ways-to-ask-her-to-be-your-girlfriend',
      'signs-a-woman-has-just-slept-with-another-man',
      'how-to-find-and-join-active-whatsapp-groups-safely',
    ],
  );

  // Obsolete duplicate locations and multi-MB PNG should not exist
  assert.equal(fs.existsSync(path.join(rootDir, 'src/posts')), false);
  assert.equal(fs.existsSync(path.join(rootDir, 'public/blogs/romantic-girlfriend-featured.png')), false);
  assert.equal(fs.existsSync(path.join(rootDir, 'public/blogs/romantic-girlfriend-featured.webp')), true);
  assert.equal(fs.existsSync(path.join(rootDir, 'public/blogs/romantic-girlfriend-featured.jpg')), true);

  const indexPreview = buildBlogIndex(posts);
  assert.equal(indexPreview[0].url, '/how-to-make-a-girl-miss-you');
  assert.equal(indexPreview[1].url, '/romantic-ways-to-ask-her-to-be-your-girlfriend');
  assert.equal(indexPreview[2].url, '/signs-a-woman-has-just-slept-with-another-man');
  assert.equal(indexPreview[3].url, '/how-to-find-and-join-active-whatsapp-groups-safely');

  const templateHtml = fs.readFileSync(path.join(rootDir, 'blog-post.html'), 'utf-8');
  const missYou = loadBlogPostById(rootDir, 'how-to-make-a-girl-miss-you');
  assert.ok(missYou);

  const renderedMissYou = prerenderBlogPostHtml(
    templateHtml,
    missYou,
    CONFIG.SITE_ORIGIN,
    CONFIG.JOIN_REDIRECT_LINK,
  );

  const ogImages = [...renderedMissYou.matchAll(/<meta\s+property="og:image"\s+content="([^"]+)"/g)].map(m => m[1]);
  assert.deepEqual(ogImages, ['https://blog.novaqueens.name.ng/blogs/how-to-make-a-girl-miss-you-preview.jpg']);
  assert.match(
    renderedMissYou,
    /<meta property="og:image:secure_url" content="https:\/\/blog\.novaqueens\.name\.ng\/blogs\/how-to-make-a-girl-miss-you-preview\.jpg" \/>/,
  );
  assert.match(
    renderedMissYou,
    /<meta name="twitter:image" content="https:\/\/blog\.novaqueens\.name\.ng\/blogs\/how-to-make-a-girl-miss-you-preview\.jpg" \/>/,
  );
  assert.match(
    renderedMissYou,
    /<link rel="canonical" href="https:\/\/blog\.novaqueens\.name\.ng\/how-to-make-a-girl-miss-you" \/>/,
  );
  assert.match(renderedMissYou, /<script type="application\/ld\+json">/);
  assert.match(renderedMissYou, /data-prerendered-id="how-to-make-a-girl-miss-you"/);
  assert.equal(fs.existsSync(path.join(rootDir, 'public/blogs/how-to-make-a-girl-miss-you-preview.jpg')), true);

  // Verify relationship trust post uses .webp in-page cover and .jpg OG preview image
  const trustPost = loadBlogPostById(rootDir, 'signs-a-woman-has-just-slept-with-another-man');
  assert.ok(trustPost);
  const renderedTrust = prerenderBlogPostHtml(
    templateHtml,
    trustPost,
    CONFIG.SITE_ORIGIN,
    CONFIG.JOIN_REDIRECT_LINK,
  );
  assert.equal(renderedTrust.includes('how-to-make-a-girl-miss-you-preview.jpg'), false);
  assert.match(
    renderedTrust,
    /<meta property="og:image" content="https:\/\/blog\.novaqueens\.name\.ng\/blogs\/relationship-trust-featured\.jpg" \/>/,
  );
  assert.match(renderedTrust, /id="blog-cover" src="\/blogs\/relationship-trust-featured\.webp"/);
  assert.match(renderedTrust, /<h3[^>]*>1\. Rushing Straight to Shower or Change Out of Habit<\/h3>/);
  assert.match(renderedTrust, /<blockquote[^>]*>/);
  assert.match(renderedTrust, /<ul class="list-disc/);
});

test('Cloudflare Pages middleware injects social meta + canonical on /blog-post(.html)?id=...', async () => {
  const blogPostTemplate = fs.readFileSync(path.join(rootDir, 'blog-post.html'), 'utf-8');
  const missYouJson = fs.readFileSync(path.join(rootDir, 'blogs/how-to-make-a-girl-miss-you.json'), 'utf-8');
  const romanticJson = fs.readFileSync(path.join(rootDir, 'blogs/romantic-ways-to-ask-her-to-be-your-girlfriend.json'), 'utf-8');

  const assets = {
    async fetch(input: Request | URL | string) {
      const reqUrl = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url);
      if (reqUrl.pathname === '/blog-post') {
        return new Response(blogPostTemplate, { status: 200, headers: { 'content-type': 'text/html; charset=utf-8' } });
      }
      if (reqUrl.pathname === '/blogs/how-to-make-a-girl-miss-you.json') {
        return new Response(missYouJson, { status: 200, headers: { 'content-type': 'application/json' } });
      }
      if (reqUrl.pathname === '/blogs/romantic-ways-to-ask-her-to-be-your-girlfriend.json') {
        return new Response(romanticJson, { status: 200, headers: { 'content-type': 'application/json' } });
      }
      return new Response('Not found', { status: 404 });
    },
  };

  const missYouRes = await onRequest({
    request: new Request('https://blog.novaqueens.name.ng/blog-post.html?id=how-to-make-a-girl-miss-you'),
    next: async () => new Response(null, { status: 308, headers: { location: '/blog-post?id=how-to-make-a-girl-miss-you' } }),
    env: { ASSETS: assets },
  });
  assert.equal(missYouRes.status, 200);
  const missYouHtml = await missYouRes.text();
  assert.match(missYouHtml, /<meta property="og:image" content="https:\/\/blog\.novaqueens\.name\.ng\/blogs\/how-to-make-a-girl-miss-you-preview\.jpg" \/>/);
  assert.match(missYouHtml, /<link rel="canonical" href="https:\/\/blog\.novaqueens\.name\.ng\/how-to-make-a-girl-miss-you" \/>/);
  assert.match(missYouHtml, /<meta property="og:image:width" content="1280" \/>/);
  assert.match(missYouHtml, /<meta property="og:image:height" content="720" \/>/);

  const otherRes = await onRequest({
    request: new Request('https://blog.novaqueens.name.ng/blog-post?id=romantic-ways-to-ask-her-to-be-your-girlfriend'),
    next: async () => new Response(blogPostTemplate, { status: 200, headers: { 'content-type': 'text/html; charset=utf-8' } }),
    env: { ASSETS: assets },
  });
  const otherHtml = await otherRes.text();
  assert.equal(otherHtml.includes('how-to-make-a-girl-miss-you-preview.jpg'), false);
  assert.match(otherHtml, /<meta property="og:image" content="https:\/\/blog\.novaqueens\.name\.ng\/blogs\/romantic-girlfriend-featured\.jpg" \/>/);
});

test('Directory posts maintain 100% category consistency, SSR body pre-rendering, and preview-only social images', async () => {
  const dirPosts = loadAllDirectoryPosts(rootDir);
  assert.equal(dirPosts.length, 52);

  const postsIndex = JSON.parse(
    fs.readFileSync(path.join(rootDir, 'public/posts/index.json'), 'utf-8'),
  ) as Array<{ id: string; image: string; category: string }>;
  assert.equal(postsIndex.length, 52);

  for (const post of dirPosts) {
    assert.equal(typeof post.socialPreviewImage, 'string', `Missing socialPreviewImage in ${post.id}`);
    assert.equal(
      post.socialPreviewImage === SOCIAL_PREVIEW_PLACEHOLDER || isConfiguredPreviewLink(post.socialPreviewImage),
      true,
      `Invalid socialPreviewImage in ${post.id}`,
    );
    const indexEntry = postsIndex.find(item => item.id === post.id);
    assert.ok(indexEntry, `Missing ${post.id} in index.json`);
    assert.equal(indexEntry.category, post.category, `Category mismatch on ${post.id}`);
    assert.equal(indexEntry.image, post.image, `Image mismatch on ${post.id}`);
  }

  const postTemplate = fs.readFileSync(path.join(rootDir, 'post.html'), 'utf-8');
  const nigerianJson = fs.readFileSync(path.join(rootDir, 'public/posts/nigerian-girls.json'), 'utf-8');
  const kenyanJson = fs.readFileSync(path.join(rootDir, 'public/posts/kenyan-girls.json'), 'utf-8');
  const moroccoJson = fs.readFileSync(path.join(rootDir, 'public/posts/morocco-girls.json'), 'utf-8');

  const assets = {
    async fetch(input: Request | URL | string) {
      const reqUrl = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url);
      if (reqUrl.pathname === '/post') {
        return new Response(postTemplate, { status: 200, headers: { 'content-type': 'text/html; charset=utf-8' } });
      }
      if (reqUrl.pathname === '/posts/nigerian-girls.json') {
        return new Response(nigerianJson, { status: 200, headers: { 'content-type': 'application/json' } });
      }
      if (reqUrl.pathname === '/posts/kenyan-girls.json') {
        return new Response(kenyanJson, { status: 200, headers: { 'content-type': 'application/json' } });
      }
      if (reqUrl.pathname === '/posts/morocco-girls.json') {
        return new Response(moroccoJson, { status: 200, headers: { 'content-type': 'application/json' } });
      }
      return new Response('Not found', { status: 404 });
    },
  };

  const ngRes = await onRequest({
    request: new Request('https://blog.novaqueens.name.ng/post.html?id=nigerian-girls'),
    next: async () => new Response(null, { status: 308, headers: { location: '/post?id=nigerian-girls' } }),
    env: { ASSETS: assets },
  });
  assert.equal(ngRes.status, 200);
  const ngHtml = await ngRes.text();
  assert.match(ngHtml, /<title>Nigerian Girls WhatsApp Group Links \| LinkHub<\/title>/);
  assert.match(ngHtml, /<link rel="canonical" href="https:\/\/blog\.novaqueens\.name\.ng\/post\?id=nigerian-girls" \/>/);
  assert.match(
    ngHtml,
    /<meta property="og:image" content="https:\/\/blog\.novaqueens\.name\.ng\/preview\/nigerian-girls\.jpg" \/>/,
  );
  // Verify SSR body pre-rendering rendered group cards & h1 while keeping social preview image out of body
  const bodyHtml = ngHtml.split('</head>')[1] || '';
  assert.match(bodyHtml, /data-prerendered-id="nigerian-girls"/);
  assert.match(bodyHtml, /LagosHotGirls/);
  assert.equal(bodyHtml.includes('nigerian-girls.jpg'), false);
  assert.equal(bodyHtml.includes('20261107-110742.jpg'), false);

  const keRes = await onRequest({
    request: new Request('https://blog.novaqueens.name.ng/post.html?id=kenyan-girls'),
    next: async () => new Response(null, { status: 308, headers: { location: '/post?id=kenyan-girls' } }),
    env: { ASSETS: assets },
  });
  const keHtml = await keRes.text();
  assert.equal(keHtml.includes('/preview/nigerian-girls.jpg'), false);
  assert.match(
    keHtml,
    /<meta property="og:image" content="https:\/\/blog\.novaqueens\.name\.ng\/preview\/kenyan-girls\.jpg" \/>/,
  );

  // Post with unfilled placeholder falls back cleanly to post.image
  const maRes = await onRequest({
    request: new Request('https://blog.novaqueens.name.ng/post?id=morocco-girls'),
    next: async () => new Response(postTemplate, { status: 200, headers: { 'content-type': 'text/html; charset=utf-8' } }),
    env: { ASSETS: assets },
  });
  const maHtml = await maRes.text();
  assert.equal(maHtml.includes(SOCIAL_PREVIEW_PLACEHOLDER), false);
  assert.match(maHtml, /<meta property="og:image" content="https:\/\/encrypted-tbn0\.gstatic\.com\/[^"]+" \/>/);

  const sampleJpeg = new Uint8Array(
    fs.readFileSync(path.join(rootDir, 'public/blogs/how-to-make-a-girl-miss-you-preview.jpg')),
  );
  assert.deepEqual(detectImageMetadata(sampleJpeg), {
    width: 1280,
    height: 720,
    mimeType: 'image/jpeg',
  });
});

test('Cloudflare optimization files, XML sitemap, and XSS escaping work properly', () => {
  assert.equal(fs.existsSync(path.join(rootDir, 'public/_routes.json')), true);
  assert.equal(fs.existsSync(path.join(rootDir, 'public/_headers')), true);
  assert.equal(fs.existsSync(path.join(rootDir, 'public/robots.txt')), true);
  assert.equal(fs.existsSync(path.join(rootDir, 'public/404.html')), true);
  assert.equal(fs.existsSync(path.join(rootDir, 'public/og-default.jpg')), true);

  const blogPosts = loadAllBlogPosts(rootDir);
  const dirPosts = loadAllDirectoryPosts(rootDir);
  const sitemap = buildSitemapXml(CONFIG.SITE_ORIGIN, blogPosts, dirPosts);
  assert.match(sitemap, /<loc>https:\/\/blog\.novaqueens\.name\.ng\/<\/loc>/);
  assert.match(sitemap, /<loc>https:\/\/blog\.novaqueens\.name\.ng\/blog<\/loc>/);
  assert.match(sitemap, /<loc>https:\/\/blog\.novaqueens\.name\.ng\/how-to-make-a-girl-miss-you<\/loc>/);
  assert.match(sitemap, /<loc>https:\/\/blog\.novaqueens\.name\.ng\/post\?id=nigerian-girls<\/loc>/);

  // Verify XSS escaping and javascript: URL rejection in post card renderer
  const maliciousCard = renderPostCardHtml({
    id: 'test-xss',
    title: '<img src=x onerror=alert(1)>',
    description: 'Safe & "escaped"',
    image: 'javascript:alert(1)',
    category: '<script>evil()</script>',
  });
  assert.equal(maliciousCard.includes('<script>'), false);
  assert.equal(maliciousCard.includes('javascript:'), false);
  assert.match(maliciousCard, /&lt;img src=x onerror=alert\(1\)&gt;/);
});
