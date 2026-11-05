import { ReactNode, useState } from 'react';
import styled from 'styled-components';
import { constants, utils } from 'ethers';
import { fmt, fmtDayTime, fmtLeft } from '../data/derive';
import {
  useGranaryWallet,
  useStaking,
  useStakingActions,
  useWallClock,
} from '../data/hooks';
import type { StakingSummary } from '../data/types';
import {
  Banner,
  Big,
  C,
  Card,
  Field,
  H4,
  InputBox,
  K,
  Note,
  Row,
  Seg,
  Stack,
  TextButton,
  Tok,
  V,
} from '../ui';
import { TxBtn } from './common';

// TempleGoldStaking on the Earn screen: stake TEMPLE, unstake, delegate its
// votes, and claim the TGLD it earns. Moved here from Spice Bazaar's Earn tab.

const DOCS = 'https://docs.templedao.link/spice-bazaar';

const TABS = ['Stake', 'Unstake', 'Delegate', 'Claim TGLD'] as const;
type Tab = (typeof TABS)[number];

// TGLD amounts are often fractional
const fmt2 = (n: number) =>
  n.toLocaleString('en-US', { maximumFractionDigits: 2 });
const short = (a: string) => `${a.slice(0, 6)}…${a.slice(-4)}`;
const same = (a?: string, b?: string) =>
  !!a && !!b && a.toLowerCase() === b.toLowerCase();
const cleanAmount = (text: string) => text.replace(/,/g, '').trim();
// TEMPLE in wei, or null if it isn't a valid amount. Limits are checked on
// these, as a float can't tell 1 from 1.000000000000000001.
const toWei = (text: string) => {
  try {
    return utils.parseUnits(text || '0', 18);
  } catch {
    return null;
  }
};

export const StakingCard = () => {
  const s = useStaking().data;
  const { account } = useGranaryWallet();
  const [tab, setTab] = useState<Tab>('Stake');
  const share = s?.totalStaked ? (s.staked / s.totalStaked) * 100 : 0;
  return (
    <Card>
      <Row>
        <H4>Stake TEMPLE, earn Temple Gold</H4>
        <TextButton
          as="a"
          href={DOCS}
          target="_blank"
          rel="noreferrer"
          aria-label="Staking docs"
        >
          How it works
        </TextButton>
      </Row>
      <Stats>
        <Stat k="Total staked" v={`${fmt(s?.totalStaked ?? 0)} TEMPLE`} />
        <Stat
          k="Circulating supply"
          v={`${fmt(s?.circulatingTgld ?? 0)} TGLD`}
        />
        <Stat k="Weekly rewards" v={`${fmt(s?.weeklyRewards ?? 0)} TGLD`} />
        <Stat
          k={`Your stake${
            account && s?.staked ? ` · ${share.toFixed(2)}% of total` : ''
          }`}
          v={account ? `${fmt(s?.staked ?? 0)} TEMPLE` : '–'}
        />
        <Stat
          k="Your daily TGLD"
          v={account ? `${fmt2(s?.dailyReward ?? 0)} TGLD` : '–'}
        />
        <Stat
          k="Claimable"
          v={account ? `${fmt2(s?.rewards ?? 0)} TGLD` : '–'}
        />
      </Stats>
      {s?.paused && (
        <Banner>
          Staking is paused: staking, unstaking and claiming are unavailable for
          now.
        </Banner>
      )}
      <Seg role="group" aria-label="Staking action">
        {TABS.map((t) => (
          <button
            key={t}
            type="button"
            aria-pressed={tab === t}
            onClick={() => setTab(t)}
          >
            {t}
          </button>
        ))}
      </Seg>
      {s &&
        (tab === 'Stake' ? (
          <StakeForm s={s} />
        ) : tab === 'Unstake' ? (
          <UnstakeForm s={s} />
        ) : tab === 'Delegate' ? (
          // restart the form when the account or its delegate changes
          <DelegateForm key={`${account}:${s.delegate}`} s={s} />
        ) : (
          <ClaimForm s={s} />
        ))}
    </Card>
  );
};

const Stat = ({ k, v }: { k: string; v: string }) => (
  <div>
    <K>{k}</K>
    <V>{v}</V>
  </div>
);

