import './index.css';
import { initTheme } from './theme';
import { initTelegramPromo } from './telegram-promo';
import { initMobileMenu } from './navigation';
import { inject } from '@vercel/analytics';
import { CONFIG } from './config';
import { resolveBlogPostPreviewImage } from './social-preview';
import {
  BlogPost,
  getBlogPostPath,
  renderBlogBodyHtml,
  renderBlogTagsHtml,
} from './blog-renderer';

inject();
initTelegramPromo();

function showToast(message: string) {
  const toast = document.getElementById('toast');
  const toastMessage = document.getElementById('toast-message');
  if (!toast || !toastMessage) return;

  toastMessage.textContent = message;
  toast.classList.remove('translate-y-32');
  toast.classList.add('translate-y-0');

  setTimeout(() => {
    toast.classList.remove('translate-y-0');
    toast.classList.add('translate-y-32');
  }, 2500);
}

async function fetchBlogPost(id: string): Promise<BlogPost | null> {
  try {
    const res = await fetch(`/blogs/${encodeURIComponent(id)}.json`);
    if (res.ok) {
      return (await res.json()) as BlogPost;
    }
  } catch (error) {
    console.warn('Network fetch for blog post failed:', error);
  }
  return null;
}

function getShareUrlForPath(pathOrUrl: string): string {
  if (pathOrUrl.startsWith('http://') || pathOrUrl.startsWith('https://')) {
    return pathOrUrl;
  }
  return new URL(pathOrUrl.startsWith('/') ? pathOrUrl : `/${pathOrUrl}`, window.location.origin).href;
}

function updateMeta(post: BlogPost) {
  document.title = `${post.title} | LinkHub`;

  const description = post.description || post.excerpt;
  const metaDesc = document.querySelector('meta[name="description"]');
  if (metaDesc) metaDesc.setAttribute('content', description);

  const ogTitle = document.querySelector('meta[property="og:title"]');
  if (ogTitle) ogTitle.setAttribute('content', post.title);

  const ogDesc = document.querySelector('meta[property="og:description"]');
  if (ogDesc) ogDesc.setAttribute('content', description);

  const rawImage = resolveBlogPostPreviewImage(post);
  const absoluteImage = rawImage.startsWith('http')
    ? rawImage
    : `${window.location.origin}${rawImage.startsWith('/') ? rawImage : `/${rawImage}`}`;
  const canonicalUrl = getShareUrlForPath(getBlogPostPath(post));

  const ogImg = document.querySelector('meta[property="og:image"]');
  if (ogImg) ogImg.setAttribute('content', absoluteImage);

  const ogImgSecure = document.querySelector('meta[property="og:image:secure_url"]');
  if (ogImgSecure) ogImgSecure.setAttribute('content', absoluteImage);

  const ogUrl = document.querySelector('meta[property="og:url"]');
  if (ogUrl) ogUrl.setAttribute('content', canonicalUrl);

  const twTitle = document.querySelector('meta[property="twitter:title"], meta[name="twitter:title"]');
  if (twTitle) twTitle.setAttribute('content', post.title);

  const twDesc = document.querySelector('meta[property="twitter:description"], meta[name="twitter:description"]');
  if (twDesc) twDesc.setAttribute('content', description);

  const twImg = document.querySelector('meta[property="twitter:image"], meta[name="twitter:image"]');
  if (twImg) twImg.setAttribute('content', absoluteImage);

  const twUrl = document.querySelector('meta[property="twitter:url"], meta[name="twitter:url"]');
  if (twUrl) twUrl.setAttribute('content', canonicalUrl);
}

