import './index.css';
import { initTheme } from './theme';
import { initMobileMenu } from './navigation';
import { inject } from '@vercel/analytics';

inject();

interface BlogPostPreview {
  id: string;
  title: string;
  excerpt: string;
  coverImage: string;
  category: string;
  author: string;
  readTime: string;
  date: string;
}

async function fetchBlogPosts(): Promise<BlogPostPreview[]> {
  try {
    const res = await fetch('/blogs/index.json');
    if (!res.ok) throw new Error('Failed to load blog posts');
    return await res.json();
  } catch (error) {
    console.error('Error fetching blog posts:', error);
    return [];
  }
}

function createBlogCard(post: BlogPostPreview): HTMLElement {
  const card = document.createElement('article');
  card.className = 'premium-card group flex flex-col justify-between h-full bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-[2rem] p-6 shadow-xl shadow-slate-200/40 dark:shadow-none hover:-translate-y-1 transition-all duration-300';

  card.innerHTML = `
    <div>
      <div class="aspect-[16/10] overflow-hidden relative rounded-[1.5rem] mb-6">
        <img 
          src="${post.coverImage}" 
          alt="${post.title}" 
          class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700 ease-out"
          loading="lazy"
        />
        <div class="absolute top-4 left-4 z-10">
          <span class="px-3.5 py-1.5 rounded-full bg-white/90 dark:bg-slate-900/90 backdrop-blur-md text-emerald-600 dark:text-emerald-400 text-[10px] font-bold uppercase tracking-widest shadow-md">
            ${post.category}
          </span>
        </div>
      </div>

      <div class="flex items-center gap-2 text-xs font-semibold text-slate-400 mb-3">
        <span>${post.date}</span>
        <span>•</span>
        <span>${post.readTime}</span>
      </div>

      <h3 class="text-2xl font-bold text-slate-900 dark:text-white mb-3 font-display group-hover:text-emerald-600 transition-colors leading-tight">
        ${post.title}
      </h3>

      <p class="text-slate-500 dark:text-slate-400 text-sm leading-relaxed mb-6 line-clamp-3">
        ${post.excerpt}
      </p>
    </div>

    <div class="pt-4 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between">
      <div class="flex items-center gap-2">
        <div class="w-7 h-7 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-bold text-xs flex items-center justify-center">
          ${post.author.charAt(0)}
        </div>
        <span class="text-xs font-semibold text-slate-600 dark:text-slate-400">${post.author}</span>
      </div>
      <a 
        href="/blog-post.html?id=${post.id}" 
        class="inline-flex items-center gap-2 text-sm font-bold text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 dark:hover:text-emerald-300 group/link"
      >
        <span>Read Article</span>
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" class="transform group-hover/link:translate-x-1 transition-transform"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>
      </a>
    </div>
  `;

  return card;
}

async function initBlog() {
  initTheme();
  initMobileMenu();
  const blogGrid = document.getElementById('blog-grid');
  if (!blogGrid) return;

  const posts = await fetchBlogPosts();
  blogGrid.innerHTML = '';

  if (posts.length === 0) {
    blogGrid.innerHTML = `
      <div class="col-span-full py-16 text-center">
        <p class="text-slate-500 dark:text-slate-400">No blog posts available yet. Check back soon!</p>
      </div>
    `;
    return;
  }

  posts.forEach(post => {
    blogGrid.appendChild(createBlogCard(post));
  });
}

window.addEventListener('load', initBlog);
