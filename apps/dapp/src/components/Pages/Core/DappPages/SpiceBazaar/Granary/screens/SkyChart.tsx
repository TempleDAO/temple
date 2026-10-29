import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import styled from 'styled-components';
import { fillPct, fmtDay, fmtMonth, pairIdOf, phaseOf } from '../data/derive';
import { useAuctions, useNow, usePairs } from '../data/hooks';
import type { Auction } from '../data/types';
import { C, Moon, Note, Row, Seg } from '../ui';
import { paths } from '../paths';

type Range = '4 months' | '1 year' | 'All';
const RANGES: Range[] = ['4 months', '1 year', 'All'];

const monthStart = (d: Date, back = 0) =>
  new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() - back, 1));

const endOf = (a: Auction) => a.cancelledAt ?? a.fulfillmentEnd;

// Overlapping auctions on one pair take extra lanes instead of hiding each other.
const lanes = (auctions: Auction[]) => {
  const out: Auction[][] = [];
  [...auctions]
    .sort((a, b) => +a.depositStart - +b.depositStart)
    .forEach((a) => {
      const lane = out.find((l) => endOf(l[l.length - 1]) <= a.depositStart);
      lane ? lane.push(a) : out.push([a]);
    });
  return out;
};

export const SkyChart = () => {
  const now = useNow();
  const navigate = useNavigate();
  const pairs = usePairs().data;
  const auctions = useAuctions().data;
  const [range, setRange] = useState<Range>('4 months');

  const earliest = auctions.reduce(
    (m, a) => (a.depositStart < m ? a.depositStart : m),
    now
  );
  const start =
    range === '4 months'
      ? monthStart(now, 3)
      : range === '1 year'
      ? monthStart(now, 12)
      : monthStart(earliest);
  const end = new Date(+monthStart(now, -1) + 15 * 864e5);
  const x = (d: Date) =>
    `${Math.max(0, ((+d - +start) / (+end - +start)) * 100).toFixed(2)}%`;
  const w = (a: Date, b: Date) => `calc(${x(b)} - ${x(a)})`;
  const months: Date[] = [];
  for (
    let m = start;
    m < end;
    m = new Date(Date.UTC(m.getUTCFullYear(), m.getUTCMonth() + 1, 1))
  )
    months.push(m);

  return (
    <>
      <Row>
        <Note>
          {fmtMonth(start)} {start.getUTCFullYear()} to mid-{fmtMonth(end)}{' '}
          {end.getUTCFullYear()}
        </Note>
        <Seg>
          {RANGES.map((r) => (
            <button
              key={r}
              aria-pressed={r === range}
              onClick={() => setRange(r)}
            >
              {r}
            </button>
          ))}
        </Seg>
      </Row>
      <Scroll>
        <Grid>
          <Label />
          <Axis>
            {months.map((m) => (
              <span key={+m} style={{ left: x(m) }}>
                {fmtMonth(m)}
              </span>
            ))}
          </Axis>
          {pairs.map((pair) => {
            const ls = lanes(
              auctions.filter(
                (a) =>
                  pairIdOf(a.bidToken, a.fillToken) === pair.id &&
                  endOf(a) >= start
              )
            );
            if (!ls.length) return null;
            return [
              <Label key={`${pair.id}-l`}>
                {pair.bidToken} → {pair.fillToken}
              </Label>,
              <Track key={pair.id} style={{ height: ls.length > 1 ? 54 : 34 }}>
                {ls.map((lane, li) =>
                  lane.map((a) => {
                    const p = phaseOf(a, now);
                    const top = li ? 37 : 17;
                    const running = p === 'Deposit' || p === 'Fulfillment';
                    return (
                      <span key={a.id}>
                        {p === 'Scheduled' && (
                          <Seg2
                            $kind="sched"
                            style={{
                              left: x(a.depositStart),
                              width: w(a.depositStart, a.fulfillmentEnd),
                              top,
                            }}
                          />
                        )}
                        {(p === 'Settlement' || p === 'Cancelled') && (
                          <Seg2
                            $kind="past"
                            style={{
                              left: x(a.depositStart),
                              width: w(a.depositStart, endOf(a)),
                              top,
                            }}
                          />
                        )}
                        {running && (
                          <>
                            <Seg2
                              $kind="dep"
                              style={{
                                left: x(a.depositStart),
                                width: w(a.depositStart, a.depositEnd),
                                top,
                              }}
                            />
                            <Seg2
                              $kind="ful"
                              style={{
                                left: x(a.depositEnd),
                                width: w(a.depositEnd, a.fulfillmentEnd),
                                top,
                              }}
                            />
                          </>
                        )}
                        <MoonBtn
                          style={{ left: x(endOf(a)), top }}
                          onClick={() => navigate(paths.auction(a))}
                          aria-label={`${pair.bidToken} → ${pair.fillToken} #${a.number}`}
                        >
                          <Moon phase={p} size={20} paused={a.paused} />
                        </MoonBtn>
                        <Lb style={{ left: x(endOf(a)), top: top - 11 }}>
                          #{a.number}
                          {p === 'Settlement' && ` ${fillPct(a)}%`}
                        </Lb>
                      </span>
                    );
                  })
                )}
                <Today style={{ left: x(now) }} />
              </Track>,
            ];
          })}
        </Grid>
      </Scroll>
      <Note>
        Dashed line: today, {fmtDay(now)}. Each line is one auction, ending in
        its moon. Click a moon to open it.
      </Note>
    </>
  );
};

