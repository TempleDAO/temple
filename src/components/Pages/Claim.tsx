import React, {
  useReducer,
  useCallback,
  useEffect,
  HTMLProps,
  useState,
  SetStateAction,
  Dispatch,
} from 'react';
import styled, { keyframes } from 'styled-components';
import { Button } from 'components/Button/Button';
import { Flex } from 'components/Layout/Flex';
import withWallet from 'hoc/withWallet';
import { useWallet } from 'providers/WalletProvider';
import { ClaimType } from 'enums/claim-type';
import welcomeImage from 'assets/images/temple-cashback.png';
import frImage from 'assets/images/fr-transparent.png';
import { ProgressAnimation } from 'components/Loader/ProgressAnimation';
import { BigNumber } from '@ethersproject/bignumber';
import { fromAtto } from 'utils/bigNumber';
import { noop } from 'utils/helpers';
import { InputSelect, Option } from 'components/InputSelect/InputSelect';

// Map filenames to dropdown name
type ClaimFile = {
  file: ClaimType;
  name: string;
};
const relevantClaims: ClaimFile[] = [
  {
    file: ClaimType.GAS_REFUND_OC_PUZZLES,
    name: 'OC Gas Refund',
  },
  { file: ClaimType.TEAM_BONUS_OC, name: 'OC Team' },
];

// Import relevant claims
type ClaimData = {
  [address: string]: {
    tokenQuantity: BigNumber;
  };
};
const claims: {
  [filename: string]: ClaimData;
} = {};
relevantClaims.forEach(async (claim: ClaimFile) => {
  const data: { default: ClaimData } = await import(
    `../../data/claims/${claim.file}.json`
  );
  claims[claim.file] = data.default;
});

type TempleCashbackState = {
  cashbackComplete: boolean;
  cashbackSuccessful: boolean;
  collecting: boolean;
  label: string;
};

type Action =
  | { type: 'collect' }
  | { type: 'success' }
  | { type: 'failure' }
  | { type: 'fileChange' };

const cashbackInitialState: TempleCashbackState = {
  cashbackComplete: false,
  cashbackSuccessful: false,
  collecting: false,
  label: 'Collect',
};

const TempleCashbackPage = () => {
  const {
    claims,
    claimCount,
    cashbackComplete,
    cashbackSuccessful,
    collecting,
    label,
    wallet,
    setActiveClaim,
    cashbackContractCall,
  } = useTempleCashback();
  const [options, setOptions]: [{ value: string; label: string }[], any] =
    useState([]);

  useEffect((): void => {
    if (!wallet) return;
    const address: string = wallet.toLowerCase();
    setOptions(
      Object.keys(claims).map((file) => {
        const claim = claims[file];
        if (claim[address]) {
          // Find the label name
          const relevantClaim = relevantClaims.find(
            (claim) => claim.file == file
          );
          if (!relevantClaim) return;
          const name = relevantClaim.name;

          // Return an Option
          return {
            value: file,
            label: `${name} - ${fromAtto(
              BigNumber.from(claim[address].tokenQuantity)
            )}`,
          };
        } else return { value: '', label: '' };
      })
    );
  }, [claims, wallet]);

  return (
    <Flex
      layout={{
        kind: 'container',
        direction: 'column',
        alignItems: 'center',
      }}
    >
      {collecting || cashbackComplete ? (
        <ClaimContainer>
          <ProgressAnimation play={collecting} finished={cashbackSuccessful} />
        </ClaimContainer>
      ) : (
        <WelcomeImage />
      )}
      <Copy>
        Not all who attended Opening Ceremony made it through unscathed.
        <br />
        <br />
        May this offering aid the wounded.
      </Copy>
      {claimCount == 0 ? (
        // TODO: Upgrade to new button loader where loading state can be promise
        <CollectButton
          label="There's not a gift for you."
          //eslint-disable-next-line no-unused-vars
          onClick={noop}
          disabled={true}
          ongoingRequest={false}
        />
      ) : claimCount == 1 ? (
        <CollectButton
          label={label}
          onClick={cashbackContractCall}
          disabled={collecting || cashbackComplete}
          ongoingRequest={collecting}
        />
      ) : (
        <>
          <div
            style={{
              width: '31rem',
            }}
          >
            <InputSelect
              onChange={(e) => {
                setActiveClaim(e.value);
              }}
              options={options}
              defaultValue={options[0]}
            />
          </div>
          <CollectButton
            label={label}
            onClick={cashbackContractCall}
            disabled={collecting || cashbackComplete}
            ongoingRequest={collecting}
          />
        </>
      )}
    </Flex>
  );
};

