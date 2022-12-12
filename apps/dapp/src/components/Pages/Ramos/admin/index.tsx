import styled, { css } from 'styled-components';

import { tabletAndAbove } from 'styles/breakpoints';
import { Tabs } from 'components/Tabs/Tabs';
import EllipsisLoader from 'components/EllipsisLoader';
import { Input } from 'components/Input/Input';
import { Button } from 'components/Button/Button';

import { useRamosAdmin } from './useRamosAdmin';
import {
  DepositAndStake,
  DepositStable,
  ExitPoolRequest,
  JoinPoolRequest,
  RebalanceDown,
  RebalanceUp,
  WithdrawStable,
} from './components';
import {
  limitInput,
  handleBlur
} from "./helpers";

const Container = styled.div`
  display: grid;
  grid-template-columns: 1fr;
  gap: 2rem;
  ${tabletAndAbove(css`
    grid-template-columns: 1fr 1fr;
  `)}
`;

const RamosAdmin = () => {
  const {
    tpf,
    templePrice,
    rebalanceUpToTpf,
    rebalanceDownToTpf,
    depositStableUpToTpf,
    createJoinPoolRequest,
    createExitPoolRequest,
    createDepositAndStakeRequest,
    withdrawStableToTpf,
    percentageOfGapToClose,
    setPercentageOfGapToClose,
    calculateRecommendedAmounts
  } = useRamosAdmin();

  const tabs = [
    {
      label: 'Rebalance',
      content: (
        <Container>
          <RebalanceUp toTpf={rebalanceUpToTpf} />
          <RebalanceDown toTpf={rebalanceDownToTpf} />
        </Container>
      ),
    },
    {
      label: 'Stable',
      content: (
        <Container>
          <DepositStable toTpf={depositStableUpToTpf} />
          <WithdrawStable toTpf={withdrawStableToTpf} />
        </Container>
      ),
    },
    {
      label: 'Liquidity',
      content: (
        <Container>
          <JoinPoolRequest calculateFunc={createJoinPoolRequest} />
          <ExitPoolRequest calculateFunc={createExitPoolRequest} />
          <DepositAndStake calculateFunc={createDepositAndStakeRequest} />
        </Container>
      ),
    },
  ];

  return (
    <div>
      <Container>
        <p>
          Temple Price: <strong>{templePrice?.formatUnits() ?? <EllipsisLoader />}</strong>
        </p>
        <p>
          TPF: <strong>{tpf?.formatUnits() ?? <EllipsisLoader />}</strong>
        </p>
      </Container>
      <Container>
        <div>
          <p>Percentage of gap to close: </p>
          <Input
            value={percentageOfGapToClose}
            small
            max={100}
            crypto={{ kind: 'value', value: 'GAP' }}
            suffix="%"
            handleChange={(e: string) => {
              setPercentageOfGapToClose(limitInput(e));
            }}
            onBlur={() => setPercentageOfGapToClose(handleBlur(percentageOfGapToClose ?? 100, 0, 100))}
          />
          <Button isSmall onClick={calculateRecommendedAmounts} label="RECALCULATE" />

        </div>
      </Container>
      <br />
      <Tabs tabs={tabs} />
    </div>
  );
};

export default RamosAdmin;
