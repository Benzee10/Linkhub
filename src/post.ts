import './index.css';
import { CONFIG } from './config';
import { initMobileMenu } from './navigation';
import {
  DirectoryPostDetail,
  renderDirectoryPostContentHtml,
  renderGroupCardHtml,
  sanitizeUrl,
} from './post-renderer';
import { resolveDirectoryPostPreviewImage } from './social-preview';
import { initTelegramPromo } from './telegram-promo';
import { initTheme } from './theme';

const VALID_POST_ID = /^[a-z0-9-]+$/i;

let toastTimer: number | undefined;

function showToast(message: string) {
  const toast = document.getElementById('toast');
  const toastMsg = document.getElementById('toast-message');
  if (!toast || !toastMsg) return;

  if (toastTimer !== undefined) {
    clearTimeout(toastTimer);
  }

  toastMsg.textContent = message;
  toast.classList.remove('translate-y-32');
  toast.classList.add('translate-y-0');

  toastTimer = window.setTimeout(() => {
    toast.classList.remove('translate-y-0');
    toast.classList.add('translate-y-32');
  }, 3000);
}

async function fetchPostDetail(id: string): Promise<DirectoryPostDetail | null> {
  if (!VALID_POST_ID.test(id)) return null;
  try {
    const response = await fetch(`/posts/${encodeURIComponent(id)}.json`);
    if (!response.ok) return null;
    return (await response.json()) as DirectoryPostDetail;
  } catch {
    return null;
  }
}

function updateMetaTags(post: DirectoryPostDetail) {
  document.title = `${post.title} | LinkHub`;

  const metaDescription = document.querySelector('meta[name="description"]');
  if (metaDescription) metaDescription.setAttribute('content', post.description);

  const ogTitle = document.querySelector('meta[property="og:title"]');
  if (ogTitle) ogTitle.setAttribute('content', post.title);

  const ogDescription = document.querySelector('meta[property="og:description"]');
  if (ogDescription) ogDescription.setAttribute('content', post.description);

  const rawPreviewImage = resolveDirectoryPostPreviewImage(post);
  const absoluteImage = rawPreviewImage.startsWith('http')
    ? rawPreviewImage
    : `${window.location.origin}${rawPreviewImage.startsWith('/') ? rawPreviewImage : `/${rawPreviewImage}`}`;

  const ogImage = document.querySelector('meta[property="og:image"]');
  if (ogImage) ogImage.setAttribute('content', absoluteImage);

  const ogImageSecure = document.querySelector('meta[property="og:image:secure_url"]');
  if (ogImageSecure) ogImageSecure.setAttribute('content', absoluteImage);

  const canonicalHref = `${window.location.origin}/post?id=${encodeURIComponent(post.id)}`;
  const canonicalLink = document.querySelector('link[rel="canonical"]');
  if (canonicalLink) canonicalLink.setAttribute('href', canonicalHref);

  const ogUrl = document.querySelector('meta[property="og:url"]');
  if (ogUrl) ogUrl.setAttribute('content', canonicalHref);

  const twitterTitle = document.querySelector('meta[property="twitter:title"], meta[name="twitter:title"]');
  if (twitterTitle) twitterTitle.setAttribute('content', post.title);

  const twitterDescription = document.querySelector('meta[property="twitter:description"], meta[name="twitter:description"]');
  if (twitterDescription) twitterDescription.setAttribute('content', post.description);

  const twitterImage = document.querySelector('meta[property="twitter:image"], meta[name="twitter:image"]');
  if (twitterImage) twitterImage.setAttribute('content', absoluteImage);

  const twitterImageSrc = document.querySelector('meta[property="twitter:image:src"], meta[name="twitter:image:src"]');
  if (twitterImageSrc) twitterImageSrc.setAttribute('content', absoluteImage);

  const twitterUrl = document.querySelector('meta[property="twitter:url"], meta[name="twitter:url"]');
  if (twitterUrl) twitterUrl.setAttribute('content', canonicalHref);
}

