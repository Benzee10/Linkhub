import './index.css';
import { initTheme } from './theme';
import { inject } from '@vercel/analytics';

inject();

interface Post {
  id: string;
  title: string;
  description: string;
  image: string;
  category: string;
  keywords?: string[];
  trending?: boolean;
}

async function fetchPosts() {
  try {
    const url = `${window.location.origin}/posts/index.json`;
    const response = await fetch(url);
    return await response.json() as Post[];
  } catch (error) {
    console.error('Error fetching posts:', error);
    return [];
  }
}

function createPostCard(post: Post, isTrending = false) {
  const card = document.createElement('div');
  card.className = isTrending ? 'premium-card group min-w-[320px] md:min-w-[380px]' : 'premium-card group';
  
  card.innerHTML = `
    <div class="aspect-[16/10] overflow-hidden relative rounded-[1.5rem] mb-6">
      <img 
        src="${post.image}" 
        alt="${post.title}" 
        class="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700 ease-out"
        loading="lazy"
        referrerPolicy="no-referrer"
      />
      
      <!-- Quick Preview Overlay -->
      <div class="absolute inset-0 bg-slate-900/90 backdrop-blur-md opacity-0 group-hover:opacity-100 transition-all duration-500 flex flex-col justify-center p-8 text-white z-10">
        <div class="mb-6">
          <span class="text-[10px] font-bold uppercase tracking-[0.2em] text-emerald-400 mb-2 block">Community Preview</span>
          <p class="text-sm leading-relaxed text-slate-200 line-clamp-4 font-medium">${post.description}</p>
        </div>
        <div class="space-y-3">
          <span class="text-[10px] font-bold uppercase tracking-[0.2em] text-emerald-400 mb-2 block">Highlights</span>
          <div class="flex flex-wrap gap-2">
            ${post.keywords ? post.keywords.slice(0, 4).map(k => `
              <span class="px-3 py-1 rounded-lg bg-white/10 border border-white/10 text-[10px] font-bold">
                ${k}
              </span>
            `).join('') : `
              <span class="px-3 py-1 rounded-lg bg-white/10 border border-white/10 text-[10px] font-bold">Verified Links</span>
              <span class="px-3 py-1 rounded-lg bg-white/10 border border-white/10 text-[10px] font-bold">Active Chat</span>
            `}
          </div>
        </div>
      </div>

      <div class="absolute top-4 left-4 flex gap-2 z-20">
        <span class="px-4 py-1.5 rounded-full bg-white/90 dark:bg-slate-900/90 backdrop-blur-md text-slate-900 dark:text-white text-[10px] font-bold uppercase tracking-widest shadow-xl">
          ${post.category}
        </span>
        ${isTrending ? `
          <span class="px-4 py-1.5 rounded-full bg-emerald-500 text-white text-[10px] font-bold uppercase tracking-widest shadow-xl flex items-center gap-1">
            <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="m12 14 4-4-4-4"/><path d="M3 3.412C3 2.632 3.632 2 4.412 2H20c.78 0 1.412.632 1.412 1.412v17.176c0 .78-.632 1.412-1.412 1.412H4.412C3.632 22 3 21.368 3 20.588V3.412Z"/><path d="M8 11h8"/><path d="M8 15h8"/><path d="M8 7h1"/></svg>
            Trending
          </span>
        ` : ''}
      </div>
    </div>
    <div class="px-2">
      <h3 class="text-2xl font-bold text-slate-900 dark:text-white mb-3 font-display group-hover:text-emerald-600 transition-colors leading-tight">
        ${post.title}
      </h3>
      <p class="text-slate-500 dark:text-slate-400 text-base leading-relaxed mb-6 line-clamp-2 font-medium">
        ${post.description}
      </p>
      
      <!-- Quick Tags -->
      <div class="flex flex-wrap gap-2 mb-8">
        ${post.keywords ? post.keywords.slice(0, 3).map(k => `
          <span class="px-2.5 py-1 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 text-[9px] font-bold uppercase tracking-wider border border-slate-200/50 dark:border-slate-700/50">
            #${k}
          </span>
        `).join('') : ''}
      </div>

      <a 
        href="/post.html?id=${post.id}" 
        class="inline-flex items-center justify-between w-full py-4 px-6 rounded-2xl bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white font-bold hover:bg-slate-900 dark:hover:bg-emerald-600 hover:text-white transition-all duration-300 group/btn"
      >
        <span>Explore Groups</span>
        <div class="w-8 h-8 rounded-full bg-white dark:bg-slate-900 flex items-center justify-center shadow-sm group-hover/btn:bg-emerald-500 transition-colors">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" class="text-slate-900 dark:text-white group-hover/btn:text-white transform group-hover/btn:translate-x-0.5 transition-all"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>
        </div>
      </a>
    </div>
  `;
  
  return card;
}

