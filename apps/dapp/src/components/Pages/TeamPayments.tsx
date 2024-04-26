import React, {
  useEffect,
  useState,
  useReducer,
  useRef,
  SetStateAction,
} from 'react';
import styled from 'styled-components';

import { TempleTeamPayments__factory } from 'types/typechain';
import { fromAtto } from 'utils/bigNumber';
import { useWallet } from 'providers/WalletProvider';

import Image from 'components/Image/Image';
import { Button } from 'components/Button/Button';
import { Flex } from 'components/Layout/Flex';
import { InputSelect } from 'components/InputSelect/InputSelect';
import eyeImage from 'assets/images/no-pupil-eye.png';
import env from 'constants/env';
import { TICKER_SYMBOL } from 'enums/ticker-symbol';

type ReducerState = {
  collectingFixed: boolean;
  labelFixed: string;
};

type TeamPaymentsState = ReducerState & {
  allocationFixed: number;
  claimableFixed: number;
  remainingAllocationFixed: number;
  setSelectedEpoch: React.Dispatch<SetStateAction<number>>;
  onCollectTeamFixedPayment(): void;
};

type Action =
  | { type: 'default-fixed' }
  | { type: 'collect-fixed' }
  | { type: 'success-fixed' }
  | { type: 'failure-fixed' };

const PAYMENT_TOKEN = TICKER_SYMBOL.DAI;

const reducerInitialState: ReducerState = {
  collectingFixed: false,
  labelFixed: `COLLECT ${PAYMENT_TOKEN} FOR IMPACT`,
};

const TeamPayments = () => {
  const {
    collectingFixed,
    labelFixed,
    allocationFixed,
    claimableFixed,
    remainingAllocationFixed,
    setSelectedEpoch,
    onCollectTeamFixedPayment,
  }: TeamPaymentsState = useTempleTeamPayments();

  const [cursorCoords, setCursorCoords] = useState([0, 0]);
  const imageRef = useRef<HTMLDivElement>(null);

  const pupilStyle = {
    transform: getPupilTransform(imageRef, cursorCoords),
  };

  const teamPayments = env.contracts.teamPayments;
  let dropdownOptions: { value: number; label: string }[] = [];
  if (teamPayments) {
    dropdownOptions = teamPayments
      .map((_, i) => ({
        value: i,
        label: teamPayments[i].name,
      }))
      .reverse();
  }

  return (
    <div onMouseMove={(e) => setCursorCoords([e.clientX, e.clientY])}>
      <Flex
        layout={{
          kind: 'container',
          direction: 'column',
          alignItems: 'center',
        }}
      >
        <Copy>
          <strong>Templar, you are seen.</strong>
          <br />
          <br />
          With each stone you lay the Temple stands taller.
          <br />
          <br />
          Now the Temple gives back to you.
        </Copy>

        <div ref={imageRef}>
          <EyeArea
            layout={{
              kind: 'container',
              justifyContent: 'center',
              alignItems: 'center',
            }}
          >
            <Image src={eyeImage} fillContainer />
            <Pupil style={pupilStyle} />
          </EyeArea>
        </div>

        <TotalAllocation
          title={`Total epoch allocation: ${allocationFixed} ${PAYMENT_TOKEN}`}
        >
          Total epoch allocation: {allocationFixed.toLocaleString()}{' '}
          {PAYMENT_TOKEN}
        </TotalAllocation>

        <ButtonArea>
          <CollectionValues
            layout={{
              kind: 'container',
              justifyContent: 'space-between',
            }}
          >
            <label title={`Collectable: ${claimableFixed} ${PAYMENT_TOKEN}`}>
              Collectable: {claimableFixed.toLocaleString()} {PAYMENT_TOKEN}
            </label>
            <label
              title={`Vested: ${remainingAllocationFixed} ${PAYMENT_TOKEN}`}
            >
              Vested: {remainingAllocationFixed.toLocaleString()}{' '}
              {PAYMENT_TOKEN}
            </label>
          </CollectionValues>
          <Button
            label={labelFixed}
            isUppercase
            disabled={collectingFixed || claimableFixed <= 0}
            onClick={() => onCollectTeamFixedPayment()}
          />
        </ButtonArea>
        {teamPayments && (
          <EpochDropdownContainer>
            <InputSelect
              options={dropdownOptions}
              defaultValue={dropdownOptions[0]}
              onChange={(e) => setSelectedEpoch(e.value)}
              maxMenuItems={10}
            ></InputSelect>
          </EpochDropdownContainer>
        )}
      </Flex>
    </div>
  );
};

