import './index.css';
import { initTheme } from './theme';
import { initTelegramPromo } from './telegram-promo';
import { initMobileMenu } from './navigation';
import { inject } from '@vercel/analytics';
import { CONFIG } from './config';
import { getBlogPostById, BlogPost as BlogPostDetail, BlogPostSection as ContentSection } from './posts';

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

async function fetchBlogPost(id: string): Promise<BlogPostDetail | null> {
  // First attempt to load from network/public static assets
  try {
    const res = await fetch(`/blogs/${id}.json`);
    if (res.ok) {
      return await res.json();
    }
  } catch (error) {
    console.warn('Network fetch for blog post failed, falling back to standalone post file:', error);
  }

  // Fallback to standalone code post file
  const localPost = getBlogPostById(id);
  if (localPost) return localPost;

  return null;
}

function getCanonicalPostUrl(post: BlogPostDetail): string {
  if (post.url) {
    return new URL(post.url, window.location.origin).href;
  }
  return window.location.href;
}

function updateMeta(post: BlogPostDetail) {
  document.title = `${post.title} | LinkHub Blog`;

  const metaDesc = document.querySelector('meta[name="description"]');
  if (metaDesc) metaDesc.setAttribute('content', post.description || post.excerpt);

  const ogTitle = document.querySelector('meta[property="og:title"]');
  if (ogTitle) ogTitle.setAttribute('content', post.title);

  const ogDesc = document.querySelector('meta[property="og:description"]');
  if (ogDesc) ogDesc.setAttribute('content', post.description || post.excerpt);

  const rawImage = post.socialPreviewImage || post.coverImage;
  const absoluteImage = rawImage.startsWith('http')
    ? rawImage
    : `${window.location.origin}${rawImage.startsWith('/') ? rawImage : '/' + rawImage}`;
  const canonicalUrl = getCanonicalPostUrl(post);

  const ogImg = document.querySelector('meta[property="og:image"]');
  if (ogImg) ogImg.setAttribute('content', absoluteImage);

  const ogImgSecure = document.querySelector('meta[property="og:image:secure_url"]');
  if (ogImgSecure) ogImgSecure.setAttribute('content', absoluteImage);

  const ogUrl = document.querySelector('meta[property="og:url"]');
  if (ogUrl) ogUrl.setAttribute('content', canonicalUrl);

  const twTitle = document.querySelector('meta[property="twitter:title"], meta[name="twitter:title"]');
  if (twTitle) twTitle.setAttribute('content', post.title);

  const twDesc = document.querySelector('meta[property="twitter:description"], meta[name="twitter:description"]');
  if (twDesc) twDesc.setAttribute('content', post.description || post.excerpt);

  const twImg = document.querySelector('meta[property="twitter:image"], meta[name="twitter:image"]');
  if (twImg) twImg.setAttribute('content', absoluteImage);

  const twUrl = document.querySelector('meta[property="twitter:url"], meta[name="twitter:url"]');
  if (twUrl) twUrl.setAttribute('content', canonicalUrl);
}

