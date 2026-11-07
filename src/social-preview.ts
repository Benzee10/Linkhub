export const SOCIAL_PREVIEW_PLACEHOLDER = 'PASTE_PREVIEW_IMAGE_LINK_HERE';

export function isConfiguredPreviewLink(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  const trimmed = value.trim();
  if (!trimmed || trimmed === SOCIAL_PREVIEW_PLACEHOLDER) {
    return false;
  }
  return (
    trimmed.startsWith('https://') ||
    trimmed.startsWith('http://') ||
    trimmed.startsWith('/')
  );
}

/**
 * Resolves the social media preview image path/URL for a directory post (`public/posts/<id>.json`).
 * - Unfilled placeholders (`"PASTE_PREVIEW_IMAGE_LINK_HERE"` or `""`) safely fall back to `post.image`.
 * - Remote `http(s)://` links (such as `https://i.postimg.cc/...`) resolve to first-party `/preview/<id>.jpg`,
 *   which is downloaded at build time (`dist/preview/<id>.jpg`) and backed by Cloudflare Edge fetch at runtime
 *   so social crawlers always receive direct image bytes instead of HTML viewer redirects.
 */
export function resolveDirectoryPostPreviewImage(post: {
  id: string;
  image: string;
  socialPreviewImage?: unknown;
}): string {
  if (!isConfiguredPreviewLink(post.socialPreviewImage)) {
    return post.image;
  }
  const trimmed = post.socialPreviewImage.trim();
  if (trimmed.startsWith('/')) {
    return trimmed;
  }
  return `/preview/${post.id}.jpg`;
}

/**
 * Resolves the social media preview image path/URL for a blog post (`blogs/<id>.json`),
 * ignoring unfilled placeholder strings.
 */
export function resolveBlogPostPreviewImage(post: {
  coverImage: string;
  socialPreviewImage?: unknown;
}): string {
  if (isConfiguredPreviewLink(post.socialPreviewImage)) {
    return post.socialPreviewImage.trim();
  }
  return post.coverImage;
}

/**
 * Returns the upstream remote URL to download/proxy for `/preview/<id>.jpg`, if configured.
 */
export function getRemoteSocialPreviewSource(post: {
  socialPreviewImage?: unknown;
  socialPreviewImageSource?: unknown;
}): string | null {
  if (
    typeof post.socialPreviewImageSource === 'string' &&
    (post.socialPreviewImageSource.trim().startsWith('https://') ||
      post.socialPreviewImageSource.trim().startsWith('http://'))
  ) {
    return post.socialPreviewImageSource.trim();
  }
  if (
    isConfiguredPreviewLink(post.socialPreviewImage) &&
    (post.socialPreviewImage.trim().startsWith('https://') ||
      post.socialPreviewImage.trim().startsWith('http://'))
  ) {
    return post.socialPreviewImage.trim();
  }
  return null;
}
