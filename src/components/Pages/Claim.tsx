import React, {
  useReducer,
  useEffect,
  HTMLProps,
  useState,
  SetStateAction,
  Dispatch,
} from 'react';
import styled, { keyframes } from 'styled-components';
import { Button } from 'components/Button/Button';
import { Flex } from 'components/Layout/Flex';
import { InputSelect, Option } from 'components/InputSelect/InputSelect';
import withWallet from 'hoc/withWallet';
import { useWallet } from 'providers/WalletProvider';
import { ClaimType } from 'enums/claim-type';
import welcomeImage from 'assets/images/temple-cashback.png';
import frImage from 'assets/images/fr-transparent.png';
import { ProgressAnimation } from 'components/Loader/ProgressAnimation';
import { BigNumber } from '@ethersproject/bignumber';
import { fromAtto } from 'utils/bigNumber';
import { noop } from 'utils/helpers';
import { TempleCashback__factory } from 'types/typechain';

const ENV_VARS = import.meta.env;
const TEMPLE_CASHBACK_ADDRESS = ENV_VARS.VITE_PUBLIC_TEMPLE_CASHBACK_ADDRESS;

// Map filenames to dropdown name
type ClaimFile = {
  file: ClaimType;
  name: string;
};
const relevantClaims: ClaimFile[] = [
  {
    file: ClaimType.GAS_REFUND_OC_PUZZLES as ActiveClaim,
    name: 'OC Gas Refund',
  },
  { file: ClaimType.TEAM_BONUS_OC as ActiveClaim, name: 'OC Team' },
];

type ActiveClaim = ClaimType.GAS_REFUND_OC_PUZZLES | ClaimType.TEAM_BONUS_OC;

// Import relevant claims
type ClaimData = {
  [address: string]: {
    tokenQuantity: BigNumber;
    nonce: BigNumber;
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
  cashbackComplete: {
    [ClaimType.GAS_REFUND_OC_PUZZLES]: boolean;
    [ClaimType.TEAM_BONUS_OC]: boolean;
  };
  cashbackSuccessful: {
    [ClaimType.GAS_REFUND_OC_PUZZLES]: boolean;
    [ClaimType.TEAM_BONUS_OC]: boolean;
  };
  collecting: boolean;
  label: string;
};

type Action =
  | { type: 'collect' }
  | { type: 'success'; claim: ActiveClaim }
  | { type: 'failure'; claim: ActiveClaim }
  | { type: 'fileChange' };

const cashbackInitialState: TempleCashbackState = {
  cashbackComplete: {
    [ClaimType.GAS_REFUND_OC_PUZZLES]: false,
    [ClaimType.TEAM_BONUS_OC]: false,
  },
  cashbackSuccessful: {
    [ClaimType.GAS_REFUND_OC_PUZZLES]: false,
    [ClaimType.TEAM_BONUS_OC]: false,
  },
  collecting: false,
  label: 'Collect',
};

const TempleCashbackPage = () => {
  const {
    activeClaim,
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
      Object.keys(claims)
        .map((file) => {
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
        .filter((claimObj) => claimObj?.value != '')
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
      {collecting || cashbackComplete[activeClaim] ? (
        <ClaimContainer>
          <ProgressAnimation
            play={collecting}
            finished={cashbackSuccessful[activeClaim]}
          />
        </ClaimContainer>
      ) : (
        <WelcomeImage />
      )}
      <Copy>
        Not all who attended the Opening Ceremony made it through unscathed.
        <br />
        <br />
        May this offering aid the wounded.
      </Copy>
      {claimCount == 0 ? (
        // TODO: Upgrade to new button loader where loading state can be promise
        <CollectButton
          label="Nothing to collect"
          onClick={noop}
          disabled={true}
          ongoingRequest={false}
        />
      ) : claimCount == 1 ? (
        <CollectButton
          label={label}
          onClick={cashbackContractCall}
          disabled={collecting || cashbackComplete[activeClaim]}
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
            disabled={collecting || cashbackComplete[activeClaim]}
            ongoingRequest={collecting}
          />
        </>
      )}
    </Flex>
  );
};

function useTempleCashback() {
  const { claim, wallet, signer } = useWallet();

  // Count eligible claim
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

  const gasRefundClaims = claims[relevantClaims[0]?.file];
  const ocClaims = claims[relevantClaims[1]?.file];

  const walletGasRefundClaim =
    //@ts-ignore
    gasRefundClaims && gasRefundClaims[wallet?.toLocaleLowerCase()];
  const walletOCClaim =
    //@ts-ignore
    ocClaims && ocClaims[wallet?.toLocaleLowerCase()];

  const initialActiveClaim = walletGasRefundClaim
    ? relevantClaims[0].file
    : relevantClaims[1].file;

  const [activeClaim, setActiveClaim]: [
    ActiveClaim,
    Dispatch<SetStateAction<ActiveClaim>>
  ] = useState(initialActiveClaim as ActiveClaim);

  const [allocation, setAllocation]: [
    number,
    Dispatch<SetStateAction<number>>
  ] = useState(0);

  // re-render component on claim change
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

  // checks if user has already claimed their allocation
  useEffect(() => {
    async function isAllocationAlreadyClaimed() {
      if (
        signer &&
        wallet &&
        activeClaim &&
        claims[activeClaim][wallet.toLowerCase()]
      ) {
        const templeCashback = new TempleCashback__factory()
          .attach(TEMPLE_CASHBACK_ADDRESS)
          .connect(signer);

        let allocationClaimed;
        if (claims[activeClaim][wallet.toLowerCase()]) {
          allocationClaimed = await templeCashback.usedNonces(
            wallet,
            BigNumber.from(claims[activeClaim][wallet.toLowerCase()]?.nonce)
          );
        }

        if (allocationClaimed) {
          dispatch({ type: 'success', claim: activeClaim });
        }
      }
    }

    isAllocationAlreadyClaimed();
  }, [signer, activeClaim]);

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
          cashbackComplete: { ...state.cashbackComplete, [action.claim]: true },
          cashbackSuccessful: {
            ...state.cashbackSuccessful,
            [action.claim]: true,
          },
          collecting: false,
          label: 'Collected',
        };
      case 'failure':
        return {
          ...state,
          cashbackComplete: { ...state.cashbackComplete, [action.claim]: true },
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

  const cashbackContractCall = () => {
    const txPromise = claim(activeClaim);

    if (txPromise) {
      dispatch({ type: 'collect' });
      txPromise
        .then(() => dispatch({ type: 'success', claim: activeClaim }))
        .catch(() => dispatch({ type: 'failure', claim: activeClaim }));
    }
  };

  return {
    ...state,
    activeClaim,
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

export default withWallet(TempleCashbackPage);
