import React, {
  useReducer,
  useCallback,
  useEffect,
  HTMLProps,
  useState,
} from 'react';
import { BigNumber } from 'ethers';
import { Howl } from 'howler';
import { fromAtto } from 'utils/bigNumber';
import styled, { keyframes } from 'styled-components';
import { Button } from 'components/Button/Button';
import { Flex } from 'components/Layout/Flex';
import { ProgressAnimation } from 'components/Loader/ProgressAnimation';
import withWallet from 'hoc/withWallet';
import { useWallet } from 'providers/WalletProvider';
import { FaithMerkleAirdrop__factory } from 'types/typechain';
import { FAITH_SYMBOL } from 'enums/symbols';
import { formatNumber } from 'utils/formatter';
import claimData from 'data/claims/faith-airdrop.json';
import deityImage from 'assets/images/deity.svg';
import altarSound from 'assets/sounds/devotion-altar-bg-track.mp3';
import chant from 'assets/sounds/chant.mp3';

const ENV_VARS = import.meta.env;
const FAITH_AIRDROP_ADDRESS = ENV_VARS.VITE_PUBLIC_FAITH_AIRDROP_ADDRESS;
const AIRDROP_END_TIMESTAMP =
  ENV_VARS.VITE_PUBLIC_FAITH_AIRDROP_END_TIMESTAMP || 1645061667000;
const ONE_MINUTE = 60000;
const ONE_HOUR = 3600000;
const ONE_DAY = 86400000;

type ReducerState = {
  cashbackComplete: boolean;
  cashbackSuccessful: boolean;
  collecting: boolean;
  label: string;
};

type FaithAirdropState = ReducerState & {
  hasAllocation: boolean;
  allocationAmount: number;
  timeRemaining: string | null;
  claimContractCall(): void;
};

type Action = { type: 'collect' } | { type: 'success' } | { type: 'failure' };

const reducerInitialState: ReducerState = {
  cashbackComplete: false,
  cashbackSuccessful: false,
  collecting: false,
  label: 'Collect',
};

const FaithAirdropPage = () => {
  const {
    collecting,
    hasAllocation,
    cashbackComplete,
    cashbackSuccessful,
    claimContractCall,
    timeRemaining,
    label,
  }: FaithAirdropState = useFaithAirdrop();

  useBackgroundNoise();

  return (
    <Flex
      layout={{
        kind: 'container',
        direction: 'column',
        alignItems: 'center',
      }}
    >
      <Copy>
        Entering the Temple Gates was just the beginning.
        <br />
        <br />
        Only the faithful will be graced by the Deity.
        <br />
        <br />
        {timeRemaining
          ? `You have ${timeRemaining}, Templar.`
          : 'Your time is up, Templar.'}
      </Copy>
      <RitualContainer>
        {collecting || cashbackComplete ? (
          <ProgressAnimation play={collecting} finished={cashbackSuccessful} />
        ) : null}
      </RitualContainer>
      {hasAllocation ? (
        <CollectButton
          label={label}
          onClick={claimContractCall}
          disabled={collecting || cashbackComplete || !timeRemaining}
          ongoingRequest={collecting}
        />
      ) : (
        <CollectButton
          label={`No ${FAITH_SYMBOL} claim available`}
          disabled={true}
          ongoingRequest={false}
        />
      )}
    </Flex>
  );
};

