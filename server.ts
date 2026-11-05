import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Helper to ensure full absolute canonical URL for social media preview crawlers (WhatsApp, Facebook, Twitter, Telegram, LinkedIn)
  const getAbsoluteUrl = (req: express.Request, relativeOrAbsoluteUrl: string): string => {
    const host = req.get("x-forwarded-host") || req.get("host") || "linkhub-directory.vercel.app";
    const proto = req.get("x-forwarded-proto") || req.protocol || "https";
    if (!relativeOrAbsoluteUrl) {
      return `${proto}://${host}`;
    }
    if (relativeOrAbsoluteUrl.startsWith("http://") || relativeOrAbsoluteUrl.startsWith("https://")) {
      return relativeOrAbsoluteUrl;
    }
    const cleanPath = relativeOrAbsoluteUrl.startsWith("/") ? relativeOrAbsoluteUrl : `/${relativeOrAbsoluteUrl}`;
    return `${proto}://${host}${cleanPath}`;
  };

  const getPageUrl = (req: express.Request): string => {
    const host = req.get("x-forwarded-host") || req.get("host") || "linkhub-directory.vercel.app";
    const proto = req.get("x-forwarded-proto") || req.protocol || "https";
    return `${proto}://${host}${req.originalUrl}`;
  };

  // Helper function to reliably inject Open Graph & Twitter Card meta tags
  const injectSocialMetaTags = (
    html: string,
    meta: {
      title: string;
      description: string;
      imageUrl: string;
      pageUrl: string;
      type?: string;
      imageWidth?: number;
      imageHeight?: number;
    }
  ): string => {
    let result = html;

    // Document title
    result = result.replace(/<title>[\s\S]*?<\/title>/i, `<title>${meta.title}</title>`);

    // Standard description
    if (/<meta\s+name=["']description["']/i.test(result)) {
      result = result.replace(
        /<meta\s+name=["']description["'][^>]*>/i,
        `<meta name="description" content="${meta.description.replace(/"/g, '&quot;')}" />`
      );
    }

    // og:title
    if (/<meta\s+property=["']og:title["']/i.test(result)) {
      result = result.replace(
        /<meta\s+property=["']og:title["'][^>]*>/i,
        `<meta property="og:title" content="${meta.title.replace(/"/g, '&quot;')}" />`
      );
    } else {
      result = result.replace('</head>', `<meta property="og:title" content="${meta.title.replace(/"/g, '&quot;')}" />\n</head>`);
    }

    // og:description
    if (/<meta\s+property=["']og:description["']/i.test(result)) {
      result = result.replace(
        /<meta\s+property=["']og:description["'][^>]*>/i,
        `<meta property="og:description" content="${meta.description.replace(/"/g, '&quot;')}" />`
      );
    } else {
      result = result.replace('</head>', `<meta property="og:description" content="${meta.description.replace(/"/g, '&quot;')}" />\n</head>`);
    }

    // og:image
    if (/<meta\s+property=["']og:image["']/i.test(result)) {
      result = result.replace(
        /<meta\s+property=["']og:image["'][^>]*>/i,
        `<meta property="og:image" content="${meta.imageUrl}" />`
      );
    } else {
      result = result.replace('</head>', `<meta property="og:image" content="${meta.imageUrl}" />\n</head>`);
    }

    // og:image:secure_url
    if (meta.imageUrl.startsWith("https://")) {
      if (/<meta\s+property=["']og:image:secure_url["']/i.test(result)) {
        result = result.replace(
          /<meta\s+property=["']og:image:secure_url["'][^>]*>/i,
          `<meta property="og:image:secure_url" content="${meta.imageUrl}" />`
        );
      } else {
        result = result.replace('</head>', `<meta property="og:image:secure_url" content="${meta.imageUrl}" />\n</head>`);
      }
    }

    // og:image:type
    const mimeType = meta.imageUrl.toLowerCase().endsWith('.png') ? 'image/png' : 'image/jpeg';
    if (/<meta\s+property=["']og:image:type["']/i.test(result)) {
      result = result.replace(/<meta\s+property=["']og:image:type["'][^>]*>/i, `<meta property="og:image:type" content="${mimeType}" />`);
    } else {
      result = result.replace('</head>', `<meta property="og:image:type" content="${mimeType}" />\n</head>`);
    }

    // og:image:width & height (Crucial for WhatsApp/Facebook instant thumbnail rendering)
    const imgWidth = meta.imageWidth || (meta.imageUrl.includes('20261105-154753') ? 1280 : 1200);
    const imgHeight = meta.imageHeight || (meta.imageUrl.includes('20261105-154753') ? 720 : 630);
    if (/<meta\s+property=["']og:image:width["']/i.test(result)) {
      result = result.replace(/<meta\s+property=["']og:image:width["'][^>]*>/i, `<meta property="og:image:width" content="${imgWidth}" />`);
    } else {
      result = result.replace('</head>', `<meta property="og:image:width" content="${imgWidth}" />\n</head>`);
    }
    if (/<meta\s+property=["']og:image:height["']/i.test(result)) {
      result = result.replace(/<meta\s+property=["']og:image:height["'][^>]*>/i, `<meta property="og:image:height" content="${imgHeight}" />`);
    } else {
      result = result.replace('</head>', `<meta property="og:image:height" content="${imgHeight}" />\n</head>`);
    }

    // og:url
    if (/<meta\s+property=["']og:url["']/i.test(result)) {
      result = result.replace(
        /<meta\s+property=["']og:url["'][^>]*>/i,
        `<meta property="og:url" content="${meta.pageUrl}" />`
      );
    } else {
      result = result.replace('</head>', `<meta property="og:url" content="${meta.pageUrl}" />\n</head>`);
    }

    // twitter:card
    if (!/<meta\s+property=["']twitter:card["']|<meta\s+name=["']twitter:card["']/i.test(result)) {
      result = result.replace('</head>', `<meta name="twitter:card" content="summary_large_image" />\n</head>`);
    }

    // twitter:title
    if (/<meta\s+(?:property|name)=["']twitter:title["']/i.test(result)) {
      result = result.replace(
        /<meta\s+(?:property|name)=["']twitter:title["'][^>]*>/i,
        `<meta property="twitter:title" content="${meta.title.replace(/"/g, '&quot;')}" />`
      );
    } else {
      result = result.replace('</head>', `<meta property="twitter:title" content="${meta.title.replace(/"/g, '&quot;')}" />\n</head>`);
    }

    // twitter:description
    if (/<meta\s+(?:property|name)=["']twitter:description["']/i.test(result)) {
      result = result.replace(
        /<meta\s+(?:property|name)=["']twitter:description["'][^>]*>/i,
        `<meta property="twitter:description" content="${meta.description.replace(/"/g, '&quot;')}" />`
      );
    } else {
      result = result.replace('</head>', `<meta property="twitter:description" content="${meta.description.replace(/"/g, '&quot;')}" />\n</head>`);
    }

    // twitter:image & twitter:image:src
    if (/<meta\s+(?:property|name)=["']twitter:image["']/i.test(result)) {
      result = result.replace(
        /<meta\s+(?:property|name)=["']twitter:image["'][^>]*>/i,
        `<meta property="twitter:image" content="${meta.imageUrl}" />`
      );
    } else {
      result = result.replace('</head>', `<meta property="twitter:image" content="${meta.imageUrl}" />\n</head>`);
    }
    if (/<meta\s+(?:property|name)=["']twitter:image:src["']/i.test(result)) {
      result = result.replace(
        /<meta\s+(?:property|name)=["']twitter:image:src["'][^>]*>/i,
        `<meta name="twitter:image:src" content="${meta.imageUrl}" />`
      );
    } else {
      result = result.replace('</head>', `<meta name="twitter:image:src" content="${meta.imageUrl}" />\n</head>`);
    }

    // WhatsApp and Schema microdata fallback tags
    if (!/<link\s+rel=["']image_src["']/i.test(result)) {
      result = result.replace('</head>', `<link rel="image_src" href="${meta.imageUrl}" />\n</head>`);
    }
    if (!/<meta\s+itemprop=["']image["']/i.test(result)) {
      result = result.replace('</head>', `<meta itemprop="image" content="${meta.imageUrl}" />\n</head>`);
    }

    // Add local fallback og:image if sharing the postimg image
    if (meta.imageUrl.includes('20261105-154753') && !result.includes('how-to-make-a-girl-miss-you-preview.jpg')) {
      const localFallbackUrl = meta.pageUrl.replace(/\/[^/]*$/, '/blogs/how-to-make-a-girl-miss-you-preview.jpg');
      result = result.replace('</head>', `<meta property="og:image" content="${localFallbackUrl}" />\n</head>`);
    }

    return result;
  };

  // Handler for post.html & /post with dynamic meta tags for social media previews
  const handlePostRequest = async (req: express.Request, res: express.Response) => {
    const postId = (req.query.id as string);
    const isProd = process.env.NODE_ENV === "production";
    let templatePath = path.resolve(process.cwd(), isProd ? "dist/post.html" : "post.html");
    
    if (!fs.existsSync(templatePath)) {
      templatePath = path.resolve(process.cwd(), "post.html");
    }
    
    let template = fs.readFileSync(templatePath, "utf-8");

    if (postId) {
      try {
        const postDataPath = path.resolve(process.cwd(), "public", "posts", `${postId}.json`);
        if (fs.existsSync(postDataPath)) {
          const post = JSON.parse(fs.readFileSync(postDataPath, "utf-8"));
          const postImageUrl = getAbsoluteUrl(req, post.image);
          const currentUrl = getPageUrl(req);

          template = injectSocialMetaTags(template, {
            title: `${post.title} | LinkHub`,
            description: post.description,
            imageUrl: postImageUrl,
            pageUrl: currentUrl,
            type: "article",
          });
        }
      } catch (error) {
        console.error("Error injecting meta tags for post:", error);
      }
    }

    if (vite) {
      template = await vite.transformIndexHtml(req.originalUrl, template);
    }

    res.status(200).set({ "Content-Type": "text/html" }).end(template);
  };

  // Handler for blog.html & /blog
  const handleBlogRequest = async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    try {
      const isProd = process.env.NODE_ENV === "production";
      let templatePath = path.resolve(process.cwd(), isProd ? "dist/blog.html" : "blog.html");
      if (!fs.existsSync(templatePath)) {
        templatePath = path.resolve(process.cwd(), "blog.html");
      }
      let template = fs.readFileSync(templatePath, "utf-8");
      if (vite) {
        template = await vite.transformIndexHtml(req.originalUrl, template);
      }
      res.status(200).set({ "Content-Type": "text/html" }).end(template);
    } catch (e) {
      if (vite) vite.ssrFixStacktrace(e);
      next(e);
    }
  };

  // Handler for blog-post.html & /blog-post with dynamic meta tags
  const handleBlogPostRequest = async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    try {
      const postId = (req.query.id as string) || "romantic-ways-to-ask-her-to-be-your-girlfriend";
      const isProd = process.env.NODE_ENV === "production";
      let templatePath = path.resolve(process.cwd(), isProd ? "dist/blog-post.html" : "blog-post.html");
      if (!fs.existsSync(templatePath)) {
        templatePath = path.resolve(process.cwd(), "blog-post.html");
      }
      let template = fs.readFileSync(templatePath, "utf-8");

      try {
        const blogPath = path.resolve(process.cwd(), "public", "blogs", `${postId}.json`);
        if (fs.existsSync(blogPath)) {
          const blog = JSON.parse(fs.readFileSync(blogPath, "utf-8"));
          const previewImage = blog.socialPreviewImage || blog.coverImage;
          const blogImageUrl = getAbsoluteUrl(req, previewImage);
          const currentUrl = getPageUrl(req);

          template = injectSocialMetaTags(template, {
            title: `${blog.title} | LinkHub Blog`,
            description: blog.description || blog.excerpt,
            imageUrl: blogImageUrl,
            pageUrl: currentUrl,
            type: "article",
          });
        }
      } catch (err) {
        console.error("Error injecting blog meta tags:", err);
      }

      if (vite) {
        template = await vite.transformIndexHtml(req.originalUrl, template);
      }
      res.status(200).set({ "Content-Type": "text/html" }).end(template);
    } catch (e) {
      if (vite) vite.ssrFixStacktrace(e);
      next(e);
    }
  };

  // Direct endpoint for post image preview
  app.get(["/preview/how-to-make-a-girl-miss-you.jpg", "/preview-image/how-to-make-a-girl-miss-you.jpg"], (req, res) => {
    const localImgPath = path.resolve(process.cwd(), "public", "blogs", "how-to-make-a-girl-miss-you-preview.jpg");
    if (fs.existsSync(localImgPath)) {
      res.setHeader("Content-Type", "image/jpeg");
      res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
      res.setHeader("Access-Control-Allow-Origin", "*");
      return res.sendFile(localImgPath);
    }
    res.redirect(302, "https://i.postimg.cc/C5krM81Q/20261105-154753.jpg");
  });

  // Register dynamic routes first before static middlewares
  app.get(["/post", "/post.html"], handlePostRequest);
  app.get(["/blog", "/blog.html"], handleBlogRequest);
  app.get(["/blog-post", "/blog-post.html"], handleBlogPostRequest);

  // Serve the fully rendered article at both its clean URL and its HTML path.
  app.get([
    "/how-to-make-a-girl-miss-you",
    "/how-to-make-a-girl-miss-you.html",
    "/blog/how-to-make-a-girl-miss-you",
    "/posts/how-to-make-a-girl-miss-you",
  ], async (req, res, next) => {
    try {
      const filename = "how-to-make-a-girl-miss-you.html";
      const builtPath = path.resolve(process.cwd(), "dist", filename);
      const templatePath = process.env.NODE_ENV === "production" && fs.existsSync(builtPath)
        ? builtPath
        : path.resolve(process.cwd(), filename);
      let template = fs.readFileSync(templatePath, "utf-8");

      const origin = getAbsoluteUrl(req, "");
      template = template.replaceAll("%LINKHUB_ORIGIN%", origin);

      if (vite) template = await vite.transformIndexHtml(req.originalUrl, template);
      res.status(200).set({ "Content-Type": "text/html" }).end(template);
    } catch (error) {
      if (vite) vite.ssrFixStacktrace(error);
      next(error);
    }
  });

  // Serve the relationship trust article at both its clean URL and its HTML path.
  app.get([
    "/signs-a-woman-has-just-slept-with-another-man",
    "/signs-a-woman-has-just-slept-with-another-man.html",
    "/blog/signs-a-woman-has-just-slept-with-another-man",
    "/posts/signs-a-woman-has-just-slept-with-another-man",
  ], async (req, res, next) => {
    try {
      const filename = "signs-a-woman-has-just-slept-with-another-man.html";
      const builtPath = path.resolve(process.cwd(), "dist", filename);
      const templatePath = process.env.NODE_ENV === "production" && fs.existsSync(builtPath)
        ? builtPath
        : path.resolve(process.cwd(), filename);
      let template = fs.readFileSync(templatePath, "utf-8");

      const origin = getAbsoluteUrl(req, "");
      template = template.replaceAll("%LINKHUB_ORIGIN%", origin);

      if (vite) template = await vite.transformIndexHtml(req.originalUrl, template);
      res.status(200).set({ "Content-Type": "text/html" }).end(template);
    } catch (error) {
      if (vite) vite.ssrFixStacktrace(error);
      next(error);
    }
  });

  // Vite middleware for development (after custom HTML routes)
  let vite: any;
  if (process.env.NODE_ENV !== "production") {
    vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "custom", // Use custom to handle HTML injection
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(process.cwd(), "dist")));
  }

  // Fallback for other routes
  app.get("*", async (req, res, next) => {
    const url = req.originalUrl;

    try {
      let templatePath = path.resolve(process.cwd(), "index.html");
      let template = fs.readFileSync(templatePath, "utf-8");

      // Inject first post's image into index.html meta tags for better home page sharing
      try {
        const indexPath = path.resolve(process.cwd(), "public", "posts", "index.json");
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
