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
import { Popover } from 'components/Popover';

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
    txSubmitted,
    txError,
    setTxError,
    setTxSubmitted,
    rebalanceUpToTpf,
    rebalanceDownToTpf,
    depositStableUpToTpf,
    createJoinPoolRequest,
    createExitPoolRequest,
    createDepositAndStakeRequest,
    withdrawStableToTpf,
    randomPercent,
    setRandomPercent,
    calculateRecommendedAmounts,
    onRebalanceDown,
    onRebalanceUp,
    onDepositStable,
    onWithdrawStable,
    onAddLiquidity,
    onRemoveLiquidity
  } = useRamosAdmin();

  const shouldDisableButton = Boolean(txError || txSubmitted);

  const tabs = [
    {
      label: 'Rebalance',
      content: (
        <Container>
          <RebalanceUp amounts={rebalanceUpToTpf} onRebalanceUp={onRebalanceUp} shouldDisableButton={shouldDisableButton} />
          <RebalanceDown amounts={rebalanceDownToTpf} onRebalanceDown={onRebalanceDown} shouldDisableButton={shouldDisableButton} />
        </Container>
      ),
    },
    {
      label: 'Stable',
      content: (
        <Container>
          <DepositStable amounts={depositStableUpToTpf} onDepositStable={onDepositStable} shouldDisableButton={shouldDisableButton} />
          <WithdrawStable amounts={withdrawStableToTpf} onWithdrawStable={onWithdrawStable} shouldDisableButton={shouldDisableButton} />
        </Container>
      ),
    },
    {
      label: 'Liquidity',
      content: (
        <Container>
          <JoinPoolRequest calculateFunc={createJoinPoolRequest} onAddLiquidity={onAddLiquidity} shouldDisableButton={shouldDisableButton} />
          <ExitPoolRequest calculateFunc={createExitPoolRequest} onRemoveLiquidity={onRemoveLiquidity} shouldDisableButton={shouldDisableButton} />
          <DepositAndStake calculateFunc={createDepositAndStakeRequest} />
        </Container>
      ),
    },
  ];

  return (
    <>
      <Popover isOpen={Boolean(txError || txSubmitted)} onClose={() => {
        setTxError(undefined);
        setTxSubmitted(false)
      }}>
        {txError ? (
          <>
            <h3>{txError.name}</h3>
            <p>{txError.message}</p>
          </>
        ) : (
          <>
            <h3>Transaction created!</h3>
            <p>Please head to Safe to complete submission</p>

          </>

        )}
      </Popover>
      <div>
        <Container>
          <p>
            Temple Price: <strong>{templePrice?.formatUnits() ?? <EllipsisLoader />}</strong>
          </p>
          <p>
            TPI: <strong>{tpf?.formatUnits() ?? <EllipsisLoader />}</strong>
          </p>
        </Container>
        <Container>
          <Input
            value={randomPercent}
            small
            max={100}
            crypto={{ kind: 'value', value: 'GAP' }}
            suffix="%"
            handleChange={(e: string) => {
              setRandomPercent(limitInput(e));
            }}
            onBlur={() => setRandomPercent(handleBlur(randomPercent ?? 0, 0, 100))}
          />
          <Button onClick={calculateRecommendedAmounts} label="RECALCULATE" />
        </Container>
        <br />
        <Tabs tabs={tabs} />
      </div>
    </>
  );
};

export default RamosAdmin;
