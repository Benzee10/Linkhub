import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import fs from 'node:fs';
import path from 'node:path';
import { defineConfig, loadEnv } from 'vite';
import { CONFIG } from './src/config';
import { renderHomeFeaturedBlogCardHtml } from './src/blog-renderer';
import {
  buildBlogIndex,
  loadAllBlogPosts,
  prerenderBlogPostHtml,
} from './scripts/blog-build';
import { buildDirectoryPostSocialPreviews } from './scripts/social-image-fetch';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');
  // Keep canonical and social links on the public production site, even for previews.
  const productionOrigin = (env.LINKHUB_PUBLIC_ORIGIN || CONFIG.SITE_ORIGIN).replace(/\/+$/, '');
  const rootDir = __dirname;

  return {
    plugins: [
      react(),
      tailwindcss(),
      {
        name: 'linkhub-single-blogs-folder',
        transformIndexHtml: {
          order: 'pre',
          handler(html, ctx) {
            let transformed = html.replaceAll('%LINKHUB_ORIGIN%', productionOrigin);

            // Pre-render the top 3 Featured Guides on index.html directly from /blogs/*.json
            if (ctx.filename.endsWith('index.html')) {
              const posts = loadAllBlogPosts(rootDir);
              const previews = buildBlogIndex(posts).slice(0, 3);
              if (previews.length > 0) {
                const cardsHtml = previews.map(renderHomeFeaturedBlogCardHtml).join('\n');
                transformed = transformed.replace(
                  /(<div id="home-blog-container"[^>]*>)[\s\S]*?(<\/div>\s*\n\s*<\/section>)/i,
                  `$1\n${cardsHtml}\n        $2`,
                );
              }
            }

            return transformed;
          },
        },
        async closeBundle() {
          const distDir = path.resolve(rootDir, 'dist');
          await buildDirectoryPostSocialPreviews(rootDir, distDir, productionOrigin);

          const blogPostTemplatePath = path.join(distDir, 'blog-post.html');
          if (!fs.existsSync(blogPostTemplatePath)) return;

          const templateHtml = fs.readFileSync(blogPostTemplatePath, 'utf-8');
          const posts = loadAllBlogPosts(rootDir);
          const blogsOutDir = path.join(distDir, 'blogs');
          fs.mkdirSync(blogsOutDir, { recursive: true });

          // Write /blogs/index.json and /blogs/<slug>.json into dist/blogs/
          const indexPayload = buildBlogIndex(posts);
          fs.writeFileSync(
            path.join(blogsOutDir, 'index.json'),
            `${JSON.stringify(indexPayload, null, 2)}\n`,
            'utf-8',
          );

          for (const post of posts) {
            fs.writeFileSync(
              path.join(blogsOutDir, `${post.id}.json`),
              `${JSON.stringify(post, null, 2)}\n`,
              'utf-8',
            );

            // Emit full static SEO & Open Graph HTML page at dist/<slug>.html
            const renderedHtml = prerenderBlogPostHtml(
              templateHtml,
              post,
              productionOrigin,
              CONFIG.JOIN_REDIRECT_LINK,
            );
            fs.writeFileSync(path.join(distDir, `${post.id}.html`), renderedHtml, 'utf-8');
          }
        },
      },
    ],
    define: {
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
    },
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
      // Allow Arena's proxied preview hosts while retaining Vite's host checks.
      allowedHosts: ['.e2b.app'],
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
    },
  };
});
