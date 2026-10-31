import { useState } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import styled, { keyframes } from 'styled-components';
import type { Token } from '../data/types';
import {
  addDays,
  auctionName,
  fmt,
  fmtDayTime,
  fmtDayYear,
  fmtM,
  pairIdOf,
  pairName,
} from '../data/derive';
import {
  useGranaryWallet,
  useMyWishes,
  useNow,
  usePair,
  usePairAuctions,
  useWalletBalance,
  useWishActions,
  useWishTokens,
} from '../data/hooks';
import {
  Btn,
  Card,
  Field,
  H4,
  InputBox,
  Note,
  Row,
  Spine,
  Stack,
  TextButton,
  TextLink,
  Tok,
  WishChip,
} from '../ui';
import { paths } from '../paths';
import { PageHead, PastAuctions, TxBtn, useRunning } from './common';

const DURATIONS = [30, 90];
const DEFAULT: { give: Token; get: Token } = { give: 'TGLD', get: 'wstETH' };

// Remount on a new query so links like "Edit wish" refill the form.
export const Wish = () => <WishScreen key={useLocation().search} />;

// The one screen where the wish leads: a pair with no auction open.
const WishScreen = () => {
  const now = useNow();
  const [params] = useSearchParams();
  // any two different wish tokens make a pair
  const tokens = useWishTokens().data;
  const pick = (want: (string | null)[], not?: Token) =>
    [...want, ...tokens].find(
      (t): t is Token => !!t && tokens.includes(t) && t !== not
    );

  const [give, setGiveRaw] = useState(() =>
    pick([params.get('give'), DEFAULT.give])
  );
  const [get, setGet] = useState(() =>
    pick([params.get('get'), DEFAULT.get], give)
  );
  const setGive = (t: Token) => {
    setGiveRaw(t);
    if (t === get) setGet(pick([], t));
  };

  const id = give && get ? pairIdOf(give, get) : '';
  const pair = usePair(id).data;
  const auctions = usePairAuctions(id).data;
  const open = useRunning().find(
    ({ a }) => pairIdOf(a.bidToken, a.fillToken) === id
  );

  if (!give || !get)
    return (
      <Stack>
        <PageHead
          back={[paths.auctions(), 'All auctions']}
          title="Make a wish"
        />
        <Note>The wishing well isn&apos;t taking wishes yet.</Note>
      </Stack>
    );

  return (
    <Stack>
      <PageHead
        back={[paths.auctions(), 'All auctions']}
        kicker="Pair"
        title={pairName(give, get)}
        right={
          <Note>
            {pair?.wishedFor === undefined
              ? null
              : pair.wishedFor
              ? `${fmtM(pair.wishedFor)} ${give} wished for`
              : 'No wishes yet'}
          </Note>
        }
      />
      <Spine now={now} />
      <Card $hot>
        <Row>
          <H4>Make a wish</H4>
          <WishChip>Wish</WishChip>
        </Row>
        {open ? (
          <Note>
            {auctionName(open.a)}{' '}
            {open.p === 'Scheduled'
              ? `opens ${fmtDayTime(open.a.depositStart)}`
              : 'is open now'}
            . <TextLink to={paths.auction(open.a)}>Go to the auction</TextLink>,
            or wish for the next one.
          </Note>
        ) : (
          <Note>
            No auction for this swap {auctions.length ? 'right now' : 'yet'}.
            The Temple reads the wishes when deciding which auctions to open.
          </Note>
        )}
        <WishPanel
          give={give}
          get={get}
          gives={tokens}
          gets={tokens.filter((t) => t !== give)}
          setGive={setGive}
          setGet={setGet}
          initialAmount={params.get('amount') ?? ''}
        />
      </Card>
      {pair && <PastAuctions pair={pair} auctions={auctions} />}
    </Stack>
  );
};

