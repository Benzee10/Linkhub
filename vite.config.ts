import tailwindcss from '@tailwindcss/vite';
import fs from 'node:fs';
import path from 'node:path';
import { defineConfig, loadEnv } from 'vite';
import {
  renderBlogIndexCardHtml,
  renderHomeFeaturedBlogCardHtml,
} from './src/blog-renderer';
import { CONFIG } from './src/config';
import { renderPostCardHtml } from './src/post-renderer';
import {
  buildBlogIndex,
  loadAllBlogPosts,
  prerenderBlogPostHtml,
} from './scripts/blog-build';
import {
  buildBlogIndexJsonLd,
  buildDirectoryPostsIndex,
  buildHomeJsonLd,
  buildSitemapXml,
  loadAllDirectoryPosts,
  syncPublicPostsIndexIfNeeded,
} from './scripts/posts-build';
import { buildDirectoryPostSocialPreviews } from './scripts/social-image-fetch';

function injectJsonLdIntoHead(html: string, jsonLd: string): string {
  const tag = `<script type="application/ld+json">${jsonLd}</script>`;
  if (/<script\s+type=["']application\/ld\+json["'][^>]*>[\s\S]*?<\/script>/i.test(html)) {
    return html.replace(
      /<script\s+type=["']application\/ld\+json["'][^>]*>[\s\S]*?<\/script>/i,
      tag,
    );
  }
  return html.replace('</head>', `    ${tag}\n  </head>`);
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');
  const productionOrigin = (env.LINKHUB_PUBLIC_ORIGIN || CONFIG.SITE_ORIGIN).replace(/\/+$/, '');
  const rootDir = __dirname;

  return {
    plugins: [
      tailwindcss(),
      {
        name: 'linkhub-static-prerender',
        transformIndexHtml: {
          order: 'pre',
          handler(html, ctx) {
            let transformed = html.replaceAll('%LINKHUB_ORIGIN%', productionOrigin);

            // Pre-render Homepage: Trending carousel, full Directory grid, Featured Blog cards, and JSON-LD
            if (ctx.filename.endsWith('index.html')) {
              const dirPosts = loadAllDirectoryPosts(rootDir);
              const dirPreviews = syncPublicPostsIndexIfNeeded(rootDir, dirPosts);

              const trendingCardsHtml = dirPreviews
                .filter(p => p.trending)
                .map((p, idx) =>
                  renderPostCardHtml(p, { isTrending: true, eagerImage: idx === 0 }),
                )
                .join('\n');

              const directoryCardsHtml = dirPreviews
                .map(p => renderPostCardHtml(p, { isTrending: false, eagerImage: false }))
                .join('\n');

              if (trendingCardsHtml) {
                transformed = transformed.replace(
                  /<!-- TRENDING_GRID_START -->[\s\S]*?<!-- TRENDING_GRID_END -->/,
                  trendingCardsHtml,
                );
              }

              if (directoryCardsHtml) {
                transformed = transformed
                  .replace(
                    /<div id="posts-grid"([^>]*)>/i,
                    '<div id="posts-grid"$1 data-prerendered="true">',
                  )
                  .replace(
                    /<!-- POSTS_GRID_START -->[\s\S]*?<!-- POSTS_GRID_END -->/,
                    directoryCardsHtml,
                  );
              }

              const blogPosts = loadAllBlogPosts(rootDir);
              const blogPreviews = buildBlogIndex(blogPosts).slice(0, 3);
              if (blogPreviews.length > 0) {
                const cardsHtml = blogPreviews.map(renderHomeFeaturedBlogCardHtml).join('\n');
                transformed = transformed.replace(
                  /<!-- HOME_BLOG_START -->[\s\S]*?<!-- HOME_BLOG_END -->/,
                  cardsHtml,
                );
              }

              transformed = injectJsonLdIntoHead(transformed, buildHomeJsonLd(productionOrigin));
            }

            // Pre-render Blog Index (/blog): all article cards + Blog JSON-LD
            if (ctx.filename.endsWith('blog.html')) {
              const blogPosts = loadAllBlogPosts(rootDir);
              const blogPreviews = buildBlogIndex(blogPosts);
              if (blogPreviews.length > 0) {
                const cardsHtml = blogPreviews
                  .map((p, idx) => renderBlogIndexCardHtml(p, idx === 0))
                  .join('\n');
                transformed = transformed
                  .replace(
                    /<div id="blog-grid"([^>]*)>/i,
                    '<div id="blog-grid"$1 data-prerendered="true">',
                  )
                  .replace(
                    /<!-- BLOG_GRID_START -->[\s\S]*?<!-- BLOG_GRID_END -->/,
                    cardsHtml,
                  );
              }
              transformed = injectJsonLdIntoHead(
                transformed,
                buildBlogIndexJsonLd(productionOrigin, blogPosts),
              );
            }

            return transformed;
          },
        },
        async closeBundle() {
          const distDir = path.resolve(rootDir, 'dist');
          if (!fs.existsSync(distDir)) return;

          const directoryPosts = loadAllDirectoryPosts(rootDir);
          const directoryIndex = buildDirectoryPostsIndex(directoryPosts);
          const postsOutDir = path.join(distDir, 'posts');
          fs.mkdirSync(postsOutDir, { recursive: true });
          fs.writeFileSync(
            path.join(postsOutDir, 'index.json'),
            `${JSON.stringify(directoryIndex, null, 2)}\n`,
            'utf-8',
          );

          await buildDirectoryPostSocialPreviews(rootDir, distDir, productionOrigin);

          const blogPosts = loadAllBlogPosts(rootDir);
          const blogPostTemplatePath = path.join(distDir, 'blog-post.html');
          if (fs.existsSync(blogPostTemplatePath)) {
            const templateHtml = fs.readFileSync(blogPostTemplatePath, 'utf-8');
            const blogsOutDir = path.join(distDir, 'blogs');
            fs.mkdirSync(blogsOutDir, { recursive: true });

            const indexPayload = buildBlogIndex(blogPosts);
            fs.writeFileSync(
              path.join(blogsOutDir, 'index.json'),
              `${JSON.stringify(indexPayload, null, 2)}\n`,
              'utf-8',
            );

            for (const post of blogPosts) {
              fs.writeFileSync(
                path.join(blogsOutDir, `${post.id}.json`),
                `${JSON.stringify(post, null, 2)}\n`,
                'utf-8',
              );

              const renderedHtml = prerenderBlogPostHtml(
                templateHtml,
                post,
                productionOrigin,
                CONFIG.JOIN_REDIRECT_LINK,
              );
              fs.writeFileSync(path.join(distDir, `${post.id}.html`), renderedHtml, 'utf-8');
            }
          }

          // Emit complete XML sitemap covering /, /blog, blog articles, and directory posts
          const sitemapXml = buildSitemapXml(productionOrigin, blogPosts, directoryPosts);
          fs.writeFileSync(path.join(distDir, 'sitemap.xml'), sitemapXml, 'utf-8');
        },
      },
    ],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    build: {
      rollupOptions: {
        input: {
          main: path.resolve(__dirname, 'index.html'),
          post: path.resolve(__dirname, 'post.html'),
          blog: path.resolve(__dirname, 'blog.html'),
          blogPost: path.resolve(__dirname, 'blog-post.html'),
        },
      },
    },
    server: {
      allowedHosts: true,
      hmr: process.env.DISABLE_HMR !== 'true',
    },
  };
});
