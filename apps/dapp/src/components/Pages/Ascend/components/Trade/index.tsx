import { useMemo, useState } from 'react';
import { BigNumber } from 'ethers';

import { formatNumber, formatNumberFixedDecimals } from 'utils/formatter';
import { Pool } from 'components/Layouts/Ascend/types';
import { Input } from 'components/Input/Input';
import { ZERO } from 'utils/bigNumber';
import { getBigNumberFromString, formatBigNumber } from 'components/Vault/utils';
import { TransactionSettingsModal } from 'components/TransactionSettingsModal/TransactionSettingsModal';
import { useTokenContractAllowance } from 'hooks/core/use-token-contract-allowance';
import { CircularLoader as BaseCircularLoader, CircularLoader } from 'components/Loader/CircularLoader';
import { DBN_ZERO, DecimalBigNumber } from 'utils/DecimalBigNumber';

import { useVaultTradeState } from './hooks/use-vault-trade-state';
import { useAuctionContext } from '../AuctionContext';

import {
  TradeWrapper,
  TradeHeader,
  SwapControls,
  ToggleButton,
  LoadWrapper,
  ReceivedValues,
  SlippageButton,
  SwapButton,
  ErrorMessage,
} from './styles';

interface Props {
  pool: Pool;
}

export const Trade = ({ pool }: Props) => {
  const { swapState: { buy, sell }, toggleTokenPair, vaultAddress, userBalances } = useAuctionContext();
  const [transactionSettingsOpen, setTransactionSettingsOpen] = useState(false);

  const {
    swap,
    state,
    setSellValue,
    setTransactionSettings,
  } = useVaultTradeState(pool);

  const [{ allowance, isLoading: allowanceIsLoading }, increaseAllowance] = useTokenContractAllowance(sell, vaultAddress);
  
  const bigSellAmount = useMemo(() => {
    return state.inputValue
      ? DecimalBigNumber.parseUnits(state.inputValue, sell.decimals)
      : DBN_ZERO;
  }, [sell, state.inputValue])

  const { receiveEstimate, estimateWithSlippage } = useMemo(() => {
    if (!state.quote.estimate) {
      return { receiveEstimate: '', estimateWithSlippage: '' };
    }

    const receiveEstimate = DecimalBigNumber.fromBN(state.quote.estimate, buy.decimals);
    const estimateWithSlippage = DecimalBigNumber.fromBN(state.quote.estimateWithSlippage!, buy.decimals);

    return {
      receiveEstimate: receiveEstimate.formatUnits(),
      estimateWithSlippage: estimateWithSlippage.formatUnits(),
    };
  }, [state.quote, buy]);

  const sellBalance = userBalances[sell.address] || DBN_ZERO;
  const buyBalance = userBalances[buy.address] || DBN_ZERO;

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
      <TradeWrapper>
        <TradeHeader>Trade {sell.name}</TradeHeader>
        <Input
          isNumber
          crypto={{ kind: 'value', value: sell.symbol }}
          placeholder="0.00"
          value={state.inputValue}
          hint={`Balance: ${formatNumber(sellBalance.formatUnits())}`}
          onHintClick={() => {
            setSellValue(sellBalance.formatUnits());
          }}
          handleChange={(value) => {
            const stringValue = value.toString();
            if (
              !stringValue.startsWith('.') && 
              Number(stringValue) === 0
            ) {
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
          disabled={state.quote.loading}
        />
        <Input
          isNumber
          placeholder="0.00"
          crypto={{ kind: 'value', value: buy.symbol }}
          value={receiveEstimate}
          hint={`Balance: ${formatNumber(buyBalance.formatUnits())}`}
          disabled
        />
        <SwapControls>
          {state.quote.loading && (
            <LoadWrapper>
              <BaseCircularLoader />
            </LoadWrapper>
          )}
          <ReceivedValues>
            {(!!receiveEstimate && !state.quote.loading) && (
              <>
                Expected Output: {formatNumberFixedDecimals(receiveEstimate, 3)}<br />
                Minimum Amount: {formatNumberFixedDecimals(estimateWithSlippage, 3)}
              </>
            )}
            {state.quote.loading && (
              <>
                Fetching Price...
              </>
            )}
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
            disabled={
              allowanceIsLoading ||
              state.swap.isLoading
            }
            onClick={() => {
              increaseAllowance();
            }}
          >
            {allowanceIsLoading ? <CircularLoader /> : <>Increase Allowance</>}
          </SwapButton>
        )}
        {allowance !== 0 && (
          <SwapButton
            type="button"
            disabled={
              bigSellAmount.isZero() ||
              bigSellAmount.gt(sellBalance) ||
              state.quote.loading ||
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
        {!!state.swap.error && (
          <ErrorMessage>
            {state.swap.error}
          </ErrorMessage>
        )}
      </TradeWrapper>
    </>
  );
};
