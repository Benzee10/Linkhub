import './index.css';
import { initTheme } from './theme';
import { initTelegramPromo } from './telegram-promo';
import { initMobileMenu } from './navigation';
import { inject } from '@vercel/analytics';

inject();
initTelegramPromo();

function showToast(message: string) {
  const toast = document.getElementById('toast');
  const text = document.getElementById('toast-message');
  if (!toast || !text) return;

  text.textContent = message;
  toast.classList.remove('translate-y-32');
  toast.classList.add('translate-y-0');
  setTimeout(() => {
    toast.classList.remove('translate-y-0');
    toast.classList.add('translate-y-32');
  }, 2500);
}

window.addEventListener('load', () => {
  initTheme();
  initMobileMenu();

  document.getElementById('share-blog-btn')?.addEventListener('click', async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: document.title,
          text: document.querySelector<HTMLMetaElement>('meta[name="description"]')?.content,
          url: window.location.href,
        });
        return;
      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') return;
      }
    }

    try {
      await navigator.clipboard.writeText(window.location.href);
      showToast('Article link copied to clipboard!');
    } catch {
      showToast('Unable to copy the article link.');
    }
  });
});
