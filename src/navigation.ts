/**
 * Mobile Navigation Drawer & Hamburger Menu Controller
 * Handles opening, closing, accessibility, body scroll locking,
 * and theme toggling within mobile menu drawers.
 */
export function initMobileMenu() {
  const toggleBtn = document.getElementById('mobile-menu-btn');
  const drawer = document.getElementById('mobile-menu-drawer');
  const overlay = document.getElementById('mobile-menu-overlay');
  const closeBtn = document.getElementById('mobile-menu-close');
  const menuIcon = document.getElementById('hamburger-icon');
  const closeIcon = document.getElementById('close-icon');
  const mobileThemeToggle = document.getElementById('mobile-theme-toggle');

  if (!toggleBtn || !drawer) return;

  let isOpen = false;

  const openMenu = () => {
    isOpen = true;
    drawer.classList.remove('translate-x-full');
    drawer.classList.add('translate-x-0');
    if (overlay) {
      overlay.classList.remove('opacity-0', 'pointer-events-none');
      overlay.classList.add('opacity-100', 'pointer-events-auto');
    }
    if (menuIcon && closeIcon) {
      menuIcon.classList.add('hidden');
      closeIcon.classList.remove('hidden');
    }
    toggleBtn.setAttribute('aria-expanded', 'true');
    document.body.classList.add('overflow-hidden');
  };

  const closeMenu = () => {
    isOpen = false;
    drawer.classList.remove('translate-x-0');
    drawer.classList.add('translate-x-full');
    if (overlay) {
      overlay.classList.remove('opacity-100', 'pointer-events-auto');
      overlay.classList.add('opacity-0', 'pointer-events-none');
    }
    if (menuIcon && closeIcon) {
      menuIcon.classList.remove('hidden');
      closeIcon.classList.add('hidden');
    }
    toggleBtn.setAttribute('aria-expanded', 'false');
    document.body.classList.remove('overflow-hidden');
  };

  toggleBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    if (isOpen) {
      closeMenu();
    } else {
      openMenu();
    }
  });

  closeBtn?.addEventListener('click', closeMenu);
  overlay?.addEventListener('click', closeMenu);

  // Close when pressing Escape key
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && isOpen) {
      closeMenu();
    }
  });

  // Close when clicking mobile nav links
  const mobileLinks = drawer.querySelectorAll('a');
  mobileLinks.forEach((link) => {
    link.addEventListener('click', () => {
      closeMenu();
    });
  });

  // Mobile Theme Toggle synchronization
  if (mobileThemeToggle) {
    mobileThemeToggle.addEventListener('click', () => {
      const html = document.documentElement;
      html.classList.toggle('dark');
      const isDark = html.classList.contains('dark');
      localStorage.setItem('theme', isDark ? 'dark' : 'light');
    });
  }
}
