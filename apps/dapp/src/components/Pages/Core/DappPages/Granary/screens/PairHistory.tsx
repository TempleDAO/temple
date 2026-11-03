import { useState } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import styled, { css } from 'styled-components';
import { phone } from 'styles/breakpoints';
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
              <div key={a.id} title={`#${a.number} · ${filled(a)}`}>
                <b>
                  <span
                    className={kind}
                    style={{ height: `${kind ? 100 : fillPct(a)}%` }}
                  />
                </b>
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
      <TableScroll>
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
                    {fmtRange(
                      a.depositStart,
                      a.cancelledAt ?? a.fulfillmentEnd
                    )}
                  </td>
                  <td>
                    <Price>{fmtPrice(a.price)}</Price>
                  </td>
                  <td data-k="Deposited">
                    {fmtM(a.totalDeposits)} {a.bidToken}
                    {p === 'Deposit' ? ' so far' : ''}
                  </td>
                  <td data-k="Filled">{filled(a)}</td>
                  <td data-k="You">{you(a) ?? <Note>—</Note>}</td>
                </tr>
              );
            })}
          </tbody>
        </Table>
      </TableScroll>
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
  overflow-x: auto;
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
  /* the full-height track, so an empty auction still shows a column */
  b {
    display: flex;
    align-items: flex-end;
    width: 22px;
    background: #1d1916;
    border-bottom: 1px solid ${C.line};
    border-radius: 3px 3px 0 0;
  }
  span {
    width: 100%;
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

// Scrolls sideways if it ever outgrows the page; on a phone the rows stack.
const TableScroll = styled.div`
  overflow-x: auto;
  border: 1px solid ${C.line};
  border-radius: 10px;
`;

const Table = styled.table`
  border-collapse: collapse;
  width: 100%;
  font-size: 14px;
  th,
  td {
    text-align: left;
    padding: 11px 14px;
    border-bottom: 1px solid ${C.line};
    white-space: nowrap;
  }
  tbody tr:last-child td {
    border-bottom: 0;
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
  /* on a phone each auction is a card: number, dates and price on top, the
     rest labelled underneath */
  ${phone(css`
    &,
    tbody {
      display: block;
    }
    thead {
      display: none;
    }
    tbody tr {
      display: grid;
      grid-template-columns: auto minmax(0, 1fr) auto;
      align-items: center;
      gap: 6px 12px;
      padding: 12px 14px;
      border-bottom: 1px solid ${C.line};
    }
    tbody tr:last-child {
      border-bottom: 0;
    }
    th,
    td {
      padding: 0;
      border: 0;
    }
    td[data-k] {
      grid-column: 1 / -1;
      display: flex;
      justify-content: space-between;
      gap: 12px;
      font-size: 13px;
      white-space: normal;
      text-align: right;
    }
    td[data-k]::before {
      content: attr(data-k);
      color: ${C.muted};
      text-align: left;
    }
  `)}
`;
