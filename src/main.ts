interface Post {
  id: string;
  title: string;
  description: string;
  image: string;
  category: string;
}

async function fetchPosts() {
  try {
    const response = await fetch('/posts/index.json');
    return await response.json() as Post[];
  } catch (error) {
    console.error('Error fetching posts:', error);
    return [];
  }
}

function createPostCard(post: Post) {
  const card = document.createElement('div');
  card.className = 'premium-card group';
  
  card.innerHTML = `
    <div class="aspect-[16/10] overflow-hidden relative rounded-[1.5rem] mb-6">
      <img 
        src="${post.image}" 
        alt="${post.title}" 
        class="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700 ease-out"
        loading="lazy"
        referrerPolicy="no-referrer"
      />
      <div class="absolute top-4 left-4">
        <span class="px-4 py-1.5 rounded-full bg-white/90 backdrop-blur-md text-slate-900 text-[10px] font-bold uppercase tracking-widest shadow-xl">
          ${post.category}
        </span>
      </div>
    </div>
    <div class="px-2">
      <h3 class="text-2xl font-bold text-slate-900 mb-3 font-display group-hover:text-emerald-600 transition-colors leading-tight">
        ${post.title}
      </h3>
      <p class="text-slate-500 text-base leading-relaxed mb-8 line-clamp-2 font-medium">
        ${post.description}
      </p>
      <a 
        href="/post.html?id=${post.id}" 
        class="inline-flex items-center justify-between w-full py-4 px-6 rounded-2xl bg-slate-50 text-slate-900 font-bold hover:bg-slate-900 hover:text-white transition-all duration-300 group/btn"
      >
        <span>Explore Groups</span>
        <div class="w-8 h-8 rounded-full bg-white flex items-center justify-center shadow-sm group-hover/btn:bg-emerald-500 transition-colors">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" class="text-slate-900 group-hover/btn:text-white transform group-hover/btn:translate-x-0.5 transition-all"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>
        </div>
      </a>
    </div>
  `;
  
  return card;
}

async function init() {
  const postsGrid = document.getElementById('posts-grid');
  const searchInput = document.getElementById('search-input') as HTMLInputElement;
  const categoryBtns = document.querySelectorAll('.category-btn');
  
  let allPosts: Post[] = [];
  let currentCategory = 'All';
  let searchQuery = '';

  const renderPosts = () => {
    if (!postsGrid) return;
    
    const filteredPosts = allPosts.filter(post => {
      const matchesCategory = currentCategory === 'All' || post.category === currentCategory;
      const matchesSearch = post.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
                           post.description.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesCategory && matchesSearch;
    });

    postsGrid.innerHTML = '';
    
    if (filteredPosts.length === 0) {
      postsGrid.innerHTML = `
        <div class="col-span-full py-20 text-center">
          <div class="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-slate-400"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
          </div>
          <h3 class="text-lg font-bold text-slate-900">No groups found</h3>
          <p class="text-slate-500">Try adjusting your search or category filters.</p>
        </div>
      `;
      return;
    }

    filteredPosts.forEach(post => {
      postsGrid.appendChild(createPostCard(post));
    });
  };

  // Fetch and initial render
  allPosts = await fetchPosts();
  renderPosts();

  // Search event
  searchInput?.addEventListener('input', (e) => {
    searchQuery = (e.target as HTMLInputElement).value;
    renderPosts();
  });

  // Category events
  categoryBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      categoryBtns.forEach(b => {
        b.classList.remove('bg-emerald-600', 'text-white', 'shadow-md', 'shadow-emerald-200');
        b.classList.add('bg-white', 'border', 'border-slate-200', 'text-slate-600');
      });
      
      btn.classList.remove('bg-white', 'border', 'border-slate-200', 'text-slate-600');
      btn.classList.add('bg-emerald-600', 'text-white', 'shadow-md', 'shadow-emerald-200');
      
      currentCategory = btn.getAttribute('data-category') || 'All';
      renderPosts();
    });
  });
}

document.addEventListener('DOMContentLoaded', init);