const WishPanel = ({
  give,
  get,
  gives,
  gets,
  setGive,
  setGet,
  initialAmount,
}: {
  give: Token;
  get: Token;
  gives: Token[];
  gets: Token[];
  setGive: (t: Token) => void;
  setGet: (t: Token) => void;
  initialAmount: string;
}) => {
  const now = useNow();
  const navigate = useNavigate();
  const { setWish } = useWishActions();
  const { account } = useGranaryWallet();
  const balance = useWalletBalance(give).data;
  // one wish per (give, get): a new one replaces it
  const current = useMyWishes().data.find(
    (w) => w.give === give && w.get === get && w.expiresAt > now
  );
  const [amount, setAmount] = useState(initialAmount);
  const [days, setDays] = useState(DURATIONS[0]);
  const [stage, setStage] = useState<'form' | 'confirm' | 'well' | 'done'>(
    'form'
  );
  const [made, setMade] = useState({ n: 0, until: now });
  const clean = amount.replace(/,/g, '').trim();
  const n = parseFloat(clean);
  const over = !!account && n > balance;
  const until = addDays(now, days);

  const cast = async () => {
    setStage('confirm');
    const ok = await setWish({ give, get, amount: clean, durationDays: days });
    if (!ok) {
      setStage('form');
      return;
    }
    setMade({ n, until });
    setStage('well');
    // the coin lands ~1.06s into the toss; show the result just after
    setTimeout(() => setStage('done'), 1400);
  };

  if (stage === 'well' || stage === 'done')
    return (
      <Well>
        <WellSvg />
        {stage === 'done' && (
          <>
            <Done>
              <b>
                Wish made: {fmt(made.n)} {give} → {get} until{' '}
                {fmtDayYear(made.until)}.
              </b>
              <br />
              It shows in the pair&apos;s wish totals within a few minutes.
            </Done>
            <Row>
              <Btn $ghost onClick={() => navigate(paths.activity)}>
                See your wishes
              </Btn>
              <TextButton onClick={() => setStage('form')}>Done</TextButton>
            </Row>
          </>
        )}
      </Well>
    );

  return (
    <Stack gap={12}>
      <Row $start>
        I&apos;d give
        <InputBox>
          <select
            aria-label="Token to give"
            value={give}
            onChange={(e) => setGive(e.target.value as Token)}
          >
            {gives.map((t) => (
              <option key={t}>{t}</option>
            ))}
          </select>
        </InputBox>
        for
        <InputBox>
          <select
            aria-label="Token to get"
            value={get}
            onChange={(e) => setGet(e.target.value as Token)}
          >
            {gets.map((t) => (
              <option key={t}>{t}</option>
            ))}
          </select>
        </InputBox>
      </Row>
      <Fields>
        <Field>
          <span>I&apos;d give up to</span>
          <InputBox>
            <input
              inputMode="decimal"
              placeholder="0"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
            <Tok>{give}</Tok>
          </InputBox>
          <Note $bad={over}>
            {over ? 'More than the ' : ''}
            {fmt(balance)} {give} you hold
          </Note>
        </Field>
        <Field>
          <span>Until</span>
          <InputBox>
            <select
              value={days}
              onChange={(e) => setDays(Number(e.target.value))}
            >
              {DURATIONS.map((d) => (
                <option key={d} value={d}>
                  {d} days · {fmtDayYear(addDays(now, d))}
                </option>
              ))}
            </select>
          </InputBox>
        </Field>
      </Fields>
      <Note>
        No tokens leave your wallet. Your wish counts until it expires, less
        what you buy in {give} → {get} auctions after making it.
      </Note>
      {current && (
        <Note>
          This replaces your wish of {fmt(current.amount)} {current.give} until{' '}
          {fmtDayTime(current.expiresAt)}.
        </Note>
      )}
      <Row $start>
        {/* not awaited, so the button shows the wallet prompt text instead of a spinner */}
        <TxBtn
          disabled={!(n > 0) || stage === 'confirm'}
          onClick={() => {
            cast();
          }}
        >
          {stage === 'confirm' ? 'Confirm in your wallet…' : 'Make wish'}
        </TxBtn>
      </Row>
    </Stack>
  );
};

const Fields = styled.div`
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  gap: 10px;
`;

/* ---------- the well: a coin drops in and the water ripples ---------- */

