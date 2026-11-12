import './telegram-promo.css';
import {
  getTelegramPromoImageQueue,
  isTelegramPromoDue,
  reserveTelegramPromo,
  TELEGRAM_INVITE_URL,
  TELEGRAM_PROMO_STORAGE_KEY,
} from './telegram-promo-logic';

const DIALOG_ID = 'telegram-daily-promo';
const MIN_DELAY_MS = 8000;
const SCROLL_THRESHOLD_PX = 120;

let initialized = false;

function showTelegramPromo(): void {
  if (!document.body || document.getElementById(DIALOG_ID)) return;

  const dialog = document.createElement('dialog');
  // Native modal dialogs provide focus trapping, an inert background, and Escape handling.
  if (typeof dialog.showModal !== 'function') return;

  let storage: Storage;
  try {
    storage = window.localStorage;
  } catch {
    return;
  }

  const now = Date.now();
  if (!reserveTelegramPromo(storage, now)) return;

  dialog.id = DIALOG_ID;
  dialog.className = 'telegram-promo';
  dialog.setAttribute('aria-labelledby', 'telegram-promo-title');
  dialog.innerHTML = `
    <div class="telegram-promo__card">
      <div class="telegram-promo__header">
        <span class="telegram-promo__eyebrow">LinkHub community</span>
        <h2 id="telegram-promo-title" class="telegram-promo__title">Join us on Telegram</h2>
        <button class="telegram-promo__close" type="button" aria-label="Close Telegram invitation" autofocus>
          <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round">
            <path d="M18 6 6 18M6 6l12 12" />
          </svg>
        </button>
      </div>
      <div class="telegram-promo__media">
        <a class="telegram-promo__image-link" href="${TELEGRAM_INVITE_URL}" target="_blank" rel="noopener noreferrer" aria-label="Open the Telegram invitation">
          <img class="telegram-promo__image" alt="Telegram community invitation" loading="lazy" referrerpolicy="no-referrer" decoding="async" />
          <span class="telegram-promo__fallback" hidden>Join our community on Telegram.</span>
        </a>
      </div>
      <div class="telegram-promo__footer">
        <a class="telegram-promo__button" href="${TELEGRAM_INVITE_URL}" target="_blank" rel="noopener noreferrer">
          <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
            <path d="M21.6 3.1 2.9 10.3c-1.3.5-1.3 1.2-.2 1.5l4.8 1.5 1.8 5.5c.2.6.1.8.8.8.5 0 .7-.2 1-.5l2.3-2.3 4.8 3.5c.9.5 1.5.2 1.7-.9l3.1-14.6c.3-1.4-.6-2-1.4-1.7ZM9.3 13l9.4-5.9c.5-.3.9-.1.5.2l-7.8 7.1-.3 3.2L9.3 13Z" />
          </svg>
          <span>Join on Telegram</span>
        </a>
      </div>
    </div>
  `;

  const image = dialog.querySelector<HTMLImageElement>('.telegram-promo__image')!;
  const fallback = dialog.querySelector<HTMLElement>('.telegram-promo__fallback')!;
  const candidates = getTelegramPromoImageQueue(Math.random());
  let candidateIndex = 0;

  image.referrerPolicy = 'no-referrer';
  image.addEventListener('error', () => {
    candidateIndex += 1;
    if (candidateIndex < candidates.length) {
      image.src = candidates[candidateIndex];
    } else {
      image.remove();
      fallback.hidden = false;
    }
  });
  image.src = candidates[0];

  dialog.querySelectorAll<HTMLAnchorElement>('a[href]').forEach(link => {
    link.addEventListener('click', () => {
      window.setTimeout(() => {
        if (dialog.open) dialog.close();
      }, 0);
    });
  });

  dialog.querySelector<HTMLButtonElement>('.telegram-promo__close')!.addEventListener('click', () => dialog.close());
  dialog.addEventListener('click', event => {
    if (event.target === dialog) dialog.close();
  });
  dialog.addEventListener('close', () => {
    document.body.classList.remove('telegram-promo-open');
    dialog.remove();
  });

  document.body.appendChild(dialog);
  try {
    dialog.showModal();
    document.body.classList.add('telegram-promo-open');
  } catch {
    dialog.remove();
    try {
      if (storage.getItem(TELEGRAM_PROMO_STORAGE_KEY) === String(now)) {
        storage.removeItem(TELEGRAM_PROMO_STORAGE_KEY);
      }
    } catch {
      // Storage can become unavailable between read and write.
    }
  }
}

function scheduleDeferredPromo(): void {
  // Fast exit without listeners/timers if storage is blocked or 24h cooldown is still active
  try {
    const lastShown = window.localStorage.getItem(TELEGRAM_PROMO_STORAGE_KEY);
    if (!isTelegramPromoDue(lastShown, Date.now())) return;
  } catch {
    return;
  }

  let triggered = false;
  let timerId = 0;

  const triggerOnce = () => {
    if (triggered) return;
    triggered = true;
    window.removeEventListener('scroll', onScroll);
    if (timerId) window.clearTimeout(timerId);
    showTelegramPromo();
  };

  const onScroll = () => {
    if (window.scrollY >= SCROLL_THRESHOLD_PX) {
      triggerOnce();
    }
  };

  // Defer modal presentation until user scrolls past hero or 8s idle so LCP and Googlebot mobile UX stay clean
  window.addEventListener('scroll', onScroll, { passive: true });
  timerId = window.setTimeout(triggerOnce, MIN_DELAY_MS);
}

export function initTelegramPromo(): void {
  if (initialized) return;
  initialized = true;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', scheduleDeferredPromo, { once: true });
    return;
  }

  if (document.visibilityState === 'hidden') {
    const onVisible = () => {
      if (document.visibilityState === 'visible') {
        document.removeEventListener('visibilitychange', onVisible);
        scheduleDeferredPromo();
      }
    };
    document.addEventListener('visibilitychange', onVisible);
    return;
  }

  scheduleDeferredPromo();
}
