import './index.css';
import { initMobileMenu } from './navigation';
import {
  DirectoryPostPreview,
  renderPostCardHtml,
} from './post-renderer';
import { initTelegramPromo } from './telegram-promo';
import { initTheme } from './theme';

const INACTIVE_BTN_CLASSES = [
  'bg-white',
  'dark:bg-slate-900',
  'border',
  'border-slate-200',
  'dark:border-slate-800',
  'text-slate-600',
  'dark:text-slate-400',
];

const ACTIVE_BTN_CLASSES = [
  'bg-emerald-600',
  'dark:bg-emerald-600',
  'text-white',
  'shadow-md',
  'shadow-emerald-500/20',
];

async function fetchPosts(): Promise<DirectoryPostPreview[] | null> {
  try {
    const response = await fetch('/posts/index.json');
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return (await response.json()) as DirectoryPostPreview[];
  } catch (error) {
    console.error('Error fetching posts:', error);
    return null;
  }
}

function setActiveCategoryButton(categoryBtns: NodeListOf<Element>, activeCategory: string) {
  categoryBtns.forEach(btn => {
    const isMatch = (btn.getAttribute('data-category') || 'All') === activeCategory;
    btn.classList.remove(
      ...ACTIVE_BTN_CLASSES,
      ...INACTIVE_BTN_CLASSES,
      'bg-slate-900',
      'shadow-emerald-200',
    );
    if (isMatch) {
      btn.classList.add(...ACTIVE_BTN_CLASSES);
      btn.setAttribute('aria-pressed', 'true');
    } else {
      btn.classList.add(...INACTIVE_BTN_CLASSES);
      btn.setAttribute('aria-pressed', 'false');
    }
  });
}

