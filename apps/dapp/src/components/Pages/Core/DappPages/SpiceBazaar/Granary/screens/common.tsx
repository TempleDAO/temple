import { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Auction, Pair } from '../data/types';
import {
  auctionName,
  deadlineOf,
  fillPct,
  fmt,
  fmtDayTime,
  fmtLeft,
  fmtMonth,
  fmtM,
  isRunning,
  pairIdOf,
  phaseOf,
} from '../data/derive';
import {
  useAuctions,
  useClaimable,
  useMyPositions,
  useMyWishes,
  useNow,
} from '../data/hooks';
import {
  Big,
  Btn,
  Card,
  ClaimStrip,
  Eyebrow,
  K,
  Moon,
  Note,
  PastPill,
  PastRow,
  Row,
  TextLink,
} from '../ui';
import { paths } from '../paths';

export const PageHead = ({
  back,
  kicker,
  title,
  right,
}: {
  back?: [string, string];
  kicker?: string;
  title: ReactNode;
  right?: ReactNode;
}) => (
  <Row>
    <div>
      {back && (
        <K>
          <TextLink to={back[0]}>← {back[1]}</TextLink>
        </K>
      )}
      {kicker && <K>{kicker}</K>}
      <Big>{title}</Big>
    </div>
    {right}
  </Row>
);

export const SectionHead = ({
  label,
  children,
}: {
  label: string;
  children?: ReactNode;
}) => (
  <Row>
    <Eyebrow>{label}</Eyebrow>
    {children && <Note>{children}</Note>}
  </Row>
);

// Running auctions sorted by their next deadline, as All auctions lists them.
export const useRunning = () => {
  const now = useNow();
  return useAuctions()
    .data.map((a) => ({ a, p: phaseOf(a, now) }))
    .filter(({ p }) => isRunning(p))
    .sort((x, y) => +deadlineOf(x.a, x.p) - +deadlineOf(y.a, y.p));
};

// The "when" text of a running auction.
export const whenText = (a: Auction, now: Date) => {
  const p = phaseOf(a, now);
  return p === 'Scheduled'
    ? `opens in ${fmtLeft(now, a.depositStart)}`
    : p === 'Deposit'
    ? `closes in ${fmtLeft(now, a.depositEnd)}`
    : `ends in ${fmtLeft(now, a.fulfillmentEnd)}`;
};

export const stateText = (a: Auction, now: Date) => {
  const p = phaseOf(a, now);
  if (p === 'Scheduled')
    return `Scheduled · opens ${fmtDayTime(a.depositStart)}`;
  if (p === 'Deposit') return a.paused ? 'Deposit · paused' : 'Deposit · open';
  if (p === 'Fulfillment')
    return `Fulfillment · Treasury funding ${fillPct(a)}%`;
  return p === 'Cancelled' ? 'Cancelled' : `Settlement · ${fillPct(a)}% filled`;
};

const OneClaimStrip = ({ a }: { a: Auction }) => {
  const navigate = useNavigate();
  const now = useNow();
  const { data } = useClaimable(a);
  if (!data) return null;
  return (
    <ClaimStrip>
      <span>
        <Moon phase={phaseOf(a, now)} size={18} />
        {data.fill
          ? `${auctionName(a)} settled, ${fillPct(a)}% filled. Claim ${fmt(
              data.fill
            )} ${a.fillToken} and ${fmt(data.refund)} ${a.bidToken}.`
          : `${auctionName(a)} cancelled. Claim ${fmt(data.refund)} ${
              a.bidToken
            }.`}
      </span>
      <Btn onClick={() => navigate(paths.auction(a))}>Claim</Btn>
    </ClaimStrip>
  );
};

// One strip per auction the account can claim from now.
export const ClaimStrips = () => {
  const positions = useMyPositions().data;
  const auctions = useAuctions().data;
  return (
    <>
      {positions
        .filter((p) => !p.claimed && p.deposit > 0)
        .map((p) => auctions.find((a) => a.id === p.auction))
        .map((a) => a && <OneClaimStrip key={a.id} a={a} />)}
    </>
  );
};

// Past moons for a pair: the latest few, plus any you can still claim.
export const PastAuctions = ({
  pair,
  auctions,
  current,
}: {
  pair: Pair;
  auctions: Auction[];
  current?: Auction;
}) => {
  const now = useNow();
  const navigate = useNavigate();
  const positions = useMyPositions().data;
  const past = auctions.filter((a) => !isRunning(phaseOf(a, now)));
  if (!past.length) return null;
  const open = (a: Auction) =>
    positions.find((p) => p.auction === a.id && !p.claimed && p.deposit > 0);
  const shown = past.filter((a, i) => i < 4 || open(a));
  return (
    <>
      <SectionHead label="Past auctions">
        {pair.wishedFor > 0 &&
          `${fmtM(pair.wishedFor)} ${pair.bidToken} wished for · `}
        <TextLink to={paths.history(pair.id)}>
          See all {auctions.length} auctions
        </TextLink>
      </SectionHead>
      <PastRow>
        {shown.map((a) => {
          const p = phaseOf(a, now);
          const mine = positions.find((x) => x.auction === a.id);
          return (
            <PastPill
              key={a.id}
              $claim={!!open(a)}
              aria-current={a === current || undefined}
              onClick={() => navigate(paths.auction(a))}
            >
              <Moon phase={p} size={24} />
              <b>
                #{a.number} · {fmtMonth(a.cancelledAt ?? a.fulfillmentEnd)}
              </b>
              <Note>
                {p === 'Cancelled'
                  ? mine?.claimed
                    ? 'cancelled · refunded'
                    : 'cancelled'
                  : `${fillPct(a)}% filled${open(a) ? ' · claim ready' : ''}`}
              </Note>
            </PastPill>
          );
        })}
      </PastRow>
    </>
  );
};

// The quiet line a pair page shows when you have a wish for it.
export const WishLine = ({ pair }: { pair: Pair }) => {
  const wish = useMyWishes().data.find(
    (w) => pairIdOf(w.from, w.to) === pair.id
  );
  if (!wish) return null;
  return (
    <Card $quiet>
      <Row>
        <Note>
          Your wish for {pair.bidToken} → {pair.fillToken}: {fmt(wish.amount)}{' '}
          {wish.from} until {fmtDayTime(wish.expiry)}.
        </Note>
        <TextLink to={paths.wish(wish.from, wish.to, wish.amount)}>
          Edit wish
        </TextLink>
      </Row>
    </Card>
  );
};

export const WishFooter = ({ text }: { text: string }) => {
  const navigate = useNavigate();
  return (
    <Row>
      <Note>{text}</Note>
      <Btn $ghost onClick={() => navigate(paths.wish())}>
        Make a wish
      </Btn>
    </Row>
  );
};