function wireInteractiveHandlers(getShareMeta: () => { title: string; text: string; url: string }) {
  document.getElementById('share-btn')?.addEventListener('click', async () => {
    const shareData = getShareMeta();
    if (navigator.share) {
      try {
        await navigator.share(shareData);
        return;
      } catch {
        // User cancelled native share sheet
      }
    }
    try {
      await navigator.clipboard.writeText(shareData.url);
    } catch {
      // Ignore clipboard failure
    }
    showToast('Link copied to clipboard!');
  });

  document.addEventListener('click', e => {
    const btn = (e.target as HTMLElement).closest('.copy-btn');
    if (btn) {
      const link = btn.getAttribute('data-link');
      if (link) {
        void navigator.clipboard.writeText(link).catch(() => {});
        showToast('Group link copied!');
      }
    }
  });

  let hasClickedAd = false;
  document.addEventListener('click', e => {
    const joinBtn = (e.target as HTMLElement).closest('.join-btn');
    if (joinBtn && !hasClickedAd) {
      hasClickedAd = true;
      window.open(CONFIG.AD_SMART_LINK, '_blank', 'noopener,noreferrer');
    }
  });
}

async function init() {
  const urlParams = new URLSearchParams(window.location.search);
  const postId = urlParams.get('id');

  if (!postId || !VALID_POST_ID.test(postId)) {
    window.location.replace('/');
    return;
  }

  initTheme();
  initMobileMenu();
  initTelegramPromo();

  const headerEl = document.getElementById('post-header');
  const prerenderedId = headerEl?.dataset.prerenderedId;

  // If Edge middleware or SSR already rendered the full post body, wire handlers immediately with 0 extra fetch
  if (prerenderedId && prerenderedId.toLowerCase() === postId.toLowerCase()) {
    const titleText = document.getElementById('post-title')?.textContent?.trim() || document.title;
    const descText = document.getElementById('post-description')?.textContent?.trim() || '';
    wireInteractiveHandlers(() => ({
      title: titleText,
      text: descText,
      url: `${window.location.origin}/post?id=${encodeURIComponent(prerenderedId)}`,
    }));
    return;
  }

  const post = await fetchPostDetail(postId);
  if (!post) {
    if (headerEl) {
      headerEl.innerHTML = `
        <div class="max-w-4xl mx-auto px-4 py-20 text-center">
          <h1 class="text-4xl font-bold text-slate-900 dark:text-white mb-4">Post Not Found</h1>
          <p class="text-slate-500 dark:text-slate-400 mb-8">The community directory you requested does not exist or could not be loaded.</p>
          <a href="/" class="inline-flex items-center gap-2 text-emerald-600 font-bold hover:underline">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m12 19-7-7 7-7"/><path d="M19 12H5"/></svg>
            Return to Directory
          </a>
        </div>
      `;
    }
    return;
  }

  updateMetaTags(post);

  const textFields: Record<string, string> = {
    'post-title': post.title,
    'post-description': post.description,
    'post-category': post.category,
    'post-intro': post.intro,
    'group-count': `${post.groups?.length || 0} Groups Available`,
  };

  Object.entries(textFields).forEach(([id, value]) => {
    const el = document.getElementById(id);
    if (el && value) {
      el.textContent = value;
    }
  });

  const contentEl = document.getElementById('post-content');
  if (contentEl && post.content) {
    contentEl.innerHTML = renderDirectoryPostContentHtml(post.content);
  }

  const img = document.getElementById('post-image') as HTMLImageElement | null;
  if (img) {
    img.src = sanitizeUrl(post.image, '/og-default.jpg');
    img.alt = post.title;
  }

  const groupsList = document.getElementById('groups-list');
  if (groupsList) {
    groupsList.innerHTML = (post.groups || [])
      .map(group => renderGroupCardHtml(group, CONFIG.JOIN_REDIRECT_LINK))
      .join('\n');
  }

  wireInteractiveHandlers(() => ({
    title: post.title,
    text: post.description,
    url: `${window.location.origin}/post?id=${encodeURIComponent(post.id)}`,
  }));
}

void init();
