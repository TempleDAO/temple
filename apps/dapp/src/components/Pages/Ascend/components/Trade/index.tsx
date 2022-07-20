import { useState } from 'react';
import { BigNumber } from 'ethers';

import { formatNumber, formatNumberFixedDecimals } from 'utils/formatter';
import { Pool } from 'components/Layouts/Ascend/types';
import { Input } from 'components/Input/Input';
import { ZERO } from 'utils/bigNumber';
import { getBigNumberFromString, formatBigNumber } from 'components/Vault/utils';
import { TransactionSettingsModal } from 'components/TransactionSettingsModal/TransactionSettingsModal';
import { useTokenContractAllowance } from 'hooks/core/use-token-contract-allowance';
import { CircularLoader as BaseCircularLoader } from 'components/Loader/CircularLoader';
import Loader from 'components/Loader/Loader';

import { useVaultTradeState } from './hooks';

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
  const [transactionSettingsOpen, setTransactionSettingsOpen] = useState(false);
  const {
    swap,
    state,
    togglePair,
    setSellValue,
    vaultAddress,
    setTransactionSettings,
  } = useVaultTradeState(pool);
  const [{ allowance, isLoading: allowanceIsLoading }, increaseAllowance] = useTokenContractAllowance(state.sell, vaultAddress);
  const bigSellAmount = getBigNumberFromString(state.sell.value);

  let receiveEstimate = '';
  if (state.quote.estimate) {
    receiveEstimate = formatBigNumber(state.quote.estimate);
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
      <TradeWrapper>
        <TradeHeader>Trade TEMPLE</TradeHeader>
        <Input
          isNumber
          crypto={{ kind: 'value', value: state.sell.symbol }}
          placeholder="0.00"
          value={state.sell.value}
          hint={`Balance: ${formatNumber(formatBigNumber(state.sell.balance as BigNumber))}`}
          onHintClick={() => {
            setSellValue(formatBigNumber(state.sell.balance as BigNumber));
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
          onClick={() => togglePair()}
          aria-label="Toggle Inputs"
          disabled={state.quote.loading}
        />
        <Input
          isNumber
          placeholder="0.00"
          crypto={{ kind: 'value', value: state.buy.symbol }}
          value={receiveEstimate}
          hint={`Balance: ${formatNumber(formatBigNumber(state.buy.balance as BigNumber))}`}
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
                Minimum Amount: {formatNumberFixedDecimals(formatBigNumber(state.quote.estimateWithSlippage!), 3)}
              </>
            )}
            {state.quote.loading && (
              <>
                Fetching Price...
              </>
            )}
          </ReceivedValues>
          <SlippageButton type="button" onClick={() => setTransactionSettingsOpen(true)}>
            {state.transactionSettings.slippageTolerance}%
          </SlippageButton>
        </SwapControls>
        {allowance === 0 && (
          <SwapButton
            type="button"
            disabled={
              allowanceIsLoading
            }
            onClick={() => {
              increaseAllowance();
            }}
          >
            {allowanceIsLoading ? <Loader /> : <>Increase Allowance</>}
          </SwapButton>
        )}
        {allowance !== 0 && (
          <SwapButton
            type="button"
            disabled={
              bigSellAmount.eq(ZERO) ||
              bigSellAmount.gt(state.sell.balance) ||
              state.quote.loading ||
              !state.quote.estimate ||
              state.swap.isLoading
            }
            onClick={() => {
              swap();
            }}
          >
            Swap
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
