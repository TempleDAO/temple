import React, { useReducer, useCallback, useEffect, HTMLProps } from 'react';
import { BigNumber } from 'ethers';
import { Howl } from 'howler';
import styled, { keyframes } from 'styled-components';
import { Button } from 'components/Button/Button';
import { Flex } from 'components/Layout/Flex';
import Loader from 'components/Loader/Loader';
import { ProgressAnimation } from 'components/Loader/ProgressAnimation';
import withWallet from 'hoc/withWallet';
import { useWallet } from 'providers/WalletProvider';
import { ClaimType } from 'enums/claim-type';
import { TempleCashback__factory } from 'types/typechain';
import { fromAtto } from 'utils/bigNumber';
import { formatNumber } from 'utils/formatter';
import claims from 'data/claims/claims-fire-ritual-rollover.json';
import frImage from 'assets/images/fr-transparent.png';
import bonfireSound from 'assets/sounds/bonfire.mp3';
import chant from 'assets/sounds/chant.mp3';

const ENV_VARS = import.meta.env;
const TEMPLE_CASHBACK_ADDRESS = ENV_VARS.VITE_PUBLIC_TEMPLE_CASHBACK_ADDRESS;

type ReducerState = {
  cashbackComplete: boolean;
  cashbackSuccessful: boolean;
  collecting: boolean;
  label: string;
};

type FireRitualCashbackState = ReducerState & {
  hasAllocation: boolean;
  allocationAmount: number;
  cashbackContractCall(): void;
};

type Action = { type: 'collect' } | { type: 'success' } | { type: 'failure' };

const reducerInitialState: ReducerState = {
  cashbackComplete: false,
  cashbackSuccessful: false,
  collecting: false,
  label: 'Collect',
};

const FireRitualistCashbackPage = () => {
  const {
    collecting,
    hasAllocation,
    cashbackComplete,
    cashbackSuccessful,
    cashbackContractCall,
    label,
  }: FireRitualCashbackState = useFireRitualistCashback();

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
        Fire Ritualist templars were promised to harvest the same yield as Open
        Ceremony templars.
        <br />
        <br />
        The Temple always delivers what&apos;s earned by the Deserving.
      </Copy>
      <FireRitualContainer>
        {collecting || cashbackComplete ? (
          <ProgressAnimation play={collecting} finished={cashbackSuccessful} />
        ) : null}
      </FireRitualContainer>
      {hasAllocation ? (
        <CollectButton
          label={label}
          //@ts-ignore
          onClick={cashbackContractCall}
          disabled={collecting || cashbackComplete}
          ongoingRequest={collecting}
        />
      ) : null}
    </Flex>
  );
};

function useFireRitualistCashback(): FireRitualCashbackState {
  const { claim, wallet, signer } = useWallet();

  // wallet may be falsey, the code can handle that
  // hooks should not be called conditionally so we deal with it this way
  //@ts-ignore
  const userClaim = claims[wallet];
  const allocationAmount = userClaim?.tokenQuantity ?? 0;

  const [state, dispatch] = useReducer(reducer, {
    ...reducerInitialState,
    label: `Collect ${formatNumber(fromAtto(allocationAmount))} $TEMPLE`,
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
        const templeCashback = new TempleCashback__factory()
          .attach(TEMPLE_CASHBACK_ADDRESS)
          .connect(signer);

        const allocationClaimed = await templeCashback.usedNonces(
          wallet,
          BigNumber.from(userClaim.nonce)
        );

        if (allocationClaimed) {
          dispatch({ type: 'success' });
        }
      }
    }

    isAllocationAlreadyClaimed();
  }, [signer]);

  const cashbackContractCall = useCallback(() => {
    const txPromise = claim(ClaimType.FIRE_RITUAL_ROLLOVER);

    if (txPromise) {
      dispatch({ type: 'collect' });
      txPromise
        .then(() => dispatch({ type: 'success' }))
        .catch((e) => {
          console.log('error', e);
          dispatch({ type: 'failure' });
        });
    }
  }, [claim, dispatch, ClaimType.FIRE_RITUAL_ROLLOVER]);

  return {
    collecting: state.collecting,
    cashbackComplete: state.cashbackComplete,
    cashbackSuccessful: state.cashbackSuccessful,
    label: state.label,
    hasAllocation: allocationAmount > 0,
    allocationAmount,
    cashbackContractCall,
  };
}

function useBackgroundNoise() {
  const bonfire = new Howl({
    src: [bonfireSound],
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
    bonfire.play();
    chanting.play();
  }, []);
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
  padding-bottom: 5rem;
`;

const flicker = keyframes`
  0% {
    opacity: 0.3;
  }

  33% {
    opacity: 0.6;
  }

  60% {
    opacity: 0.4;
  }

  80% {
    opacity: 0.8;
  }

  100% {
    opacity: 0.5;
  }
`;

const FireRitualContainer = styled.div`
  position: relative;
  width: 29.375rem;
  height: 18.75rem;
  background-image: url(${frImage});
  background-size: cover;
  background-position: center;
  margin-bottom: 6.25rem;

  animation: ${flicker} 4s infinite alternate ease-out;
`;

export default withWallet(FireRitualistCashbackPage);
