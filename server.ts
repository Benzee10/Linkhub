import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { createServer as createViteServer } from 'vite';
import {
  injectSocialMetaIntoHtml,
  prerenderDirectoryPostBodyIntoHtml,
} from './functions/_middleware';
import {
  buildBlogIndex,
  loadAllBlogPosts,
  loadBlogPostById,
  prerenderBlogPostHtml,
} from './scripts/blog-build';
import {
  buildDirectoryPostsIndex,
  loadAllDirectoryPosts,
} from './scripts/posts-build';
import { fetchVerifiedImageBytes } from './scripts/social-image-fetch';
import { CONFIG } from './src/config';
import { DirectoryPostDetail } from './src/post-renderer';
import {
  getRemoteSocialPreviewSource,
  resolveDirectoryPostPreviewImage,
} from './src/social-preview';

const DEFAULT_ORIGIN = new URL(CONFIG.SITE_ORIGIN);

function sanitizeHostHeader(rawHost: string | undefined): string {
  if (!rawHost) return DEFAULT_ORIGIN.host;
  const firstHost = rawHost.split(',')[0].trim();
  return /^[a-z0-9.:-]+$/i.test(firstHost) ? firstHost : DEFAULT_ORIGIN.host;
}

async function startServer() {
  const app = express();
  const PORT = 3000;
  const rootDir = process.cwd();

  const getOrigin = (req: express.Request): string => {
    const host = sanitizeHostHeader(req.get('x-forwarded-host') || req.get('host'));
    const rawProto = (req.get('x-forwarded-proto') || req.protocol || 'https').split(',')[0].trim();
    const proto = rawProto === 'http' ? 'http' : 'https';
    return `${proto}://${host}`;
  };

  const getAbsoluteUrl = (req: express.Request, relativeOrAbsoluteUrl: string): string => {
    const origin = getOrigin(req);
    if (!relativeOrAbsoluteUrl) return origin;
    if (relativeOrAbsoluteUrl.startsWith('http://') || relativeOrAbsoluteUrl.startsWith('https://')) {
      return relativeOrAbsoluteUrl;
    }
    const cleanPath = relativeOrAbsoluteUrl.startsWith('/')
      ? relativeOrAbsoluteUrl
      : `/${relativeOrAbsoluteUrl}`;
    return `${origin}${cleanPath}`;
  };

  let vite: Awaited<ReturnType<typeof createViteServer>> | null = null;

  const renderBlogPostPage = async (
    req: express.Request,
    res: express.Response,
    postId: string,
  ): Promise<boolean> => {
    const isProd = process.env.NODE_ENV === 'production';
    const builtStaticPath = path.resolve(rootDir, 'dist', `${postId}.html`);
    if (isProd && fs.existsSync(builtStaticPath)) {
      const html = fs.readFileSync(builtStaticPath, 'utf-8');
      res.status(200).set({ 'Content-Type': 'text/html; charset=utf-8' }).end(html);
      return true;
    }

    const post = loadBlogPostById(rootDir, postId);
    if (!post) return false;

    let templatePath = path.resolve(rootDir, isProd ? 'dist/blog-post.html' : 'blog-post.html');
    if (!fs.existsSync(templatePath)) {
      templatePath = path.resolve(rootDir, 'blog-post.html');
    }
    let template = fs.readFileSync(templatePath, 'utf-8');
    template = prerenderBlogPostHtml(template, post, getOrigin(req), CONFIG.JOIN_REDIRECT_LINK);

    if (vite) {
      template = await vite.transformIndexHtml(req.originalUrl, template);
    }

    res.status(200).set({ 'Content-Type': 'text/html; charset=utf-8' }).end(template);
    return true;
  };

  app.get('/posts/index.json', (_req, res) => {
    const posts = loadAllDirectoryPosts(rootDir);
    res.status(200).json(buildDirectoryPostsIndex(posts));
  });

  app.get('/blogs/index.json', (_req, res) => {
    const posts = loadAllBlogPosts(rootDir);
    res.status(200).json(buildBlogIndex(posts));
  });

  app.get('/blogs/:slug.json', (req, res, next) => {
    const slug = Array.isArray(req.params.slug) ? req.params.slug[0] : req.params.slug;
    const post = loadBlogPostById(rootDir, slug);
    if (!post) return next();
    res.status(200).json(post);
  });

  app.get(['/preview/:slug.jpg', '/preview-image/:slug.jpg'], async (req, res) => {
    const rawSlug = req.params.slug;
    const slug = Array.isArray(rawSlug) ? rawSlug[0] : rawSlug;
    if (!slug || !/^[a-z0-9-]+$/i.test(slug)) {
      return res.status(404).end();
    }

    const candidateLocalPaths = [
      path.resolve(rootDir, 'dist', 'preview', `${slug}.jpg`),
      path.resolve(rootDir, 'public', 'preview', `${slug}.jpg`),
      path.resolve(rootDir, 'public', 'blogs', `${slug}-preview.jpg`),
    ];

    for (const localPath of candidateLocalPaths) {
      if (fs.existsSync(localPath)) {
        res.setHeader('Content-Type', 'image/jpeg');
        res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
        res.setHeader('Access-Control-Allow-Origin', '*');
        return res.sendFile(localPath);
      }
    }

    const postDataPath = path.resolve(rootDir, 'public', 'posts', `${slug}.json`);
    if (fs.existsSync(postDataPath)) {
      const post = JSON.parse(fs.readFileSync(postDataPath, 'utf-8'));
      const remoteSource = getRemoteSocialPreviewSource(post);
      if (remoteSource) {
        const fetched = await fetchVerifiedImageBytes(
          remoteSource,
          post.socialPreviewImageFallback,
          4000,
        );
        if (fetched) {
          res.setHeader('Content-Type', fetched.meta.mimeType);
          res.setHeader('Cache-Control', 'public, max-age=86400');
          res.setHeader('Access-Control-Allow-Origin', '*');
          return res.status(200).send(Buffer.from(fetched.bytes));
        }
        return res.redirect(302, post.socialPreviewImageFallback || remoteSource);
      }
    }

    return res.status(404).end();
  });

  app.get(['/post', '/post.html'], async (req, res, next) => {
    try {
      const postId = typeof req.query.id === 'string' ? req.query.id : '';
      const isProd = process.env.NODE_ENV === 'production';
      let templatePath = path.resolve(rootDir, isProd ? 'dist/post.html' : 'post.html');
      if (!fs.existsSync(templatePath)) {
        templatePath = path.resolve(rootDir, 'post.html');
      }

      const origin = getOrigin(req);
      let template = fs.readFileSync(templatePath, 'utf-8').replaceAll('%LINKHUB_ORIGIN%', origin);

      if (postId && /^[a-z0-9-]+$/i.test(postId)) {
        const postDataPath = path.resolve(rootDir, 'public', 'posts', `${postId}.json`);
        if (fs.existsSync(postDataPath)) {
          const post = JSON.parse(fs.readFileSync(postDataPath, 'utf-8')) as DirectoryPostDetail;
          const previewImage = resolveDirectoryPostPreviewImage({
            id: post.id || postId,
            image: post.image,
            socialPreviewImage: post.socialPreviewImage,
          });
          const canonicalUrl = `${origin}/post?id=${encodeURIComponent(post.id || postId)}`;
          template = injectSocialMetaIntoHtml(template, {
            documentTitle: `${post.title} | LinkHub`,
            title: post.title,
            description: post.description,
            imageUrl: getAbsoluteUrl(req, previewImage),
            imageWidth: post.socialPreviewImageWidth || 1200,
            imageHeight: post.socialPreviewImageHeight || 630,
            pageUrl: `${origin}${req.originalUrl}`,
            canonicalUrl,
          });
          template = prerenderDirectoryPostBodyIntoHtml(template, post, CONFIG.JOIN_REDIRECT_LINK);
        }
      }

      if (vite) {
        template = await vite.transformIndexHtml(req.originalUrl, template);
      }

      res.status(200).set({ 'Content-Type': 'text/html; charset=utf-8' }).end(template);
    } catch (e) {
      if (vite && e instanceof Error) vite.ssrFixStacktrace(e);
      next(e);
    }
  });

  app.get(['/blog', '/blog.html'], async (req, res, next) => {
    try {
      const isProd = process.env.NODE_ENV === 'production';
      let templatePath = path.resolve(rootDir, isProd ? 'dist/blog.html' : 'blog.html');
      if (!fs.existsSync(templatePath)) {
        templatePath = path.resolve(rootDir, 'blog.html');
      }
      let template = fs.readFileSync(templatePath, 'utf-8').replaceAll('%LINKHUB_ORIGIN%', getOrigin(req));
      if (vite) {
        template = await vite.transformIndexHtml('/blog.html', template);
      }
      res.status(200).set({ 'Content-Type': 'text/html; charset=utf-8' }).end(template);
    } catch (e) {
      if (vite && e instanceof Error) vite.ssrFixStacktrace(e);
      next(e);
    }
  });

  app.get(['/blog-post', '/blog-post.html'], async (req, res, next) => {
    try {
      const postId = typeof req.query.id === 'string' ? req.query.id : '';
      if (!postId) {
        return res.redirect(302, '/blog');
      }
      const handled = await renderBlogPostPage(req, res, postId);
      if (handled) return;
      next();
    } catch (e) {
      if (vite && e instanceof Error) vite.ssrFixStacktrace(e);
      next(e);
    }
  });

  app.get(['/:slug', '/blog/:slug'], async (req, res, next) => {
    try {
      const paramSlug = req.params.slug;
      const rawSlug = (Array.isArray(paramSlug) ? paramSlug[0] : paramSlug) || '';
      const slug = rawSlug.replace(/\.html$/i, '');
      if (!slug || ['index', 'post', 'blog', 'blog-post', '404'].includes(slug)) {
        return next();
      }
      const handled = await renderBlogPostPage(req, res, slug);
      if (!handled) return next();
    } catch (e) {
      if (vite && e instanceof Error) vite.ssrFixStacktrace(e);
      next(e);
    }
  });

  if (process.env.NODE_ENV !== 'production') {
    vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'custom',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(rootDir, 'dist')));
  }

  app.use(async (req, res, next) => {
    if (req.method !== 'GET' && req.method !== 'HEAD') return next();
    try {
      const isRoot = req.path === '/' || req.path === '/index.html';
      if (!isRoot) {
        const notFoundPath = path.resolve(rootDir, 'public', '404.html');
        if (fs.existsSync(notFoundPath)) {
          return res
            .status(404)
            .set({ 'Content-Type': 'text/html; charset=utf-8' })
            .end(fs.readFileSync(notFoundPath, 'utf-8'));
        }
        return res.status(404).end('Not Found');
      }

      const templatePath = path.resolve(rootDir, 'index.html');
      let template = fs.readFileSync(templatePath, 'utf-8').replaceAll('%LINKHUB_ORIGIN%', getOrigin(req));
      if (vite) {
        template = await vite.transformIndexHtml('/index.html', template);
      }
      res.status(200).set({ 'Content-Type': 'text/html; charset=utf-8' }).end(template);
    } catch (e) {
      if (vite && e instanceof Error) vite.ssrFixStacktrace(e);
      next(e);
    }
  });

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