async function initBlogPost() {
  initTheme();
  initMobileMenu();

  const urlParams = new URLSearchParams(window.location.search);
  const postId = urlParams.get('id') || 'romantic-ways-to-ask-her-to-be-your-girlfriend';

  const post = await fetchBlogPost(postId);

  const titleEl = document.getElementById('blog-title');
  const excerptEl = document.getElementById('blog-excerpt');
  const categoryEl = document.getElementById('blog-category');
  const authorEl = document.getElementById('blog-author');
  const dateEl = document.getElementById('blog-date');
  const readTimeEl = document.getElementById('blog-read-time');
  const coverEl = document.getElementById('blog-cover') as HTMLImageElement;
  const bodyEl = document.getElementById('blog-body');
  const tagsEl = document.getElementById('blog-tags');
  const shareBtn = document.getElementById('share-blog-btn');

  if (!post) {
    if (titleEl) titleEl.textContent = 'Post Not Found';
    if (excerptEl) excerptEl.textContent = 'The requested blog post could not be loaded.';
    if (bodyEl) bodyEl.innerHTML = '<p class="text-center py-10"><a href="/blog.html" class="text-emerald-500 font-bold hover:underline">Return to Blog</a></p>';
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
    coverEl.alt = post.title;
  }

  if (bodyEl) {
    bodyEl.innerHTML = post.content.map(section => `
      <section class="space-y-4">
        <h2 class="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white font-display tracking-tight">
          ${section.heading}
        </h2>
        <div class="whitespace-pre-line text-slate-600 dark:text-slate-300 leading-relaxed font-normal">
          ${section.body}
        </div>
        ${section.image ? `
          <div class="my-6 rounded-2xl overflow-hidden border border-slate-100 dark:border-slate-800 shadow-lg">
            <img 
              src="${section.image}" 
              alt="${section.heading}" 
              class="w-full h-auto max-h-[450px] object-cover" 
              loading="lazy" 
            />
            ${section.imageCaption ? `
              <p class="text-xs text-center py-2.5 px-4 bg-slate-50 dark:bg-slate-800/80 text-slate-500 dark:text-slate-400 font-medium italic">
                ${section.imageCaption}
              </p>
            ` : ''}
          </div>
        ` : ''}
        ${section.whatsappCta ? `
          <div class="my-8 p-6 sm:p-8 rounded-[2rem] bg-gradient-to-br from-emerald-500/10 via-teal-500/5 to-slate-100 dark:to-slate-800/60 border border-emerald-500/20 shadow-md">
            <div class="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-5">
              <div class="space-y-1.5 flex-1">
                <div class="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
                  <span>Featured WhatsApp Community</span>
                </div>
                <h4 class="text-xl font-bold text-slate-900 dark:text-white font-display">${section.whatsappCta.title}</h4>
                <p class="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">${section.whatsappCta.description}</p>
              </div>
              <a 
                href="${section.whatsappCta.groupLink || CONFIG.JOIN_REDIRECT_LINK}" 
                target="_blank" 
                rel="noopener noreferrer"
                class="join-btn w-full sm:w-auto inline-flex items-center justify-center gap-2 py-3.5 px-6 rounded-2xl bg-emerald-500 hover:bg-emerald-600 dark:bg-emerald-500 dark:hover:bg-emerald-400 text-slate-950 font-black text-sm tracking-wide shadow-lg shadow-emerald-500/25 transition-all hover:scale-[1.02] active:scale-[0.98] whitespace-nowrap"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
                <span>${section.whatsappCta.buttonText || 'Join WhatsApp Groups'}</span>
              </a>
            </div>
          </div>
        ` : ''}
      </section>
    `).join('');
  }

  if (tagsEl && post.tags) {
    tagsEl.innerHTML = post.tags.map(t => `
      <span class="px-3 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-xs font-semibold">
        #${t}
      </span>
    `).join('');
  }

  shareBtn?.addEventListener('click', async () => {
    const shareUrl = getCanonicalPostUrl(post);
    if (navigator.share) {
      try {
        await navigator.share({
          title: post.title,
          text: post.excerpt,
          url: shareUrl,
        });
        return;
      } catch (err) {
        // User dismissed share dialog or unsupported
      }
    }
    await navigator.clipboard.writeText(shareUrl);
    showToast('Article link copied to clipboard!');
  });

  // Click logic for Join WhatsApp buttons to trigger smart link once
  let hasClickedAd = false;
  document.addEventListener('click', (e) => {
    const joinBtn = (e.target as HTMLElement).closest('.join-btn');
    if (joinBtn && !hasClickedAd) {
      hasClickedAd = true;
      window.open(CONFIG.AD_SMART_LINK, '_blank');
    }
  });
}

window.addEventListener('load', initBlogPost);
