import styled from 'styled-components';
import { Popover } from 'components/Popover';
import { useSwapController } from 'components/Pages/Core/Trade/use-swap-controller';
import { formatNumberFixedDecimals, formatToken } from 'utils/formatter';
import { SwapReducerState } from 'components/Pages/Core/Trade/types';
import { BigNumber } from 'ethers';
import { TradeButton } from 'components/Pages/Core/NewUI/TradeNew';
import { ZERO } from 'utils/bigNumber';
import { getBigNumberFromString } from 'components/Vault/utils';

interface IProps {
  isOpen: boolean;
  onClose: () => void;
  state: SwapReducerState;
}

export const TransactionPreviewModal: React.FC<IProps> = ({ isOpen, onClose, state }) => {
  const { handleTransaction } = useSwapController();

  // Check if swap should be disabled
  const bigInputValue = getBigNumberFromString(state.inputValue || '0');
  const isButtonDisabled =
    state.isTransactionPending ||
    state.inputTokenBalance.eq(ZERO) ||
    bigInputValue.gt(state.inputTokenBalance) ||
    state.inputValue === '';

  // TODO: Refresh quote every 30 seconds
  // useEffect(() => {
  //   const interval = setInterval(() => refreshQuote(), 30000);
  //   return () => clearInterval(interval);
  // }, [state.inputValue]);

  if (state.quote === null) return null;

  return (
    <Popover isOpen={isOpen} onClose={onClose} closeOnClickOutside={true} showCloseButton header="Preview Swap">
      <p>
        {state.inputValue} {state.inputToken} ($
        {formatNumberFixedDecimals((1 / Number(state.quote.marketSp)) * Number(state.inputValue), 2)})
      </p>
      <p>
        {formatToken(state.quote.returnAmount, state.outputToken, 4)} {state.outputToken}
      </p>
      <p>Swap from {state.inputToken} details</p>
      <p>
        Total to receive before fees: {formatToken(state.quote.returnAmount, state.outputToken, 4)} {state.outputToken}
      </p>
      <p>Gas costs: -0.0 ETH</p>
      <p>
        Swap fees:{' '}
        {formatToken(state.quote.returnAmount.sub(state.quote.returnAmountConsideringFees), state.outputToken, 4)}{' '}
        {state.outputToken}
      </p>
      <p>
        Total expected after fees: {formatToken(state.quote.returnAmountConsideringFees, state.outputToken, 4)}{' '}
        {state.outputToken}
      </p>
      <p>
        The least you'll get at {state.slippageTolerance}% slippage:{' '}
        {formatToken(
          state.quote.returnAmountConsideringFees
            .mul(BigNumber.from((100 - state.slippageTolerance) * 100))
            .div(BigNumber.from(10_000)),
          state.outputToken,
          4
        )}
      </p>
      <TradeButton disabled={isButtonDisabled} label="Swap" onClick={() => handleTransaction()} />
    </Popover>
  );
};
