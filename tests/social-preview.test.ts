import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { onRequest } from '../functions/_middleware';
import { howToMakeAGirlMissYou } from '../src/posts/how-to-make-a-girl-miss-you';

const rootDir = process.cwd();

test('standalone how-to-make-a-girl-miss-you HTML uses the dedicated first-party preview JPEG unambiguously', () => {
  const html = fs.readFileSync(path.join(rootDir, 'how-to-make-a-girl-miss-you.html'), 'utf-8');
  const ogImages = [...html.matchAll(/<meta\s+property="og:image"\s+content="([^"]+)"/g)].map(m => m[1]);

  assert.deepEqual(ogImages, ['%LINKHUB_ORIGIN%/blogs/how-to-make-a-girl-miss-you-preview.jpg']);
  assert.match(html, /<meta property="og:image:secure_url" content="%LINKHUB_ORIGIN%\/blogs\/how-to-make-a-girl-miss-you-preview\.jpg" \/>/);
  assert.match(html, /<meta name="twitter:image" content="%LINKHUB_ORIGIN%\/blogs\/how-to-make-a-girl-miss-you-preview\.jpg" \/>/);
  assert.equal(fs.existsSync(path.join(rootDir, 'public/blogs/how-to-make-a-girl-miss-you-preview.jpg')), true);
});

test('homepage and post data link directly to /how-to-make-a-girl-miss-you with matching socialPreviewImage', () => {
  const indexHtml = fs.readFileSync(path.join(rootDir, 'index.html'), 'utf-8');
  assert.equal(indexHtml.includes('/blog-post.html?id=how-to-make-a-girl-miss-you'), false);
  assert.equal(indexHtml.includes('href="/how-to-make-a-girl-miss-you"'), true);

  const blogJson = JSON.parse(fs.readFileSync(path.join(rootDir, 'public/blogs/how-to-make-a-girl-miss-you.json'), 'utf-8'));
  assert.equal(blogJson.socialPreviewImage, '/blogs/how-to-make-a-girl-miss-you-preview.jpg');
  assert.equal(blogJson.url, '/how-to-make-a-girl-miss-you');
  assert.equal(howToMakeAGirlMissYou.socialPreviewImage, '/blogs/how-to-make-a-girl-miss-you-preview.jpg');
  assert.equal(howToMakeAGirlMissYou.url, '/how-to-make-a-girl-miss-you');
});

test('Cloudflare Pages middleware injects how-to-make-a-girl-miss-you preview image on /blog-post(.html)?id=how-to-make-a-girl-miss-you only', async () => {
  const blogPostTemplate = fs.readFileSync(path.join(rootDir, 'blog-post.html'), 'utf-8');
  const missYouJson = fs.readFileSync(path.join(rootDir, 'public/blogs/how-to-make-a-girl-miss-you.json'), 'utf-8');
  const romanticJson = fs.readFileSync(path.join(rootDir, 'public/blogs/romantic-ways-to-ask-her-to-be-your-girlfriend.json'), 'utf-8');

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
    request: new Request('https://linkhubi.pages.dev/blog-post.html?id=how-to-make-a-girl-miss-you'),
    next: async () => new Response(null, { status: 308, headers: { location: '/blog-post?id=how-to-make-a-girl-miss-you' } }),
    env: { ASSETS: assets },
  });
  assert.equal(missYouRes.status, 200);
  const missYouHtml = await missYouRes.text();
  assert.match(missYouHtml, /<meta property="og:image" content="https:\/\/linkhubi\.pages\.dev\/blogs\/how-to-make-a-girl-miss-you-preview\.jpg" \/>/);
  assert.match(missYouHtml, /<meta name="twitter:image" content="https:\/\/linkhubi\.pages\.dev\/blogs\/how-to-make-a-girl-miss-you-preview\.jpg" \/>/);
  assert.match(missYouHtml, /<meta property="og:image:width" content="1280" \/>/);
  assert.match(missYouHtml, /<meta property="og:image:height" content="720" \/>/);

  // 2. Other posts keep their own preview image and never show how-to-make-a-girl-miss-you-preview.jpg
  const otherRes = await onRequest({
    request: new Request('https://linkhubi.pages.dev/blog-post?id=romantic-ways-to-ask-her-to-be-your-girlfriend'),
    next: async () => new Response(blogPostTemplate, { status: 200, headers: { 'content-type': 'text/html; charset=utf-8' } }),
    env: { ASSETS: assets },
  });
  const otherHtml = await otherRes.text();
  assert.equal(otherHtml.includes('how-to-make-a-girl-miss-you-preview.jpg'), false);
  assert.match(otherHtml, /<meta property="og:image" content="https:\/\/linkhubi\.pages\.dev\/blogs\/romantic-girlfriend-featured\.png" \/>/);
});
