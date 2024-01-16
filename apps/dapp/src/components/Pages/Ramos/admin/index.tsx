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
  const ramosAdmin = useRamosAdmin();
  const [isTxSettingsOpen, setIsTxSettingsOpen] = useState(false);

  const tpfFormatted = ramosAdmin && ramosAdmin.tpf?.formatUnits(5);
  const templePriceFormatted =
    ramosAdmin && ramosAdmin.templePrice?.formatUnits(5);
  const totalAvailableDaiTrvFormatted =
    ramosAdmin && ramosAdmin.totalAvailableDaiTrv?.formatUnits(5);
  const totalAvailableTempleTrvFormatted =
    ramosAdmin && ramosAdmin.totalAvailableTempleTrv?.formatUnits(5);

  const tabs = [
    {
      label: 'Liquidity',
      content: (
        <Container>
          <AddLiquidity
            calculateFunc={ramosAdmin.createJoinPoolRequest}
            handleInput={ramosAdmin.handleAddLiquidityInput}
          />
          <RemoveLiquidity calculateFunc={ramosAdmin.createExitPoolRequest} />
          <DepositAndStakeBpt
            calculateFunc={ramosAdmin.createDepositAndStakeRequest}
          />
        </Container>
      ),
    },
    {
      label: 'Rebalance',
      content: (
        <Container>
          <RebalanceUp amounts={ramosAdmin.rebalanceUpAmounts} />
          <RebalanceDown amounts={ramosAdmin.rebalanceDownAmounts} />
          <Button
            isSmall
            onClick={ramosAdmin.calculateRecommendedAmounts}
            label="RECALCULATE"
          />
        </Container>
      ),
    },
    {
      label: 'Stable',
      content: (
        <Container>
          <DepositStable amounts={ramosAdmin.depositStableAmounts} />
          <WithdrawStable amounts={ramosAdmin.withdrawStableAmounts} />
          <Button
            isSmall
            onClick={ramosAdmin.calculateRecommendedAmounts}
            label="RECALCULATE"
          />
        </Container>
      ),
    },
  ];

  const {
    ramos: RAMOS_ADDRESS,
    treasuryReservesVault: TRV_ADDRESS,
    strategies: STRATEGIES,
  } = environmentConfig.contracts;

  return (
    <div>
      <TransactionSettingsModal
        hasDeadline={false}
        closeOnClickOutside={false}
        defaultSlippage={ramosAdmin.slippageTolerance}
        isOpen={isTxSettingsOpen}
        onClose={() => {
          setIsTxSettingsOpen(false);
          ramosAdmin.calculateRecommendedAmounts();
        }}
        onChange={(settings) => {
          ramosAdmin.setSlippageTolerance(settings.slippageTolerance);
        }}
      />
      <Container>
        <Header
          alias="RAMOS"
          contractAddress={RAMOS_ADDRESS}
          additionalDetails={
            <>
              <p>
                Current Spot Price:{' '}
                <strong>{templePriceFormatted ?? <EllipsisLoader />}</strong>
              </p>
              <p>
                Current Treasury Price Index:{' '}
                <strong>{tpfFormatted ?? <EllipsisLoader />}</strong>
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
                Total Available Dai:{' '}
                <strong>
                  {totalAvailableDaiTrvFormatted ?? <EllipsisLoader />}
                </strong>
              </p>
              <p>
                Total Available Temple:{' '}
                <strong>
                  {totalAvailableTempleTrvFormatted ?? <EllipsisLoader />}
                </strong>
              </p>
            </>
          }
        />
        <Header
          alias="RAMOS STRATEGY"
          contractAddress={STRATEGIES.ramosStrategy}
          additionalDetails={
            <p>
              Version:{' '}
              <strong>
                {ramosAdmin ? (
                  ramosAdmin.ramosStrategyVersion
                ) : (
                  <EllipsisLoader />
                )}
              </strong>
            </p>
          }
        />
      </Container>
      <Container>
        <Content>
          <Button
            isSmall
            onClick={() => setIsTxSettingsOpen(true)}
            label="TRANSACTION SETTINGS"
          />
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
        <a
          href={`https://etherscan.io/address/${contractAddress}`}
          target="_blank"
          rel="noreferrer"
        >
          {contractAddress.slice(0, 6) + '.....' + contractAddress.slice(-6)}
        </a>
      </p>
      {additionalDetails}
    </div>
  );
};

export default RamosAdmin;
