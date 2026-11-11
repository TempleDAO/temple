import { expect, test } from 'vitest';
import { batchAnnouncements, tokenLabel } from './shared';

test('splits announcements into ordered messages within the Discord limits', () => {
  const announcements = Array.from({ length: 25 }, (_, n) => ({
    title: `#${n}`,
    description: 'x'.repeat(1000),
  }));

  const batches = batchAnnouncements(announcements);

  expect(batches.flat()).toEqual(announcements);
  for (const batch of batches) {
    expect(batch.length).toBeLessThanOrEqual(10);
    const characters = batch.reduce(
      (n, e) => n + e.title!.length + e.description!.length,
      0
    );
    expect(characters).toBeLessThanOrEqual(6000);
  }
});

test('rejects an oversized announcement before returning any batch', () => {
  expect(() =>
    batchAnnouncements([
      { title: 'fits', description: 'x' },
      { title: 'x'.repeat(300) },
    ])
  ).toThrow('Granary announcement exceeds Discord embed limits');
});

const id = '0x1111111111111111111111111111111111111111';

test.each([
  ['USDC', 'USDC'],
  ['USDC.e', 'USDC.e'],
  ['stETH-2', 'stETH-2'],
  ['x'.repeat(32), 'x'.repeat(32)],
  ['_x_', '\\_x\\_'],
])('renders the safe symbol %j', (symbol, label) => {
  expect(tokenLabel({ symbol, id })).toBe(label);
});

test.each([
  ['missing', ''],
  ['unknown', '?'],
  ['masked link', '[USDC](https://evil.xyz)'],
  ['link fragment', '](https://evil.xyz)'],
  ['raw URL', 'https://evil.xyz'],
  ['space', 'US DC'],
  ['newline', 'US\nDC'],
  ['zero-width space', 'US\u200bDC'],
  ['Cyrillic homoglyph', 'USD\u0421'],
  ['emoji', '\u{1F438}'],
  ['too long', 'x'.repeat(33)],
])('falls back to the address for a %s symbol', (_, symbol) => {
  expect(tokenLabel({ symbol, id })).toBe(id);
});
