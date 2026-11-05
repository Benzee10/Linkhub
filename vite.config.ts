import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig, loadEnv} from 'vite';

export default defineConfig(({mode}) => {
  const env = loadEnv(mode, '.', '');
  // Keep canonical and social links on the public production site, even for previews.
  const productionOrigin = (env.LINKHUB_PUBLIC_ORIGIN || 'https://linkhubi.pages.dev').replace(/\/+$/, '');
  return {
    plugins: [
      react(),
      tailwindcss(),
      {
        name: 'article-production-origin',
        transformIndexHtml: {
          order: 'pre',
          handler(html) {
            return html.replaceAll('%LINKHUB_ORIGIN%', productionOrigin);
          },
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
          relationshipTrust: path.resolve(__dirname, 'signs-a-woman-has-just-slept-with-another-man.html'),
        },
      },
    },
    server: {
      // Allow Arena's proxied preview hosts while retaining Vite's host checks.
      allowedHosts: ['.e2b.app'],
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modifyâfile watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
    },
  };
});
