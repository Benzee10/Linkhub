export const TELEGRAM_PROMO_STORAGE_KEY = 'linkhub.telegram-promo.v2.last-shown';
export const TELEGRAM_PROMO_INTERVAL_MS = 24 * 60 * 60 * 1000;
export const TELEGRAM_INVITE_URL = 'https://t.me/+5Qe37BSNw941OWE0';
export const TELEGRAM_PROMO_IMAGES = [
  'https://i.postimg.cc/KYPF11H3/3-54-1.webp',
  'https://i.postimg.cc/gkzwmWrQ/5-34.webp',
] as const;

export type TelegramPromoImage = (typeof TELEGRAM_PROMO_IMAGES)[number];

/** A timestamp in the future or an invalid value should not suppress the promo indefinitely. */
export function isTelegramPromoDue(lastShown: string | null, now: number): boolean {
  if (lastShown === null || lastShown.trim() === '') return true;

  const timestamp = Number(lastShown);
  if (!Number.isFinite(timestamp) || timestamp < 0 || timestamp > now) return true;
  return now - timestamp >= TELEGRAM_PROMO_INTERVAL_MS;
}

/** Reserve a display across pages and tabs; fail closed if storage is unavailable. */
export function reserveTelegramPromo(storage: Pick<Storage, 'getItem' | 'setItem'>, now: number): boolean {
  try {
    if (!isTelegramPromoDue(storage.getItem(TELEGRAM_PROMO_STORAGE_KEY), now)) return false;
    storage.setItem(TELEGRAM_PROMO_STORAGE_KEY, String(now));
    return true;
  } catch {
    // Without persistent storage we cannot reliably respect the daily limit.
    return false;
  }
}

export function chooseTelegramPromoIndex(random: number): number {
  if (!Number.isFinite(random)) return 0;
  return Math.min(
    TELEGRAM_PROMO_IMAGES.length - 1,
    Math.max(0, Math.floor(random * TELEGRAM_PROMO_IMAGES.length)),
  );
}

export function chooseTelegramPromoImage(random: number): TelegramPromoImage {
  return TELEGRAM_PROMO_IMAGES[chooseTelegramPromoIndex(random)];
}

/** Ordered image candidates starting from the randomly chosen image, cycling through remaining images on load error. */
export function getTelegramPromoImageQueue(random: number): TelegramPromoImage[] {
  const startIndex = chooseTelegramPromoIndex(random);
  return [
    ...TELEGRAM_PROMO_IMAGES.slice(startIndex),
    ...TELEGRAM_PROMO_IMAGES.slice(0, startIndex),
  ];
}