// An amount field with a Max shortcut.
const AmountField = ({
  label,
  text,
  setText,
  max,
  maxExact,
  hint,
  bad,
  disabled,
}: {
  label: string;
  text: string;
  setText: (t: string) => void;
  max: number;
  maxExact: string;
  hint: string;
  bad?: boolean;
  disabled?: boolean;
}) => (
  <Field>
    <span>{label}</span>
    <InputBox>
      <input
        inputMode="decimal"
        placeholder="0"
        value={text}
        aria-label={`TEMPLE to ${label.toLowerCase()}`}
        disabled={disabled}
        onChange={(e) => setText(e.target.value)}
      />
      <TextButton
        type="button"
        disabled={disabled || !max}
        onClick={() => setText(maxExact)}
      >
        Max
      </TextButton>
      <Tok>TEMPLE</Tok>
    </InputBox>
    <Note $bad={bad}>{hint}</Note>
  </Field>
);

const StakeForm = ({ s }: { s: StakingSummary }) => {
  const { stake } = useStakingActions();
  const { account } = useGranaryWallet();
  const [text, setText] = useState('');
  const [bridged, setBridged] = useState(false);
  const [locked, setLocked] = useState(false);
  const clean = cleanAmount(text);
  const wei = toWei(clean);
  const over =
    !!account && !!wei && wei.gt(toWei(s.availableExact) ?? constants.Zero);
  const ok = !!wei?.gt(0) && !over && bridged && locked && !s.paused;
  const d = s.cooldownDays;
  const lock =
    d >= 1
      ? `${fmt2(d)} day${d === 1 ? '' : 's'}`
      : `${fmt2(d * 24)} hour${d * 24 === 1 ? '' : 's'}`;
  return (
    <Stack gap={12}>
      <AmountField
        label="Stake"
        text={text}
        setText={setText}
        max={s.available}
        maxExact={s.availableExact}
        bad={over}
        hint={`${over ? 'More than the ' : ''}${fmt2(
          s.available
        )} TEMPLE in your wallet`}
      />
      <Check checked={bridged} onChange={setBridged}>
        TGLD can&apos;t be sent to another address, only bridged to the same
        address on another chain. Using a multisig?{' '}
        <a href={DOCS} target="_blank" rel="noreferrer">
          Read more
        </a>
        .
      </Check>
      <Check checked={locked} onChange={setLocked}>
        {d > 0
          ? `A stake can't be cancelled, and your staked TEMPLE is locked for ${lock} before you can unstake it. Staking more restarts the lock.`
          : "A stake can't be cancelled once submitted."}
      </Check>
      <Row $start>
        <TxBtn
          disabled={!ok}
          onClick={async () => {
            if (await stake(clean)) {
              setText('');
              setBridged(false);
              setLocked(false);
            }
          }}
        >
          Stake
        </TxBtn>
      </Row>
    </Stack>
  );
};

const UnstakeForm = ({ s }: { s: StakingSummary }) => {
  const { unstake } = useStakingActions();
  const wall = useWallClock();
  const [text, setText] = useState('');
  const [claim, setClaim] = useState(false);
  const clean = cleanAmount(text);
  const wei = toWei(clean);
  const over = !!wei && wei.gt(toWei(s.stakedExact) ?? constants.Zero);
  const lockedUntil = s.unstakeAt && s.unstakeAt > wall ? s.unstakeAt : null;
  const ok = !!wei?.gt(0) && !over && !lockedUntil && !s.paused;
  return (
    <Stack gap={12}>
      {lockedUntil && (
        <Banner>
          Your stake unlocks {fmtDayTime(lockedUntil)}, in{' '}
          {fmtLeft(wall, lockedUntil)}.
        </Banner>
      )}
      <AmountField
        label="Unstake"
        text={text}
        setText={setText}
        max={s.staked}
        maxExact={s.stakedExact}
        bad={over}
        disabled={!!lockedUntil}
        hint={`${over ? 'More than the ' : ''}${fmt2(s.staked)} TEMPLE staked`}
      />
      <Check checked={claim} onChange={setClaim} disabled={!!lockedUntil}>
        Also claim my {fmt2(s.rewards)} TGLD
      </Check>
      <Row $start>
        <TxBtn
          disabled={!ok}
          onClick={async () => {
            if (await unstake(clean, claim)) {
              setText('');
              setClaim(false);
            }
          }}
        >
          Unstake
        </TxBtn>
      </Row>
    </Stack>
  );
};