function useFaithAirdrop(): FaithAirdropState {
  const { claimFaithAirdrop, wallet, signer } = useWallet();
  const [timeRemaining, setTimeRemaining] = useState<string | null>(null);
  // wallet may be falsey, the code can handle that
  // hooks should not be called conditionally so we deal with it this way
  //@ts-ignore
  const userClaim = wallet && claimData.claims[wallet];

  const allocationAmount = userClaim
    ? fromAtto(BigNumber.from(userClaim.amount))
    : 0;

  const [state, dispatch] = useReducer(reducer, {
    ...reducerInitialState,
    label: `Collect ${formatNumber(allocationAmount)} ${FAITH_SYMBOL}`,
  });

  function reducer(state: ReducerState, action: Action): ReducerState {
    switch (action.type) {
      case 'collect':
        return { ...state, collecting: true, label: 'Collecting...' };
      case 'success':
        return {
          cashbackComplete: true,
          cashbackSuccessful: true,
          collecting: false,
          label: 'Collected',
        };
      case 'failure':
        return {
          ...state,
          cashbackComplete: true,
          collecting: false,
          label: 'Failed to collect',
        };
      default:
        return state;
    }
  }

  // checks if user has already claimed their allocation
  useEffect(() => {
    async function isAllocationAlreadyClaimed() {
      if (signer && wallet && userClaim) {
        const faithMerkleAirdrop = new FaithMerkleAirdrop__factory(
          signer
        ).attach(FAITH_AIRDROP_ADDRESS);

        const allocationClaimed = await faithMerkleAirdrop.isClaimed(
          userClaim.index
        );

        if (allocationClaimed) {
          dispatch({ type: 'success' });
        }
      }
    }
    setTimeRemaining(getTimeRemaining());
    isAllocationAlreadyClaimed();
  }, [signer]);

  const claimContractCall = useCallback(() => {
    if (!wallet) return;

    const txPromise = claimFaithAirdrop(
      userClaim.index,
      wallet,
      BigNumber.from(userClaim.amount),
      userClaim.proof
    );

    if (txPromise) {
      dispatch({ type: 'collect' });
      txPromise
        .then(() => dispatch({ type: 'success' }))
        .catch((e) => {
          console.error('error', e);
          dispatch({ type: 'failure' });
        });
    }
  }, [claimFaithAirdrop, dispatch]);

  return {
    collecting: state.collecting,
    cashbackComplete: state.cashbackComplete,
    cashbackSuccessful: state.cashbackSuccessful,
    label: state.label,
    hasAllocation: allocationAmount > 0,
    allocationAmount,
    timeRemaining,
    claimContractCall,
  };
}

function useBackgroundNoise() {
  const altar = new Howl({
    src: [altarSound],
    loop: true,
    volume: 0.15,
  });

  const chanting = new Howl({
    src: [chant],
    loop: true,
    volume: 0.25,
  });

  // start looping on mount
  useEffect(() => {
    altar.play();
    chanting.play();

    return () => {
      altar.stop();
      chanting.stop();
    };
  }, []);
}

function getTimeRemaining() {
  const now = new Date().valueOf();
  const timeRemaining = Number(AIRDROP_END_TIMESTAMP) - now;

  if (timeRemaining <= 0) return null;
  else {
    if (timeRemaining > ONE_DAY) {
      return `${(timeRemaining / ONE_DAY).toFixed(0)} days`;
    } else if (timeRemaining > ONE_HOUR) {
      return `${(timeRemaining / ONE_HOUR).toFixed(0)} hours`;
    } else return `${(timeRemaining / ONE_MINUTE).toFixed(0)} minutes`;
  }
}

interface CollectButtonProps extends HTMLProps<HTMLButtonElement> {
  ongoingRequest: boolean;
}

const CollectButton = styled(Button)<CollectButtonProps>`
  max-width: 31.25rem;

  ${({ ongoingRequest, disabled }) =>
    ongoingRequest ? `cursor: wait;` : disabled && `cursor: not-allowed;`}
`;

const Copy = styled.p`
  max-width: 80%;
  text-align: center;
  padding-bottom: 1.5rem;
`;

const glow = keyframes`
  0% {
    opacity: 0.9;
  }
  50% {
    opacity: 0.7;
  }
  100% {
    opacity: 0.98;
  }
`;

const RitualContainer = styled.div`
  position: relative;
  height: 20rem;
  width: 28rem;
  background-image: url(${deityImage});
  background-size: contain;
  background-repeat: no-repeat;
  background-position: center;
  margin-bottom: 3rem;

  animation: ${glow} 4s infinite alternate linear;
`;

export default withWallet(FaithAirdropPage);
