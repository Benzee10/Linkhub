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

  // Vite middleware for development
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

  // Handle post.html with dynamic meta tags
  app.get("/post.html", async (req, res) => {
    const postId = req.query.id as string;
    const isProd = process.env.NODE_ENV === "production";
    let templatePath = path.resolve(process.cwd(), isProd ? "dist/post.html" : "post.html");
    
    if (!fs.existsSync(templatePath)) {
      // Fallback to post.html if dist/post.html is missing
      templatePath = path.resolve(process.cwd(), "post.html");
    }
    
    let template = fs.readFileSync(templatePath, "utf-8");

    if (postId) {
      try {
        const postDataPath = path.resolve(process.cwd(), "public", "posts", `${postId}.json`);
        if (fs.existsSync(postDataPath)) {
          const post = JSON.parse(fs.readFileSync(postDataPath, "utf-8"));
          
          // Replace meta tags for social sharing (crawlers)
          template = template.replace(
            /<title>.*?<\/title>/,
            `<title>${post.title} | LinkHub</title>`
          );
          template = template.replace(
            /<meta property="og:title" content=".*?" \/>/,
            `<meta property="og:title" content="${post.title}" />`
          );
          template = template.replace(
            /<meta property="og:description" content=".*?" \/>/,
            `<meta property="og:description" content="${post.description}" />`
          );
          template = template.replace(
            /<meta property="og:image" content=".*?" \/>/,
            `<meta property="og:image" content="${post.image}" />`
          );
          template = template.replace(
            /<meta property="og:url" content=".*?" \/>/,
            `<meta property="og:url" content="${req.protocol}://${req.get('host')}${req.originalUrl}" />`
          );
          template = template.replace(
            /<meta property="twitter:title" content=".*?" \/>/,
            `<meta property="twitter:title" content="${post.title}" />`
          );
          template = template.replace(
            /<meta property="twitter:url" content=".*?" \/>/,
            `<meta property="twitter:url" content="${req.protocol}://${req.get('host')}${req.originalUrl}" />`
          );
          template = template.replace(
            /<meta property="twitter:description" content=".*?" \/>/,
            `<meta property="twitter:description" content="${post.description}" />`
          );
          template = template.replace(
            /<meta property="twitter:image" content=".*?" \/>/,
            `<meta property="twitter:image" content="${post.image}" />`
          );
          template = template.replace(
            /<meta name="description" content=".*?" \/>/,
            `<meta name="description" content="${post.description}" />`
          );
        }
      } catch (error) {
        console.error("Error injecting meta tags:", error);
      }
    }

    if (vite) {
      template = await vite.transformIndexHtml(req.originalUrl, template);
    }

    res.status(200).set({ "Content-Type": "text/html" }).end(template);
  });

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