const toss = keyframes`
  0% { opacity: 1; transform: translate(-70px, -36px) scale(1) rotate(0); }
  45% { opacity: 1; transform: translate(-20px, -58px) scale(.9) rotate(200deg); }
  92% { opacity: 1; transform: translate(0, 0) scale(.55) rotate(400deg); }
  100% { opacity: 0; transform: translate(0, 6px) scale(.4) rotate(420deg); }
`;
const ripple = keyframes`
  0% { opacity: .9; transform: scale(.15); }
  100% { opacity: 0; transform: scale(1.25); }
`;
const glint = keyframes`
  0% { opacity: 0; } 30% { opacity: .9; } 100% { opacity: .35; }
`;

const Well = styled.div`
  display: grid;
  justify-items: center;
  gap: 8px;
  padding: 6px 0;
  svg {
    width: 280px;
    max-width: 100%;
    height: auto;
    overflow: hidden;
  }
  .coin,
  .ripple {
    transform-box: fill-box;
    transform-origin: center;
    opacity: 0;
  }
  .glint {
    opacity: 0;
  }
  @media (prefers-reduced-motion: no-preference) {
    .coin {
      animation: ${toss} 1.15s cubic-bezier(0.35, 0, 0.65, 1) forwards;
    }
    .glint {
      animation: ${glint} 2.2s ease-out 1.15s forwards;
    }
    .r0 {
      animation: ${ripple} 1.6s ease-out 1.1s forwards;
    }
    .r1 {
      animation: ${ripple} 1.6s ease-out 1.3s forwards;
    }
    .r2 {
      animation: ${ripple} 1.6s ease-out 1.55s forwards;
    }
  }
  /* reduced motion: skip the coin, show the ripples at rest */
  @media (prefers-reduced-motion: reduce) {
    .ripple {
      opacity: 0.5;
      transform: scale(0.8);
    }
    .glint {
      opacity: 0.35;
    }
  }
`;

const Done = styled.p`
  font-size: 13px;
  text-align: center;
  max-width: 44ch;
  margin: 0;
  b {
    color: ${({ theme }) => theme.palette.gold};
    font-weight: 600;
  }
`;

const WellSvg = () => (
  <svg
    viewBox="0 0 220 150"
    role="img"
    aria-label="A coin drops into the wishing well"
  >
    <ellipse cx="110" cy="70" rx="78" ry="20" fill="#1a1412" stroke="#5a4433" />
    <ellipse cx="110" cy="72" rx="66" ry="14" fill="#0e1a1f" />
    <ellipse
      className="glint"
      cx="110"
      cy="72"
      rx="40"
      ry="7"
      fill="#F1DDB0"
      fillOpacity=".18"
    />
    <ellipse
      className="ripple r0"
      cx="110"
      cy="72"
      rx="58"
      ry="12"
      fill="none"
      stroke="#F1DDB0"
      strokeWidth="1.4"
    />
    <ellipse
      className="ripple r1"
      cx="110"
      cy="72"
      rx="58"
      ry="12"
      fill="none"
      stroke="#EAB85B"
      strokeWidth="1"
    />
    <ellipse
      className="ripple r2"
      cx="110"
      cy="72"
      rx="58"
      ry="12"
      fill="none"
      stroke="#BD7B4F"
      strokeWidth=".8"
    />
    <g className="coin">
      <circle cx="110" cy="70" r="7" fill="#EAB85B" stroke="#95613F" />
      <circle
        cx="110"
        cy="70"
        r="3.5"
        fill="none"
        stroke="#95613F"
        strokeWidth=".8"
      />
    </g>
    <path
      d="M32 70 v40 a78 20 0 0 0 156 0 v-40 a78 20 0 0 1 -156 0Z"
      fill="#2a1f19"
      stroke="#5a4433"
    />
    <path
      d="M32 84 a78 20 0 0 0 156 0 M32 98 a78 20 0 0 0 156 0"
      fill="none"
      stroke="#3d2e25"
    />
    <path
      d="M58 80 v14 M86 86 v14 M114 88 v14 M142 86 v14 M168 80 v14 M72 98 v12 M100 102 v12 M128 102 v12 M156 98 v12"
      stroke="#3d2e25"
    />
  </svg>
);