const Scroll = styled.div`
  overflow-x: auto;
`;
const Grid = styled.div`
  min-width: 600px;
  display: grid;
  grid-template-columns: 140px minmax(0, 1fr);
  font-size: 11px;
  padding-right: 34px;
`;
const Label = styled.div`
  ${({ theme }) => theme.typography.fonts.fontHeading};
  font-size: 13px;
  color: ${({ theme }) => theme.palette.brandLight};
  padding: 6px 8px 6px 0;
  border-top: 1px solid #241b16;
  display: flex;
  align-items: center;
  line-height: 1.2;
  &:first-child {
    border-top: 0;
  }
`;
const Axis = styled.div`
  position: relative;
  height: 20px;
  color: ${C.muted};
  font-family: ${C.mono};
  font-size: 10px;
  span {
    position: absolute;
    top: 2px;
  }
`;
const Track = styled.div`
  position: relative;
  border-top: 1px solid #241b16;
`;
const SEG = {
  dep: `background: ${C.ok}; height: 2px;`,
  ful: `background: ${C.warn}; height: 2px;`,
  past: `background: #5a4636; height: 2px;`,
  sched: `border-top: 1px dashed ${C.mystery}; height: 0;`,
};
const Seg2 = styled.span<{ $kind: keyof typeof SEG }>`
  position: absolute;
  ${({ $kind }) => SEG[$kind]}
`;
const MoonBtn = styled.button`
  all: unset;
  position: absolute;
  transform: translate(-50%, -50%);
  line-height: 0;
  cursor: pointer;
  border-radius: 50%;
  z-index: 2;
  &:focus-visible {
    outline: 2px solid ${({ theme }) => theme.palette.gold};
    outline-offset: 2px;
  }
`;
const Lb = styled.span`
  position: absolute;
  transform: translate(-50%, -100%);
  font-family: ${C.mono};
  font-size: 10px;
  color: ${C.muted};
  white-space: nowrap;
  background: #0b0a0a;
  padding: 0 3px;
  z-index: 2;
  line-height: 1.3;
`;
const Today = styled.span`
  position: absolute;
  top: 0;
  bottom: 0;
  border-left: 1px dashed ${({ theme }) => theme.palette.gold};
  z-index: 1;
  pointer-events: none;
`;
