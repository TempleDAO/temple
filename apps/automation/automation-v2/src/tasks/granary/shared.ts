import { APIEmbed, escapeMarkdown } from 'discord.js';
import type { Token } from './subgraph';

export function tokenLabel({ symbol, id }: Pick<Token, 'symbol' | 'id'>) {
  return escapeMarkdown(
    symbol && symbol !== '?' ? symbol.slice(0, 64).replace(/[\r\n]/g, ' ') : id
  );
}

export type Announcement = APIEmbed;

/**
 * Cursor lifecycle shared by both notification tasks. A collector reads the
 * indexed snapshot and reports one step:
 *
 *   (no cursor) ──baseline──▶ cursor ──advanced──▶ cursor' ──▶ …
 *                               └──unchanged──┘
 *
 * - `baseline`: first run; record the snapshot and announce nothing.
 * - `unchanged`: the indexer has not passed the cursor; do nothing.
 * - `advanced`: announce `announcements` (possibly none), then move the cursor.
 *
 * A snapshot behind the cursor throws instead, leaving the cursor in place
 * for the next run. The cursor only moves after the whole digest is sent.
 */
export type CursorStep<Cursor> =
  | { kind: 'baseline'; cursor: Cursor }
  | { kind: 'unchanged' }
  | { kind: 'advanced'; cursor: Cursor; announcements: Announcement[] };

/** Absolute and relative Discord timestamp, rendered in each reader's timezone. */
export function discordTimestamp(seconds: bigint) {
  return `<t:${seconds}:f> · <t:${seconds}:R>`;
}

/** Explorer URL for a transaction, if the chain has an explorer. */
export function explorerTxUrl(explorerUrl: string | undefined, hash: string) {
  return explorerUrl && `${explorerUrl}/tx/${hash}`;
}

// https://discord.com/developers/docs/resources/message#embed-object-embed-limits
export const EMBED_LIMITS = {
  title: 256,
  description: 4096,
  fields: 25,
  fieldName: 256,
  fieldValue: 1024,
  // Shared by all embeds in one message.
  characters: 6000,
  embeds: 10,
};

function embedLength({ title, description, fields, footer, author }: APIEmbed) {
  return (
    (title?.length ?? 0) +
    (description?.length ?? 0) +
    (fields ?? []).reduce((n, f) => n + f.name.length + f.value.length, 0) +
    (footer?.text.length ?? 0) +
    (author?.name.length ?? 0)
  );
}

function fitsEmbedLimits(embed: APIEmbed) {
  const fields = embed.fields ?? [];
  return (
    (embed.title?.length ?? 0) <= EMBED_LIMITS.title &&
    (embed.description?.length ?? 0) <= EMBED_LIMITS.description &&
    fields.length <= EMBED_LIMITS.fields &&
    fields.every(
      (f) =>
        f.name.length <= EMBED_LIMITS.fieldName &&
        f.value.length <= EMBED_LIMITS.fieldValue
    ) &&
    embedLength(embed) <= EMBED_LIMITS.characters
  );
}

/**
 * Splits announcements into messages of at most 10 embeds and 6,000 embed
 * characters. Every announcement is checked before any batch is returned, so
 * an oversized one fails the run before anything is sent.
 */
export function batchAnnouncements(announcements: Announcement[]) {
  if (!announcements.every(fitsEmbedLimits))
    throw new Error('Granary announcement exceeds Discord embed limits');

  const batches: Announcement[][] = [];
  let batch: Announcement[] = [];
  let length = 0;

  for (const embed of announcements) {
    const size = embedLength(embed);

    if (
      batch.length === EMBED_LIMITS.embeds ||
      length + size > EMBED_LIMITS.characters
    ) {
      batches.push(batch);
      batch = [];
      length = 0;
    }

    batch.push(embed);
    length += size;
  }

  if (batch.length) batches.push(batch);

  return batches;
}
