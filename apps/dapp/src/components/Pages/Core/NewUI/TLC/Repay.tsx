import leftCaret from 'assets/images/newui-images/leftCaret.svg';
import { TradeButton } from '../Home';
import { Input } from '../HomeInput';
import { formatToken } from 'utils/formatter';
import { ITlcDataTypes } from 'types/typechain/contracts/interfaces/v2/templeLineOfCredit/ITempleLineOfCredit';
import {
  BackButton,
  Copy,
  FlexBetween,
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
import { ZERO, fromAtto } from 'utils/bigNumber';
import styled from 'styled-components';

interface IProps {
  accountPosition: ITlcDataTypes.AccountPositionStructOutput | undefined;
  state: State;
  setState: React.Dispatch<React.SetStateAction<State>>;
  repay: () => void;
  repayAll: () => void;
  back: () => void;
}

export const Repay: React.FC<IProps> = ({ accountPosition, state, setState, repay, repayAll, back }) => {
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
      <BackButton src={leftCaret} onClick={() => back()} />
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
        value={(Number(getEstimatedLTV()) / MAX_LTV) * 100}
        progress={(Number(getEstimatedLTV()) / MAX_LTV) * 100}
      />
      <FlexBetween>
        <RangeLabel>0%</RangeLabel>
        <RangeLabel>{MAX_LTV}%</RangeLabel>
      </FlexBetween>
      <FlexCol>
        <TradeButton
          onClick={() => repay()}
          // Disable if the amount is greater than the wallet balance, or if the amount is greater than the current debt
          disabled={
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
      </FlexCol>
    </>
  );
};

const FlexCol = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
`;

export default Repay;
