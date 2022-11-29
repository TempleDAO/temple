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
    calculateRebalanceUp,
    rebalanceUpToTpf,
    calculateRebalanceDown,
    rebalanceDownToTpf,
    calculateDepositStable,
    depositStableUpToTpf,
    createJoinPoolRequest,
    createExitPoolRequest,
    calculateWithdrawStable,
    createDepositAndStakeRequest,
    withdrawStableToTpf,
    randomPercent,
    setRandomPercent,
    calculateRecommendedAmounts
  } = useRamosAdmin();

  const tabs = [
    {
      label: 'Rebalance',
      content: (
        <Container>
          <RebalanceUp calculateFunc={calculateRebalanceUp} toTpf={rebalanceUpToTpf} />
          <RebalanceDown calculateFunc={calculateRebalanceDown} toTpf={rebalanceDownToTpf} />
        </Container>
      ),
    },
    {
      label: 'Stable',
      content: (
        <Container>
          <DepositStable calculateFunc={calculateDepositStable} toTpf={depositStableUpToTpf} />
          <WithdrawStable calculateFunc={calculateWithdrawStable} toTpf={withdrawStableToTpf} />
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
        <Input
          value={randomPercent}
          small
          max={100}
          crypto={{ kind: 'value', value: 'RANDOM' }}
          suffix="%"
          handleChange={(e: string) => {
            setRandomPercent(limitInput(e));
          }}
          onBlur={() => setRandomPercent(handleBlur(randomPercent ?? 0, 0, 100))}
        />
        <Button onClick={calculateRecommendedAmounts} label="RECALCULATE"/>
      </Container>
      <br />
      <Tabs tabs={tabs} />
    </div>
  );
};

export default RamosAdmin;
