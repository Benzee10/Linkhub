/**
 * Mobile Navigation Drawer & Responsive Controls
 * Accessible slide-over mobile menu with Escape handling, inert management, and scroll locking.
 */
let mobileMenuInitialized = false;

export function initMobileMenu() {
  if (mobileMenuInitialized) return;

  const menuBtn = document.getElementById('mobile-menu-btn') as HTMLElement | null;
  const closeBtn = document.getElementById('mobile-menu-close') as HTMLElement | null;
  const overlay = document.getElementById('mobile-menu-overlay') as HTMLElement | null;
  const drawer = document.getElementById('mobile-menu-drawer') as (HTMLElement & { inert?: boolean }) | null;
  const hamburgerIcon = document.getElementById('hamburger-icon');
  const closeIcon = document.getElementById('close-icon');

  if (!menuBtn || !drawer || !overlay) return;
  mobileMenuInitialized = true;

  drawer.inert = true;
  drawer.setAttribute('aria-hidden', 'true');

  let isOpen = false;

  const openMenu = () => {
    isOpen = true;
    menuBtn.setAttribute('aria-expanded', 'true');
    drawer.inert = false;
    drawer.setAttribute('aria-hidden', 'false');
    overlay.classList.remove('opacity-0', 'pointer-events-none');
    overlay.classList.add('opacity-100', 'pointer-events-auto');
    drawer.classList.remove('translate-x-full');
    drawer.classList.add('translate-x-0');
    hamburgerIcon?.classList.add('hidden');
    hamburgerIcon?.classList.remove('block');
    closeIcon?.classList.remove('hidden');
    closeIcon?.classList.add('block');
    document.body.style.overflow = 'hidden';
    closeBtn?.focus({ preventScroll: true });
  };

  const closeMenu = (restoreFocus = false) => {
    if (!isOpen) return;
    isOpen = false;
    menuBtn.setAttribute('aria-expanded', 'false');
    drawer.inert = true;
    drawer.setAttribute('aria-hidden', 'true');
    overlay.classList.remove('opacity-100', 'pointer-events-auto');
    overlay.classList.add('opacity-0', 'pointer-events-none');
    drawer.classList.remove('translate-x-0');
    drawer.classList.add('translate-x-full');
    hamburgerIcon?.classList.remove('hidden');
    hamburgerIcon?.classList.add('block');
    closeIcon?.classList.add('hidden');
    closeIcon?.classList.remove('block');
    document.body.style.overflow = '';
    if (restoreFocus) {
      menuBtn.focus({ preventScroll: true });
    }
  };

  menuBtn.addEventListener('click', () => {
    if (isOpen) {
      closeMenu(true);
    } else {
      openMenu();
    }
  });

  closeBtn?.addEventListener('click', () => closeMenu(true));
  overlay.addEventListener('click', () => closeMenu(true));

  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && isOpen) {
      closeMenu(true);
    }
  });

  drawer.querySelectorAll('a').forEach(link => {
    link.addEventListener('click', () => closeMenu(false));
  });

  const mobileThemeBtn = document.getElementById('mobile-theme-toggle');
  mobileThemeBtn?.addEventListener('click', () => {
    const desktopToggle = document.getElementById('theme-toggle');
    if (desktopToggle) {
      desktopToggle.click();
    } else {
      const isDark = document.documentElement.classList.toggle('dark');
      try {
        localStorage.setItem('theme', isDark ? 'dark' : 'light');
      } catch {
        // Ignore storage errors
      }
    }
  });

  const mobileShareBtn = document.getElementById('mobile-share-btn');
  mobileShareBtn?.addEventListener('click', () => {
    closeMenu(false);
    const desktopShare = document.getElementById('share-btn') || document.getElementById('share-blog-btn');
    desktopShare?.click();
  });

  window.addEventListener(
    'resize',
    () => {
      if (window.innerWidth >= 768 && isOpen) {
        closeMenu(false);
      }
    },
    { passive: true },
  );
}
