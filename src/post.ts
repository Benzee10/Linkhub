import './index.css';
import { initTheme } from './theme';
import { CONFIG } from './config';

interface Group {
  name: string;
  description: string;
  members: string;
  link: string;
}

interface PostDetail {
  id: string;
  title: string;
  description: string;
  image: string;
  category: string;
  intro: string;
  content: string;
  groups: Group[];
}

async function fetchPostDetail(id: string) {
  try {
    const url = `${window.location.origin}/posts/${id}.json`;
    console.log('Fetching post from:', url);
    const response = await fetch(url);
    if (!response.ok) {
      console.error(`Post fetch failed: ${response.status} ${response.statusText}`);
      throw new Error('Post not found');
    }
    return await response.json() as PostDetail;
  } catch (error) {
    console.error('Error fetching post detail:', error);
    return null;
  }
}

function createGroupCard(group: Group) {
  const card = document.createElement('div');
  card.className = 'bg-white/5 dark:bg-slate-800/50 backdrop-blur-xl border border-white/10 dark:border-slate-700/50 p-8 rounded-[2rem] flex flex-col md:flex-row items-center justify-between gap-8 hover:bg-white/10 dark:hover:bg-slate-800 transition-all duration-500 group';
  
  const effectiveLink = CONFIG.JOIN_REDIRECT_LINK;

  card.innerHTML = `
    <div class="flex-1 text-center md:text-left">
      <div class="flex flex-col md:flex-row items-center gap-4 mb-3">
        <h3 class="text-2xl font-bold text-white font-display">${group.name}</h3>
        ${group.members ? `<span class="px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-400 text-[10px] font-bold uppercase tracking-widest border border-emerald-500/20">${group.members} Members</span>` : ''}
      </div>
      <p class="text-slate-400 dark:text-slate-300 text-base leading-relaxed max-w-xl">${group.description}</p>
    </div>
    <div class="flex items-center gap-4 w-full md:w-auto">
      <button class="copy-btn p-4 rounded-2xl bg-white/5 dark:bg-slate-700/50 text-slate-400 hover:text-white hover:bg-white/10 dark:hover:bg-slate-700 transition-all border border-white/5 dark:border-slate-700" data-link="${effectiveLink}" title="Copy Link">
        <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>
      </button>
      <a 
        href="${effectiveLink}" 
        target="_blank" 
        rel="noopener noreferrer"
        class="join-btn flex-1 md:flex-none inline-flex items-center justify-center py-4 px-10 rounded-2xl bg-emerald-500 text-slate-900 font-extrabold hover:bg-white hover:text-slate-900 transition-all shadow-2xl shadow-emerald-500/20"
      >
        JOIN NOW
      </a>
    </div>
  `;
  
  return card;
}

function showToast(message: string) {
  const toast = document.getElementById('toast');
  const toastMsg = document.getElementById('toast-message');
  if (!toast || !toastMsg) return;
  
  toastMsg.textContent = message;
  toast.classList.remove('translate-y-32');
  toast.classList.add('translate-y-0');
  
  setTimeout(() => {
    toast.classList.remove('translate-y-0');
    toast.classList.add('translate-y-32');
  }, 3000);
}

async function init() {
  console.log('Initializing post page...');
  const urlParams = new URLSearchParams(window.location.search);
  const postId = urlParams.get('id');
  
  console.log('Post ID:', postId);
  
  if (!postId) {
    console.error('No post ID found in URL');
    window.location.href = '/';
    return;
  }

  initTheme();

  const post = await fetchPostDetail(postId);
  console.log('Fetched post:', post);
  
  if (!post) {
    console.error('Post not found or fetch failed');
    const container = document.getElementById('post-header');
    if (container) {
      container.innerHTML = `
        <div class="max-w-4xl mx-auto px-4 py-20 text-center">
          <h1 class="text-4xl font-bold text-slate-900 dark:text-white mb-4">Post Not Found</h1>
          <p class="text-slate-500 dark:text-slate-400 mb-8">The post you are looking for does not exist or could not be loaded.</p>
          <a href="/" class="inline-flex items-center gap-2 text-emerald-600 font-bold hover:underline">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m12 19-7-7 7-7"/><path d="M19 12H5"/></svg>
            Return to Directory
          </a>
        </div>
      `;
    }
    return;
  }

  // Update DOM
  document.title = `${post.title} | LinkHub`;
  
  const elements = {
    'post-title': post.title,
    'post-description': post.description,
    'post-category': post.category,
    'post-intro': post.intro,
    'post-content': post.content,
    'group-count': `${post.groups?.length || 0} Groups Available`
  };

  Object.entries(elements).forEach(([id, value]) => {
    const el = document.getElementById(id);
    if (el && value) {
      if (id === 'post-content') {
        el.innerHTML = value.split('\n').map(p => `<p class="mb-4">${p}</p>`).join('');
      } else {
        el.textContent = value;
      }
    }
  });
  
  const img = document.getElementById('post-image') as HTMLImageElement;
  if (img) {
    img.src = post.image;
    img.alt = post.title;
  }

  const groupsList = document.getElementById('groups-list');
  if (groupsList) {
    groupsList.innerHTML = '';
    post.groups.forEach(group => {
      groupsList.appendChild(createGroupCard(group));
    });
  }

  // Share button
  document.getElementById('share-btn')?.addEventListener('click', () => {
    if (navigator.share) {
      navigator.share({
        title: post.title,
        text: post.description,
        url: window.location.href,
      });
    } else {
      navigator.clipboard.writeText(window.location.href);
      showToast('Link copied to clipboard!');
    }
  });

  // Copy buttons
  document.addEventListener('click', (e) => {
    const btn = (e.target as HTMLElement).closest('.copy-btn');
    if (btn) {
      const link = btn.getAttribute('data-link');
      if (link) {
        navigator.clipboard.writeText(link);
        showToast('Group link copied!');
      }
    }
  });

  // Click logic for Join buttons
  let hasClickedAd = false;
  document.addEventListener('click', (e) => {
    const joinBtn = (e.target as HTMLElement).closest('.join-btn');
    if (joinBtn && !hasClickedAd) {
      hasClickedAd = true;
      window.open(CONFIG.AD_SMART_LINK, '_blank');
    }
  });
}

console.log('Post script loaded');

// Initialize
window.addEventListener('load', () => {
  console.log('Window loaded, running init');
  init();
});
