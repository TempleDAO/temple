import { ReactNode, useState } from 'react';
import styled from 'styled-components';
import { utils } from 'ethers';
import {
  fmt,
  fmt2,
  fmtDayTime,
  fmtLeft,
  isPositive,
  parseTyped,
  plain,
  toNumber,
  ZERO,
} from '../data/derive';
import {
  useGranaryWallet,
  useStaking,
  useStakingActions,
  useWallClock,
} from '../data/hooks';
import type { Amount, StakingSummary } from '../data/types';
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

// the unstake lock, in days or hours
const fmtCount = (n: number) =>
  n.toLocaleString('en-US', { maximumFractionDigits: 2 });
const short = (a: string) => `${a.slice(0, 6)}…${a.slice(-4)}`;
const same = (a?: string, b?: string) =>
  !!a && !!b && a.toLowerCase() === b.toLowerCase();
const cleanAmount = (text: string) => text.replace(/,/g, '').trim();

export const StakingCard = () => {
  const s = useStaking().data;
  const { account } = useGranaryWallet();
  const [tab, setTab] = useState<Tab>('Stake');
  // a percentage, for display only
  const share =
    s && isPositive(s.totalStaked)
      ? toNumber(s.staked.div(s.totalStaked, 6)) * 100
      : 0;
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
        <Stat k="Total staked" v={`${fmt(s?.totalStaked ?? ZERO)} TEMPLE`} />
        <Stat
          k="Circulating supply"
          v={`${fmt(s?.circulatingTgld ?? ZERO)} TGLD`}
        />
        <Stat k="Weekly rewards" v={`${fmt(s?.weeklyRewards ?? ZERO)} TGLD`} />
        <Stat
          k={`Your stake${
            account && isPositive(s?.staked)
              ? ` · ${share.toFixed(2)}% of total`
              : ''
          }`}
          v={account ? `${fmt(s?.staked ?? ZERO)} TEMPLE` : '–'}
        />
        <Stat
          k="Your daily TGLD"
          v={account ? `${fmt2(s?.dailyReward ?? ZERO)} TGLD` : '–'}
        />
        <Stat
          k="Claimable"
          v={account ? `${fmt2(s?.rewards ?? ZERO)} TGLD` : '–'}
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
  hint,
  bad,
  disabled,
}: {
  label: string;
  text: string;
  setText: (t: string) => void;
  max: Amount;
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
        disabled={disabled || !isPositive(max)}
        onClick={() => setText(plain(max))}
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
  const typed = parseTyped(clean);
  const over = !!account && !!typed && typed.gt(s.available);
  const ok = isPositive(typed) && !over && bridged && locked && !s.paused;
  const d = s.cooldownDays;
  const lock =
    d >= 1
      ? `${fmtCount(d)} day${d === 1 ? '' : 's'}`
      : `${fmtCount(d * 24)} hour${d * 24 === 1 ? '' : 's'}`;
  return (
    <Stack gap={12}>
      <AmountField
        label="Stake"
        text={text}
        setText={setText}
        max={s.available}
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
  const typed = parseTyped(clean);
  const over = !!typed && typed.gt(s.staked);
  const lockedUntil = s.unstakeAt && s.unstakeAt > wall ? s.unstakeAt : null;
  const ok = isPositive(typed) && !over && !lockedUntil && !s.paused;
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
        {isPositive(s.staked)
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
          {isPositive(s.dailyReward)
            ? ` · about ${fmt2(s.dailyReward)} more per day at the current rate`
            : ''}
        </Note>
      </div>
      <Row $start>
        <TxBtn
          disabled={!isPositive(s.rewards) || s.paused}
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
