import React, { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import styled, { css } from 'styled-components';
import { Button } from 'components/Button/Button';
import type { Auction, Phase } from './data/types';
import { fmtDay, fmtDayTime, fmtLeft, fmtRange, phaseOf } from './data/derive';

// Storyboard colours the theme doesn't carry yet.
export const C = {
  moon: '#F1DDB0',
  moonDark: '#241c17',
  text: '#E9DCD2',
  muted: '#9C8B7F',
  line: '#3a2a1f',
  edge: '#4a3324',
  ok: '#3FA88F',
  warn: '#D9A441',
  bad: '#C85563',
  mystery: '#9E87C2',
  pause: '#E07A5F',
  mono: 'ui-monospace, Menlo, monospace',
};

/* ---------- moon glyph: the phase icon everywhere ---------- */

export type MoonPhase = Phase | 'none';
const LIT: Record<MoonPhase, number> = {
  none: 0,
  Scheduled: 0,
  Deposit: 0.32,
  Fulfillment: 0.7,
  Settlement: 1,
  Cancelled: 0,
};
const RING: Record<MoonPhase, string> = {
  none: '#4a3a30',
  Scheduled: C.mystery,
  Deposit: C.ok,
  Fulfillment: C.warn,
  Settlement: '#EAB85B',
  Cancelled: C.muted,
};

export const Moon = ({
  phase,
  size = 28,
  paused = false,
}: {
  phase: MoonPhase;
  size?: number;
  paused?: boolean;
}) => {
  const r = 10,
    c = 12,
    f = LIT[phase];
  const rx = (r * Math.abs(2 * f - 1)).toFixed(2);
  const dashed = phase === 'none' || phase === 'Scheduled';
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      <circle
        cx={c}
        cy={c}
        r={r}
        fill={phase === 'none' ? 'transparent' : C.moonDark}
      />
      {f >= 1 && <circle cx={c} cy={c} r={r} fill={C.moon} />}
      {f > 0 && f < 1 && (
        <path
          d={`M${c} ${c - r} A${r} ${r} 0 0 1 ${c} ${c + r} A${rx} ${r} 0 0 ${
            f > 0.5 ? 1 : 0
          } ${c} ${c - r}Z`}
          fill={C.moon}
        />
      )}
      {phase === 'Cancelled' && (
        <>
          <circle cx={c} cy={c} r={r} fill="#3a1f22" />
          <circle
            cx={c}
            cy={c}
            r={r}
            fill="none"
            stroke={C.bad}
            strokeOpacity=".6"
          />
        </>
      )}
      {paused ? (
        <>
          <circle
            cx={c}
            cy={c}
            r={r + 1.5}
            fill="none"
            stroke={C.pause}
            strokeWidth="1.6"
            strokeDasharray="3 2.4"
          />
          <rect x={c - 4} y={c - 4} width="2.6" height="8" fill={C.pause} />
          <rect x={c + 1.4} y={c - 4} width="2.6" height="8" fill={C.pause} />
        </>
      ) : (
        <circle
          cx={c}
          cy={c}
          r={r + 1.5}
          fill="none"
          stroke={RING[phase]}
          strokeWidth="1"
          strokeDasharray={dashed ? '2 2' : undefined}
        />
      )}
    </svg>
  );
};

export const Coin = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" aria-hidden="true">
    <circle cx="12" cy="12" r="8" fill="#EAB85B" stroke="#95613F" />
    <circle cx="12" cy="12" r="4" fill="none" stroke="#95613F" />
  </svg>
);

/* ---------- text ---------- */

export const K = styled.div`
  font-size: 12px;
  color: ${C.muted};
`;
export const V = styled.span`
  color: ${C.text};
  font-variant-numeric: tabular-nums;
`;
export const Big = styled.div`
  ${({ theme }) => theme.typography.fonts.fontHeading};
  font-size: 26px;
  line-height: 1.1;
  color: ${({ theme }) => theme.palette.brandLight};
  overflow-wrap: anywhere;
`;
export const H4 = styled.h4`
  ${({ theme }) => theme.typography.fonts.fontHeading};
  font-weight: 400;
  font-size: 16px;
  margin: 0;
  color: ${({ theme }) => theme.palette.brandLight};
`;
export const Price = styled.span`
  font-family: ${C.mono};
  font-size: 12px;
  color: ${({ theme }) => theme.palette.gold};
`;
export const Note = styled.span<{ $bad?: boolean }>`
  font-size: 12.5px;
  color: ${({ $bad }) => ($bad ? C.bad : C.muted)};
`;
export const Eyebrow = styled.span`
  font-family: ${C.mono};
  font-size: 11px;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: ${({ theme }) => theme.palette.brand};
`;
export const Mk = styled.div`
  ${({ theme }) => theme.typography.fonts.fontHeading};
  font-size: 15px;
  color: ${({ theme }) => theme.palette.brandLight};
`;
export const Ex = styled.span`
  font-family: ${C.mono};
  font-size: 9.5px;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: ${C.muted};
  border: 1px dashed #4a3a30;
  border-radius: 4px;
  padding: 0 5px;
`;

