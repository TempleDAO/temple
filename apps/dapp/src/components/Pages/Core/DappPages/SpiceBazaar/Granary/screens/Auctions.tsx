import { useNavigate, useSearchParams } from 'react-router-dom';
import styled from 'styled-components';
import {
  auctionName,
  fillPct,
  fmt,
  fmtM,
  fmtPrice,
  pairIdOf,
  phaseOf,
} from '../data/derive';
import {
  useAuctions,
  useIndexerStatus,
  useMyPositions,
  useNow,
  usePairAuctions,
  usePairs,
} from '../data/hooks';
import type { Pair } from '../data/types';
import {
  Big,
  Card,
  clickable,
  ListRow,
  Mk,
  Moon,
  Note,
  Price,
  Row,
  Seg,
  Stack,
  TextLink,
} from '../ui';
import { paths } from '../paths';
import {
  ClaimStrips,
  SectionHead,
  stateText,
  useRunning,
  whenText,
  WishFooter,
} from './common';
import { SkyChart } from './SkyChart';

export const Auctions = () => {
  const [params, setParams] = useSearchParams();
  const chart = params.get('view') === 'chart';
  return (
    <Stack>
      <Row>
        <Big>Auctions</Big>
        <Seg>
          <button aria-pressed={!chart} onClick={() => setParams({})}>
            List
          </button>
          <button
            aria-pressed={chart}
            onClick={() => setParams({ view: 'chart' })}
          >
            Chart
          </button>
        </Seg>
      </Row>
      <ClaimStrips />
      {chart ? <SkyChart /> : <List />}
      <WishFooter text="Looking for a swap that isn't listed?" />
    </Stack>
  );
};

const List = () => {
  const now = useNow();
  const indexed = useIndexerStatus().data;
  const auctions = useAuctions().data;
  const navigate = useNavigate();
  const positions = useMyPositions().data;
  const running = useRunning();
  const scheduled = running.filter(({ p }) => p === 'Scheduled').length;
  return (
    <>
      <SectionHead label="Running auctions">
        {running.length - scheduled} running · {scheduled} scheduled · sorted by
        next deadline
      </SectionHead>
      <Card $flush>
        {running.map(({ a, p }) => {
          const you = positions.find(
            (x) => x.auction === a.id && x.deposit > 0
          );
          return (
            <ListRow
              key={a.id}
              {...clickable(() => navigate(paths.auction(a)))}
            >
              <Moon phase={p} size={26} paused={a.paused} />
              <div>
                <Mk>{auctionName(a)}</Mk>
                <Note>{stateText(a, now)}</Note>
              </div>
              <div>
                <div>{whenText(a, now)}</div>
                <Note>
                  {you ? `You: ${fmt(you.deposit)} ${a.bidToken}` : ' '}
                </Note>
              </div>
              <Price>{fmtPrice(a.price)}</Price>
            </ListRow>
          );
        })}
      </Card>
      <SectionHead label="All pairs">
        updated {Math.round((+now - +indexed.blockTime) / 60_000)} min ago
      </SectionHead>
      <Card $flush>
        {usePairs()
          .data.filter((p) =>
            auctions.some((a) => pairIdOf(a.bidToken, a.fillToken) === p.id)
          )
          .map((p) => (
            <PairRow key={p.id} pair={p} />
          ))}
      </Card>
    </>
  );
};

const PairRow = ({ pair }: { pair: Pair }) => {
  const now = useNow();
  const navigate = useNavigate();
  const auctions = usePairAuctions(pair.id).data;
  const running = useRunning().find(
    ({ a }) => a.bidToken === pair.bidToken && a.fillToken === pair.fillToken
  );
  const past = auctions.filter((a) => {
    const p = phaseOf(a, now);
    return p === 'Settlement' || p === 'Cancelled';
  });
  const last = past[0];
  return (
    <ListRow {...clickable(() => navigate(paths.pair(pair.id)))}>
      <Moon phase={running?.p ?? 'none'} size={24} paused={running?.a.paused} />
      <div>
        <Mk>
          {pair.bidToken} → {pair.fillToken}
        </Mk>
        <Note>
          {fmtM(pair.wishedFor)} {pair.bidToken} wished for
        </Note>
      </div>
      <Moons>
        {past
          .slice(0, 3)
          .reverse()
          .map((a) => (
            <Moon key={a.id} phase={phaseOf(a, now)} size={16} />
          ))}
        {last && (
          <Note>
            &nbsp;last #{last.number} ·{' '}
            {phaseOf(last, now) === 'Cancelled'
              ? 'cancelled'
              : `${fillPct(last)}%`}
          </Note>
        )}
      </Moons>
      <TextLink
        to={paths.history(pair.id)}
        onClick={(e) => e.stopPropagation()}
      >
        {auctions.length} auctions
      </TextLink>
    </ListRow>
  );
};

const Moons = styled.span`
  display: flex;
  gap: 4px;
  align-items: center;
`;
