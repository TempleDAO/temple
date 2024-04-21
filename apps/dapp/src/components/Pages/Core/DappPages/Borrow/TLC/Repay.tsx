import { TradeButton } from '../../../NewUI/Home';
import { Input } from '../../../NewUI/HomeInput';
import { formatToken } from 'utils/formatter';
import { ITlcDataTypes } from 'types/typechain/contracts/interfaces/v2/templeLineOfCredit/ITempleLineOfCredit';
import {
  FlexBetween,
  FlexColCenter,
  InfoCircle,
  MarginTop,
  RangeLabel,
  RangeSlider,
  RemoveMargin,
  State,
  Title,
  Warning,
  Prices,
} from '../index';
import { ZERO, fromAtto } from 'utils/bigNumber';
import { useMemo } from 'react';

interface IProps {
  accountPosition: ITlcDataTypes.AccountPositionStructOutput | undefined;
  state: State;
  setState: React.Dispatch<React.SetStateAction<State>>;
  repay: () => void;
  repayAll: () => void;
  prices: Prices;
}

export const Repay: React.FC<IProps> = ({
  accountPosition,
  state,
  setState,
  repay,
  repayAll,
  prices,
}) => {
  // used for the range slider label
  const maxPossibleLTV = useMemo(() => {
    if (!accountPosition) return 0;

    const newDebt = fromAtto(accountPosition.currentDebt);
    const adjustedNewDebt = Math.max(newDebt, 0);
    const estimatedLTV = (
      (adjustedNewDebt / (fromAtto(accountPosition.collateral) * prices.tpi)) *
      100
    ).toFixed(2);

    return Number(estimatedLTV);
  }, [prices.tpi, accountPosition]);

  // used for the estimated LTV label
  const getEstimatedLTV = (): string => {
    if (!accountPosition) return '0.00';

    // Calculate the new debt after repayment.
    const newDebt =
      fromAtto(accountPosition.currentDebt) - Number(state.repayValue);

    // Ensure newDebt does not become negative, which could happen with incorrect repayValue.
    const adjustedNewDebt = Math.max(newDebt, 0);

    // Calculate the estimated LTV after repayment.
    const estimatedLTV = (
      (adjustedNewDebt / (fromAtto(accountPosition.collateral) * prices.tpi)) *
      100
    ).toFixed(2);

    return estimatedLTV;
  };

  const shouldShowRepayAll = useMemo(() => {
    return (
      parseFloat(state.repayValue) ===
      parseFloat(
        formatToken(
          accountPosition ? accountPosition.currentDebt : ZERO,
          state.outputToken
        )
      )
    );
  }, [accountPosition, state.outputToken, state.repayValue]);

  return (
    <>
      <RemoveMargin />
      <Title>Repay DAI</Title>
      <Input
        crypto={{
          kind: 'value',
          value: 'DAI',
        }}
        handleChange={(value: string) =>
          setState({ ...state, repayValue: value })
        }
        isNumber
        value={state.repayValue}
        placeholder="0"
        onHintClick={() => {
          setState({
            ...state,
            repayValue: accountPosition
              ? formatToken(accountPosition.currentDebt, state.outputToken)
              : '0',
          });
        }}
        min={0}
        // Max is total debt
        hint={`Max: ${formatToken(
          accountPosition ? accountPosition.currentDebt : ZERO,
          state.outputToken
        )}`}
        width="100%"
      />
      {fromAtto(state.outputTokenBalance) < Number(state.repayValue) && (
        <Warning>
          <InfoCircle>
            <p>i</p>
          </InfoCircle>
          <p>
            Amount exceeds your wallet balance of{' '}
            {formatToken(state.outputTokenBalance, state.outputToken)} DAI
          </p>
        </Warning>
      )}
      <MarginTop />
      <RangeLabel>Estimated DAI LTV: {getEstimatedLTV()}%</RangeLabel>
      <RangeSlider
        onChange={(e) => {
          if (!accountPosition) return;

          const sliderValue = Number(e.target.value); // This is between 0 and 100
          const maxRepayable = fromAtto(accountPosition.currentDebt); // Maximum that can be repaid
          const repayAmount = (sliderValue / 100) * maxRepayable; // Direct mapping of slider to repay amount

          setState({ ...state, repayValue: repayAmount.toFixed(2) });
        }}
        min={0}
        max={100}
        value={
          (Number(state.repayValue) /
            fromAtto(accountPosition ? accountPosition.currentDebt : ZERO)) *
          100
        }
        progress={
          (Number(state.repayValue) /
            fromAtto(accountPosition ? accountPosition.currentDebt : ZERO)) *
          100
        }
      />
      <FlexBetween>
        <RangeLabel>{maxPossibleLTV}%</RangeLabel>
        <RangeLabel>0%</RangeLabel>
      </FlexBetween>
      <FlexColCenter>
        <TradeButton
          onClick={() => {
            if (shouldShowRepayAll) {
              return repayAll();
            } else {
              return repay();
            }
          }}
          // Disable if repay amount is lte zero, or gt wallet balance
          disabled={
            Number(state.repayValue) <= 0 ||
            fromAtto(state.outputTokenBalance) < Number(state.repayValue)
          }
          style={{ width: 'auto' }}
        >
          {shouldShowRepayAll ? 'Repay All' : `Repay ${state.repayValue} DAI`}
        </TradeButton>
      </FlexColCenter>
    </>
  );
};

export default Repay;
