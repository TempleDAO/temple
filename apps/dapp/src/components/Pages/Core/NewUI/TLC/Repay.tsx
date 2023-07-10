import leftCaret from 'assets/images/newui-images/leftCaret.svg';
import { TradeButton } from '../Home';
import { useState } from 'react';
import { Input } from '../HomeInput';
import { formatToken } from 'utils/formatter';
import { ITlcDataTypes } from 'types/typechain/contracts/interfaces/v2/templeLineOfCredit/ITempleLineOfCredit';
import {
  BackButton,
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

interface IProps {
  accountPosition: ITlcDataTypes.AccountPositionStructOutput | undefined;
  state: State;
  setState: React.Dispatch<React.SetStateAction<State>>;
  repay: () => void;
  back: () => void;
}

export const Repay: React.FC<IProps> = ({ accountPosition, state, setState, repay, back }) => {
  const [progress, setProgress] = useState(0);

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
          <p>
            Exceeds your balance of {formatToken(state.outputTokenBalance, state.outputToken)} {state.outputToken}
          </p>
        </Warning>
      )}
      <MarginTop />
      <RangeLabel>Estimated DAI LTV</RangeLabel>
      <RangeSlider onChange={(e) => setProgress(Number(e.target.value))} value={progress} progress={progress} />
      <FlexBetween>
        <RangeLabel>0%</RangeLabel>
        <RangeLabel>{MAX_LTV}%</RangeLabel>
      </FlexBetween>
      <TradeButton onClick={() => repay()} disabled={fromAtto(state.outputTokenBalance) < Number(state.repayValue)}>
        Repay
      </TradeButton>
      {/* <TradeButton onClick={() => repay()}>Repay All</TradeButton> */}
    </>
  );
};

export default Repay;