function init() {
  initTheme();
  initMobileMenu();
  initTelegramPromo();

  const postsGrid = document.getElementById('posts-grid');
  const trendingGrid = document.getElementById('trending-grid');
  const searchInput = document.getElementById('search-input') as HTMLInputElement | null;
  const categoryBtns = document.querySelectorAll('.category-btn');

  const urlParams = new URLSearchParams(window.location.search);
  let currentCategory = urlParams.get('category') || 'All';
  let searchQuery = urlParams.get('q') || '';
  if (searchInput && searchQuery) {
    searchInput.value = searchQuery;
  }

  let allPosts: DirectoryPostPreview[] | null = null;
  let postsLoadPromise: Promise<DirectoryPostPreview[] | null> | null = null;
  const isPrerendered = postsGrid?.dataset.prerendered === 'true';

  const ensurePostsLoaded = (): Promise<DirectoryPostPreview[] | null> => {
    if (allPosts !== null) return Promise.resolve(allPosts);
    if (!postsLoadPromise) {
      postsLoadPromise = fetchPosts().then(result => {
        if (result) {
          allPosts = result;
        } else {
          postsLoadPromise = null;
        }
        return result;
      });
    }
    return postsLoadPromise;
  };

  const renderErrorState = () => {
    if (!postsGrid) return;
    postsGrid.innerHTML = `
      <div class="col-span-full py-16 text-center">
        <p class="text-slate-600 dark:text-slate-400 mb-4 font-medium">Unable to load community groups right now.</p>
        <button type="button" id="retry-posts-btn" class="px-5 py-2.5 rounded-xl bg-emerald-600 text-white font-bold text-sm hover:bg-emerald-500 transition-colors">
          Try Again
        </button>
      </div>
    `;
    document.getElementById('retry-posts-btn')?.addEventListener('click', async () => {
      const loaded = await ensurePostsLoaded();
      if (loaded) {
        renderTrending();
        renderPosts();
      }
    });
  };

  const renderTrending = () => {
    if (!trendingGrid || !allPosts) return;
    const trendingPosts = allPosts.filter(p => p.trending);
    trendingGrid.innerHTML = trendingPosts
      .map((post, idx) => renderPostCardHtml(post, { isTrending: true, eagerImage: idx === 0 }))
      .join('\n');
  };

  const renderPosts = () => {
    if (!postsGrid) return;
    if (!allPosts) {
      if (!isPrerendered) renderErrorState();
      return;
    }

    const searchLower = searchQuery.trim().toLowerCase();
    const filteredPosts = allPosts.filter(post => {
      const matchesCategory = currentCategory === 'All' || post.category === currentCategory;
      if (!matchesCategory) return false;
      if (!searchLower) return true;
      return (
        post.title.toLowerCase().includes(searchLower) ||
        post.description.toLowerCase().includes(searchLower) ||
        Boolean(post.keywords && post.keywords.some(k => k.toLowerCase().includes(searchLower)))
      );
    });

    if (filteredPosts.length === 0) {
      postsGrid.innerHTML = `
        <div class="col-span-full py-20 text-center">
          <div class="w-16 h-16 bg-slate-100 dark:bg-slate-900 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" class="text-slate-400 dark:text-slate-600"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
          </div>
          <h3 class="text-lg font-bold text-slate-900 dark:text-white">No groups found</h3>
          <p class="text-slate-500 dark:text-slate-400">Try adjusting your search or category filters.</p>
        </div>
      `;
      return;
    }

    postsGrid.innerHTML = filteredPosts
      .map(post => renderPostCardHtml(post, { isTrending: false, eagerImage: false }))
      .join('\n');
  };

  setActiveCategoryButton(categoryBtns, currentCategory);

  // If pre-rendered with default filters, keep existing HTML untouched for zero CLS/paint cost,
  // and warm the search/filter dataset during browser idle time.
  if (isPrerendered && currentCategory === 'All' && !searchQuery) {
    const warmCache = () => {
      void ensurePostsLoaded();
    };
    if ('requestIdleCallback' in window) {
      (window as Window & { requestIdleCallback: (cb: () => void) => number }).requestIdleCallback(warmCache);
    } else {
      setTimeout(warmCache, 250);
    }
  } else {
    void ensurePostsLoaded().then(loaded => {
      if (!loaded) {
        renderErrorState();
        return;
      }
      if (!isPrerendered) {
        renderTrending();
      }
      renderPosts();
    });
  }

  // Trending Carousel Navigation
  const trendingPrev = document.getElementById('trending-prev');
  const trendingNext = document.getElementById('trending-next');
  if (trendingPrev && trendingNext && trendingGrid) {
    trendingNext.addEventListener('click', () => {
      const scrollAmount = Math.min(380, window.innerWidth * 0.82);
      trendingGrid.scrollBy({ left: scrollAmount, behavior: 'smooth' });
    });
    trendingPrev.addEventListener('click', () => {
      const scrollAmount = Math.min(380, window.innerWidth * 0.82);
      trendingGrid.scrollBy({ left: -scrollAmount, behavior: 'smooth' });
    });
  }

  // rAF-batched search input handler
  let searchFrame = 0;
  searchInput?.addEventListener('input', e => {
    searchQuery = (e.target as HTMLInputElement).value;
    cancelAnimationFrame(searchFrame);
    searchFrame = requestAnimationFrame(async () => {
      await ensurePostsLoaded();
      renderPosts();
    });
  });

  const focusResultsGrid = async () => {
    await ensurePostsLoaded();
    renderPosts();
    postsGrid?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  searchInput?.addEventListener('keydown', e => {
    if (e.key === 'Enter') {
      e.preventDefault();
      searchInput.blur();
      void focusResultsGrid();
    }
  });

  document.getElementById('search-button')?.addEventListener('click', () => {
    void focusResultsGrid();
  });

  document.getElementById('search-button-mobile')?.addEventListener('click', () => {
    void focusResultsGrid();
  });

  categoryBtns.forEach(btn => {
    btn.addEventListener('click', async () => {
      currentCategory = btn.getAttribute('data-category') || 'All';
      setActiveCategoryButton(categoryBtns, currentCategory);
      await ensurePostsLoaded();
      renderPosts();
    });
  });
}

init();