function useTempleTeamPayments(): TeamPaymentsState {
  const { wallet, signer, collectTempleTeamPayment } = useWallet();

  const [state, dispatch] = useReducer(reducer, { ...reducerInitialState });

  const [selectedEpoch, setSelectedEpoch] = useState<number>(
    env.contracts.teamPayments ? env.contracts.teamPayments.length - 1 : 0
  );

  const [claimableFixed, setClaimableFixed] = useState(0);

  const [allocationFixed, setAllocationFixed] = useState(0);

  const [remainingAllocationFixed, setRemainingAllocationFixed] = useState(0);

  const [claimed, setClaimed] = useState(false);

  function reducer(state: ReducerState, action: Action): ReducerState {
    switch (action.type) {
      case 'default-fixed':
        return {
          ...state,
          collectingFixed: false,
          labelFixed: `Collect ${PAYMENT_TOKEN} for impact`,
        };
      case 'collect-fixed':
        return { ...state, collectingFixed: true, labelFixed: 'Collecting...' };
      case 'success-fixed':
        return {
          ...state,
          collectingFixed: false,
          labelFixed: 'Collected',
        };
      case 'failure-fixed': {
        return {
          ...state,
          collectingFixed: false,
          labelFixed: 'Failed to collect',
        };
      }
      default:
        return state;
    }
  }

  useEffect(() => {
    const getAllocationAndClaimableAmounts = async () => {
      if (wallet && signer && selectedEpoch && env.contracts.teamPayments) {
        // Retrieve fixed allocation & claimable amounts
        const fixedTeamPayments = new TempleTeamPayments__factory(
          signer
        ).attach(env.contracts.teamPayments[selectedEpoch].address);

        const fixedAllocation = await fixedTeamPayments.allocation(wallet);
        const fixedClaimedAmount = await fixedTeamPayments.claimed(wallet);
        const convertedFixedAlloc = fromAtto(fixedAllocation);
        setRemainingAllocationFixed(
          fromAtto(fixedAllocation.sub(fixedClaimedAmount))
        );

        setAllocationFixed(convertedFixedAlloc);

        if (convertedFixedAlloc > 0) {
          const fixedClaimable = await fixedTeamPayments.calculateClaimable(
            wallet
          );
          const convertedFixedClaimable = fromAtto(fixedClaimable);

          convertedFixedClaimable > 0 && dispatch({ type: 'default-fixed' });
          setClaimableFixed(convertedFixedClaimable);
        } else {
          setClaimableFixed(0);
        }
      }
    };

    getAllocationAndClaimableAmounts();
  }, [wallet, signer, claimed, selectedEpoch]);

  async function onCollectTeamFixedPayment() {
    dispatch({ type: 'collect-fixed' });

    const tx = await collectTempleTeamPayment(selectedEpoch);

    if (tx) {
      setClaimed(!claimed);
      dispatch({ type: 'success-fixed' });
    } else {
      dispatch({ type: 'failure-fixed' });
      console.error('Could not claim');
    }
  }

  return {
    collectingFixed: state.collectingFixed,
    labelFixed: state.labelFixed,
    claimableFixed,
    remainingAllocationFixed,
    allocationFixed,
    setSelectedEpoch,
    onCollectTeamFixedPayment,
  };
}

function getPupilTransform(
  imageRef: React.RefObject<HTMLDivElement>,
  cursorCoords: number[]
) {
  const headerHeight = 80;

  if (imageRef.current) {
    const x = 0 - window.innerWidth / 2 + cursorCoords[0];
    const y =
      0 -
      window.innerHeight / 2 +
      imageRef.current.offsetTop +
      cursorCoords[1] -
      headerHeight;

    const values = normalizeTransform(x, y);
    return `translate(${values[0]}px, ${values[1]}px)`;
  }
}

function normalizeTransform(x: number, y: number) {
  if (Math.abs(x) + Math.abs(y) <= 10) {
    return [x, y];
  }

  const multipleOfLength = (Math.abs(x) + Math.abs(y)) / 10;

  return [x / multipleOfLength, y / multipleOfLength];
}

const Copy = styled.p`
  text-align: center;
  margin-bottom: 3rem;
`;

const ButtonArea = styled.div`
  max-width: 31.25rem;
  width: 100%;
  margin-top: 4rem;
`;

const CollectionValues = styled(Flex)`
  padding: 1rem;
  color: ${({ theme }) => theme.palette.brand};
`;

const EyeArea = styled(Flex)`
  width: 18.75rem;
  height: 18.75rem;
`;

const Pupil = styled.div`
  position: absolute;
  height: 1rem;
  width: 1rem;
  background-color: ${({ theme }) => theme.palette.brand};
  border-radius: 1rem;
`;

const TotalAllocation = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  color: ${({ theme }) => theme.palette.brand};
  font-size: 1.5rem;
  padding-top: 0.5rem;
`;

const EpochDropdownContainer = styled.div`
  position: absolute;
  right: 0;
  width: 12rem;
`;

export default TeamPayments;
