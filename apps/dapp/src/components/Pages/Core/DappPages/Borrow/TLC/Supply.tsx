import { TradeButton } from '../../../NewUI/Home';
import { Input } from '../../../NewUI/HomeInput';
import { formatToken } from 'utils/formatter';
import { ITlcDataTypes } from 'types/typechain/contracts/interfaces/v2/templeLineOfCredit/ITempleLineOfCredit';
import {
  Copy,
  FlexBetween,
  FlexColCenter,
  GradientContainer,
  InfoCircle,
  MAX_LTV,
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
  minBorrow: number | undefined;
  setState: React.Dispatch<React.SetStateAction<State>>;
  supply: () => void;
  prices: Prices;
}

export const Supply: React.FC<IProps> = ({
  accountPosition,
  state,
  minBorrow,
  setState,
  supply,
  prices,
}) => {
  const estimatedCollateral = useMemo(() => {
    return accountPosition
      ? fromAtto(accountPosition.collateral) + Number(state.supplyValue)
      : Number(state.supplyValue);
  }, [accountPosition, state.supplyValue]);

  const getEstimatedLTV = (): string => {
    if (!accountPosition) return '0.00';
    const tpi = prices.tpi;

    const currentDebt = fromAtto(accountPosition.currentDebt);

    const ltv = (currentDebt / (estimatedCollateral * tpi)) * 100;
    return ltv.toFixed(2);
  };

  const estimatedMaxBorrow = useMemo(() => {
    const tpi = prices.tpi;
    return estimatedCollateral * tpi * (MAX_LTV / 100);
  }, [prices.tpi, estimatedCollateral]);

  const minSupply = minBorrow ? (1 / (MAX_LTV / 100)) * minBorrow : 0;
  const unusedSupply = accountPosition
    ? fromAtto(accountPosition.collateral) -
      fromAtto(accountPosition.currentDebt)
    : 0;
  const estimatedUnusedSupply = Number(state.supplyValue) + unusedSupply;

  const supplyMessage = useMemo(() => {
    const existingDebtInDAI = fromAtto(accountPosition?.currentDebt || ZERO);
    return `You could borrow up to ${(
      estimatedMaxBorrow - existingDebtInDAI
    ).toFixed(2)} additional DAI with ${estimatedCollateral.toFixed(2)}
    total TEMPLE collateral.`;
  }, [accountPosition?.currentDebt, estimatedMaxBorrow, estimatedCollateral]);

  return (
    <>
      <RemoveMargin />
      <Title>Supply TEMPLE</Title>
      <Input
        crypto={{
          kind: 'value',
          value: 'TEMPLE',
        }}
        handleChange={(value: string) =>
          setState({ ...state, supplyValue: value })
        }
        isNumber
        value={state.supplyValue}
        placeholder="0"
        onHintClick={() => {
          setState({
            ...state,
            supplyValue: formatToken(state.inputTokenBalance, state.inputToken),
          });
        }}
        min={0}
        hint={`Balance: ${formatToken(
          state.inputTokenBalance,
          state.inputToken
        )}`}
        width="100%"
      />
      {estimatedUnusedSupply < minSupply && (
        <Warning>
          <InfoCircle>
            <p>i</p>
          </InfoCircle>
          <p>
            You should supply at least {(minSupply - unusedSupply).toFixed(2)}{' '}
            TEMPLE in order to meet the minimum borrow requirement.
          </p>
        </Warning>
      )}
      {/* Only display range slider if the user has borrows */}
      {accountPosition?.currentDebt.gt(0) && (
        <>
          <MarginTop />
          <RangeLabel>Estimated DAI LTV: {getEstimatedLTV()}%</RangeLabel>
          <RangeSlider
            onChange={(e) => {
              if (!accountPosition) return;
              const sliderValue = Number(e.target.value);
              const newSupply =
                (sliderValue / 100) * fromAtto(state.inputTokenBalance);

              setState({ ...state, supplyValue: `${newSupply.toFixed(2)}` });
            }}
            min={0}
            max={100}
            value={
              (Number(state.supplyValue) / fromAtto(state.inputTokenBalance)) *
              100
            }
            progress={
              (Number(state.supplyValue) / fromAtto(state.inputTokenBalance)) *
              100
            }
          />
          <FlexBetween>
            <RangeLabel>0 TEMPLE</RangeLabel>
            <RangeLabel>{fromAtto(state.inputTokenBalance)} TEMPLE</RangeLabel>
          </FlexBetween>
        </>
      )}
      <GradientContainer>
        <Copy style={{ textAlign: 'left' }}>{supplyMessage}</Copy>
      </GradientContainer>
      <FlexColCenter>
        <TradeButton
          onClick={() => supply()}
          disabled={
            Number(state.supplyValue) <= 0 ||
            Number(state.supplyValue) > fromAtto(state.inputTokenBalance)
          }
        >
          Supply
        </TradeButton>
      </FlexColCenter>
    </>
  );
};

export default Supply;
