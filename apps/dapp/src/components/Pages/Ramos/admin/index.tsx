import styled, { css } from 'styled-components';

import { tabletAndAbove } from 'styles/breakpoints';
import { Tabs } from 'components/Tabs/Tabs';
import EllipsisLoader from 'components/EllipsisLoader';
import { Input } from 'components/Input/Input';
import { Button } from 'components/Button/Button';

import { useRamosAdmin } from './useRamosAdmin';
import {
  DepositAndStakeBpt,
  DepositStable,
  RemoveLiquidity,
  AddLiquidity,
  RebalanceDown,
  RebalanceUp,
  WithdrawStable,
} from './components';
import { limitInput, handleBlur } from './helpers';
import { TransactionSettingsModal } from 'components/TransactionSettingsModal/TransactionSettingsModal';
import { useState } from 'react';

const Container = styled.div`
  display: grid;
  grid-template-columns: 1fr;
  gap: 2rem;
  ${tabletAndAbove(css`
    grid-template-columns: 1fr 1fr;
  `)}
`;

const Content = styled.div`
  display: flex;
  flex-direction: column;
  justify-content: flex-end;
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
    setSlippageTolerance,
    calculateRecommendedAmounts,
  } = useRamosAdmin();
  const [isTxSettingsOpen, setIsTxSettingsOpen] = useState(false);

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
          <AddLiquidity calculateFunc={createJoinPoolRequest} />
          <RemoveLiquidity calculateFunc={createExitPoolRequest} />
          <DepositAndStakeBpt calculateFunc={createDepositAndStakeRequest} />
        </Container>
      ),
    },
  ];

  return (
    <div>
      <TransactionSettingsModal
        hasDeadline={false}
        closeOnClickOutside={false}
        defaultSlippage={0.5}
        isOpen={isTxSettingsOpen}
        onClose={() => {
          setIsTxSettingsOpen(false);
          calculateRecommendedAmounts();
        }}
        onChange={(settings) => {
          setSlippageTolerance(settings.slippageTolerance);
        }}
      />
      <Container>
        <p>
          Current Spot Price: <strong>{templePrice?.formatUnits() ?? <EllipsisLoader />}</strong>
        </p>
        <p>
          Current TPI: <strong>{tpf?.formatUnits() ?? <EllipsisLoader />}</strong>
        </p>
      </Container>
      <Container>
        <Content>
          <p>Percentage of gap to close: </p>
          <Input
            value={percentageOfGapToClose}
            small
            max={100}
            suffix="%"
            handleChange={(e: string) => {
              setPercentageOfGapToClose(limitInput(e));
            }}
            onBlur={() => setPercentageOfGapToClose(handleBlur(percentageOfGapToClose ?? 100, 0, 100))}
          />
        </Content>
        <Content>
          <Button isSmall onClick={calculateRecommendedAmounts} label="RECALCULATE" />
          <Button isSmall onClick={() => setIsTxSettingsOpen(true)} label="TRANSACTION SETTINGS" />
        </Content>
      </Container>
      <br />
      <Tabs tabs={tabs} />
    </div>
  );
};

export default RamosAdmin;
