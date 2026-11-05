import test from 'node:test';
import assert from 'node:assert/strict';
import {
  chooseTelegramPromoImage,
  getTelegramPromoImageQueue,
  isTelegramPromoDue,
  reserveTelegramPromo,
  TELEGRAM_INVITE_URL,
  TELEGRAM_PROMO_IMAGES,
  TELEGRAM_PROMO_INTERVAL_MS,
  TELEGRAM_PROMO_STORAGE_KEY,
} from '../src/telegram-promo-logic';

const now = 1_800_000_000_000;

function createStorage() {
  const data = new Map<string, string>();
  return {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => { data.set(key, value); },
  };
}

test('first visit is eligible, and a recent visit is not', () => {
  assert.equal(isTelegramPromoDue(null, now), true);
  assert.equal(isTelegramPromoDue(String(now), now), false);
  assert.equal(isTelegramPromoDue(String(now - TELEGRAM_PROMO_INTERVAL_MS + 1), now), false);
  assert.equal(isTelegramPromoDue(String(now - TELEGRAM_PROMO_INTERVAL_MS), now), true);
});

test('invalid and future timestamps do not suppress the popup indefinitely', () => {
  for (const value of ['', 'not-a-date', '-1', 'Infinity', String(now + 1)]) {
    assert.equal(isTelegramPromoDue(value, now), true, `Expected ${value} to be reset`);
  }
});

test('a reservation is shared across visits and expires after 24 hours', () => {
  const storage = createStorage();
  assert.equal(reserveTelegramPromo(storage, now), true);
  assert.equal(storage.getItem(TELEGRAM_PROMO_STORAGE_KEY), String(now));
  assert.equal(reserveTelegramPromo(storage, now + 1000), false);
  assert.equal(reserveTelegramPromo(storage, now + TELEGRAM_PROMO_INTERVAL_MS), true);
  assert.equal(storage.getItem(TELEGRAM_PROMO_STORAGE_KEY), String(now + TELEGRAM_PROMO_INTERVAL_MS));
});

test('unavailable storage never causes repeated popups or an exception', () => {
  const unavailableRead = {
    getItem: () => { throw new Error('blocked'); },
    setItem: () => {},
  };
  const unavailableWrite = {
    getItem: () => null,
    setItem: () => { throw new Error('blocked'); },
  };
  assert.equal(reserveTelegramPromo(unavailableRead, now), false);
  assert.equal(reserveTelegramPromo(unavailableWrite, now), false);
});

test('all three supplied images are evenly selectable with full fallback coverage and exact Telegram URL', () => {
  assert.deepEqual(TELEGRAM_PROMO_IMAGES, [
    'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQKR-P4uTl9HQAOUhNgIoGevo4TIMcL8fB0qX-eM3AFmA&s',
    'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcS8MMFA5UM4bFehDD9adrrG0eRtwLyX13M-grIA5K3YYQ&s',
    'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcRSWyD4ShSOFlCw2GUE2kqA6_Gh12HvrmEVzCQiaaRxxCuO8E-wpIGZGD3J&s=10',
  ]);

  assert.equal(chooseTelegramPromoImage(0), TELEGRAM_PROMO_IMAGES[0]);
  assert.equal(chooseTelegramPromoImage(0.33), TELEGRAM_PROMO_IMAGES[0]);
  assert.equal(chooseTelegramPromoImage(1 / 3), TELEGRAM_PROMO_IMAGES[1]);
  assert.equal(chooseTelegramPromoImage(0.66), TELEGRAM_PROMO_IMAGES[1]);
  assert.equal(chooseTelegramPromoImage(0.67), TELEGRAM_PROMO_IMAGES[2]);
  assert.equal(chooseTelegramPromoImage(0.9999), TELEGRAM_PROMO_IMAGES[2]);
  assert.equal(chooseTelegramPromoImage(1), TELEGRAM_PROMO_IMAGES[2]);

  assert.deepEqual(getTelegramPromoImageQueue(0.5), [
    TELEGRAM_PROMO_IMAGES[1],
    TELEGRAM_PROMO_IMAGES[2],
    TELEGRAM_PROMO_IMAGES[0],
  ]);

  assert.equal(TELEGRAM_INVITE_URL, 'https://t.me/+5Qe37BSNw941OWE0');
});
