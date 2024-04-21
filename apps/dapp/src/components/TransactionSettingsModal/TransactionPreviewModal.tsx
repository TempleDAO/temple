/* eslint-disable react/no-unescaped-entities */
import styled from 'styled-components';
import { Popover } from 'components/Popover';
import { formatNumberFixedDecimals, formatToken } from 'utils/formatter';
import { SwapReducerState } from 'components/Pages/Core/Trade/types';
import { BigNumber, ethers } from 'ethers';
import { ZERO } from 'utils/bigNumber';
import { getBigNumberFromString, getTokenInfo } from 'components/Vault/utils';
import { Button } from 'components/Button/Button';
import { transparentize } from 'polished';

interface IProps {
  isOpen: boolean;
  onClose: () => void;
  state: SwapReducerState;
  handleTransaction: () => Promise<boolean>;
}

export const TransactionPreviewModal: React.FC<IProps> = ({
  isOpen,
  onClose,
  state,
  handleTransaction,
}) => {
  // Check if swap should be disabled
  const bigInputValue = getBigNumberFromString(
    state.inputValue || '0',
    getTokenInfo(state.inputToken).decimals
  );
  const isButtonDisabled =
    state.isTransactionPending ||
    state.inputTokenBalance.eq(ZERO) ||
    bigInputValue.gt(state.inputTokenBalance);

  // TODO: Display error message if input value is greater than input token balance

  // TODO: Refresh quote every 30 seconds
  // useEffect(() => {
  //   const interval = setInterval(() => refreshQuote(), 30000);
  //   return () => clearInterval(interval);
  // }, [state.inputValue]);

  if (state.quote === null) return null;

  return (
    <Popover
      isOpen={isOpen}
      onClose={onClose}
      closeOnClickOutside={true}
      showCloseButton
      header="Preview Swap"
    >
      <PriceContainer>
        <div>
          <span>
            <b>{formatNumberFixedDecimals(state.inputValue)}</b>
          </span>
          <Subtext>Sending {state.inputToken}</Subtext>
        </div>
        <div>
          <span>
            <b>{formatToken(state.quote.returnAmount, state.outputToken)}</b>
          </span>
          <Subtext>Receiving {state.outputToken}</Subtext>
        </div>
      </PriceContainer>
      <PriceMarker>
        1 {state.inputToken} ={' '}
        {(
          Number(
            ethers.utils.formatUnits(
              state.quote.returnAmount,
              getTokenInfo(state.outputToken).decimals
            )
          ) / Number(state.inputValue)
        ).toFixed(4)}{' '}
        {state.outputToken}
      </PriceMarker>
      <SwapDetails>
        <SwapDetailsHeader>Swap Details</SwapDetailsHeader>
        <AmountAfterFees>
          <span>Total expected after fees:</span>
          <NoWrapSpan>
            {formatToken(state.quote.returnAmount, state.outputToken, 4)}{' '}
            {state.outputToken}
          </NoWrapSpan>
        </AmountAfterFees>
        <div>
          <span>
            The least you'll get at {state.slippageTolerance}% slippage:
          </span>
          <NoWrapSpan>
            {formatToken(
              state.quote.returnAmount
                .mul(BigNumber.from(10_000))
                .div(BigNumber.from((100 + state.slippageTolerance) * 100)),
              state.outputToken,
              4
            )}{' '}
            {state.outputToken}
          </NoWrapSpan>
        </div>
      </SwapDetails>
      <TradeButton
        disabled={isButtonDisabled}
        label="Confirm Swap"
        onClick={async () => {
          const success = await handleTransaction();
          if (success) onClose();
        }}
      />
    </Popover>
  );
};

const PriceContainer = styled.div`
  display: flex;
  flex-direction: row;
  text-align: left;
  color: ${({ theme }) => theme.palette.brandLight};
  font-size: 1.25rem;
  justify-content: center;
  gap: 2rem;
  max-width: 400px;
  margin: auto;
  text-align: center;
`;
const Subtext = styled.div`
  font-size: 0.85rem;
  color: ${({ theme }) => theme.palette.brand};
  font-weight: normal;
  padding-bottom: 0.25rem;
`;
const PriceMarker = styled.div`
  padding: 1rem;
`;
const SwapDetails = styled.div`
  padding: 1rem;
  border: 1px solid ${({ theme }) => theme.palette.brand};
  border-radius: 0.5rem;
  box-shadow: 0 0 0.3rem 0.3rem rgba(0, 0, 0, 0.2);
  text-align: left;

  div {
    font-size: 0.9rem;
    display: flex;
    justify-content: space-between;
    gap: 2rem;
  }
`;
const SwapDetailsHeader = styled.h5`
  font-size: 1rem;
  margin: 0;
  font-family: 'Megant';
  color: ${({ theme }) => transparentize(0.1, theme.palette.brandLight)};
  font-weight: bold;
  text-align: left;
  border-bottom: 1px solid ${({ theme }) => theme.palette.brand};
  padding-bottom: 0.5rem;
`;
const AmountAfterFees = styled.div`
  color: ${({ theme }) => theme.palette.brandLight};
  padding: 1rem 0 0.5rem 0;
`;
const NoWrapSpan = styled.span`
  white-space: nowrap;
`;
const TradeButton = styled(Button)`
  padding: 10px;
  gap: 20px;
  height: 52px;
  background: ${({ theme }) => theme.palette.gradients.dark};
  border: 1px solid ${({ theme }) => theme.palette.brandDark};
  box-shadow: 0px 0px 20px rgba(222, 92, 6, 0.4);
  border-radius: 10px;
  font-weight: 700;
  font-size: 16px;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: ${({ theme }) => theme.palette.brandLight};
  width: 100%;
  margin-top: 1rem;
`;
