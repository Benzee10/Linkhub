import './index.css';

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
    const response = await fetch(`/posts/${id}.json`);
    if (!response.ok) throw new Error('Post not found');
    return await response.json() as PostDetail;
  } catch (error) {
    console.error('Error fetching post detail:', error);
    return null;
  }
}

function createGroupCard(group: Group, isFirst: boolean) {
  const card = document.createElement('div');
  card.className = 'bg-white/5 backdrop-blur-xl border border-white/10 p-8 rounded-[2rem] flex flex-col md:flex-row items-center justify-between gap-8 hover:bg-white/10 transition-all duration-500 group';
  
  const effectiveLink = isFirst ? group.link : 'https://vip-redirect.vercel.app';

  card.innerHTML = `
    <div class="flex-1 text-center md:text-left">
      <div class="flex flex-col md:flex-row items-center gap-4 mb-3">
        <h3 class="text-2xl font-bold text-white font-display">${group.name}</h3>
        ${group.members ? `<span class="px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-400 text-[10px] font-bold uppercase tracking-widest border border-emerald-500/20">${group.members} Members</span>` : ''}
      </div>
      <p class="text-slate-400 text-base leading-relaxed max-w-xl">${group.description}</p>
    </div>
    <div class="flex items-center gap-4 w-full md:w-auto">
      <button class="copy-btn p-4 rounded-2xl bg-white/5 text-slate-400 hover:text-white hover:bg-white/10 transition-all border border-white/5" data-link="${effectiveLink}" title="Copy Link">
        <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>
      </button>
      <a 
        href="${effectiveLink}" 
        target="_blank" 
        rel="noopener noreferrer"
        class="flex-1 md:flex-none inline-flex items-center justify-center py-4 px-10 rounded-2xl bg-emerald-500 text-slate-900 font-extrabold hover:bg-white hover:text-slate-900 transition-all shadow-2xl shadow-emerald-500/20"
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
  const urlParams = new URLSearchParams(window.location.search);
  const postId = urlParams.get('id');
  
  if (!postId) {
    window.location.href = '/';
    return;
  }

  const post = await fetchPostDetail(postId);
  
  if (!post) {
    document.body.innerHTML = '<div class="flex items-center justify-center h-screen"><div class="text-center"><h1 class="text-2xl font-bold mb-4">Post not found</h1><a href="/" class="text-emerald-600 underline">Return Home</a></div></div>';
    return;
  }

  // Update DOM
  document.title = `${post.title} | LinkHub`;
  document.getElementById('post-title')!.textContent = post.title;
  document.getElementById('post-description')!.textContent = post.description;
  document.getElementById('post-category')!.textContent = post.category;
  document.getElementById('post-intro')!.textContent = post.intro;
  document.getElementById('post-content')!.textContent = post.content;
  document.getElementById('group-count')!.textContent = `${post.groups.length} Groups`;
  
  const img = document.getElementById('post-image') as HTMLImageElement;
  img.src = post.image;
  img.alt = post.title;

  const groupsList = document.getElementById('groups-list');
  if (groupsList) {
    groupsList.innerHTML = '';
    post.groups.forEach((group, index) => {
      groupsList.appendChild(createGroupCard(group, index === 0));
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
}

document.addEventListener('DOMContentLoaded', init);
