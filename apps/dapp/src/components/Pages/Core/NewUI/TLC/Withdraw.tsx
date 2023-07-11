import leftCaret from 'assets/images/newui-images/leftCaret.svg';
import { TradeButton } from '../Home';
import { Input } from '../HomeInput';
import { ITlcDataTypes } from 'types/typechain/contracts/interfaces/v2/templeLineOfCredit/ITempleLineOfCredit';
import {
  BackButton,
  Copy,
  FlexBetween,
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
} from './TLCModal';
import { fromAtto } from 'utils/bigNumber';

interface IProps {
  accountPosition: ITlcDataTypes.AccountPositionStructOutput | undefined;
  state: State;
  setState: React.Dispatch<React.SetStateAction<State>>;
  withdraw: () => void;
  back: () => void;
}

export const Withdraw: React.FC<IProps> = ({ accountPosition, state, setState, withdraw, back }) => {
  const getEstimatedCollateral = (): number => {
    return accountPosition
      ? fromAtto(accountPosition.collateral) - Number(state.withdrawValue)
      : Number(state.withdrawValue);
  };

  const getEstimatedLTV = (): string => {
    return accountPosition
      ? ((fromAtto(accountPosition.currentDebt) / getEstimatedCollateral()) * 100).toFixed(2)
      : '0.00';
  };

  const getEstimatedMaxBorrow = (): number => {
    return getEstimatedCollateral() * (MAX_LTV / 100);
  };

  const getMaxWithdraw = (): number => {
    return accountPosition
      ? (-1 * fromAtto(accountPosition.currentDebt)) / (MAX_LTV / 100) + fromAtto(accountPosition.collateral)
      : 0;
  };

  return (
    <>
      <RemoveMargin />
      <BackButton src={leftCaret} onClick={() => back()} />
      <Title>Withdraw TEMPLE</Title>
      {/* TODO: Make width 100% */}
      <Input
        crypto={{
          kind: 'value',
          value: 'TEMPLE',
        }}
        handleChange={(value: string) => setState({ ...state, withdrawValue: value })}
        isNumber
        value={state.withdrawValue}
        placeholder="0"
        onHintClick={() => {
          setState({ ...state, withdrawValue: getMaxWithdraw().toFixed(2) });
        }}
        min={0}
        hint={`Max: ${getMaxWithdraw().toFixed(2)}`}
      />
      {/* Only display if user has borrows */}
      {accountPosition?.currentDebt.gt(0) && (
        <>
          <Warning>
            <InfoCircle>
              <p>i</p>
            </InfoCircle>
            <p>MAX represents the amount of supplied TEMPLE that you can withdraw without liquidation.</p>
          </Warning>
          <MarginTop />
          <RangeLabel>Estimated DAI LTV: {getEstimatedLTV()}%</RangeLabel>
          <RangeSlider
            onChange={(e) => {
              if (!accountPosition) return;
              let ltvPercent = ((Number(e.target.value) / 100) * MAX_LTV) / 100;
              // Min LTV is the current LTV
              const minLtv = fromAtto(accountPosition.currentDebt) / fromAtto(accountPosition.collateral);
              if (ltvPercent < minLtv) ltvPercent = minLtv;
              const withdrawAmount = (
                (-1 * fromAtto(accountPosition.currentDebt)) / ltvPercent +
                fromAtto(accountPosition.collateral)
              ).toFixed(2);
              setState({ ...state, withdrawValue: `${Number(withdrawAmount) > 0 ? withdrawAmount : '0'}` });
            }}
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
          You could borrow up to {getEstimatedMaxBorrow().toFixed(2)} DAI with {getEstimatedCollateral().toFixed(2)}{' '}
          total TEMPLE collateral.
        </Copy>
      </GradientContainer>
      <TradeButton onClick={() => withdraw()}>Withdraw</TradeButton>
    </>
  );
};

export default Withdraw;
