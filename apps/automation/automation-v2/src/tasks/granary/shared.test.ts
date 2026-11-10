import { expect, test } from 'vitest';
import { batchAnnouncements } from './shared';

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