function setupShareAndJoinHandlers(getShareData: () => { title: string; text: string; url: string }) {
  const shareBtn = document.getElementById('share-blog-btn');
  shareBtn?.addEventListener('click', async () => {
    const shareData = getShareData();
    if (navigator.share) {
      try {
        await navigator.share(shareData);
        return;
      } catch {
        // User dismissed share dialog or unsupported
      }
    }
    try {
      await navigator.clipboard.writeText(shareData.url);
    } catch {
      // Clipboard API fallback ignored
    }
    showToast('Article link copied to clipboard!');
  });

  // Trigger Adsterra smart link once per page session on Join button click
  let hasClickedAd = false;
  document.addEventListener('click', e => {
    const joinBtn = (e.target as HTMLElement).closest('.join-btn');
    if (joinBtn && !hasClickedAd) {
      hasClickedAd = true;
      window.open(CONFIG.AD_SMART_LINK, '_blank');
    }
  });
}

function resolveRequestedPostId(): string {
  const urlParams = new URLSearchParams(window.location.search);
  const queryId = urlParams.get('id');
  if (queryId) return queryId;

  const cleanPathname = window.location.pathname
    .replace(/^\/(blog|posts)\//, '/')
    .replace(/\.html$/i, '')
    .replace(/^\/+|\/+$/g, '');

  if (cleanPathname && cleanPathname !== 'blog-post') {
    return cleanPathname;
  }

  return 'romantic-ways-to-ask-her-to-be-your-girlfriend';
}

async function initBlogPost() {
  initTheme();
  initMobileMenu();

  const articleEl = document.querySelector('article[data-prerendered-id]') as HTMLElement | null;
  const prerenderedId = articleEl?.dataset.prerenderedId;

  // If Vite build or dev server already pre-rendered the full article HTML, wire interactions directly
  if (prerenderedId) {
    const titleEl = document.getElementById('blog-title');
    const excerptEl = document.getElementById('blog-excerpt');
    const sharePath = articleEl?.dataset.sharePath || `/${prerenderedId}`;

    setupShareAndJoinHandlers(() => ({
      title: titleEl?.textContent?.trim() || document.title,
      text: excerptEl?.textContent?.trim() || '',
      url: getShareUrlForPath(sharePath),
    }));
    return;
  }

  const postId = resolveRequestedPostId();
  const post = await fetchBlogPost(postId);

  const titleEl = document.getElementById('blog-title');
  const excerptEl = document.getElementById('blog-excerpt');
  const categoryEl = document.getElementById('blog-category');
  const authorEl = document.getElementById('blog-author');
  const dateEl = document.getElementById('blog-date');
  const readTimeEl = document.getElementById('blog-read-time');
  const coverEl = document.getElementById('blog-cover') as HTMLImageElement | null;
  const bodyEl = document.getElementById('blog-body');
  const tagsEl = document.getElementById('blog-tags');

  if (!post) {
    if (titleEl) titleEl.textContent = 'Post Not Found';
    if (excerptEl) excerptEl.textContent = 'The requested blog post could not be loaded.';
    if (bodyEl) {
      bodyEl.innerHTML =
        '<p class="text-center py-10"><a href="/blog.html" class="text-emerald-500 font-bold hover:underline">Return to Blog</a></p>';
    }
    return;
  }

  updateMeta(post);

  if (titleEl) titleEl.textContent = post.title;
  if (excerptEl) excerptEl.textContent = post.excerpt;
  if (categoryEl) categoryEl.textContent = post.category;
  if (authorEl) authorEl.textContent = post.authorRole ? `${post.author} (${post.authorRole})` : post.author;
  if (dateEl) dateEl.textContent = post.date;
  if (readTimeEl) readTimeEl.textContent = post.readTime;
  if (coverEl) {
    coverEl.src = post.coverImage;
    coverEl.alt = post.coverImageAlt || post.title;
  }
  if (bodyEl) {
    bodyEl.innerHTML = renderBlogBodyHtml(post, CONFIG.JOIN_REDIRECT_LINK);
  }
  if (tagsEl) {
    tagsEl.innerHTML = renderBlogTagsHtml(post.tags);
  }

  setupShareAndJoinHandlers(() => ({
    title: post.title,
    text: post.excerpt,
    url: getShareUrlForPath(getBlogPostPath(post)),
  }));
}

window.addEventListener('load', initBlogPost);