/* ---------- layout ---------- */

export const Stack = styled.div<{ gap?: number }>`
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: ${({ gap = 16 }) => gap}px;
  min-width: 0;
`;
export const Row = styled.div<{ $start?: boolean }>`
  display: flex;
  justify-content: ${({ $start }) => ($start ? 'flex-start' : 'space-between')};
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
`;
export const Grid2 = styled.div`
  display: grid;
  grid-template-columns: minmax(0, 1.15fr) minmax(0, 1fr);
  gap: 14px;
  align-items: start;
`;
export const Card = styled.div<{
  $hot?: boolean;
  $quiet?: boolean;
  $flush?: boolean;
}>`
  border: 1px solid ${C.edge};
  border-radius: 10px;
  padding: 16px;
  background: linear-gradient(180deg, #211e1d 0%, #121010 90%);
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: ${({ $flush }) => ($flush ? 0 : 11)}px;
  min-width: 0;
  ${({ $hot, theme }) => $hot && `border-color: ${theme.palette.gold};`}
  ${({ $quiet }) => $quiet && `background: #121010; border-style: dashed;`}
`;
export const Bar = ({ pct }: { pct: number }) => (
  <BarTrack>
    <i style={{ width: `${pct}%` }} />
  </BarTrack>
);
const BarTrack = styled.div`
  height: 6px;
  border-radius: 3px;
  background: #2a201b;
  overflow: hidden;
  i {
    display: block;
    height: 100%;
    background: linear-gradient(90deg, #95613f, ${C.warn});
  }
`;
export const Banner = styled.div`
  padding: 10px 12px;
  border-radius: 8px;
  font-size: 13px;
  background: rgba(158, 135, 194, 0.08);
  border: 1px solid rgba(158, 135, 194, 0.35);
`;

// One line in a list: moon, name, detail, right-hand value or action.
export const ListRow = styled.div`
  display: grid;
  grid-template-columns: 30px minmax(0, 1.3fr) minmax(0, 1fr) 170px;
  gap: 12px;
  align-items: center;
  padding: 11px 0;
  border-top: 1px solid #241b16;
  font-size: 13px;
  &:first-child {
    border-top: 0;
  }
  > :last-child {
    justify-self: end;
    text-align: right;
  }
  ${({ onClick }) =>
    onClick &&
    css`
      cursor: pointer;
      &:hover ${Mk} {
        color: ${({ theme }) => theme.palette.gold};
      }
    `}
`;

// Props that make a non-button element act as one.
export const clickable = (onClick: () => void) => ({
  onClick,
  role: 'button',
  tabIndex: 0,
  onKeyDown: (e: React.KeyboardEvent) => {
    if (e.target !== e.currentTarget) return;
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onClick();
    }
  },
});

/* ---------- chips ---------- */

const CHIP: Record<Phase, string> = {
  Scheduled: C.mystery,
  Deposit: C.ok,
  Fulfillment: C.warn,
  Settlement: '#EAB85B',
  Cancelled: C.muted,
};
const ChipBase = styled.span<{ color: string; dashed?: boolean }>`
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-family: ${C.mono};
  font-size: 10.5px;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  padding: 3px 9px;
  border-radius: 999px;
  border: 1px ${({ dashed }) => (dashed ? 'dashed' : 'solid')} currentColor;
  color: ${({ color }) => color};
  width: fit-content;
  line-height: 1.35;
  &::before {
    content: '';
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: currentColor;
  }
`;
export const PhaseChip = ({ phase }: { phase: Phase }) => (
  <ChipBase color={CHIP[phase]}>{phase}</ChipBase>
);
export const PausedChip = () => (
  <ChipBase color={C.pause} dashed>
    Paused
  </ChipBase>
);
export const WishChip = ({ children }: { children: ReactNode }) => (
  <ChipBase color="#FFDEC9">{children}</ChipBase>
);
export const Chips = styled.span`
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
`;

/* ---------- controls ---------- */

export const Btn = styled(Button).attrs({ isSmall: true, autoWidth: true })<{
  $ghost?: boolean;
}>`
  height: auto;
  width: fit-content;
  padding: 10px 16px;
  border-radius: 8px;
  font-size: 12px;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  font-weight: 700;
  white-space: nowrap;
  color: ${({ theme }) => theme.palette.light};
  background: linear-gradient(90deg, #95613f, #bd7b4f 60%, #95613f);
  border: 1px solid ${({ theme }) => theme.palette.brand};
  ${({ $ghost, theme }) =>
    $ghost &&
    css`
      background: transparent;
      color: ${theme.palette.brandLight};
      border-color: ${theme.palette.brandDark};
      font-weight: 600;
    `}
  &:disabled {
    opacity: 0.55;
    color: ${({ theme }) => theme.palette.light};
  }
`;

const linkCss = css`
  all: unset;
  cursor: pointer;
  color: ${({ theme }) => theme.palette.gold};
  font-weight: 600;
  font-size: 13px;
  &:hover {
    text-decoration: underline;
  }
  &:focus-visible {
    outline: 2px solid ${({ theme }) => theme.palette.gold};
    outline-offset: 2px;
  }
`;
export const TextLink = styled(Link)`
  ${linkCss}
`;
export const TextButton = styled.button`
  ${linkCss}
`;

export const Seg = styled.div`
  display: inline-flex;
  width: fit-content;
  border: 1px solid ${({ theme }) => theme.palette.brandDark};
  border-radius: 8px;
  overflow: hidden;
  max-width: 100%;
  flex-wrap: wrap;
  button {
    all: unset;
    cursor: pointer;
    padding: 6px 12px;
    font-size: 12px;
    color: ${C.muted};
    display: inline-flex;
    gap: 6px;
    align-items: center;
  }
  button[aria-pressed='true'] {
    background: #2a1d14;
    color: ${({ theme }) => theme.palette.brandLight};
  }
  button:focus-visible {
    outline: 2px solid ${({ theme }) => theme.palette.gold};
    outline-offset: -2px;
  }
`;

export const Field = styled.label`
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 4px;
  min-width: 0;
  > span:first-child {
    font-size: 11px;
    color: ${C.muted};
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }
`;
export const InputBox = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 10px 12px;
  border-radius: 8px;
  border: 1px solid ${C.edge};
  background: #0b0a0a;
  min-width: 0;
  color: ${C.text};
  input,
  select {
    all: unset;
    min-width: 0;
    flex: 1;
    width: 100%;
    font-variant-numeric: tabular-nums;
  }
  select {
    cursor: pointer;
  }
  option {
    background: #151312;
  }
  &:focus-within {
    border-color: ${({ theme }) => theme.palette.gold};
  }
`;
export const Tok = styled.span`
  font-family: ${C.mono};
  font-size: 12px;
  color: ${({ theme }) => theme.palette.brandLight};
  padding: 2px 8px;
  border-radius: 6px;
  background: #2a1d14;
  white-space: nowrap;
`;

/* ---------- strips ---------- */

export const ClaimStrip = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
  padding: 10px 14px;
  border: 1px solid ${({ theme }) => theme.palette.gold};
  border-radius: 10px;
  background: linear-gradient(90deg, rgba(234, 184, 91, 0.1), transparent);
  font-size: 13px;
  > span {
    display: flex;
    align-items: center;
    gap: 8px;
  }
`;

export const PastRow = styled.div`
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
`;
export const PastPill = styled.button<{ $claim?: boolean }>`
  all: unset;
  cursor: pointer;
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  gap: 2px 8px;
  align-items: center;
  padding: 8px 12px;
  border: 1px solid ${({ $claim }) => ($claim ? '#EAB85B' : '#2e231c')};
  border-radius: 10px;
  background: #121010;
  font-size: 12px;
  b {
    ${({ theme }) => theme.typography.fonts.fontHeading};
    font-weight: 400;
    font-size: 14px;
    color: ${({ theme }) => theme.palette.brandLight};
  }
  ${Note} {
    grid-column: 2;
  }
  &:hover,
  &:focus-visible {
    border-color: ${({ theme }) => theme.palette.brand};
  }
`;

/* ---------- moon spine: one auction's four phases ---------- */

type Node = {
  phase: MoonPhase;
  state: 'done' | 'now' | 'todo';
  label: string;
  date: string;
  left?: string;
  paused?: boolean;
};

const ORDER: Phase[] = ['Scheduled', 'Deposit', 'Fulfillment', 'Settlement'];

const spineNodes = (a: Auction | undefined, now: Date): Node[] => {
  if (!a)
    return ORDER.map((label, i) => ({
      phase: 'none',
      state: 'todo',
      label,
      date: i ? '' : 'no auction yet',
    }));
  const p = phaseOf(a, now);
  const over = p === 'Settlement' || p === 'Cancelled';
  const cur = p === 'Cancelled' ? 3 : ORDER.indexOf(p);
  const dates = [
    p === 'Scheduled'
      ? `opens ${fmtDayTime(a.depositStart)}`
      : `created ${fmtDay(a.createdAt)}`,
    over
      ? fmtRange(a.depositStart, a.depositEnd)
      : cur > 1
      ? `closed ${fmtDay(a.depositEnd)}`
      : `until ${fmtDayTime(a.depositEnd)}`,
    over
      ? fmtRange(a.depositEnd, a.fulfillmentEnd)
      : `until ${fmtDayTime(a.fulfillmentEnd)}`,
    p === 'Cancelled'
      ? `cancelled ${fmtDay(a.cancelledAt ?? a.fulfillmentEnd)}`
      : over
      ? `settled ${fmtDay(a.settledAt ?? a.fulfillmentEnd)}`
      : `claim from ${fmtDay(a.fulfillmentEnd)}`,
  ];
  const ends = [a.depositStart, a.depositEnd, a.fulfillmentEnd];
  return ORDER.map((label, i) => ({
    phase: i === 3 && p === 'Cancelled' ? 'Cancelled' : label,
    state: i < cur ? 'done' : i === cur ? 'now' : 'todo',
    label: i === 3 && p === 'Cancelled' ? 'Cancelled' : label,
    date: dates[i],
    left: i === cur && !over ? `${fmtLeft(now, ends[i])} left` : undefined,
    paused: i === cur && a.paused,
  }));
};

export const Spine = ({ auction, now }: { auction?: Auction; now: Date }) => {
  const nodes = spineNodes(auction, now);
  const cur = nodes.findIndex((n) => n.state === 'now');
  return (
    <SpineGrid>
      <i style={{ width: `${Math.max(0, cur) * 25}%` }} />
      {nodes.map((n) => (
        <SpineNode key={n.label} $state={n.state}>
          <span>
            <Moon
              phase={n.phase}
              size={n.state === 'now' ? 38 : 30}
              paused={n.paused}
            />
          </span>
          <b>{n.label}</b>
          <span>{n.date}</span>
          {n.left && <em>{n.left}</em>}
        </SpineNode>
      ))}
    </SpineGrid>
  );
};

const SpineGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  position: relative;
  padding-top: 4px;
  &::before,
  > i {
    content: '';
    position: absolute;
    left: 12.5%;
    top: 24px;
    height: 1px;
  }
  &::before {
    right: 12.5%;
    background: ${C.line};
  }
  > i {
    background: linear-gradient(90deg, #95613f, #eab85b);
  }
`;
const SpineNode = styled.div<{ $state: Node['state'] }>`
  display: grid;
  grid-template-rows: 40px auto auto auto;
  align-content: start;
  justify-items: center;
  gap: 4px;
  text-align: center;
  font-size: 12px;
  color: ${C.muted};
  position: relative;
  min-width: 0;
  padding: 0 4px;
  opacity: ${({ $state }) => ($state === 'todo' ? 0.6 : 1)};
  > span:first-child {
    background: #0b0a0a;
    padding: 0 6px;
    line-height: 0;
    height: 40px;
    display: grid;
    place-items: center;
    ${({ $state }) =>
      $state === 'now' &&
      'svg { filter: drop-shadow(0 0 8px rgba(241,221,176,.35)); }'}
  }
  b {
    ${({ theme }) => theme.typography.fonts.fontHeading};
    font-weight: 400;
    font-size: 15px;
    color: ${({ $state, theme }) =>
      $state === 'now' ? theme.palette.gold : C.text};
  }
  em {
    font-style: normal;
    font-family: ${C.mono};
    font-size: 10.5px;
    color: ${({ theme }) => theme.palette.gold};
    border: 1px solid ${({ theme }) => theme.palette.brandDark};
    border-radius: 999px;
    padding: 1px 8px;
  }
`;