function useTempleCashback() {
  const { claim, wallet } = useWallet();
  const [activeClaim, setActiveClaim]: [
    ClaimType,
    Dispatch<SetStateAction<ClaimType>>
  ] = useState(relevantClaims[0].file);
  const [allocation, setAllocation]: [
    number,
    Dispatch<SetStateAction<number>>
  ] = useState(0);

  // Count eligible claims and set activeClaim to the last eligible
  let claimCount = 0;
  if (wallet) {
    const address: string = wallet.toLowerCase();
    relevantClaims.forEach((claim: ClaimFile) => {
      if (claims[claim.file] && claims[claim.file][address]) {
        const tokens = BigNumber.from(
          claims[claim.file][address].tokenQuantity
        );
        if (tokens.gt(0)) {
          claimCount++;
        }
      }
    });
  }

  useEffect(() => {
    if (
      wallet &&
      claims[activeClaim] &&
      claims[activeClaim][wallet.toLowerCase()]
    )
      setAllocation(
        fromAtto(
          BigNumber.from(
            claims[activeClaim][wallet.toLowerCase()].tokenQuantity
          )
        )
      );
    else setAllocation(0);
    if (dispatch) dispatch({ type: 'fileChange' });
  }, [activeClaim, wallet]);

  const [state, dispatch] = useReducer(reducer, {
    ...cashbackInitialState,
    label: `Collect ${allocation} $TEMPLE`,
  });

  function reducer(
    state: TempleCashbackState,
    action: Action
  ): TempleCashbackState {
    switch (action.type) {
      case 'collect':
        return { ...state, collecting: true, label: 'Collecting...' };
      case 'success':
        return {
          ...state,
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
      case 'fileChange':
        return {
          ...state,
          label: `Collect ${allocation} $TEMPLE`,
        };
      default:
        return state;
    }
  }

  const cashbackContractCall = useCallback(() => {
    const txPromise = claim(activeClaim);

    if (txPromise) {
      dispatch({ type: 'collect' });
      txPromise
        .then(() => dispatch({ type: 'success' }))
        .catch(() => dispatch({ type: 'failure' }));
    }
  }, [claim, dispatch, ClaimType.FIRE_RITUAL_ROLLOVER]);

  return {
    ...state,
    claimCount,
    claims,
    wallet,
    setActiveClaim,
    cashbackContractCall,
  };
}

interface CollectButtonProps extends HTMLProps<HTMLButtonElement> {
  ongoingRequest: boolean;
}

const CollectButton = styled(Button)<CollectButtonProps>`
  max-width: 500px;

  ${({ ongoingRequest, disabled }: CollectButtonProps) =>
    ongoingRequest ? `cursor: wait;` : disabled && `cursor: not-allowed;`}
`;

const Copy = styled.p`
  max-width: 80%;
  text-align: center;
  padding-bottom: 2rem;
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

const ClaimContainer = styled.div`
  position: relative;
  width: 470px;
  height: 300px;
  background-image: url(${frImage});
  background-size: cover;
  background-position: center;
  margin-bottom: 100px;
  animation: ${flicker} 4s infinite alternate ease-out;
`;

const WelcomeImage = styled.div`
  position: relative;
  width: 470px;
  height: 300px;
  background: url(${welcomeImage}) center no-repeat;
  background-size: contain;
  margin-bottom: 50px;
`;

const Dropdown = styled.select`
  max-width: 500px;
  margin-bottom: 15px;
  text-align: center;
  width: 100%;
  padding: 1rem;
  transition: color 250ms linear;
  background-color: transparent;
  color: ${(props) => props.theme.palette.brand};
  ${(props) => props.theme.typography.meta};
  border: 0.0625rem /* 1/16 */ solid currentColor;
`;

export default withWallet(TempleCashbackPage);
