import { TradeButton } from '../../../NewUI/Home';
import { Input } from '../../../NewUI/HomeInput';
import { formatToken } from 'utils/formatter';
import { ITlcDataTypes } from 'types/typechain/contracts/interfaces/v2/templeLineOfCredit/ITempleLineOfCredit';
import {
  Copy,
  FlexBetween,
  FlexColCenter,
  InfoCircle,
  MAX_LTV,
  MarginTop,
  RangeLabel,
  RangeSlider,
  RemoveMargin,
  State,
  Title,
  Warning,
} from '../index';
import { ZERO, fromAtto } from 'utils/bigNumber';

interface IProps {
  accountPosition: ITlcDataTypes.AccountPositionStructOutput | undefined;
  state: State;
  setState: React.Dispatch<React.SetStateAction<State>>;
  repay: () => void;
  repayAll: () => void;
}

export const Repay: React.FC<IProps> = ({ accountPosition, state, setState, repay, repayAll }) => {
  const getEstimatedLTV = (): string => {
    return accountPosition
      ? (
          ((fromAtto(accountPosition.currentDebt) - Number(state.repayValue)) / fromAtto(accountPosition.collateral)) *
          100
        ).toFixed(2)
      : '0.00';
  };

  return (
    <>
      <RemoveMargin />
      <Title>Repay DAI</Title>
      <Input
        crypto={{
          kind: 'value',
          value: 'DAI',
        }}
        handleChange={(value: string) => setState({ ...state, repayValue: value })}
        isNumber
        value={state.repayValue}
        placeholder="0"
        onHintClick={() => {
          setState({
            ...state,
            repayValue: accountPosition ? formatToken(accountPosition.currentDebt, state.outputToken) : '0',
          });
        }}
        min={0}
        // Max is total debt
        hint={`Max: ${formatToken(accountPosition ? accountPosition.currentDebt : ZERO, state.outputToken)}`}
        width="100%"
      />
      {fromAtto(state.outputTokenBalance) < Number(state.repayValue) && (
        <Warning>
          <InfoCircle>
            <p>i</p>
          </InfoCircle>
          <p>Amount exceeds your wallet balance of {formatToken(state.outputTokenBalance, state.outputToken)} DAI</p>
        </Warning>
      )}
      <MarginTop />
      <RangeLabel>Estimated DAI LTV: {getEstimatedLTV()}%</RangeLabel>
      <RangeSlider
        onChange={(e) => {
          if (!accountPosition) return;
          let ltvPercent = ((Number(e.target.value) / 100) * MAX_LTV) / 100;
          // Max LTV is the current LTV
          const maxLtv = fromAtto(accountPosition.currentDebt) / fromAtto(accountPosition.collateral);
          if (ltvPercent > maxLtv) ltvPercent = maxLtv;
          const repayAmount = (
            -1 * (ltvPercent * fromAtto(accountPosition.collateral)) +
            fromAtto(accountPosition.currentDebt)
          ).toFixed(2);
          console.log(repayAmount);
          setState({ ...state, repayValue: `${Number(repayAmount) > 0 ? repayAmount : '0'}` });
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
      <FlexColCenter>
        <TradeButton
          onClick={() => repay()}
          // Disable if repay amount is lte zero, gt wallet balance, or gt current debt
          disabled={
            Number(state.repayValue) <= 0 ||
            fromAtto(state.outputTokenBalance) < Number(state.repayValue) ||
            (accountPosition && Number(state.repayValue) >= fromAtto(accountPosition.currentDebt))
          }
          style={{ width: 'auto' }}
        >
          Repay {state.repayValue} DAI
        </TradeButton>
        <Copy>- or -</Copy>
        <TradeButton
          onClick={() => repayAll()}
          // Disable if the amount is greater than the wallet balance
          disabled={accountPosition && fromAtto(accountPosition.currentDebt) > fromAtto(state.outputTokenBalance)}
          style={{ width: 'auto', marginTop: '0' }}
        >
          Repay Total
        </TradeButton>
      </FlexColCenter>
    </>
  );
};

export default Repay;
