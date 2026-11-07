export interface BlogWhatsappCta {
  eyebrow?: string;
  title: string;
  description: string;
  buttonText?: string;
  targetCategory?: string;
  groupLink?: string;
}

export interface BlogPostSection {
  heading?: string;
  level?: 2 | 3;
  body?: string;
  quote?: string;
  bullets?: string[];
  afterBullets?: string;
  image?: string;
  imageAlt?: string;
  imageCaption?: string;
  whatsappCta?: BlogWhatsappCta;
}

export interface BlogPost {
  id: string;
  order?: number;
  title: string;
  description: string;
  excerpt: string;
  coverImage: string;
  coverImageAlt?: string;
  socialPreviewImage?: string;
  socialPreviewImageWidth?: number;
  socialPreviewImageHeight?: number;
  url?: string;
  category: string;
  author: string;
  authorRole?: string;
  readTime: string;
  date: string;
  publishedTime?: string;
  tags?: string[];
  content: BlogPostSection[];
}

export interface BlogPostPreview {
  id: string;
  title: string;
  excerpt: string;
  coverImage: string;
  imageAlt?: string;
  url: string;
  category: string;
  author: string;
  readTime: string;
  date: string;
}

export function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

export function getBlogPostPath(post: Pick<BlogPost, 'id' | 'url'>): string {
  if (post.url && post.url.trim()) {
    return post.url.startsWith('/') ? post.url : `/${post.url}`;
  }
  return `/${post.id}`;
}

export function toBlogPostPreview(post: BlogPost): BlogPostPreview {
  return {
    id: post.id,
    title: post.title,
    excerpt: post.excerpt,
    coverImage: post.coverImage,
    imageAlt: post.coverImageAlt || post.title,
    url: getBlogPostPath(post),
    category: post.category,
    author: post.author,
    readTime: post.readTime,
    date: post.date,
  };
}

function renderParagraphBlocks(text?: string): string {
  if (!text || !text.trim()) return '';
  return text
    .split(/\n{2,}/)
    .map(block => block.trim())
    .filter(Boolean)
    .map(block => `<p>${escapeHtml(block).replaceAll('\n', '<br />')}</p>`)
    .join('\n');
}

export function renderBlogBodyHtml(post: BlogPost, joinRedirectLink: string): string {
  return post.content
    .map(section => {
      const parts: string[] = [];

      if (section.heading) {
        if (section.level === 3) {
          parts.push(
            `<h3 class="pt-2 text-xl sm:text-2xl font-bold text-slate-900 dark:text-white font-display leading-snug">${escapeHtml(section.heading)}</h3>`,
          );
        } else {
          parts.push(
            `<h2 class="pt-3 text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white font-display tracking-tight">${escapeHtml(section.heading)}</h2>`,
          );
        }
      }

      const bodyHtml = renderParagraphBlocks(section.body);
      if (bodyHtml) {
        parts.push(`<div class="space-y-4 text-slate-600 dark:text-slate-300 leading-relaxed font-normal">${bodyHtml}</div>`);
      }

      if (section.quote) {
        parts.push(
          `<blockquote class="border-l-4 border-emerald-500 pl-5 italic text-slate-700 dark:text-slate-200"><p>${escapeHtml(section.quote)}</p></blockquote>`,
        );
      }

      if (section.bullets && section.bullets.length > 0) {
        const items = section.bullets.map(item => `<li>${escapeHtml(item)}</li>`).join('');
        parts.push(`<ul class="list-disc pl-6 space-y-2 marker:text-emerald-500">${items}</ul>`);
      }

      const afterBulletsHtml = renderParagraphBlocks(section.afterBullets);
      if (afterBulletsHtml) {
        parts.push(`<div class="space-y-4 text-slate-600 dark:text-slate-300 leading-relaxed font-normal">${afterBulletsHtml}</div>`);
      }

      if (section.image) {
        const imgAlt = escapeHtml(section.imageAlt || section.heading || post.title);
        parts.push(`
          <div class="my-6 rounded-2xl overflow-hidden border border-slate-100 dark:border-slate-800 shadow-lg">
            <img
              src="${escapeHtml(section.image)}"
              alt="${imgAlt}"
              class="w-full h-auto max-h-[450px] object-cover"
              loading="lazy"
            />
            ${
              section.imageCaption
                ? `<p class="text-xs text-center py-2.5 px-4 bg-slate-50 dark:bg-slate-800/80 text-slate-500 dark:text-slate-400 font-medium italic">${escapeHtml(section.imageCaption)}</p>`
                : ''
            }
          </div>
        `);
      }

      if (section.whatsappCta) {
        const cta = section.whatsappCta;
        const eyebrow = escapeHtml(cta.eyebrow || 'Featured WhatsApp Community');
        const href = escapeHtml(cta.groupLink || joinRedirectLink);
        const buttonText = escapeHtml(cta.buttonText || 'Join WhatsApp Groups');
        parts.push(`
          <div class="my-8 p-6 sm:p-8 rounded-[2rem] bg-gradient-to-br from-emerald-500/10 via-teal-500/5 to-slate-100 dark:to-slate-800/60 border border-emerald-500/20 shadow-md">
            <div class="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-5">
              <div class="space-y-1.5 flex-1">
                <div class="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
                  <span>${eyebrow}</span>
                </div>
                <h4 class="text-xl font-bold text-slate-900 dark:text-white font-display">${escapeHtml(cta.title)}</h4>
                <p class="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">${escapeHtml(cta.description)}</p>
              </div>
              <a
                href="${href}"
                target="_blank"
                rel="noopener noreferrer"
                class="join-btn w-full sm:w-auto inline-flex items-center justify-center gap-2 py-3.5 px-6 rounded-2xl bg-emerald-500 hover:bg-emerald-600 dark:bg-emerald-500 dark:hover:bg-emerald-400 text-slate-950 font-black text-sm tracking-wide shadow-lg shadow-emerald-500/25 transition-all hover:scale-[1.02] active:scale-[0.98] whitespace-nowrap"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
                <span>${buttonText}</span>
              </a>
            </div>
          </div>
        `);
      }

      return `<section class="space-y-4">${parts.join('\n')}</section>`;
    })
    .join('\n');
}

