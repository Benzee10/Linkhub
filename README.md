# LinkHub — WhatsApp Communities Directory & Guides

Production site: **https://blog.novaqueens.name.ng**

## Tech Stack
- **Frontend:** Vanilla TypeScript Multi-Page App (MPA) + Tailwind CSS v4
- **Build & Static Pre-Rendering:** Vite (`vite.config.ts`, `scripts/blog-build.ts`, `scripts/posts-build.ts`, `scripts/social-image-fetch.ts`)
- **Edge Hosting:** Cloudflare Pages + Pages Functions (`functions/_middleware.ts`, `public/_routes.json`, `public/_headers`)

## Content Authoring
- **WhatsApp Community Directory Posts:** `public/posts/<slug>.json` — see [`docs/POSTS_AUTHORING.md`](docs/POSTS_AUTHORING.md)
- **Blog Articles:** `blogs/<slug>.json` — see [`blogs/README.md`](blogs/README.md)

## Local Development

```bash
npm install
npm run dev      # Local Express + Vite server at http://localhost:3000
npm test         # Unit & build-output tests
npm run lint     # TypeScript strict typecheck
npm run build    # Production build to dist/
```
