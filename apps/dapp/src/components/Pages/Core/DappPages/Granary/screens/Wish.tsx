import { useState } from 'react';
import {
  Navigate,
  useLocation,
  useNavigate,
  useParams,
  useSearchParams,
} from 'react-router-dom';
import styled, { css, keyframes } from 'styled-components';
import { phone } from 'styles/breakpoints';
import type { Token } from '../data/types';
import {
  addDays,
  auctionName,
  fmt,
  fmtDayTime,
  fmtDayYear,
  fmtM,
  isPositive,
  pairIdOf,
  pairName,
  parseTyped,
  plain,
  ZERO,
} from '../data/derive';
import {
  useGranaryWallet,
  useMyWishes,
  useNow,
  useWallClock,
  usePair,
  usePairAuctions,
  useWalletBalance,
  useWishActions,
  useWishTokens,
} from '../data/hooks';
import {
  Banner,
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

// The one screen where the wish leads: a pair with no auction open.
export const Wish = () => {
  const navigate = useNavigate();
  // the URL names the pair: /wish/<give>-<get>; ?amount pre-fills a new wish
  // pair IDs are lowercase; links may not be
  const pairId = useParams().pairId?.toLowerCase();
  const [params] = useSearchParams();
  // set when a link's pair wasn't available and we fell back to the default
  const unavailable = !!(
    useLocation().state as { unavailable?: boolean } | null
  )?.unavailable;
  // any two different wish tokens make a pair
  const wishTokens = useWishTokens().data;
  const tokens = wishTokens.map((t) => t.symbol);
  const pick = (want: (string | null)[], not?: Token) =>
    [...want, ...tokens].find(
      (t): t is Token => !!t && tokens.includes(t) && t !== not
    );
  const [give, get] =
    tokens
      .flatMap((g) => tokens.map((t): [Token, Token] => [g, t]))
      .find(([g, t]) => g !== t && pairIdOf(g, t) === pairId) ?? [];

  // changing a token moves to that pair's URL
  // changing a token keeps a link's ?amount
  const go = (g: Token, t: Token) =>
    navigate(paths.wish(g, t, params.get('amount') ?? undefined), {
      replace: true,
    });
  const setGive = (t: Token) => go(t, t === get ? pick([], t) ?? t : get ?? t);
  const setGet = (t: Token) => give && go(give, t);

  // no pair, or one the well doesn't take: the default pair, saying so if
  // the link named a pair
  if (!give || !get) {
    const g = pick([DEFAULT.give]);
    const t = pick([DEFAULT.get], g);
    if (g && t)
      return (
        <Navigate
          replace
          to={paths.wish(g, t)}
          state={pairId ? { unavailable: true } : null}
        />
      );
  }

  return give && get ? (
    <WishPairScreen
      give={give}
      get={get}
      tokens={tokens}
      decimals={wishTokens.find((t) => t.symbol === give)?.decimals ?? 18}
      setGive={setGive}
      setGet={setGet}
      linkAmount={params.get('amount') ?? undefined}
      unavailable={unavailable}
    />
  ) : (
    <Stack>
      <PageHead back={[paths.auctions(), 'All auctions']} title="Make a wish" />
      <Note>The wishing well isn&apos;t taking wishes yet.</Note>
    </Stack>
  );
};

const WishPairScreen = ({
  give,
  get,
  tokens,
  decimals,
  setGive,
  setGet,
  linkAmount,
  unavailable,
}: {
  give: Token;
  get: Token;
  tokens: Token[];
  decimals: number;
  setGive: (t: Token) => void;
  setGet: (t: Token) => void;
  linkAmount?: string;
  unavailable?: boolean;
}) => {
  const now = useNow();
  const id = pairIdOf(give, get);
  const pair = usePair(id).data;
  const auctions = usePairAuctions(id).data;
  const open = useRunning().find(
    ({ a }) => pairIdOf(a.bidToken, a.fillToken) === id
  );

  return (
    <Stack>
      <PageHead
        back={[paths.auctions(), 'All auctions']}
        title={pairName(give, get)}
        right={
          <Note>
            {pair?.wishedFor === undefined
              ? null
              : isPositive(pair.wishedFor)
              ? `${fmtM(pair.wishedFor)} ${give} wished for`
              : 'No wishes yet'}
          </Note>
        }
      />
      {unavailable && (
        <Banner>That pair isn&apos;t open for wishes. Pick one below.</Banner>
      )}
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
          decimals={decimals}
          setGive={setGive}
          setGet={setGet}
          linkAmount={linkAmount}
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
  decimals,
  setGive,
  setGet,
  linkAmount,
}: {
  give: Token;
  get: Token;
  gives: Token[];
  gets: Token[];
  // the give token's: more decimal places can't be sent
  decimals: number;
  setGive: (t: Token) => void;
  setGet: (t: Token) => void;
  // from a link's ?amount: pre-fills the form only when there's no wish yet
  linkAmount?: string;
}) => {
  const now = useNow();
  // the wish's expiry is now + duration on the wall clock
  const wall = useWallClock();
  const navigate = useNavigate();
  const { setWish } = useWishActions();
  const { account } = useGranaryWallet();
  const balance = useWalletBalance(give).data;
  // one wish per (give, get): a new one replaces it
  const current = useMyWishes().data.find(
    (w) => w.give === give && w.get === get && w.expiresAt > now
  );
  // until you type, the form shows your wish for the pair, or the link's amount
  const [edited, setAmount] = useState<string | null>(null);
  const amount = edited ?? (current ? plain(current.amount) : linkAmount ?? '');
  const [days, setDays] = useState(DURATIONS[0]);
  const [stage, setStage] = useState<'form' | 'well' | 'done'>('form');
  const [made, setMade] = useState({ n: ZERO, until: wall });
  const clean = amount.replace(/,/g, '').trim();
  const typed = parseTyped(clean, decimals);
  const over = !!account && !!typed && typed.gt(balance);
  const until = addDays(wall, days);

  const cast = async () => {
    const ok = await setWish({ give, get, amount: clean, durationDays: days });
    if (!ok) return;
    setMade({ n: typed ?? ZERO, until });
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
          <span>{current ? 'Your total wish' : "I'd give up to"}</span>
          <InputBox>
            <input
              inputMode="decimal"
              placeholder="0"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
            <Tok>{give}</Tok>
          </InputBox>
          <Note $bad={over || !typed}>
            {!typed
              ? `Enter a number with at most ${decimals} decimal places`
              : `${over ? 'More than the ' : ''}${fmt(
                  balance
                )} ${give} you hold`}
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
                  {d} days · {fmtDayYear(addDays(wall, d))}
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
          Saving replaces your wish of {fmt(current.amount)} {current.give}{' '}
          until {fmtDayTime(current.expiresAt)}. It doesn&apos;t add to it.
        </Note>
      )}
      <Row $start>
        <TxBtn disabled={!isPositive(typed)} onClick={cast}>
          {current ? 'Update wish' : 'Make wish'}
        </TxBtn>
      </Row>
    </Stack>
  );
};

const Fields = styled.div`
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  gap: 10px;
  ${phone(css`
    grid-template-columns: minmax(0, 1fr);
  `)}
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