export function renderBlogTagsHtml(tags?: string[]): string {
  if (!tags || tags.length === 0) return '';
  return tags
    .map(
      tag => `
      <span class="px-3 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-xs font-semibold">
        #${escapeHtml(tag)}
      </span>
    `,
    )
    .join('');
}

export function renderHomeFeaturedBlogCardHtml(post: BlogPostPreview): string {
  const articleUrl = escapeHtml(post.url || `/${post.id}`);
  const imgAlt = escapeHtml(post.imageAlt || post.title);
  return `
    <article class="premium-card group flex flex-col justify-between h-full bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-[1.75rem] sm:rounded-[2.5rem] p-5 sm:p-7 shadow-xl shadow-slate-200/40 dark:shadow-none hover:-translate-y-1 transition-all duration-300">
      <div>
        <div class="aspect-[16/10] overflow-hidden relative rounded-[1.4rem] sm:rounded-[1.8rem] mb-5 sm:mb-6">
          <img
            src="${escapeHtml(post.coverImage)}"
            alt="${imgAlt}"
            class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700 ease-out"
            loading="lazy"
          />
          <div class="absolute top-3 left-3 sm:top-4 sm:left-4 z-10">
            <span class="px-3 sm:px-3.5 py-1 sm:py-1.5 rounded-full bg-white/90 dark:bg-slate-900/90 backdrop-blur-md text-emerald-600 dark:text-emerald-400 text-[9px] sm:text-[10px] font-bold uppercase tracking-widest shadow-md">
              ${escapeHtml(post.category)}
            </span>
          </div>
        </div>

        <div class="flex items-center gap-2 text-xs font-semibold text-slate-400 mb-2 sm:mb-3">
          <span>${escapeHtml(post.date)}</span>
          <span>•</span>
          <span>${escapeHtml(post.readTime)}</span>
        </div>

        <h3 class="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white mb-2 sm:mb-3 font-display group-hover:text-emerald-600 transition-colors leading-snug">
          ${escapeHtml(post.title)}
        </h3>

        <p class="text-slate-500 dark:text-slate-400 text-sm leading-relaxed mb-5 sm:mb-6 line-clamp-3">
          ${escapeHtml(post.excerpt)}
        </p>
      </div>

      <div class="pt-4 sm:pt-5 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between">
        <span class="text-xs font-semibold text-slate-500 dark:text-slate-400">By ${escapeHtml(post.author)}</span>
        <a
          href="${articleUrl}"
          class="inline-flex items-center gap-1.5 text-xs sm:text-sm font-bold text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 dark:hover:text-emerald-300 min-h-[44px] group/link"
        >
          <span>Read Guide</span>
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" class="transform group-hover/link:translate-x-1 transition-transform"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>
        </a>
      </div>
    </article>
  `;
}
