# LinkHub Blog Posts (`/blogs`)

All blog articles live in this single `/blogs` folder as `.json` files so you can edit existing articles or add new ones manually in one place.

## How It Works

- Every `blogs/<slug>.json` file automatically becomes:
  - A full static SEO & social-preview page at `https://blog.novaqueens.name.ng/<slug>`
  - An entry on `/blog.html` and the homepage Featured Guides section (sorted by `"order"` ascending, then `"date"` newest first)
  - A JSON data file at `/blogs/<slug>.json` and in `/blogs/index.json`

## Editing an Existing Post

Open the matching `.json` file in this `/blogs` folder (for example `blogs/how-to-make-a-girl-miss-you.json`), edit the text, image URLs, or sections, and commit/push.

## Adding a New Post Manually

1. Duplicate any `.json` file in `/blogs` and name it after the URL slug you want, e.g. `blogs/first-date-conversation-tips.json`.
2. Update the fields at the top of the file:
   - `"id"`: must match the filename without `.json` (e.g. `"first-date-conversation-tips"`)
   - `"order"`: number controlling display order (`1` shows first; lower numbers appear earlier)
   - `"title"`, `"description"`, `"excerpt"`, `"category"`, `"author"`, `"readTime"`, `"date"`
   - `"coverImage"`: main image shown inside the article and on blog cards (can be an external `https://...` URL or a local file placed in `public/blogs/...` and referenced as `"/blogs/your-image.jpg"`)
   - `"socialPreviewImage"` *(optional)*: custom WhatsApp / Facebook / Telegram / X link preview image if you want it to differ from `"coverImage"`
3. Edit `"content"` sections:
   - `"heading"` *(optional)*: section title (`"level": 3` for sub-headings, defaults to `h2`)
   - `"body"` *(optional)*: paragraphs separated by `\n\n`
   - `"bullets"` *(optional)*: array of bullet strings
   - `"quote"` *(optional)*: highlighted quote text
   - `"image"` & `"imageCaption"` *(optional)*: inline section image
   - `"whatsappCta"` *(optional)*: call-to-action card with `"title"`, `"description"`, `"buttonText"`, and optional `"groupLink"` (defaults to `CONFIG.JOIN_REDIRECT_LINK` and triggers the Adsterra smart link in `src/config.ts`).
