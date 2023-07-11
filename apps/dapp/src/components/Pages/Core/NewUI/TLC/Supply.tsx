import leftCaret from 'assets/images/newui-images/leftCaret.svg';
import { TradeButton } from '../Home';
import { Input } from '../HomeInput';
import { formatToken } from 'utils/formatter';
import { ITlcDataTypes } from 'types/typechain/contracts/interfaces/v2/templeLineOfCredit/ITempleLineOfCredit';
import {
  BackButton,
  Copy,
  FlexBetween,
  GradientContainer,
  MAX_LTV,
  MarginTop,
  RangeLabel,
  RangeSlider,
  RemoveMargin,
  State,
  Title,
} from './TLCModal';
import { fromAtto } from 'utils/bigNumber';

interface IProps {
  accountPosition: ITlcDataTypes.AccountPositionStructOutput | undefined;
  state: State;
  setState: React.Dispatch<React.SetStateAction<State>>;
  supply: () => void;
  back: () => void;
}

export const Supply: React.FC<IProps> = ({ accountPosition, state, setState, supply, back }) => {
  const getEstimatedCollateral = (): number => {
    return accountPosition
      ? fromAtto(accountPosition.collateral) + Number(state.supplyValue)
      : Number(state.supplyValue);
  };

  const getEstimatedLTV = (): string => {
    return accountPosition
      ? ((fromAtto(accountPosition.currentDebt) / getEstimatedCollateral()) * 100).toFixed(2)
      : '0.00';
  };

  const getEstimatedMaxBorrow = (): number => {
    return getEstimatedCollateral() * (MAX_LTV / 100);
  };

  return (
    <>
      <RemoveMargin />
      <BackButton src={leftCaret} onClick={() => back()} />
      <Title>Supply TEMPLE</Title>
      {/* TODO: Make width 100% */}
      <Input
        crypto={{
          kind: 'value',
          value: 'TEMPLE',
        }}
        handleChange={(value: string) => setState({ ...state, supplyValue: value })}
        isNumber
        value={state.supplyValue}
        placeholder="0"
        onHintClick={() => {
          setState({ ...state, supplyValue: formatToken(state.inputTokenBalance, state.inputToken) });
        }}
        min={0}
        hint={`Balance: ${formatToken(state.inputTokenBalance, state.inputToken)}`}
      />
      {/* Only display range slider if the user has borrows */}
      {accountPosition?.currentDebt.gt(0) && (
        <>
          <MarginTop />
          <RangeLabel>Estimated DAI LTV: {getEstimatedLTV()}%</RangeLabel>
          <RangeSlider
            onChange={(e) => {
              if (!accountPosition) return;
              let ltvPercent = ((Number(e.target.value) / 100) * MAX_LTV) / 100;
              // Max LTV is the current LTV
              const maxLtv = fromAtto(accountPosition.currentDebt) / fromAtto(accountPosition.collateral);
              if (ltvPercent > maxLtv) ltvPercent = maxLtv;
              const newSupply = (
                fromAtto(accountPosition.currentDebt) / ltvPercent -
                fromAtto(accountPosition.collateral)
              ).toFixed(2);
              setState({ ...state, supplyValue: `${Number(newSupply) > 0 ? newSupply : '0'}` });
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
      <TradeButton onClick={() => supply()}>Supply</TradeButton>
    </>
  );
};

export default Supply;
