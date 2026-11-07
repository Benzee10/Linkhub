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

const rootDir = process.cwd();

test('CONFIG uses Adsterra smart link https://html-starter-6nu.pages.dev and site origin https://blog.novaqueens.name.ng', () => {
  assert.equal(CONFIG.AD_SMART_LINK, 'https://html-starter-6nu.pages.dev');
  assert.equal(CONFIG.SITE_ORIGIN, 'https://blog.novaqueens.name.ng');
});

test('all blog posts live in the single /blogs folder and prerender static SEO/Open Graph HTML pages', () => {
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

  // Obsolete duplicate locations should not exist
  assert.equal(fs.existsSync(path.join(rootDir, 'src/posts')), false);
  assert.equal(fs.existsSync(path.join(rootDir, 'how-to-make-a-girl-miss-you.html')), false);
  assert.equal(fs.existsSync(path.join(rootDir, 'signs-a-woman-has-just-slept-with-another-man.html')), false);
  assert.equal(fs.existsSync(path.join(rootDir, 'public/blogs/index.json')), false);

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
  assert.match(renderedMissYou, /data-prerendered-id="how-to-make-a-girl-miss-you"/);
  assert.equal(fs.existsSync(path.join(rootDir, 'public/blogs/how-to-make-a-girl-miss-you-preview.jpg')), true);

  // Verify relationship trust post preserves h2, h3, bullets, quote, and its own preview image
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
  assert.match(renderedTrust, /<h3[^>]*>1\. Rushing Straight to Shower or Change Out of Habit<\/h3>/);
  assert.match(renderedTrust, /<blockquote[^>]*>/);
  assert.match(renderedTrust, /<ul class="list-disc/);
});

test('Cloudflare Pages middleware injects how-to-make-a-girl-miss-you preview image on /blog-post(.html)?id=how-to-make-a-girl-miss-you only', async () => {
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

  // 1. Legacy .html query URL (even if static layer returns 308 to clean URL)
  const missYouRes = await onRequest({
    request: new Request('https://blog.novaqueens.name.ng/blog-post.html?id=how-to-make-a-girl-miss-you'),
    next: async () => new Response(null, { status: 308, headers: { location: '/blog-post?id=how-to-make-a-girl-miss-you' } }),
    env: { ASSETS: assets },
  });
  assert.equal(missYouRes.status, 200);
  const missYouHtml = await missYouRes.text();
  assert.match(missYouHtml, /<meta property="og:image" content="https:\/\/blog\.novaqueens\.name\.ng\/blogs\/how-to-make-a-girl-miss-you-preview\.jpg" \/>/);
  assert.match(missYouHtml, /<meta name="twitter:image" content="https:\/\/blog\.novaqueens\.name\.ng\/blogs\/how-to-make-a-girl-miss-you-preview\.jpg" \/>/);
  assert.match(missYouHtml, /<meta property="og:image:width" content="1280" \/>/);
  assert.match(missYouHtml, /<meta property="og:image:height" content="720" \/>/);

  // 2. Other posts keep their own preview image and never show how-to-make-a-girl-miss-you-preview.jpg
  const otherRes = await onRequest({
    request: new Request('https://blog.novaqueens.name.ng/blog-post?id=romantic-ways-to-ask-her-to-be-your-girlfriend'),
    next: async () => new Response(blogPostTemplate, { status: 200, headers: { 'content-type': 'text/html; charset=utf-8' } }),
    env: { ASSETS: assets },
  });
  const otherHtml = await otherRes.text();
  assert.equal(otherHtml.includes('how-to-make-a-girl-miss-you-preview.jpg'), false);
  assert.match(otherHtml, /<meta property="og:image" content="https:\/\/blog\.novaqueens\.name\.ng\/blogs\/romantic-girlfriend-featured\.png" \/>/);
});
