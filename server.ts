import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import fs from "fs";
import { CONFIG } from "./src/config";
import {
  buildBlogIndex,
  loadAllBlogPosts,
  loadBlogPostById,
  prerenderBlogPostHtml,
} from "./scripts/blog-build";
import { fetchVerifiedImageBytes } from "./scripts/social-image-fetch";

const DEFAULT_HOST = new URL(CONFIG.SITE_ORIGIN).host;

async function startServer() {
  const app = express();
  const PORT = 3000;
  const rootDir = process.cwd();

  const getOrigin = (req: express.Request): string => {
    const host = req.get("x-forwarded-host") || req.get("host") || DEFAULT_HOST;
    const proto = req.get("x-forwarded-proto") || req.protocol || "https";
    return `${proto}://${host}`;
  };

  const getAbsoluteUrl = (req: express.Request, relativeOrAbsoluteUrl: string): string => {
    const origin = getOrigin(req);
    if (!relativeOrAbsoluteUrl) {
      return origin;
    }
    if (relativeOrAbsoluteUrl.startsWith("http://") || relativeOrAbsoluteUrl.startsWith("https://")) {
      return relativeOrAbsoluteUrl;
    }
    const cleanPath = relativeOrAbsoluteUrl.startsWith("/") ? relativeOrAbsoluteUrl : `/${relativeOrAbsoluteUrl}`;
    return `${origin}${cleanPath}`;
  };

  const getPageUrl = (req: express.Request): string => `${getOrigin(req)}${req.originalUrl}`;

  const injectSocialMetaTags = (
    html: string,
    meta: {
      title: string;
      description: string;
      imageUrl: string;
      pageUrl: string;
      imageWidth?: number;
      imageHeight?: number;
    }
  ): string => {
    let result = html.replace(/<title>[\s\S]*?<\/title>/i, `<title>${meta.title}</title>`);

    const upsert = (pattern: RegExp, tag: string) => {
      if (pattern.test(result)) {
        result = result.replace(pattern, tag);
      } else {
        result = result.replace("</head>", `${tag}\n</head>`);
      }
    };

    const safeTitle = meta.title.replace(/"/g, "&quot;");
    const safeDesc = meta.description.replace(/"/g, "&quot;");
    const mimeType = meta.imageUrl.toLowerCase().endsWith(".png") ? "image/png" : "image/jpeg";
    const imgWidth = meta.imageWidth || 1200;
    const imgHeight = meta.imageHeight || 630;

    upsert(/<meta\s+name=["']description["'][^>]*>/i, `<meta name="description" content="${safeDesc}" />`);
    upsert(/<meta\s+property=["']og:title["'][^>]*>/i, `<meta property="og:title" content="${safeTitle}" />`);
    upsert(/<meta\s+property=["']og:description["'][^>]*>/i, `<meta property="og:description" content="${safeDesc}" />`);
    upsert(/<meta\s+property=["']og:image["'][^>]*>/i, `<meta property="og:image" content="${meta.imageUrl}" />`);
    if (meta.imageUrl.startsWith("https://")) {
      upsert(/<meta\s+property=["']og:image:secure_url["'][^>]*>/i, `<meta property="og:image:secure_url" content="${meta.imageUrl}" />`);
    }
    upsert(/<meta\s+property=["']og:image:type["'][^>]*>/i, `<meta property="og:image:type" content="${mimeType}" />`);
    upsert(/<meta\s+property=["']og:image:width["'][^>]*>/i, `<meta property="og:image:width" content="${imgWidth}" />`);
    upsert(/<meta\s+property=["']og:image:height["'][^>]*>/i, `<meta property="og:image:height" content="${imgHeight}" />`);
    upsert(/<meta\s+property=["']og:url["'][^>]*>/i, `<meta property="og:url" content="${meta.pageUrl}" />`);
    upsert(/<meta\s+(?:property|name)=["']twitter:card["'][^>]*>/i, `<meta name="twitter:card" content="summary_large_image" />`);
    upsert(/<meta\s+(?:property|name)=["']twitter:url["'][^>]*>/i, `<meta name="twitter:url" content="${meta.pageUrl}" />`);
    upsert(/<meta\s+(?:property|name)=["']twitter:title["'][^>]*>/i, `<meta property="twitter:title" content="${safeTitle}" />`);
    upsert(/<meta\s+(?:property|name)=["']twitter:description["'][^>]*>/i, `<meta name="twitter:description" content="${safeDesc}" />`);
    upsert(/<meta\s+(?:property|name)=["']twitter:image["'][^>]*>/i, `<meta property="twitter:image" content="${meta.imageUrl}" />`);
    upsert(/<meta\s+(?:property|name)=["']twitter:image:src["'][^>]*>/i, `<meta name="twitter:image:src" content="${meta.imageUrl}" />`);
    upsert(/<link\s+rel=["']image_src["'][^>]*>/i, `<link rel="image_src" href="${meta.imageUrl}" />`);
    upsert(/<meta\s+itemprop=["']image["'][^>]*>/i, `<meta itemprop="image" content="${meta.imageUrl}" />`);

    return result;
  };

  let vite: any;

  const renderBlogPostPage = async (req: express.Request, res: express.Response, postId: string) => {
    const isProd = process.env.NODE_ENV === "production";
    const builtStaticPath = path.resolve(rootDir, "dist", `${postId}.html`);
    if (isProd && fs.existsSync(builtStaticPath)) {
      const html = fs.readFileSync(builtStaticPath, "utf-8");
      res.status(200).set({ "Content-Type": "text/html" }).end(html);
      return true;
    }

    const post = loadBlogPostById(rootDir, postId);
    if (!post) return false;

    let templatePath = path.resolve(rootDir, isProd ? "dist/blog-post.html" : "blog-post.html");
    if (!fs.existsSync(templatePath)) {
      templatePath = path.resolve(rootDir, "blog-post.html");
    }
    let template = fs.readFileSync(templatePath, "utf-8");
    template = prerenderBlogPostHtml(template, post, getOrigin(req), CONFIG.JOIN_REDIRECT_LINK);

    if (vite) {
      template = await vite.transformIndexHtml(req.originalUrl, template);
    }

    res.status(200).set({ "Content-Type": "text/html" }).end(template);
    return true;
  };

  // Serve /blogs/index.json and /blogs/:slug.json directly from the /blogs folder
  app.get("/blogs/index.json", (_req, res) => {
    const posts = loadAllBlogPosts(rootDir);
    res.status(200).json(buildBlogIndex(posts));
  });

  app.get("/blogs/:slug.json", (req, res, next) => {
    const post = loadBlogPostById(rootDir, req.params.slug);
    if (!post) return next();
    res.status(200).json(post);
  });

  // Direct endpoint for post image previews
  app.get(["/preview/:slug.jpg", "/preview-image/:slug.jpg"], async (req, res) => {
    const { slug } = req.params;
    if (!/^[a-z0-9-]+$/i.test(slug)) {
      return res.status(404).end();
    }

    const candidateLocalPaths = [
      path.resolve(rootDir, "dist", "preview", `${slug}.jpg`),
      path.resolve(rootDir, "public", "preview", `${slug}.jpg`),
      path.resolve(rootDir, "public", "blogs", `${slug}-preview.jpg`),
    ];

    for (const localPath of candidateLocalPaths) {
      if (fs.existsSync(localPath)) {
        res.setHeader("Content-Type", "image/jpeg");
        res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
        res.setHeader("Access-Control-Allow-Origin", "*");
        return res.sendFile(localPath);
      }
    }

    const postDataPath = path.resolve(rootDir, "public", "posts", `${slug}.json`);
    if (fs.existsSync(postDataPath)) {
      const post = JSON.parse(fs.readFileSync(postDataPath, "utf-8"));
      if (post.socialPreviewImageSource) {
        const fetched = await fetchVerifiedImageBytes(
          post.socialPreviewImageSource,
          post.socialPreviewImageFallback,
          3000
        );
        if (fetched) {
          res.setHeader("Content-Type", fetched.meta.mimeType);
          res.setHeader("Cache-Control", "public, max-age=86400");
          res.setHeader("Access-Control-Allow-Origin", "*");
          return res.status(200).send(Buffer.from(fetched.bytes));
        }
        return res.redirect(302, post.socialPreviewImageFallback || post.socialPreviewImageSource);
      }
    }

    res.status(404).end();
  });

  // Handler for post.html & /post with dynamic meta tags for social media previews
  app.get(["/post", "/post.html"], async (req, res, next) => {
    try {
      const postId = req.query.id as string;
      const isProd = process.env.NODE_ENV === "production";
      let templatePath = path.resolve(rootDir, isProd ? "dist/post.html" : "post.html");
      if (!fs.existsSync(templatePath)) {
        templatePath = path.resolve(rootDir, "post.html");
      }

      let template = fs.readFileSync(templatePath, "utf-8").replaceAll("%LINKHUB_ORIGIN%", getOrigin(req));

      if (postId && /^[a-z0-9-]+$/i.test(postId)) {
        const postDataPath = path.resolve(rootDir, "public", "posts", `${postId}.json`);
        if (fs.existsSync(postDataPath)) {
          const post = JSON.parse(fs.readFileSync(postDataPath, "utf-8"));
          const previewImage = post.socialPreviewImage || post.image;
          template = injectSocialMetaTags(template, {
            title: `${post.title} | LinkHub`,
            description: post.description,
            imageUrl: getAbsoluteUrl(req, previewImage),
            imageWidth: post.socialPreviewImageWidth,
            imageHeight: post.socialPreviewImageHeight,
            pageUrl: getPageUrl(req),
          });
        }
      }

      if (vite) {
        template = await vite.transformIndexHtml(req.originalUrl, template);
      }

      res.status(200).set({ "Content-Type": "text/html" }).end(template);
    } catch (e) {
      if (vite) vite.ssrFixStacktrace(e);
      next(e);
    }
  });

  // Handler for blog.html & /blog
  app.get(["/blog", "/blog.html"], async (req, res, next) => {
    try {
      const isProd = process.env.NODE_ENV === "production";
      let templatePath = path.resolve(rootDir, isProd ? "dist/blog.html" : "blog.html");
      if (!fs.existsSync(templatePath)) {
        templatePath = path.resolve(rootDir, "blog.html");
      }
      let template = fs.readFileSync(templatePath, "utf-8").replaceAll("%LINKHUB_ORIGIN%", getOrigin(req));
      if (vite) {
        template = await vite.transformIndexHtml(req.originalUrl, template);
      }
      res.status(200).set({ "Content-Type": "text/html" }).end(template);
    } catch (e) {
      if (vite) vite.ssrFixStacktrace(e);
      next(e);
    }
  });

  // Handler for blog-post.html & /blog-post?id=<slug>
  app.get(["/blog-post", "/blog-post.html"], async (req, res, next) => {
    try {
      const postId = (req.query.id as string) || "romantic-ways-to-ask-her-to-be-your-girlfriend";
      const handled = await renderBlogPostPage(req, res, postId);
      if (handled) return;

      const isProd = process.env.NODE_ENV === "production";
      let templatePath = path.resolve(rootDir, isProd ? "dist/blog-post.html" : "blog-post.html");
      if (!fs.existsSync(templatePath)) {
        templatePath = path.resolve(rootDir, "blog-post.html");
      }
      let template = fs.readFileSync(templatePath, "utf-8").replaceAll("%LINKHUB_ORIGIN%", getOrigin(req));
      if (vite) {
        template = await vite.transformIndexHtml(req.originalUrl, template);
      }
      res.status(200).set({ "Content-Type": "text/html" }).end(template);
    } catch (e) {
      if (vite) vite.ssrFixStacktrace(e);
      next(e);
    }
  });

  // Automatically serve any /<slug>, /<slug>.html, /blog/<slug>, or /posts/<slug> matching blogs/<slug>.json
  app.get(["/:slug", "/blog/:slug", "/posts/:slug"], async (req, res, next) => {
    try {
      const rawSlug = req.params.slug || "";
      const slug = rawSlug.replace(/\.html$/i, "");
      if (!slug || ["index", "post", "blog", "blog-post"].includes(slug)) {
        return next();
      }
      const handled = await renderBlogPostPage(req, res, slug);
      if (!handled) return next();
    } catch (e) {
      if (vite) vite.ssrFixStacktrace(e);
      next(e);
    }
  });

  // Vite middleware for development (after custom HTML routes)
  if (process.env.NODE_ENV !== "production") {
    vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "custom",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(rootDir, "dist")));
  }

  // Fallback for index / other routes
  app.get("*", async (req, res, next) => {
    const url = req.originalUrl;

    try {
      const templatePath = path.resolve(rootDir, "index.html");
      let template = fs.readFileSync(templatePath, "utf-8").replaceAll("%LINKHUB_ORIGIN%", getOrigin(req));

      try {
        const indexPath = path.resolve(rootDir, "public", "posts", "index.json");
        if (fs.existsSync(indexPath)) {
          const posts = JSON.parse(fs.readFileSync(indexPath, "utf-8"));
          if (posts.length > 0) {
            const firstPost = posts[0];
            template = template.replace(
              /<meta property="og:image" content=".*?" \/>/,
              `<meta property="og:image" content="${firstPost.image}" />`
            );
            template = template.replace(
              /<meta property="twitter:image" content=".*?" \/>/,
              `<meta property="twitter:image" content="${firstPost.image}" />`
            );
          }
        }
      } catch (error) {
        console.error("Error injecting home page meta tags:", error);
      }

      if (vite) {
        template = await vite.transformIndexHtml(url, template);
      }

      res.status(200).set({ "Content-Type": "text/html" }).end(template);
    } catch (e) {
      if (vite) vite.ssrFixStacktrace(e);
      next(e);
    }
  });

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
