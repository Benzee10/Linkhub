import './index.css';
import {
  BlogPostPreview,
  renderBlogIndexCardHtml,
} from './blog-renderer';
import { initMobileMenu } from './navigation';
import { initTelegramPromo } from './telegram-promo';
import { initTheme } from './theme';

async function fetchBlogPosts(): Promise<BlogPostPreview[] | null> {
  try {
    const res = await fetch('/blogs/index.json');
    if (!res.ok) throw new Error('Failed to load blog posts');
    return (await res.json()) as BlogPostPreview[];
  } catch (error) {
    console.error('Error fetching blog posts:', error);
    return null;
  }
}

async function initBlog() {
  initTheme();
  initMobileMenu();
  initTelegramPromo();

  const blogGrid = document.getElementById('blog-grid');
  if (!blogGrid) return;

  // Build-time pre-rendered cards are already in the DOM — zero runtime JSON fetch needed!
  if (blogGrid.dataset.prerendered === 'true') {
    return;
  }

  const posts = await fetchBlogPosts();
  if (!posts) {
    blogGrid.innerHTML = `
      <div class="col-span-full py-16 text-center">
        <p class="text-slate-600 dark:text-slate-400 mb-4">Unable to load guides right now.</p>
        <button type="button" id="retry-blogs-btn" class="px-5 py-2.5 rounded-xl bg-emerald-600 text-white font-bold text-sm hover:bg-emerald-500 transition-colors">
          Try Again
        </button>
      </div>
    `;
    document.getElementById('retry-blogs-btn')?.addEventListener('click', () => {
      void initBlog();
    });
    return;
  }

  if (posts.length === 0) {
    blogGrid.innerHTML = `
      <div class="col-span-full py-16 text-center">
        <p class="text-slate-500 dark:text-slate-400">No blog posts available yet. Check back soon!</p>
      </div>
    `;
    return;
  }

  blogGrid.innerHTML = posts
    .map((post, idx) => renderBlogIndexCardHtml(post, idx === 0))
    .join('\n');
}

void initBlog();
