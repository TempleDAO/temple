import { utils } from 'ethers';
import type { Auction, Phase, Token } from './types';

// Client-side derivations over auction fields. Pass the indexer's block time
// (useNow) as `now`, not the wall clock.

export const pairIdOf = (bid: Token, fill: Token) =>
  `${bid}-${fill}`.toLowerCase();

export const pairName = (bid: Token, fill: Token) => `${bid} → ${fill}`;

export const auctionName = (a: Auction) =>
  `${pairName(a.bidToken, a.fillToken)} #${a.number}`;

export const phaseOf = (a: Auction, now: Date): Phase => {
  if (a.outcome === 'Cancelled') return 'Cancelled';
  if (a.outcome === 'Settled' || now >= a.fulfillmentEnd) return 'Settlement';
  if (now >= a.depositEnd) return 'Fulfillment';
  if (now >= a.depositStart) return 'Deposit';
  return 'Scheduled';
};

export const isRunning = (p: Phase) => p !== 'Settlement' && p !== 'Cancelled';

// The time the current phase ends; for a finished auction, when it ended.
export const deadlineOf = (a: Auction, p: Phase) =>
  p === 'Scheduled'
    ? a.depositStart
    : p === 'Deposit'
    ? a.depositEnd
    : a.cancelledAt ?? a.settledAt ?? a.fulfillmentEnd;

export const fundedFraction = (a: Auction) => {
  // settlement().filledBids: exact, including the contract's rounding
  if (a.filledBids !== undefined && a.totalDeposits > 0)
    return Math.min(1, a.filledBids / a.totalDeposits);
  const required = a.totalDeposits * a.price;
  return required > 0 ? Math.min(1, a.funding / required) : 0;
};

export const fillPct = (a: Auction) => Math.round(fundedFraction(a) * 100);

// What claim() pays one depositor: the pro-rata fill and the unfilled refund.
export const settlementFor = (a: Auction, deposit: number, now: Date) => {
  const p = phaseOf(a, now);
  if (p === 'Cancelled') return { filledBid: 0, fill: 0, refund: deposit };
  if (p !== 'Settlement') return null;
  const filledBid = deposit * fundedFraction(a);
  return { filledBid, fill: filledBid * a.price, refund: deposit - filledBid };
};

/* ---------- formatting ---------- */

const MONTHS = 'Jan Feb Mar Apr May Jun Jul Aug Sep Oct Nov Dec'.split(' ');
const pad = (n: number) => String(n).padStart(2, '0');

export const fmt = (n: number) =>
  n.toLocaleString('en-US', { maximumFractionDigits: 0 });

// A typed amount in 18-decimal units, or null if it isn't a valid amount.
// Limits are checked on these, as a float can't tell 1 from
// 1.000000000000000001. Tokens with fewer decimals compare correctly too.
export const toWei = (text: string) => {
  try {
    return utils.parseUnits(text.replace(/,/g, '').trim() || '0', 18);
  } catch {
    return null;
  }
};

// Millions for big figures; small ones in full, so a quiet auction doesn't read "0.0M".
export const fmtM = (n: number) => {
  if (Math.abs(n) < 100_000) return fmt(n);
  const m = n / 1e6;
  // toPrecision(3) turns to exponent notation from 999.5M
  if (Math.abs(m) >= 999.5) return `${fmt(m)}M`;
  let s = m.toPrecision(3);
  if (s.includes('.')) s = s.replace(/0+$/, '').replace(/\.$/, '.0');
  return `${s}M`;
};

export const fmtPrice = (p: number) => p.toFixed(p < 0.1 ? 4 : 2);

export const fmtMonth = (d: Date) => MONTHS[d.getUTCMonth()];
export const fmtDay = (d: Date) => `${d.getUTCDate()} ${fmtMonth(d)}`;
export const fmtTime = (d: Date) =>
  `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`;
export const fmtDayTime = (d: Date) => `${fmtDay(d)} ${fmtTime(d)} UTC`;
export const fmtDayYear = (d: Date) => `${fmtDay(d)} ${d.getUTCFullYear()}`;
export const fmtRange = (a: Date, b: Date) =>
  a.getUTCMonth() === b.getUTCMonth()
    ? `${a.getUTCDate()} – ${fmtDay(b)}`
    : `${fmtDay(a)} – ${fmtDay(b)}`;

export const fmtLeft = (from: Date, to: Date) => {
  const h = Math.max(0, Math.floor((+to - +from) / 36e5));
  return h >= 24 ? `${Math.floor(h / 24)}d ${h % 24}h` : `${h}h`;
};

export const addDays = (d: Date, days: number) => new Date(+d + days * 864e5);
