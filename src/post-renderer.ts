import { escapeHtml } from './blog-renderer';

export interface DirectoryGroup {
  name: string;
  description: string;
  members: string;
  link?: string;
}

export interface DirectoryPostPreview {
  id: string;
  order?: number;
  title: string;
  description: string;
  image: string;
  category: string;
  keywords?: string[];
  trending?: boolean;
}

export interface DirectoryPostDetail extends DirectoryPostPreview {
  socialPreviewImage?: string;
  socialPreviewImageSource?: string;
  socialPreviewImageFallback?: string;
  socialPreviewImageWidth?: number;
  socialPreviewImageHeight?: number;
  intro: string;
  content: string;
  groups: DirectoryGroup[];
}

export function sanitizeUrl(rawUrl: string | undefined, fallback = '/'): string {
  if (!rawUrl) return fallback;
  const trimmed = rawUrl.trim();
  if (
    trimmed.startsWith('https://') ||
    trimmed.startsWith('http://') ||
    (trimmed.startsWith('/') && !trimmed.startsWith('//'))
  ) {
    return trimmed;
  }
  return fallback;
}

export function renderPostCardHtml(
  post: DirectoryPostPreview,
  options: { isTrending?: boolean; eagerImage?: boolean } = {},
): string {
  const { isTrending = false, eagerImage = false } = options;
  const cardClass = isTrending
    ? 'premium-card group w-[84vw] max-w-[340px] sm:w-[360px] md:w-[380px] shrink-0 snap-center p-5 sm:p-6'
    : 'premium-card group p-5 sm:p-6';

  const safeImg = escapeHtml(sanitizeUrl(post.image, '/og-default.jpg'));
  const safeTitle = escapeHtml(post.title);
  const safeDesc = escapeHtml(post.description);
  const safeCategory = escapeHtml(post.category);
  const safeHref = `/post?id=${encodeURIComponent(post.id)}`;
  const loadingAttr = eagerImage ? 'loading="eager" fetchpriority="high"' : 'loading="lazy"';

  const highlightsHtml =
    post.keywords && post.keywords.length > 0
      ? post.keywords
          .slice(0, 4)
          .map(
            k => `
              <span class="px-2.5 py-0.5 rounded-lg bg-white/10 border border-white/10 text-[10px] font-bold">
                ${escapeHtml(k)}
              </span>`,
          )
          .join('')
      : `
              <span class="px-2.5 py-0.5 rounded-lg bg-white/10 border border-white/10 text-[10px] font-bold">Verified Links</span>
              <span class="px-2.5 py-0.5 rounded-lg bg-white/10 border border-white/10 text-[10px] font-bold">Active Chat</span>`;

  const tagsHtml =
    post.keywords && post.keywords.length > 0
      ? post.keywords
          .slice(0, 3)
          .map(
            k => `
          <span class="px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-[10px] font-bold uppercase tracking-wider border border-slate-200/60 dark:border-slate-700/60">
            #${escapeHtml(k)}
          </span>`,
          )
          .join('')
      : '';

  const trendingBadge = isTrending
    ? `
          <span class="px-3 py-1 rounded-full bg-emerald-600 text-white text-[10px] font-bold uppercase tracking-widest shadow-md flex items-center gap-1">
            <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m12 14 4-4-4-4"/><path d="M3 3.412C3 2.632 3.632 2 4.412 2H20c.78 0 1.412.632 1.412 1.412v17.176c0 .78-.632 1.412-1.412 1.412H4.412C3.632 22 3 21.368 3 20.588V3.412Z"/><path d="M8 11h8"/><path d="M8 15h8"/><path d="M8 7h1"/></svg>
            Trending
          </span>`
    : '';

  return `
    <article class="${cardClass}">
      <div class="aspect-[16/10] overflow-hidden relative rounded-[1.25rem] sm:rounded-[1.5rem] mb-4 sm:mb-6 bg-slate-100 dark:bg-slate-800">
        <img
          src="${safeImg}"
          alt="${safeTitle}"
          width="640"
          height="400"
          decoding="async"
          ${loadingAttr}
          referrerpolicy="no-referrer"
          class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 ease-out"
        />

        <div class="hidden md:flex absolute inset-0 bg-slate-900/90 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex-col justify-center p-6 text-white z-10 pointer-events-none group-hover:pointer-events-auto">
          <div class="mb-4">
            <span class="text-[10px] font-bold uppercase tracking-[0.2em] text-emerald-400 mb-1.5 block">Community Preview</span>
            <p class="text-xs sm:text-sm leading-relaxed text-slate-200 line-clamp-4 font-medium">${safeDesc}</p>
          </div>
          <div class="space-y-2">
            <span class="text-[10px] font-bold uppercase tracking-[0.2em] text-emerald-400 mb-1 block">Highlights</span>
            <div class="flex flex-wrap gap-1.5">${highlightsHtml}</div>
          </div>
        </div>

        <div class="absolute top-3 left-3 sm:top-4 sm:left-4 flex gap-1.5 z-20">
          <span class="px-3 sm:px-4 py-1 rounded-full bg-white/95 dark:bg-slate-900/95 text-slate-900 dark:text-white text-[10px] font-bold uppercase tracking-widest shadow-md">
            ${safeCategory}
          </span>${trendingBadge}
        </div>
      </div>
      <div class="px-1">
        <h3 class="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white mb-2 sm:mb-3 font-display group-hover:text-emerald-600 transition-colors leading-tight">
          ${safeTitle}
        </h3>
        <p class="text-slate-600 dark:text-slate-400 text-sm sm:text-base leading-relaxed mb-4 sm:mb-6 line-clamp-2 font-medium">
          ${safeDesc}
        </p>

        <div class="flex flex-wrap gap-1.5 sm:gap-2 mb-5 sm:mb-8">${tagsHtml}</div>

        <a
          href="${safeHref}"
          class="inline-flex items-center justify-between w-full min-h-[48px] py-3.5 px-5 sm:px-6 rounded-xl sm:rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white font-bold hover:bg-slate-900 dark:hover:bg-emerald-600 hover:text-white transition-colors duration-200 group/btn active:scale-[0.98]"
        >
          <span>Explore Groups</span>
          <span class="w-8 h-8 rounded-full bg-white dark:bg-slate-900 flex items-center justify-center shadow-sm group-hover/btn:bg-emerald-500 transition-colors">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" class="text-slate-900 dark:text-white group-hover/btn:text-white transform group-hover/btn:translate-x-0.5 transition-transform"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>
          </span>
        </a>
      </div>
    </article>
  `;
}

