import { useState } from 'react';
import { Navigate, useParams, useSearchParams } from 'react-router-dom';
import type { Amount, Auction, Phase } from '../data/types';
import {
  fillPct,
  fmt,
  fmtTyped,
  fmtDay,
  fmtDayTime,
  fmtM,
  fmtPrice,
  isPositive,
  isRunning,
  pairName,
  parseTyped,
  phaseOf,
  settlementFor,
  ZERO,
} from '../data/derive';
import {
  useAuctionActions,
  useClaimable,
  useComplianceWait,
  useGranaryWallet,
  useIsFlagged,
  useMyPositions,
  useNow,
  usePair,
  usePairAuctions,
  useWalletBalance,
} from '../data/hooks';
import {
  Bar,
  Card,
  Chips,
  Field,
  Grid2,
  H4,
  InputBox,
  K,
  Moon,
  Note,
  PausedChip,
  PhaseChip,
  Price,
  Row,
  Seg,
  Spine,
  Stack,
  TextButton,
  TextLink,
  Tok,
  V,
} from '../ui';
import { paths } from '../paths';
import { PageHead, PastAuctions, TxBtn, WishLine } from './common';

const useDeposit = (a?: Auction) =>
  useMyPositions().data.find((p) => p.auction === a?.id);

const claimsPaused = (a: Auction, now: Date) =>
  a.paused && now <= a.claimPauseEndsAt;

// TempleGold only moves for authorised contracts: until this auction is,
// TGLD can't go in or come out of it.
const tgldBlocked = (a: Auction) =>
  a.tgldAuthorized === false &&
  (a.bidToken === 'TGLD' || a.fillToken === 'TGLD');

const FLAGGED_NOTE =
  "This wallet is on the auction's compliance list, so it can't deposit, withdraw or claim.";
const TGLD_NOTE =
  "Temple Gold hasn't authorised this auction yet, so TGLD can't move in or out of it.";

export const PairPage = () => {
  const { pairId = '' } = useParams();
  const [params, setParams] = useSearchParams();
  const now = useNow();
  const pair = usePair(pairId).data;
  const auctions = usePairAuctions(pairId).data;
  const balance = useWalletBalance(pair?.bidToken ?? 'TGLD').data;
  const positions = useMyPositions().data;

  const running = auctions
    .filter((a) => isRunning(phaseOf(a, now)))
    .sort((a, b) => +a.fulfillmentEnd - +b.fulfillmentEnd);
  const selected =
    auctions.find((a) => a.number === Number(params.get('auction'))) ??
    running[0];

  if (!pair) return <Navigate replace to={paths.auctions()} />;
  if (!selected)
    return <Navigate replace to={paths.wish(pair.bidToken, pair.fillToken)} />;

  const phase = phaseOf(selected, now);
  const past = !isRunning(phase);
  const name = pairName(pair.bidToken, pair.fillToken);
  const mine = (a: Auction) =>
    positions.find((p) => p.auction === a.id && isPositive(p.deposit));
  const others = past ? [] : running.filter((a) => a !== selected);
  const show = (a: Auction) => setParams({ auction: String(a.number) });

  return (
    <Stack>
      {past ? (
        <PageHead
          back={[paths.pair(pair.id), name]}
          title={`${name} #${selected.number}`}
          right={<Note>viewing a past auction</Note>}
        />
      ) : (
        <PageHead
          back={[paths.auctions(), 'All auctions']}
          title={name}
          right={
            <Note>
              {fmt(balance)} {pair.bidToken} in your wallet
              {pair.bidToken === 'TGLD' && (
                <>
                  {' · '}
                  <TextLink to={paths.earn}>Earn more</TextLink>
                </>
              )}
            </Note>
          }
        />
      )}

      {others.length > 0 && (
        <Row>
          <Note>
            {running.length === 2 ? 'Two' : running.length} auctions are running
            on this pair.
          </Note>
          <Seg>
            {running.map((a) => {
              const p = phaseOf(a, now);
              return (
                <button
                  key={a.id}
                  aria-pressed={a === selected}
                  onClick={() => show(a)}
                >
                  <Moon phase={p} size={16} paused={a.paused} />#{a.number} ·{' '}
                  {mine(a) ? 'yours, ' : ''}
                  {a.paused ? 'paused' : p}
                </button>
              );
            })}
          </Seg>
        </Row>
      )}

      <Spine auction={selected} now={now} />

      {phase === 'Deposit' && !selected.paused && !tgldBlocked(selected) ? (
        <Grid2>
          <DepositCard a={selected} balance={balance} />
          <PositionCard a={selected} />
        </Grid2>
      ) : phase === 'Deposit' || phase === 'Fulfillment' ? (
        <RunningCard a={selected} phase={phase} />
      ) : phase === 'Scheduled' ? (
        <ScheduledCard a={selected} />
      ) : (
        <ClaimCard a={selected} phase={phase} />
      )}

      <ExcludedCard a={selected} />

      {others.map((a) => (
        <Card $quiet key={a.id}>
          <Row>
            <Note>
              {mine(a)
                ? `You're also in #${a.number}: ${fmt(
                    mine(a)?.deposit ?? ZERO
                  )} ${a.bidToken}${a.paused ? ', paused' : ''}.`
                : `#${a.number} is also running: ${otherState(
                    a,
                    phaseOf(a, now)
                  )}.`}
            </Note>
            <TextButton onClick={() => show(a)}>Show #{a.number}</TextButton>
          </Row>
        </Card>
      ))}

      {!past && <WishLine pair={pair} />}
      <PastAuctions pair={pair} auctions={auctions} current={selected} />
    </Stack>
  );
};

