import { BigNumber, utils } from 'ethers';
import { DBN_ZERO, DecimalBigNumber, minDBN } from 'utils/DecimalBigNumber';
import type { Amount, Auction, Phase, Token } from './types';

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

/* ---------- amounts ---------- */

export const ZERO = DBN_ZERO;
const ONE = DecimalBigNumber.fromBN(BigNumber.from(1), 0);

// A whole number as an Amount, e.g. seconds in a day.
export const whole = (n: number) =>
  DecimalBigNumber.fromBN(BigNumber.from(n), 0);

// Base units (or their decimal string) with the token's decimals.
export const fromUnits = (v: BigNumber | string, decimals: number) =>
  DecimalBigNumber.fromBN(BigNumber.from(v), decimals);

// Rounds to `decimals` places: a product's decimals add up, so this keeps
// estimates at their token's precision.
export const roundTo = (d: Amount, decimals: number) =>
  DecimalBigNumber.fromBN(d.toBN(decimals), decimals);

export const isPositive = (d?: Amount | null) => !!d && d.gt(ZERO);

// For display and percentages only: a float, so the last digits can be off.
export const toNumber = (d: Amount) => Number(d.formatUnits());

// For an input box or a URL: "4950", not "4950.0".
export const plain = (d: Amount) => d.formatUnits().replace(/\.0$/, '');

// A typed amount, or null if it isn't a valid number with at most `decimals`
// decimal places.
export const parseTyped = (text: string, decimals = 18): Amount | null => {
  try {
    const v = utils.parseUnits(text.replace(/,/g, '').trim() || '0', decimals);
    return DecimalBigNumber.fromBN(v, decimals);
  } catch {
    return null;
  }
};

/* ---------- auction outcome ---------- */

// The share of the deposits the funding fills, from 0 to 1.
export const fundedFraction = (a: Auction): Amount => {
  // settlement().filledBids: exact, including the contract's rounding
  if (a.filledBids && !a.totalDeposits.isZero())
    return minDBN(ONE, a.filledBids.div(a.totalDeposits, 18));
  const required = a.totalDeposits.mul(a.price);
  return required.isZero() ? ZERO : minDBN(ONE, a.funding.div(required, 18));
};

export const fillPct = (a: Auction) =>
  Math.round(toNumber(fundedFraction(a)) * 100);

// What claim() pays one depositor: the pro-rata fill and the unfilled refund.
export const settlementFor = (a: Auction, deposit: Amount, now: Date) => {
  const p = phaseOf(a, now);
  if (p === 'Cancelled')
    return { filledBid: ZERO, fill: ZERO, refund: deposit };
  if (p !== 'Settlement') return null;
  const filledBid = roundTo(
    deposit.mul(fundedFraction(a)),
    deposit.getDecimals()
  );
  return {
    filledBid,
    fill: filledBid.mul(a.price),
    refund: deposit.sub(filledBid),
  };
};

/* ---------- formatting ---------- */

const MONTHS = 'Jan Feb Mar Apr May Jun Jul Aug Sep Oct Nov Dec'.split(' ');
const pad = (n: number) => String(n).padStart(2, '0');

// Whole tokens, e.g. "4,950".
export const fmt = (d: Amount) =>
  toNumber(d).toLocaleString('en-US', { maximumFractionDigits: 0 });

// Every digit, grouped: "1,234.5678".
export const fmtExact = (d: Amount) => {
  const [int, frac] = plain(d).split('.');
  const grouped = int.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return frac ? `${grouped}.${frac}` : grouped;
};

// A typed amount, exactly as typed, e.g. in a notification.
export const fmtTyped = (text: string) => fmtExact(parseTyped(text) ?? ZERO);

// Up to two decimals, for amounts that are often fractional (TGLD).
export const fmt2 = (d: Amount) =>
  toNumber(d).toLocaleString('en-US', { maximumFractionDigits: 2 });

const fmtWhole = (n: number) =>
  n.toLocaleString('en-US', { maximumFractionDigits: 0 });

// Millions for big figures; small ones in full, so a quiet auction doesn't read "0.0M".
export const fmtM = (d: Amount) => {
  const n = toNumber(d);
  if (Math.abs(n) < 100_000) return fmtWhole(n);
  const m = n / 1e6;
  // toPrecision(3) turns to exponent notation from 999.5M
  if (Math.abs(m) >= 999.5) return `${fmtWhole(m)}M`;
  let s = m.toPrecision(3);
  if (s.includes('.')) s = s.replace(/0+$/, '').replace(/\.$/, '.0');
  return `${s}M`;
};

export const fmtPrice = (d: Amount) => {
  const p = toNumber(d);
  return p.toFixed(p < 0.1 ? 4 : 2);
};

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

// Time left: days and hours, hours and minutes under a day, minutes under an hour.
export const fmtLeft = (from: Date, to: Date) => {
  const m = Math.max(0, Math.floor((+to - +from) / 6e4));
  const h = Math.floor(m / 60);
  if (h >= 24) return `${Math.floor(h / 24)}d ${h % 24}h`;
  if (h >= 1) return `${h}h ${m % 60}m`;
  return m >= 1 ? `${m}m` : 'under a minute';
};

export const addDays = (d: Date, days: number) => new Date(+d + days * 864e5);
