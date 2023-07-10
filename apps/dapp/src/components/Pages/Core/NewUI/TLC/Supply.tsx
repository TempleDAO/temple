import leftCaret from 'assets/images/newui-images/leftCaret.svg';
import { TradeButton } from '../Home';
import { useState } from 'react';
import { Input } from '../HomeInput';
import { formatToken } from 'utils/formatter';
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

interface IProps {
  accountPosition: ITlcDataTypes.AccountPositionStructOutput | undefined;
  state: State;
  setState: React.Dispatch<React.SetStateAction<State>>;
  supply: () => void;
  back: () => void;
}

export const Supply: React.FC<IProps> = ({ accountPosition, state, setState, supply, back }) => {
  const [progress, setProgress] = useState(0);

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
          <RangeLabel>Estimated DAI LTV</RangeLabel>
          {/* TODO: Change progress to progress / TokenBalance * 100 */}
          <RangeSlider onChange={(e) => setProgress(Number(e.target.value))} value={progress} progress={progress} />
          <FlexBetween>
            <RangeLabel>0%</RangeLabel>
            <RangeLabel>{MAX_LTV}%</RangeLabel>
          </FlexBetween>
          <GradientContainer>
            <Warning>
              <InfoCircle>
                <p>i</p>
              </InfoCircle>
              <p>If your DAI LTV reaches the liquidation threshold, your TEMPLE collateral will be liquidated.</p>
            </Warning>
            <Copy style={{ textAlign: 'left' }}>
              Given the current TPI price of <strong>$1.06</strong>, your TEMPLE collateral will be liquidated on
              <strong>10/02/2024</strong>.
            </Copy>
          </GradientContainer>
        </>
      )}
      <TradeButton onClick={() => supply()}>Supply</TradeButton>
    </>
  );
};

export default Supply;
