import { useState } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import styled from 'styled-components';
import type { Auction } from '../data/types';
import {
  fillPct,
  fmt,
  fmtM,
  fmtPrice,
  fmtRange,
  pairName,
  phaseOf,
} from '../data/derive';
import {
  useMyPositions,
  useNow,
  usePair,
  usePairAuctions,
} from '../data/hooks';
import { Btn, C, clickable, Moon, Note, Price, Row, Seg, Stack } from '../ui';
import { paths } from '../paths';
import { PageHead } from './common';

export const PairHistory = () => {
  const { pairId = '' } = useParams();
  const now = useNow();
  const navigate = useNavigate();
  const pair = usePair(pairId).data;
  const auctions = usePairAuctions(pairId).data;
  const positions = useMyPositions().data;
  const [onlyMine, setOnlyMine] = useState(false);
  if (!pair) return <Navigate replace to={paths.auctions()} />;

  const mine = (a: Auction) =>
    positions.find((p) => p.auction === a.id && p.deposit > 0);
  const rows = onlyMine ? auctions.filter(mine) : auctions;
  const name = pairName(pair.bidToken, pair.fillToken);

  const filled = (a: Auction) => {
    const p = phaseOf(a, now);
    return p === 'Deposit' || p === 'Scheduled'
      ? p === 'Scheduled'
        ? 'scheduled'
        : 'taking deposits'
      : p === 'Fulfillment'
      ? `${fillPct(a)}% funded so far`
      : p === 'Cancelled'
      ? 'cancelled'
      : `${fillPct(a)}%`;
  };
  const you = (a: Auction) => {
    const pos = mine(a);
    if (!pos) return null;
    const p = phaseOf(a, now);
    const status = a.paused
      ? 'paused'
      : pos.claimed
      ? 'claimed'
      : p === 'Settlement' || p === 'Cancelled'
      ? 'claim ready'
      : 'in';
    return `${fmt(pos.deposit)} ${a.bidToken} · ${status}`;
  };

  return (
    <Stack>
      <PageHead
        back={[paths.pair(pair.id), name]}
        kicker="Pair"
        title={`${name} · all auctions`}
        right={
          <Seg>
            <button aria-pressed={!onlyMine} onClick={() => setOnlyMine(false)}>
              All {auctions.length}
            </button>
            <button aria-pressed={onlyMine} onClick={() => setOnlyMine(true)}>
              Only mine
            </button>
          </Seg>
        }
      />
      <div>
        <Fills aria-label="Fill by auction">
          {[...auctions].reverse().map((a) => {
            const p = phaseOf(a, now);
            const kind =
              p === 'Cancelled' ? 'can' : p === 'Settlement' ? '' : 'live';
            return (
              <div key={a.id}>
                <span
                  className={kind}
                  style={{ height: `${kind ? 100 : fillPct(a)}%` }}
                />
                <i>#{a.number}</i>
              </div>
            );
          })}
        </Fills>
        <Note>
          Fill per auction, oldest to newest. Hatched: cancelled. Dashed: still
          running.
        </Note>
      </div>
      <Table>
        <thead>
          <tr>
            <th>Auction</th>
            <th>Dates</th>
            <th>Price</th>
            <th>Deposited</th>
            <th>Filled</th>
            <th>You</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((a) => {
            const p = phaseOf(a, now);
            return (
              <tr key={a.id} {...clickable(() => navigate(paths.auction(a)))}>
                <td>
                  <span className="hm">
                    <Moon phase={p} size={20} paused={a.paused} /> #{a.number}
                  </span>
                </td>
                <td>
                  {fmtRange(a.depositStart, a.cancelledAt ?? a.fulfillmentEnd)}
                </td>
                <td>
                  <Price>{fmtPrice(a.price)}</Price>
                </td>
                <td>
                  {fmtM(a.totalDeposits)} {a.bidToken}
                  {p === 'Deposit' ? ' so far' : ''}
                </td>
                <td>{filled(a)}</td>
                <td>{you(a) ?? <Note>—</Note>}</td>
              </tr>
            );
          })}
        </tbody>
      </Table>
      <Row>
        <Note>
          Showing {rows.length} of {rows.length} · newest first · 20 per page
        </Note>
        <Btn $ghost disabled>
          Older auctions
        </Btn>
      </Row>
    </Stack>
  );
};

const Fills = styled.div`
  display: flex;
  gap: 10px;
  align-items: flex-end;
  height: 92px;
  padding-top: 6px;
  > div {
    display: grid;
    grid-template-rows: 1fr auto;
    justify-items: center;
    gap: 4px;
    height: 100%;
    width: 34px;
  }
  span {
    width: 22px;
    align-self: end;
    border-radius: 3px 3px 0 0;
    background: linear-gradient(180deg, #eab85b, #95613f);
  }
  span.can {
    background: repeating-linear-gradient(
      45deg,
      #3a2f29 0 3px,
      transparent 3px 6px
    );
    border: 1px dashed #5a4a40;
  }
  span.live {
    background: transparent;
    border: 1px dashed ${C.ok};
  }
  i {
    font-style: normal;
    font-family: ${C.mono};
    font-size: 10px;
    color: ${C.muted};
  }
`;

const Table = styled.table`
  border-collapse: collapse;
  width: 100%;
  font-size: 14px;
  border: 1px solid ${C.line};
  border-radius: 10px;
  th,
  td {
    text-align: left;
    padding: 11px 14px;
    border-bottom: 1px solid ${C.line};
    white-space: nowrap;
  }
  th {
    font-family: ${C.mono};
    font-size: 11px;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: ${({ theme }) => theme.palette.brand};
    font-weight: 500;
    background: #151312;
  }
  tbody tr {
    cursor: pointer;
  }
  tbody tr:hover {
    background: #151312;
  }
  .hm {
    display: inline-flex;
    align-items: center;
    gap: 8px;
  }
`;
