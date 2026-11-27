import { expect, test } from 'vitest';
import { DISCORD_CONTENT_MAX, fitDiscordContent } from './discord';

test('content Discord accepts is posted unchanged', () => {
  const content = 'x'.repeat(DISCORD_CONTENT_MAX);
  expect(fitDiscordContent(content)).toBe(content);
});

test('longer content is cut to fit, saying how much was cut', () => {
  const content = 'x'.repeat(5000);
  const fitted = fitDiscordContent(content);
  expect(fitted.length).toBeLessThanOrEqual(DISCORD_CONTENT_MAX);
  const cut = Number(fitted.match(/\((\d+) characters truncated/)?.[1]);
  const kept = fitted.slice(0, fitted.indexOf('\n…'));
  expect(kept).toBe('x'.repeat(5000 - cut));
  expect(fitted).toContain('check the logs for the full message');
});
