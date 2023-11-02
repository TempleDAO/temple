import styled, { css } from 'styled-components';

import { tabletAndAbove } from 'styles/breakpoints';
import { Tabs } from 'components/Pages/Ramos/admin/components/Tabs';
import EllipsisLoader from 'components/EllipsisLoader';
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
import { TransactionSettingsModal } from 'components/TransactionSettingsModal/TransactionSettingsModal';
import { useState } from 'react';
import environmentConfig from 'constants/env';

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
    rebalanceUpAmounts,
    rebalanceDownAmounts,
    depositStableAmounts,
    withdrawStableAmounts,
    handleAddLiquidityInput,
    createJoinPoolRequest,
    createExitPoolRequest,
    createDepositAndStakeRequest,
    setSlippageTolerance,
    calculateRecommendedAmounts,
  } = useRamosAdmin();
  const [isTxSettingsOpen, setIsTxSettingsOpen] = useState(false);

  const tabs = [
    {
      label: 'Rebalance',
      content: (
        <Container>
          <RebalanceUp amounts={rebalanceUpAmounts} />
          <RebalanceDown amounts={rebalanceDownAmounts} />
        </Container>
      ),
    },
    {
      label: 'Stable',
      content: (
        <Container>
          <DepositStable amounts={depositStableAmounts} />
          <WithdrawStable amounts={withdrawStableAmounts} />
        </Container>
      ),
    },
    {
      label: 'Liquidity',
      content: (
        <Container>
          <AddLiquidity calculateFunc={createJoinPoolRequest} handleInput={handleAddLiquidityInput} />
          <RemoveLiquidity calculateFunc={createExitPoolRequest} />
          <DepositAndStakeBpt calculateFunc={createDepositAndStakeRequest} />
        </Container>
      ),
    },
  ];

  const ramosAddress = environmentConfig.contracts.ramos;

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
      <div>
        <p>
          RAMOS:{' '}
          <a href={`https://etherscan.io/address/${ramosAddress}`} target="_blank" rel="noreferrer">
            {ramosAddress}
          </a>
        </p>
      </div>
      <Container>
        <p>
          Current Spot Price: <strong>{templePrice?.formatUnits() ?? <EllipsisLoader />}</strong>
        </p>
        <p>
          Current Treasury Price Index: <strong>{tpf?.formatUnits() ?? <EllipsisLoader />}</strong>
        </p>
      </Container>
      <Container>
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
