import { ComponentProps, ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import styled from 'styled-components';
import linkSvg from 'assets/icons/link.svg?react';
import type { Auction, Pair } from '../data/types';
import {
  auctionName,
  deadlineOf,
  fillPct,
  fmt,
  fmtDayTime,
  fmtLeft,
  fmtM,
  fmtMonth,
  isPositive,
  isRunning,
  pairIdOf,
  phaseOf,
} from '../data/derive';
import {
  useAuctions,
  useClaimable,
  useGranaryWallet,
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
import { explorerUrl, paths } from '../paths';

export const PageHead = ({
  back,
  title,
  right,
  explorer,
}: {
  back?: [string, string];
  title: ReactNode;
  right?: ReactNode;
  // a contract to link on the block explorer, shown as the arrow icon after the title
  explorer?: { address: string; label: string };
}) => {
  const href = explorer && explorerUrl(explorer.address);
  return (
    <Row>
      <div>
        {back && (
          <K>
            <TextLink to={back[0]}>← {back[1]}</TextLink>
          </K>
        )}
        <Big>
          {title}
          {explorer && href && (
            <ExplorerLink
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={explorer.label}
              title={explorer.label}
            >
              <LinkIcon />
            </ExplorerLink>
          )}
        </Big>
      </div>
      {right}
    </Row>
  );
};

const ExplorerLink = styled.a`
  display: inline-flex;
  vertical-align: middle;
  margin-left: 8px;
  color: ${({ theme }) => theme.palette.brand};
  &:hover {
    color: ${({ theme }) => theme.palette.brandLight};
  }
  &:focus-visible {
    outline: 2px solid ${({ theme }) => theme.palette.gold};
    outline-offset: 2px;
  }
`;

const LinkIcon = styled(linkSvg)`
  width: 20px;
  height: 20px;
  fill: currentColor;
`;

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
        {phaseOf(a, now) === 'Cancelled'
          ? `${auctionName(a)} cancelled. Claim ${fmt(data.refund)} ${
              a.bidToken
            }.`
          : !isPositive(data.fill)
          ? `${auctionName(a)} settled, nothing filled. Claim back ${fmt(
              data.refund
            )} ${a.bidToken}.`
          : isPositive(data.refund)
          ? `${auctionName(a)} settled, ${fillPct(a)}% filled. Claim ${fmt(
              data.fill
            )} ${a.fillToken} and ${fmt(data.refund)} ${a.bidToken}.`
          : `${auctionName(a)} settled, ${fillPct(a)}% filled. Claim ${fmt(
              data.fill
            )} ${a.fillToken}.`}
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
        .filter((p) => !p.claimed && isPositive(p.deposit))
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
    positions.find(
      (p) => p.auction === a.id && !p.claimed && isPositive(p.deposit)
    );
  const shown = past.filter((a, i) => i < 4 || open(a));
  return (
    <>
      <SectionHead label="Past auctions">
        {pair.wishedFor &&
          isPositive(pair.wishedFor) &&
          `${fmtM(pair.wishedFor)} ${pair.bidToken} wished for · `}
        <TextLink to={paths.history(pair.id)}>
          {auctions.length === 1
            ? 'See its history'
            : `See all ${auctions.length} auctions`}
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
  const now = useNow();
  const wish = useMyWishes().data.find(
    (w) => pairIdOf(w.give, w.get) === pair.id && w.expiresAt > now
  );
  if (!wish) return null;
  return (
    <Card $quiet>
      <Row>
        <Note>
          Your wish for {wish.give} → {wish.get}: {fmt(wish.amount)} {wish.give}{' '}
          until {fmtDayTime(wish.expiresAt)}.
        </Note>
        <TextLink to={paths.wish(wish.give, wish.get)}>Edit wish</TextLink>
      </Row>
    </Card>
  );
};

// A button that sends a transaction. With no wallet connected it asks to
// connect one instead. An async onClick shows the spinner until it resolves.
export const TxBtn = ({
  children,
  onClick,
  disabled,
  ...rest
}: ComponentProps<typeof Btn>) => {
  const { account, connect } = useGranaryWallet();
  if (!account)
    return (
      <Btn {...rest} onClick={connect}>
        Connect wallet
      </Btn>
    );
  return (
    <Btn {...rest} disabled={disabled} onClick={onClick}>
      {children}
    </Btn>
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