const otherState = (a: Auction, p: Phase) =>
  a.paused
    ? `${p}, paused`
    : p === 'Fulfillment'
    ? `Fulfillment, ${fillPct(a)}% funded`
    : p === 'Deposit'
    ? 'taking deposits'
    : `opens ${fmtDayTime(a.depositStart)}`;

const PriceRow = ({ a }: { a: Auction }) => (
  <Row>
    <K>Fixed price</K>
    <Price>
      1 {a.bidToken} = {fmtPrice(a.price)} {a.fillToken}
    </Price>
  </Row>
);

const DepositCard = ({ a, balance }: { a: Auction; balance: Amount }) => {
  const { deposit } = useAuctionActions();
  const { account } = useGranaryWallet();
  const [text, setText] = useState('');
  const [done, setDone] = useState('');
  const current = useDeposit(a)?.deposit ?? ZERO;
  const clean = text.replace(/,/g, '').trim();
  // the bid token's decimals: more decimal places can't be sent
  const decimals = a.minDeposit.getDecimals();
  const typed = parseTyped(clean, decimals) ?? ZERO;
  const valid = parseTyped(clean, decimals) !== null;
  const over = !!account && typed.gt(balance);
  const below = isPositive(typed) && current.add(typed).lt(a.minDeposit);
  const flagged = useIsFlagged(a);
  const wait = useComplianceWait(a);
  const ok = valid && isPositive(typed) && !over && !below && !flagged && !wait;
  return (
    <Card $hot>
      <Row>
        <H4>Auction #{a.number} · taking deposits</H4>
        <PhaseChip phase="Deposit" />
      </Row>
      <PriceRow a={a} />
      <Field>
        <span>Deposit</span>
        <InputBox>
          <input
            inputMode="decimal"
            placeholder="0"
            value={text}
            aria-label={`${a.bidToken} to deposit`}
            onChange={(e) => {
              setText(e.target.value);
              setDone('');
            }}
          />
          <Tok>{a.bidToken}</Tok>
        </InputBox>
        <Note $bad={over || below || !valid}>
          {!valid
            ? `Enter a number with at most ${decimals} decimal places`
            : below
            ? `Your deposit must total at least ${fmt(a.minDeposit)} ${
                a.bidToken
              }`
            : `${over ? 'More than the ' : ''}${fmt(balance)} ${
                a.bidToken
              } in your wallet`}
        </Note>
      </Field>
      <Row>
        <K>You&apos;d get at full funding</K>
        <V>{ok ? `${fmt(typed.mul(a.price))} ${a.fillToken}` : '–'}</V>
      </Row>
      <Note>
        If the Treasury funds less, you get a pro‑rata share and the rest of
        your {a.bidToken} back. You can withdraw until{' '}
        {fmtDayTime(a.depositEnd)}.
      </Note>
      <TxBtn
        disabled={!ok}
        onClick={async () => {
          if (await deposit(a, clean)) {
            setText('');
            setDone(`Deposited ${fmtTyped(clean)} ${a.bidToken}.`);
          }
        }}
      >
        Deposit
      </TxBtn>
      {flagged && <Note $bad>{FLAGGED_NOTE}</Note>}
      {wait === 'checking' && <Note>Checking the compliance list…</Note>}
      {wait === 'failed' && (
        <Note $bad>
          Couldn&apos;t check the compliance list, so deposits are off for now.
          Try again shortly.
        </Note>
      )}
      {done && <Note>{done}</Note>}
    </Card>
  );
};