export function renderGroupCardHtml(group: DirectoryGroup, joinRedirectLink: string): string {
  const safeName = escapeHtml(group.name);
  const safeDesc = escapeHtml(group.description);
  const safeMembers = group.members ? escapeHtml(group.members) : '';
  const safeHref = escapeHtml(sanitizeUrl(joinRedirectLink, 'https://vip-redirect.vercel.app'));

  return `
    <div class="bg-white/5 dark:bg-slate-800/60 border border-white/10 dark:border-slate-700/60 p-5 sm:p-8 rounded-[1.75rem] sm:rounded-[2rem] flex flex-col md:flex-row items-start sm:items-center justify-between gap-5 sm:gap-8 hover:bg-white/10 dark:hover:bg-slate-800 transition-colors duration-200 group">
      <div class="flex-1 text-left w-full">
        <div class="flex flex-wrap items-center gap-2 sm:gap-4 mb-2.5">
          <h3 class="text-xl sm:text-2xl font-bold text-white font-display group-hover:text-emerald-400 transition-colors">${safeName}</h3>
          <div class="flex items-center gap-2">
            ${safeMembers ? `<span class="px-2.5 py-1 rounded-full bg-emerald-500/15 text-emerald-300 text-[10px] font-bold uppercase tracking-widest border border-emerald-500/25">${safeMembers} Members</span>` : ''}
            <span class="opacity-80 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity duration-200 px-2.5 py-1 rounded-full bg-blue-500/15 text-blue-300 text-[10px] font-bold uppercase tracking-widest border border-blue-500/25 flex items-center gap-1">
              <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
              Verified
            </span>
          </div>
        </div>
        <p class="text-slate-300 text-sm sm:text-base leading-relaxed max-w-xl group-hover:text-white transition-colors">${safeDesc}</p>
      </div>
      <div class="flex items-center gap-3 sm:gap-4 w-full md:w-auto">
        <button type="button" class="copy-btn min-w-[48px] min-h-[48px] p-3 sm:p-4 rounded-xl sm:rounded-2xl bg-white/5 dark:bg-slate-700/60 text-slate-300 hover:text-white hover:bg-white/10 dark:hover:bg-slate-700 transition-colors border border-white/10 dark:border-slate-700 flex items-center justify-center active:scale-95" data-link="${safeHref}" title="Copy Link" aria-label="Copy link for ${safeName}">
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>
        </button>
        <a
          href="${safeHref}"
          target="_blank"
          rel="noopener noreferrer"
          class="join-btn flex-1 md:flex-none inline-flex items-center justify-center min-h-[48px] py-3.5 px-6 sm:px-10 rounded-xl sm:rounded-2xl bg-emerald-500 text-slate-950 font-extrabold text-sm sm:text-base hover:bg-white hover:text-slate-900 transition-colors shadow-xl shadow-emerald-500/20 active:scale-[0.98]"
        >
          JOIN NOW
        </a>
      </div>
    </div>
  `;
}

export function renderDirectoryPostContentHtml(content: string): string {
  if (!content || !content.trim()) return '';
  return content
    .split(/\n+/)
    .map(p => p.trim())
    .filter(Boolean)
    .map(p => `<p class="mb-4">${escapeHtml(p)}</p>`)
    .join('\n');
}
