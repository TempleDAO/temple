import { formatUnits } from 'viem';
import type { BaseApi } from '@/utils/api';
import { GranarySubgraph, Token, Wish } from './subgraph';
import {
  Announcement,
  CursorStep,
  discordTimestamp,
  tokenLabel,
  explorerTxUrl,
} from './shared';

// Wishes are read in their latest state; only open ones are announced. A
// cleared (zero amount) or expired wish stays silent.
function isOpenWish(wish: Wish, timestamp: number) {
  return wish.fromAmount !== 0n && wish.expiresAt > BigInt(timestamp);
}

function compare<T extends bigint | string>(a: T, b: T) {
  return a < b ? -1 : a > b ? 1 : 0;
}

async function resolveToken(tokenApi: Pick<BaseApi, 'getToken'>, token: Token) {
  if (
    !token.metadataPending &&
    token.symbol &&
    token.symbol !== '?' &&
    token.decimals !== 0
  )
    return token;

  try {
    const resolved = await tokenApi.getToken(token.id);

    return {
      id: token.id,
      symbol: resolved.symbol,
      decimals: Number(resolved.decimals),
    };
  } catch {
    return { id: token.id, symbol: token.id, decimals: undefined };
  }
}

async function formatWishAnnouncement(
  tokenApi: Pick<BaseApi, 'getToken'>,
  wish: Wish,
  explorerUrl: string | undefined
): Promise<Announcement> {
  const [bid, fill] = await Promise.all([
    resolveToken(tokenApi, wish.pair.bidToken),
    resolveToken(tokenApi, wish.pair.fillToken),
  ]);

  const amount =
    bid.decimals === undefined
      ? `${wish.fromAmount} raw base units of`
      : formatUnits(wish.fromAmount, bid.decimals);
  const tx = explorerTxUrl(explorerUrl, wish.setHash);

  return {
    title: '🌠 A wish was cast into the wishing well',
    color: 0x9b59b6,
    fields: [
      {
        name: 'Offering up to',
        value: `**${amount} ${tokenLabel(bid)}**`,
        inline: true,
      },
      { name: 'For', value: `**${tokenLabel(fill)}**`, inline: true },
      { name: 'Cast', value: discordTimestamp(wish.setAt), inline: false },
      {
        name: 'Expires',
        value: discordTimestamp(wish.expiresAt),
        inline: false,
      },
      ...(tx
        ? [{ name: 'Transaction', value: `[View on explorer](${tx})` }]
        : []),
    ],
  };
}

export async function collectWishAnnouncements({
  subgraph,
  tokenApi,
  explorerUrl,
  cursor,
}: {
  subgraph: GranarySubgraph;
  tokenApi: Pick<BaseApi, 'getToken'>;
  explorerUrl: string | undefined;
  cursor: number | undefined;
}): Promise<CursorStep<number>> {
  const snapshot = await subgraph.snapshot();

  if (cursor === undefined) {
    // Run the query once so a broken query fails before the first cursor is
    // saved.
    await subgraph.wishes(snapshot, snapshot.number);
    return { kind: 'baseline', cursor: snapshot.number };
  }

  if (snapshot.number < cursor)
    throw new Error('Granary subgraph is behind the wish checkpoint');

  if (snapshot.number === cursor) return { kind: 'unchanged' };

  const wishes = await subgraph.wishes(snapshot, cursor);
  // Oldest first, like auction announcements.
  wishes.sort(
    (a, b) =>
      compare(a.setBlock, b.setBlock) ||
      compare(a.setAt, b.setAt) ||
      compare(a.id, b.id)
  );
  const announcements: Announcement[] = [];

  for (const wish of wishes) {
    if (!isOpenWish(wish, snapshot.timestamp)) continue;

    announcements.push(
      await formatWishAnnouncement(tokenApi, wish, explorerUrl)
    );
  }

  return { kind: 'advanced', cursor: snapshot.number, announcements };
}
