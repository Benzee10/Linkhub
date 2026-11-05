import './index.css';
import { initTheme } from './theme';
import { initMobileMenu } from './navigation';
import { inject } from '@vercel/analytics';

inject();

interface ContentSection {
  heading: string;
  body: string;
}

interface BlogPostDetail {
  id: string;
  title: string;
  description: string;
  excerpt: string;
  coverImage: string;
  category: string;
  author: string;
  authorRole?: string;
  readTime: string;
  date: string;
  tags?: string[];
  content: ContentSection[];
}

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
  try {
    const res = await fetch(`/blogs/${id}.json`);
    if (!res.ok) throw new Error('Blog post not found');
    return await res.json();
  } catch (error) {
    console.error('Error fetching blog post:', error);
    return null;
  }
}

function updateMeta(post: BlogPostDetail) {
  document.title = `${post.title} | LinkHub Blog`;

  const metaDesc = document.querySelector('meta[name="description"]');
  if (metaDesc) metaDesc.setAttribute('content', post.description || post.excerpt);

  const ogTitle = document.querySelector('meta[property="og:title"]');
  if (ogTitle) ogTitle.setAttribute('content', post.title);

  const ogDesc = document.querySelector('meta[property="og:description"]');
  if (ogDesc) ogDesc.setAttribute('content', post.description || post.excerpt);

  const absoluteImage = post.coverImage.startsWith('http')
    ? post.coverImage
    : `${window.location.origin}${post.coverImage.startsWith('/') ? post.coverImage : '/' + post.coverImage}`;

  const ogImg = document.querySelector('meta[property="og:image"]');
  if (ogImg) ogImg.setAttribute('content', absoluteImage);

  const ogImgSecure = document.querySelector('meta[property="og:image:secure_url"]');
  if (ogImgSecure) ogImgSecure.setAttribute('content', absoluteImage);

  const ogUrl = document.querySelector('meta[property="og:url"]');
  if (ogUrl) ogUrl.setAttribute('content', window.location.href);

  const twTitle = document.querySelector('meta[property="twitter:title"]');
  if (twTitle) twTitle.setAttribute('content', post.title);

  const twDesc = document.querySelector('meta[property="twitter:description"]');
  if (twDesc) twDesc.setAttribute('content', post.description || post.excerpt);

  const twImg = document.querySelector('meta[property="twitter:image"]');
  if (twImg) twImg.setAttribute('content', absoluteImage);

  const twUrl = document.querySelector('meta[property="twitter:url"]');
  if (twUrl) twUrl.setAttribute('content', window.location.href);
}

async function initBlogPost() {
  initTheme();
  initMobileMenu();

  const urlParams = new URLSearchParams(window.location.search);
  const postId = urlParams.get('id') || 'how-to-find-and-join-active-whatsapp-groups-safely';

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
      <section class="space-y-3">
        <h2 class="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white font-display tracking-tight">
          ${section.heading}
        </h2>
        <div class="whitespace-pre-line text-slate-600 dark:text-slate-300 leading-relaxed font-normal">
          ${section.body}
        </div>
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
    if (navigator.share) {
      try {
        await navigator.share({
          title: post.title,
          text: post.excerpt,
          url: window.location.href,
        });
        return;
      } catch (err) {
        // User dismissed share dialog or unsupported
      }
    }
    await navigator.clipboard.writeText(window.location.href);
    showToast('Article link copied to clipboard!');
  });
}

window.addEventListener('load', initBlogPost);
