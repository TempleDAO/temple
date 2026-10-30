import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Auction, Phase, Wish } from '../data/types';
import {
  addDays,
  auctionName,
  fillPct,
  fmt,
  fmtDay,
  fmtDayTime,
  isRunning,
  pairIdOf,
  phaseOf,
  settlementFor,
} from '../data/derive';
import {
  useAuctions,
  useClaimable,
  useMyPositions,
  useMyWishes,
  useNow,
  useWishActions,
} from '../data/hooks';
import { MyActivityTGLD } from '../../MyActivity/BidsForTGLD';
import { MyActivitySpice } from '../../MyActivity/BidsForSpice';
import {
  Banner,
  Btn,
  Card,
  clickable,
  Coin,
  ListRow,
  Mk,
  Moon,
  Note,
  Seg,
  Stack,
  TextLink,
  WishChip,
} from '../ui';
import { paths } from '../paths';
import { ClaimStrips, PageHead, SectionHead, useRunning } from './common';

const Tabs = ({ on }: { on: 'now' | 'legacy' }) => {
  const navigate = useNavigate();
  return (
    <Seg>
      <button
        aria-pressed={on === 'now'}
        onClick={() => navigate(paths.activity)}
      >
        Auctions and wishes
      </button>
      <button
        aria-pressed={on === 'legacy'}
        onClick={() => navigate(paths.legacy)}
      >
        Spice Bazaar (past)
      </button>
    </Seg>
  );
};

export const Activity = () => {
  const now = useNow();
  const navigate = useNavigate();
  const auctions = useAuctions().data;
  const mine = useMyPositions()
    .data.filter((p) => p.deposit > 0)
    .map((pos) => {
      const a = auctions.find((x) => x.id === pos.auction) as Auction;
      return { pos, a, p: phaseOf(a, now) };
    });
  const live = mine.filter(({ p }) => isRunning(p));
  const past = mine
    .filter(({ p }) => !isRunning(p))
    .sort(
      (x, y) =>
        +(y.a.cancelledAt ?? y.a.fulfillmentEnd) -
        +(x.a.cancelledAt ?? x.a.fulfillmentEnd)
    );
  const wishes = useMyWishes().data.filter((w) => w.expiry > now);

  return (
    <Stack>
      <PageHead title="My Activity" right={<Tabs on="now" />} />
      <ClaimStrips />

      <SectionHead label="In auctions" />
      <Card $flush>
        {live.map(({ pos, a, p }) => (
          <ListRow key={a.id} {...clickable(() => navigate(paths.auction(a)))}>
            <Moon phase={p} size={24} paused={a.paused} />
            <div>
              <Mk>{auctionName(a)}</Mk>
              <Note>
                {fmt(pos.deposit)} {a.bidToken} → {fmt(pos.deposit * a.price)}{' '}
                {a.fillToken} at full funding
              </Note>
            </div>
            <Note>
              {a.paused
                ? 'paused: no deposits or withdrawals'
                : p === 'Deposit'
                ? `withdraw until ${fmtDayTime(a.depositEnd)}`
                : `locked while the Treasury funds, until ${fmtDayTime(
                    a.fulfillmentEnd
                  )}`}
            </Note>
            <Note>
              {a.paused ? 'paused' : p === 'Deposit' ? 'open' : 'funding'}
            </Note>
          </ListRow>
        ))}
        {!live.length && <Note>Nothing deposited in a running auction.</Note>}
      </Card>

      <SectionHead label="Your wishes">no tokens leave your wallet</SectionHead>
      <Card $flush>
        {wishes.map((w) => (
          <WishRow key={`${w.from}-${w.to}`} w={w} />
        ))}
        {!wishes.length && <Note>No wishes yet.</Note>}
      </Card>

      <SectionHead label="Past auctions" />
      <Card $flush>
        {past.map(({ pos, a, p }) => (
          <PastRow key={a.id} a={a} p={p} deposit={pos.deposit} />
        ))}
      </Card>
    </Stack>
  );
};

