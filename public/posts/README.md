# Directory Posts (`public/posts`)

Each `<slug>.json` file in `public/posts/` controls a WhatsApp group directory page (`/post.html?id=<slug>`).

## Setting a Custom Social Media Share Preview Image

Every post JSON file includes a `"socialPreviewImage"` field right below `"image"`:

```json
"image": "https://encrypted-tbn0.gstatic.com/...",
"socialPreviewImage": "PASTE_PREVIEW_IMAGE_LINK_HERE",
```

- **To set a social preview image**: Replace `"PASTE_PREVIEW_IMAGE_LINK_HERE"` with your image link (for example `"https://i.postimg.cc/xxxxxxxx/photo.jpg"`).
- **Preview-only behavior**: `"socialPreviewImage"` is used **only** for social media link previews (WhatsApp, Facebook, Telegram, X/Twitter) and will **not** replace `"image"` inside the post or on homepage cards.
- **Unfilled placeholders**: Any file left as `"PASTE_PREVIEW_IMAGE_LINK_HERE"` (or `""`) automatically uses `"image"` until you add a link.
