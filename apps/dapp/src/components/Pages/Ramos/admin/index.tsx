import { ReactNode } from 'react';
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
    totalAvailableDaiTrv,
    totalAvailableTempleTrv,
    ramosStrategyVersion,
    handleAddLiquidityInput,
    createJoinPoolRequest,
    createExitPoolRequest,
    createDepositAndStakeRequest,
    setSlippageTolerance,
    calculateRecommendedAmounts,
  } = useRamosAdmin();
  const [isTxSettingsOpen, setIsTxSettingsOpen] = useState(false);
  
  const tpfFormatted = tpf?.formatUnits(5);
  const templePriceFormatted = templePrice?.formatUnits(5);
  const totalAvailableDaiTrvFormatted = totalAvailableDaiTrv?.formatUnits(5);
  const totalAvailableTempleTrvFormatted = totalAvailableTempleTrv?.formatUnits(5);

  const tabs = [
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
    {
      label: 'Rebalance',
      content: (
        <Container>
          <RebalanceUp amounts={rebalanceUpAmounts} />
          <RebalanceDown amounts={rebalanceDownAmounts} />
          <Button isSmall onClick={calculateRecommendedAmounts} label="RECALCULATE" />
        </Container>
      ),
    },
    {
      label: 'Stable',
      content: (
        <Container>
          <DepositStable amounts={depositStableAmounts} />
          <WithdrawStable amounts={withdrawStableAmounts} />
          <Button isSmall onClick={calculateRecommendedAmounts} label="RECALCULATE" />
        </Container>
      ),
    },
  ];

  const {
    ramos: RAMOS_ADDRESS,
    treasuryReservesVault: TRV_ADDRESS,
    ramosStrategy: RAMOS_STRATEGY,
  } = environmentConfig.contracts;

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
        <Header
          alias="RAMOS"
          contractAddress={RAMOS_ADDRESS}
          additionalDetails={
            <>
              <p>
                Current Spot Price: <strong>{templePriceFormatted ?? <EllipsisLoader />}</strong>
              </p>
              <p>
                Current Treasury Price Index: <strong>{tpfFormatted ?? <EllipsisLoader />}</strong>
              </p>
            </>
          }
        />
        <Header
          alias="TRV"
          contractAddress={TRV_ADDRESS}
          additionalDetails={
            <>
              <p>
                Total Available Dai: <strong>{totalAvailableDaiTrvFormatted ?? <EllipsisLoader />}</strong>
              </p>
              <p>
                Total Available Temple: <strong>{totalAvailableTempleTrvFormatted ?? <EllipsisLoader />}</strong>
              </p>
            </>
          }
        />
        <Header
          alias="RAMOS STRATEGY"
          contractAddress={RAMOS_STRATEGY}
          additionalDetails={
            <p>
              Version: <strong>{ramosStrategyVersion ?? <EllipsisLoader />}</strong>
            </p>
          }
        />
      </Container>
      <Container>
        <Content>
          <Button isSmall onClick={() => setIsTxSettingsOpen(true)} label="TRANSACTION SETTINGS" />
        </Content>
      </Container>
      <br />
      <Tabs tabs={tabs} />
    </div>
  );
};

type Props = {
  alias: string;
  contractAddress: string;
  additionalDetails?: ReactNode;
};
const Header = (props: Props) => {
  const { alias, contractAddress, additionalDetails } = props;
  return (
    <div>
      <p>
        {alias + ' '}
        <a href={`https://etherscan.io/address/${contractAddress}`} target="_blank" rel="noreferrer">
          {contractAddress.slice(0, 6) + '.....' + contractAddress.slice(-6)}
        </a>
      </p>
      {additionalDetails}
    </div>
  );
};

export default RamosAdmin;