const WishRow = ({ w }: { w: Wish }) => {
  const now = useNow();
  const navigate = useNavigate();
  const { extendWish } = useWishActions();
  const open = useRunning().find(
    ({ a }) => pairIdOf(a.bidToken, a.fillToken) === pairIdOf(w.from, w.to)
  );
  const soon = +w.expiry - +now < 7 * 864e5;
  const extendTo = addDays(now, 30);
  return (
    <ListRow>
      <Coin />
      <div>
        <Mk>
          {fmt(w.amount)} {w.from} → {w.to}{' '}
          {w.isNew && <WishChip>new</WishChip>}
        </Mk>
        <Note>
          expires {fmtDayTime(w.expiry)}
          {soon && ` · in ${Math.round((+w.expiry - +now) / 864e5)} days`}
        </Note>
      </div>
      <Note>
        {!open ? (
          'No auction yet'
        ) : open.p === 'Scheduled' ? (
          `#${open.a.number} opens ${fmtDay(open.a.depositStart)}${
            open.a.depositStart > w.expiry ? ', after it expires' : ''
          }`
        ) : (
          <TextLink to={paths.auction(open.a)}>
            #{open.a.number} is{' '}
            {open.p === 'Deposit' ? 'taking deposits' : 'funding'}
          </TextLink>
        )}
      </Note>
      {soon ? (
        <Btn $ghost onClick={() => extendWish(w, extendTo)}>
          Extend to {fmtDay(extendTo)}
        </Btn>
      ) : (
        <Btn
          $ghost
          onClick={() => navigate(paths.wish(w.from, w.to, w.amount))}
        >
          Edit wish
        </Btn>
      )}
    </ListRow>
  );
};

const PastRow = ({
  a,
  p,
  deposit,
}: {
  a: Auction;
  p: Phase;
  deposit: number;
}) => {
  const now = useNow();
  const navigate = useNavigate();
  const owed = useClaimable(a).data;
  const s = settlementFor(a, deposit, now);
  const go = () => navigate(paths.auction(a));
  return (
    <ListRow {...clickable(go)}>
      <Moon phase={p} size={24} />
      <div>
        <Mk>{auctionName(a)}</Mk>
        <Note>
          {p === 'Cancelled'
            ? `cancelled ${fmtDay(a.cancelledAt ?? a.fulfillmentEnd)}`
            : `${fillPct(a)}% filled · settled ${fmtDay(
                a.settledAt ?? a.fulfillmentEnd
              )}`}
        </Note>
      </div>
      <Note>
        {!s
          ? ''
          : p === 'Cancelled'
          ? `${fmt(s.refund)} ${a.bidToken} returned`
          : `${fmt(s.fill)} ${a.fillToken}${
              s.refund ? ` + ${fmt(s.refund)} ${a.bidToken}` : ''
            }`}
      </Note>
      {owed ? (
        <Btn $ghost onClick={go}>
          Claim
        </Btn>
      ) : (
        <Note>claimed</Note>
      )}
    </ListRow>
  );
};

// The old Bids for TGLD and Bids for spice claims, unchanged, so nobody loses what they're owed.
export const LegacyActivity = () => {
  const [tab, setTab] = useState<'tgld' | 'spice'>('tgld');
  return (
    <Stack>
      <PageHead title="My Activity" right={<Tabs on="legacy" />} />
      <Banner>
        Claim what you&apos;re owed from past Spice Bazaar auctions here.
      </Banner>
      <Seg>
        <button aria-pressed={tab === 'tgld'} onClick={() => setTab('tgld')}>
          Bids for TGLD
        </button>
        <button aria-pressed={tab === 'spice'} onClick={() => setTab('spice')}>
          Bids for spice
        </button>
      </Seg>
      {tab === 'tgld' ? (
        <MyActivityTGLD embedded />
      ) : (
        <MyActivitySpice embedded />
      )}
    </Stack>
  );
};