const PositionCard = ({ a }: { a: Auction }) => {
  const { withdrawDeposit } = useAuctionActions();
  const pos = useDeposit(a);
  const flagged = useIsFlagged(a);
  if (!pos || !isPositive(pos.deposit)) return null;
  return (
    <Card>
      <Row>
        <H4>Your deposit in #{a.number}</H4>
        <V>
          {fmt(pos.deposit)} {a.bidToken}
        </V>
      </Row>
      <Row>
        <K>At full funding you receive</K>
        <V>
          {fmt(pos.deposit.mul(a.price))} {a.fillToken}
        </V>
      </Row>
      <Row>
        <K>Deposited by everyone</K>
        <V>
          {fmtM(a.totalDeposits)} {a.bidToken}
        </V>
      </Row>
      <Row $start>
        <TxBtn
          $ghost
          disabled={flagged}
          onClick={async () => {
            await withdrawDeposit(a, 'all');
          }}
        >
          Withdraw all
        </TxBtn>
      </Row>
    </Card>
  );
};

// Fulfillment, or any running phase while paused: no actions, only state.
const RunningCard = ({ a, phase }: { a: Auction; phase: Phase }) => {
  const pos = useDeposit(a);
  const required = a.totalDeposits.mul(a.price);
  return (
    <Card>
      <Row>
        <H4>
          Auction #{a.number} ·{' '}
          {phase === 'Deposit' ? 'taking deposits' : 'Treasury funding'}
        </H4>
        <Chips>
          <PhaseChip phase={phase} />
          {a.paused && <PausedChip />}
        </Chips>
      </Row>
      <PriceRow a={a} />
      {phase === 'Fulfillment' && (
        <>
          <Row>
            <K>Funded so far</K>
            <V>
              {fmt(a.funding)} of {fmt(required)} {a.fillToken} · {fillPct(a)}%
            </V>
          </Row>
          <Bar pct={fillPct(a)} />
        </>
      )}
      {phase === 'Deposit' ? (
        <Row>
          <K>Your deposit</K>
          <V>
            {pos && isPositive(pos.deposit)
              ? `${fmt(pos.deposit)} ${a.bidToken} → ${fmt(
                  pos.deposit.mul(a.price)
                )} ${a.fillToken} at full funding`
              : 'none'}
          </V>
        </Row>
      ) : null}
      {tgldBlocked(a) && <Note $bad>{TGLD_NOTE}</Note>}
      <Note>
        {a.paused
          ? `Paused by the Temple. ${
              phase === 'Deposit'
                ? 'Deposits and withdrawals are'
                : 'Treasury funding is'
            } stopped until it unpauses; the clock keeps running and ${
              phase === 'Deposit'
                ? 'deposits still close'
                : 'funding still closes'
            } ${fmtDayTime(
              phase === 'Deposit' ? a.depositEnd : a.fulfillmentEnd
            )}.`
          : `Deposits are locked. If funding ends below 100%, every depositor gets the same pro‑rata fill and the rest back. The Temple may settle early on the funding held, or cancel, after which everyone claims their full deposit back, before ${fmtDayTime(
              a.fulfillmentEnd
            )}.`}
      </Note>
      {phase === 'Fulfillment' && (
        <Row>
          <K>Your deposit in #{a.number}</K>
          <V>
            {pos && isPositive(pos.deposit)
              ? `${fmt(pos.deposit)} ${a.bidToken}`
              : 'none'}
          </V>
        </Row>
      )}
    </Card>
  );
};

const ScheduledCard = ({ a }: { a: Auction }) => (
  <Card>
    <Row>
      <H4>Auction #{a.number} · scheduled</H4>
      <PhaseChip phase="Scheduled" />
    </Row>
    <PriceRow a={a} />
    <Note>
      Deposits open {fmtDayTime(a.depositStart)} and close{' '}
      {fmtDayTime(a.depositEnd)}.
    </Note>
  </Card>
);

