import { TradeButton } from '../../../NewUI/Home';
import { Input } from '../../../NewUI/HomeInput';
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
  TlcInfo,
} from '../index';
import { fromAtto, toAtto } from 'utils/bigNumber';
import { useMemo } from 'react';

interface IProps {
  accountPosition: ITlcDataTypes.AccountPositionStructOutput | undefined;
  state: State;
  tlcInfo: TlcInfo | undefined;
  setState: React.Dispatch<React.SetStateAction<State>>;
  withdraw: () => void;
  prices: Prices;
}

export const Withdraw: React.FC<IProps> = ({
  accountPosition,
  state,
  setState,
  tlcInfo,
  withdraw,
  prices,
}) => {
  const getEstimatedCollateral = (): number => {
    return accountPosition
      ? fromAtto(accountPosition.collateral) - Number(state.withdrawValue)
      : Number(state.withdrawValue);
  };

  const getEstimatedLTV = (): string => {
    if (!accountPosition) return '0.00';
    const tpi = prices.tpi;

    const currentDebt = fromAtto(accountPosition.currentDebt);
    const estimatedCollateral = getEstimatedCollateral();

    const ltv = (currentDebt / (estimatedCollateral * tpi)) * 100;
    return ltv.toFixed(2);
  };

  const getEstimatedMaxBorrow = (): number => {
    return getEstimatedCollateral() * prices.tpi * (MAX_LTV / 100);
  };

  const maxWithdrawValue = useMemo((): number => {
    const userMaxWithdraw = accountPosition
      ? fromAtto(accountPosition.collateral) -
        fromAtto(accountPosition.currentDebt) / (MAX_LTV / 100) / prices.tpi
      : 0;

    const userMaxWithdrawBigNumber = toAtto(userMaxWithdraw);

    if (
      tlcInfo &&
      tlcInfo.circuitBreakers.templeCircuitBreakerRemaining.lt(
        userMaxWithdrawBigNumber
      )
    ) {
      return fromAtto(tlcInfo.circuitBreakers.templeCircuitBreakerRemaining);
    }

    return userMaxWithdraw;
  }, [accountPosition, prices.tpi, tlcInfo]);

  return (
    <>
      <RemoveMargin />
      <Title>Withdraw TEMPLE</Title>
      <Input
        crypto={{
          kind: 'value',
          value: 'TEMPLE',
        }}
        handleChange={(value: string) =>
          setState({ ...state, withdrawValue: value })
        }
        isNumber
        value={state.withdrawValue}
        placeholder="0"
        onHintClick={() => {
          setState({
            ...state,
            withdrawValue: maxWithdrawValue.toFixed(2),
          });
        }}
        min={0}
        hint={`Max: ${maxWithdrawValue.toFixed(2)}`}
        width="100%"
      />
      {/* Only display if user has borrows */}
      {accountPosition?.currentDebt.gt(0) && (
        <>
          <Warning>
            <InfoCircle>
              <p>i</p>
            </InfoCircle>
            <p>
              The maximum amount of collateral that can be withdrawn is subject
              to the LTV limit and the Daily Withdrawal Limits across all users.
            </p>
          </Warning>
          <MarginTop />
          <RangeLabel>Estimated DAI LTV: {getEstimatedLTV()}%</RangeLabel>
          <RangeSlider
            onChange={(e) => {
              if (!accountPosition) return;
              let ltvPercent = ((Number(e.target.value) / 100) * MAX_LTV) / 100;
              // Min LTV is the current LTV
              const minLtv =
                fromAtto(accountPosition.currentDebt) /
                (fromAtto(accountPosition.collateral) * prices.tpi);
              if (ltvPercent < minLtv) ltvPercent = minLtv;
              const withdrawAmount = (
                (-1 * fromAtto(accountPosition.currentDebt)) /
                  ltvPercent /
                  prices.tpi +
                fromAtto(accountPosition.collateral)
              ).toFixed(2);
              setState({
                ...state,
                withdrawValue: `${
                  Number(withdrawAmount) > 0 ? withdrawAmount : '0'
                }`,
              });
            }}
            min={0}
            max={100}
            value={(Number(getEstimatedLTV()) / MAX_LTV) * 100}
            progress={(Number(getEstimatedLTV()) / MAX_LTV) * 100}
          />
          <FlexBetween>
            <RangeLabel>0%</RangeLabel>
            <RangeLabel>{MAX_LTV}%</RangeLabel>
          </FlexBetween>
        </>
      )}
      <GradientContainer>
        <Copy style={{ textAlign: 'left' }}>
          You could borrow up to {getEstimatedMaxBorrow().toFixed(2)} DAI with{' '}
          {getEstimatedCollateral().toFixed(2)} total TEMPLE collateral.
        </Copy>
      </GradientContainer>
      <FlexColCenter>
        <TradeButton
          onClick={() => withdraw()}
          // Disable if amount is 0 or greater than max withdraw
          disabled={
            Number(state.withdrawValue) <= 0 ||
            Number(state.withdrawValue) > maxWithdrawValue
          }
        >
          Withdraw
        </TradeButton>
      </FlexColCenter>
    </>
  );
};

export default Withdraw;
