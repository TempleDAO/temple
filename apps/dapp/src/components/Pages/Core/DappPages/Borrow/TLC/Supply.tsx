import leftCaret from 'assets/images/newui-images/leftCaret.svg';
import { TradeButton } from '../../../NewUI/Home';
import { Input } from '../../../NewUI/HomeInput';
import { formatToken } from 'utils/formatter';
import { ITlcDataTypes } from 'types/typechain/contracts/interfaces/v2/templeLineOfCredit/ITempleLineOfCredit';
import {
  BackButton,
  Copy,
  FlexBetween,
  FlexCol,
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
import { BigNumber } from 'ethers';

interface IProps {
  accountPosition: ITlcDataTypes.AccountPositionStructOutput | undefined;
  state: State;
  minBorrow: number | undefined;
  setState: React.Dispatch<React.SetStateAction<State>>;
  supply: () => void;
  back: () => void;
}

export const Supply: React.FC<IProps> = ({ accountPosition, state, minBorrow, setState, supply, back }) => {
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

  const minSupply = minBorrow ? (1 / (MAX_LTV / 100)) * minBorrow : 0;
  const unusedSupply = accountPosition
    ? fromAtto(accountPosition.collateral) - fromAtto(accountPosition.currentDebt)
    : 0;
  const estimatedUnusedSupply = Number(state.supplyValue) + unusedSupply;

  return (
    <>
      <RemoveMargin />
      <Title>Supply TEMPLE</Title>
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
        width="100%"
      />
      {estimatedUnusedSupply < minSupply && (
        <Warning>
          <InfoCircle>
            <p>i</p>
          </InfoCircle>
          <p>
            You should supply at least {(minSupply - unusedSupply).toFixed(2)} TEMPLE in order to meet the minimum
            borrow requirement.
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
          You could borrow up to {getEstimatedMaxBorrow().toFixed(2)} DAI with {getEstimatedCollateral().toFixed(2)}{' '}
          total TEMPLE collateral.
        </Copy>
      </GradientContainer>
      <FlexCol>
        <TradeButton
          onClick={() => supply()}
          disabled={Number(state.supplyValue) <= 0 || Number(state.supplyValue) > fromAtto(state.inputTokenBalance)}
        >
          Supply
        </TradeButton>
      </FlexCol>
    </>
  );
};

export default Supply;
