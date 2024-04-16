import { useMemo, useState } from 'react';

import { useWallet } from 'providers/WalletProvider';
import { formatNumber, formatNumberFixedDecimals } from 'utils/formatter';
import { Pool } from 'components/Layouts/Ascend/types';
import { TransactionSettingsModal } from 'components/TransactionSettingsModal/TransactionSettingsModal';
import { useTokenContractAllowance } from 'hooks/core/use-token-contract-allowance';
import {
  CircularLoader as BaseCircularLoader,
  CircularLoader,
} from 'components/Pages/Ascend/components/Trade/CircularLoader';
import { DBN_ZERO, DecimalBigNumber } from 'utils/DecimalBigNumber';

import { useVaultTradeState } from './hooks/use-vault-trade-state';
import { useAuctionContext } from '../AuctionContext';

import {
  Wrapper,
  TradeHeader,
  SwapControls,
  ToggleButton,
  LoadWrapper,
  ReceivedValues,
  SlippageButton,
  SwapButton,
  ErrorMessage,
} from './styles';
import { AnalyticsService } from 'services/AnalyticsService';
import { AnalyticsEvent } from 'constants/events';
import { Input } from 'components/Pages/Core/NewUI/HomeInput';

interface Props {
  pool: Pool;
}

export const Trade = ({ pool }: Props) => {
  const { wallet } = useWallet();
  const {
    swapState: { buy, sell },
    toggleTokenPair,
    vaultAddress,
    userBalances,
    isPaused,
  } = useAuctionContext();
  const [transactionSettingsOpen, setTransactionSettingsOpen] = useState(false);

  const { swap, state, setSellValue, setTransactionSettings } =
    useVaultTradeState(pool, async (tokenSold, tokenBought, amount, poolId) => {
      AnalyticsService.captureEvent(AnalyticsEvent.Ascend.Swap, {
        tokenSold,
        tokenBought,
        amount,
        poolId,
      });
    });

  const [{ allowance, isLoading: allowanceIsLoading }, increaseAllowance] =
    useTokenContractAllowance(sell as any, vaultAddress);

  const bigSellAmount = useMemo(() => {
    if (!state.inputValue || state.inputValue.trim() === '.') {
      return DBN_ZERO;
    }
    return DecimalBigNumber.parseUnits(state.inputValue, sell.decimals);
  }, [sell, state.inputValue]);

  const { receiveEstimate, estimateWithSlippage } = useMemo(() => {
    if (!state.quote.estimate) {
      return { receiveEstimate: '', estimateWithSlippage: '' };
    }

    return {
      receiveEstimate: state.quote.estimate.formatUnits(),
      estimateWithSlippage: state.quote.estimateWithSlippage!.formatUnits(),
    };
  }, [state.quote, buy]);

  const sellBalance = userBalances[sell.address as any] || DBN_ZERO;
  const buyBalance = userBalances[buy.address as any] || DBN_ZERO;

  if (!wallet) {
    return (
      <Wrapper verticalAlignment="top">
        <h3>Connect Wallet</h3>
        <p>Please connect your wallet...</p>
      </Wrapper>
    );
  }

  if (!pool.swapEnabled || isPaused) {
    return (
      <Wrapper verticalAlignment="top">
        <h3>Paused!</h3>
        <p>This event is currently paused.</p>
      </Wrapper>
    );
  }

  return (
    <>
      <TransactionSettingsModal
        isOpen={transactionSettingsOpen}
        onClose={() => setTransactionSettingsOpen(false)}
        onChange={({ slippageTolerance, deadlineMinutes }) => {
          if (slippageTolerance < 0 || slippageTolerance > 100) {
            return;
          }
          setTransactionSettings({ slippageTolerance, deadlineMinutes });
        }}
      />
      <Wrapper>
        <TradeHeader>Trade {sell.symbol}</TradeHeader>
        <Input
          isNumber
          crypto={{ kind: 'value', value: sell.symbol }}
          placeholder="0.00"
          small
          value={state.inputValue}
          hint={`Balance: ${formatNumber(sellBalance.formatUnits())}`}
          onHintClick={() => {
            setSellValue(sellBalance.formatUnits());
          }}
          handleChange={(value) => {
            const stringValue = value.toString();
            if (!stringValue.startsWith('.') && Number(stringValue) === 0) {
              setSellValue('');
            } else {
              setSellValue(stringValue);
            }
          }}
        />
        <ToggleButton
          type="button"
          onClick={() => toggleTokenPair()}
          aria-label="Toggle Inputs"
          disabled={state.quote.isLoading}
        />
        <Input
          isNumber
          placeholder="0.00"
          crypto={{ kind: 'value', value: buy.symbol }}
          small
          value={receiveEstimate}
          hint={`Balance: ${formatNumber(buyBalance.formatUnits())}`}
          disabled
        />
        <SwapControls>
          {state.quote.isLoading && (
            <LoadWrapper>
              <BaseCircularLoader />
            </LoadWrapper>
          )}
          <ReceivedValues>
            {!!receiveEstimate && !state.quote.isLoading && (
              <>
                Expected Output: {formatNumberFixedDecimals(receiveEstimate, 3)}
                <br />
                Minimum Amount:{' '}
                {formatNumberFixedDecimals(estimateWithSlippage, 3)}
              </>
            )}
            {state.quote.isLoading && <>Fetching Price...</>}
          </ReceivedValues>
          <SlippageButton
            type="button"
            onClick={() => setTransactionSettingsOpen(true)}
          >
            {state.transactionSettings.slippageTolerance}%
          </SlippageButton>
        </SwapControls>
        {allowance === 0 && (
          <SwapButton
            type="button"
            disabled={allowanceIsLoading || state.swap.isLoading}
            onClick={() => {
              increaseAllowance();
            }}
          >
            {allowanceIsLoading ? <CircularLoader /> : <>Approve</>}
          </SwapButton>
        )}
        {allowance !== 0 && (
          <SwapButton
            type="button"
            disabled={
              bigSellAmount.isZero() ||
              bigSellAmount.gt(sellBalance) ||
              state.quote.isLoading ||
              !state.quote.estimate ||
              state.swap.isLoading
            }
            onClick={() => {
              swap();
            }}
          >
            {state.swap.isLoading ? <CircularLoader /> : <>Swap</>}
          </SwapButton>
        )}
        {!!state.swap.error && <ErrorMessage>{state.swap.error}</ErrorMessage>}
        {!!state.quote.error && (
          <ErrorMessage>{state.quote.error}</ErrorMessage>
        )}
      </Wrapper>
    </>
  );
};