const ClaimCard = ({ a, phase }: { a: Auction; phase: Phase }) => {
  const { claim } = useAuctionActions();
  const now = useNow();
  const pos = useDeposit(a);
  const paused = claimsPaused(a, now);
  const flagged = useIsFlagged(a);
  const blocked = paused || flagged || tgldBlocked(a);
  const cancelled = phase === 'Cancelled';
  const deposit = pos?.deposit ?? ZERO;
  // Exact figures: what the claim paid once claimed, claimable(me) before;
  // the settlement estimate only while that read is loading.
  const claimable = useClaimable(a).data;
  const paid =
    pos?.claimed && pos.claimedFill !== undefined
      ? {
          filledBid: deposit.sub(pos.claimedRefund ?? ZERO),
          fill: pos.claimedFill,
          refund: pos.claimedRefund ?? ZERO,
        }
      : null;
  const s = paid ??
    claimable ??
    settlementFor(a, deposit, now) ?? {
      filledBid: ZERO,
      fill: ZERO,
      refund: deposit,
    };
  return (
    <Card $hot={isPositive(deposit) && !pos?.claimed}>
      <Row>
        <H4>
          Auction #{a.number} · {cancelled ? 'cancelled' : 'settled'}{' '}
          {fmtDay(a.cancelledAt ?? a.settledAt ?? a.fulfillmentEnd)}
        </H4>
        <PhaseChip phase={phase} />
      </Row>
      <Row>
        <K>Deposited by everyone</K>
        <V>
          {fmtM(a.totalDeposits)} {a.bidToken}
        </V>
      </Row>
      {!cancelled && (
        <Row>
          <K>Treasury funded</K>
          <V>
            {fmtM(a.funding)} {a.fillToken} · {fillPct(a)}% filled
          </V>
        </Row>
      )}
      {isPositive(deposit) ? (
        <>
          <Row>
            <K>Your deposit</K>
            <V>
              {fmt(deposit)} {a.bidToken}
            </V>
          </Row>
          {!cancelled && (
            <Row>
              <K>Filled at {fmtPrice(a.price)}</K>
              <V>
                {fmt(s.filledBid)} {a.bidToken} → {fmt(s.fill)} {a.fillToken}
              </V>
            </Row>
          )}
          <Row>
            <K>Returned to you</K>
            <V>
              {fmt(s.refund)} {a.bidToken}
            </V>
          </Row>
          <Row $start>
            {!pos?.claimed ? (
              <TxBtn
                disabled={blocked}
                onClick={async () => {
                  await claim(a);
                }}
              >
                Claim
              </TxBtn>
            ) : (
              <Note>Claimed.</Note>
            )}
          </Row>
          <Note>
            {flagged && !pos?.claimed
              ? FLAGGED_NOTE
              : tgldBlocked(a) && !pos?.claimed
              ? TGLD_NOTE
              : paused && !pos?.claimed
              ? `Claims are paused by the Temple until it unpauses, or ${fmtDayTime(
                  a.claimPauseEndsAt
                )} at the latest.`
              : 'One claim pays both. Nothing expires.'}
          </Note>
        </>
      ) : (
        <Note>You had no deposit in this auction.</Note>
      )}
    </Card>
  );
};

// A deposit the compliance check moved out of the fill: refunded in full.
const ExcludedCard = ({ a }: { a: Auction }) => {
  const { withdrawExcluded } = useAuctionActions();
  const now = useNow();
  const pos = useDeposit(a);
  const flagged = useIsFlagged(a);
  if (!pos || !isPositive(pos.excluded)) return null;
  const paused = claimsPaused(a, now);
  // withdrawExcluded() pays bid tokens: only a TGLD bid needs authorisation
  const tgld = a.bidToken === 'TGLD' && a.tgldAuthorized === false;
  return (
    <Card>
      <Row>
        <H4>Excluded from #{a.number}</H4>
        <V>
          {fmt(pos.excluded)} {a.bidToken}
        </V>
      </Row>
      <Note>
        {flagged
          ? FLAGGED_NOTE
          : tgld
          ? TGLD_NOTE
          : paused
          ? `The auction is paused. You can withdraw this once it unpauses, or ${fmtDayTime(
              a.claimPauseEndsAt
            )} at the latest.`
          : 'This part of your deposit was taken out of the auction and is returned to you in full.'}
      </Note>
      <Row $start>
        <TxBtn
          $ghost
          disabled={paused || flagged || tgld}
          onClick={async () => {
            await withdrawExcluded(a);
          }}
        >
          Withdraw
        </TxBtn>
      </Row>
    </Card>
  );
};