const DelegateForm = ({ s }: { s: StakingSummary }) => {
  const { delegate } = useStakingActions();
  const { account } = useGranaryWallet();
  const toSelf = same(s.delegate, account);
  const [other, setOther] = useState(
    () => !!s.delegate && !same(s.delegate, account)
  );
  const [text, setText] = useState(() =>
    s.delegate && !toSelf ? s.delegate : ''
  );
  const typed = text.trim();
  const valid = utils.isAddress(typed);
  const target = other ? typed : account;
  const unchanged = same(target, s.delegate);
  const ok = !!target && (!other || valid) && !unchanged;
  return (
    <Stack gap={12}>
      <Row>
        <K>Your votes are delegated to</K>
        <V>
          {!s.delegate
            ? 'nobody yet'
            : toSelf
            ? `yourself (${short(s.delegate)})`
            : short(s.delegate)}
        </V>
      </Row>
      <Seg role="radiogroup" aria-label="Delegate to">
        <button
          type="button"
          role="radio"
          aria-checked={!other}
          aria-pressed={!other}
          onClick={() => setOther(false)}
        >
          Yourself
        </button>
        <button
          type="button"
          role="radio"
          aria-checked={other}
          aria-pressed={other}
          onClick={() => setOther(true)}
        >
          Another address
        </button>
      </Seg>
      {other && (
        <Field>
          <span>Delegate to</span>
          <InputBox>
            <input
              placeholder="0x…"
              value={text}
              aria-label="Address to delegate to"
              spellCheck={false}
              onChange={(e) => setText(e.target.value)}
            />
          </InputBox>
          {typed && !valid && <Note $bad>Not a valid address</Note>}
        </Field>
      )}
      <Note>
        {s.staked
          ? `Your ${fmt(s.staked)} staked TEMPLE carry the votes.`
          : 'You have no TEMPLE staked yet; future stakes follow this delegate.'}
        {unchanged && target ? ' That is already your delegate.' : ''}
      </Note>
      <Row $start>
        <TxBtn
          disabled={!ok}
          onClick={async () => {
            if (target) await delegate(target);
          }}
        >
          {s.delegate ? 'Change delegate' : 'Delegate'}
        </TxBtn>
      </Row>
    </Stack>
  );
};

const ClaimForm = ({ s }: { s: StakingSummary }) => {
  const { claimStakingRewards } = useStakingActions();
  return (
    <Stack gap={12}>
      <div>
        <Big>{fmt2(s.rewards)} TGLD</Big>
        <Note>
          ready to claim
          {s.dailyReward
            ? ` · about ${fmt2(s.dailyReward)} more per day at the current rate`
            : ''}
        </Note>
      </div>
      <Row $start>
        <TxBtn
          disabled={!(s.rewards > 0) || s.paused}
          onClick={async () => {
            await claimStakingRewards();
          }}
        >
          Claim TGLD
        </TxBtn>
      </Row>
    </Stack>
  );
};

const Check = ({
  checked,
  onChange,
  disabled,
  children,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
  children: ReactNode;
}) => (
  <CheckLabel $disabled={disabled}>
    <input
      type="checkbox"
      checked={checked}
      disabled={disabled}
      onChange={(e) => onChange(e.target.checked)}
    />
    <span>{children}</span>
  </CheckLabel>
);

const Stats = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  gap: 12px 16px;
`;

const CheckLabel = styled.label<{ $disabled?: boolean }>`
  display: flex;
  gap: 10px;
  align-items: flex-start;
  font-size: 12.5px;
  line-height: 1.45;
  color: ${C.text};
  cursor: ${({ $disabled }) => ($disabled ? 'default' : 'pointer')};
  opacity: ${({ $disabled }) => ($disabled ? 0.55 : 1)};
  input {
    margin: 2px 0 0;
    accent-color: ${({ theme }) => theme.palette.gold};
    width: 15px;
    height: 15px;
    flex: none;
  }
  a {
    color: ${({ theme }) => theme.palette.gold};
  }
`;