async function init() {
  const postsGrid = document.getElementById('posts-grid');
  const trendingGrid = document.getElementById('trending-grid');
  const searchInput = document.getElementById('search-input') as HTMLInputElement;
  const categoryBtns = document.querySelectorAll('.category-btn');
  
  let allPosts: Post[] = [];
  let currentCategory = 'All';
  let searchQuery = '';

  const renderTrending = () => {
    if (!trendingGrid) return;
    const trendingPosts = allPosts.filter(p => p.trending);
    trendingGrid.innerHTML = '';
    trendingPosts.forEach(post => {
      trendingGrid.appendChild(createPostCard(post, true));
    });
  };

  const renderPosts = () => {
    if (!postsGrid) return;
    
    const filteredPosts = allPosts.filter(post => {
      const matchesCategory = currentCategory === 'All' || post.category === currentCategory;
      
      const searchLower = searchQuery.toLowerCase();
      const matchesSearch = post.title.toLowerCase().includes(searchLower) || 
                           post.description.toLowerCase().includes(searchLower) ||
                           (post.keywords && post.keywords.some(k => k.toLowerCase().includes(searchLower)));
      
      return matchesCategory && matchesSearch;
    });

    postsGrid.innerHTML = '';
    
    if (filteredPosts.length === 0) {
      postsGrid.innerHTML = `
        <div class="col-span-full py-20 text-center">
          <div class="w-16 h-16 bg-slate-100 dark:bg-slate-900 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-slate-400 dark:text-slate-600"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
          </div>
          <h3 class="text-lg font-bold text-slate-900 dark:text-white">No groups found</h3>
          <p class="text-slate-500 dark:text-slate-400">Try adjusting your search or category filters.</p>
        </div>
      `;
      return;
    }

    filteredPosts.forEach(post => {
      postsGrid.appendChild(createPostCard(post));
    });
  };

  // Fetch and initial render
  initTheme();
  allPosts = await fetchPosts();
  renderTrending();
  renderPosts();

  // Trending Navigation
  const trendingPrev = document.getElementById('trending-prev');
  const trendingNext = document.getElementById('trending-next');
  if (trendingPrev && trendingNext && trendingGrid) {
    trendingNext.addEventListener('click', () => {
      trendingGrid.scrollBy({ left: 400, behavior: 'smooth' });
    });
    trendingPrev.addEventListener('click', () => {
      trendingGrid.scrollBy({ left: -400, behavior: 'smooth' });
    });
  }

  // Search event
  searchInput?.addEventListener('input', (e) => {
    searchQuery = (e.target as HTMLInputElement).value;
    renderPosts();
  });

  document.getElementById('search-button')?.addEventListener('click', () => {
    renderPosts();
  });

  // Category events
  categoryBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      categoryBtns.forEach(b => {
        b.classList.remove('bg-emerald-600', 'text-white', 'shadow-md', 'shadow-emerald-200', 'bg-slate-900');
        b.classList.add('bg-white', 'dark:bg-slate-900', 'border', 'border-slate-200', 'dark:border-slate-800', 'text-slate-600', 'dark:text-slate-400');
      });
      
      btn.classList.remove('bg-white', 'dark:bg-slate-900', 'border', 'border-slate-200', 'dark:border-slate-800', 'text-slate-600', 'dark:text-slate-400');
      btn.classList.add('bg-emerald-600', 'text-white', 'shadow-md', 'shadow-emerald-200');
      
      currentCategory = btn.getAttribute('data-category') || 'All';
      renderPosts();
    });
  });
}

window.addEventListener('load', init);
