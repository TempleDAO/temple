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
  withdraw: () => void;
  back: () => void;
}

export const Withdraw: React.FC<IProps> = ({ accountPosition, state, setState, withdraw, back }) => {
  const [progress, setProgress] = useState(0);

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
          setState({ ...state, withdrawValue: formatToken(accountPosition?.collateral, state.inputToken) });
        }}
        min={0}
        hint={`Supplies: ${formatToken(accountPosition?.collateral, state.inputToken)}`}
      />
      {/* Only display if user has borrows */}
      {accountPosition?.currentDebt.gt(0) && (
        <>
          <Warning>
            <InfoCircle>
              <p>i</p>
            </InfoCircle>
            <p>
              Since you have borrow positions, the max amount represents the amount of supplied TEMPLE that you can
              withdraw without liquidation.
            </p>
          </Warning>
          <MarginTop />
          <RangeLabel>Estimated DAI LTV</RangeLabel>
          {/* TODO: Change progress to progress / TokenBalance * 100 */}
          <RangeSlider onChange={(e) => setProgress(Number(e.target.value))} value={progress} progress={progress} />
          <FlexBetween>
            <RangeLabel>0%</RangeLabel>
            <RangeLabel>{MAX_LTV}%</RangeLabel>
          </FlexBetween>
          <GradientContainer>
            <Copy style={{ textAlign: 'left' }}>
              Given the current TPI price of <strong>$1.06</strong>, your TEMPLE collateral will be liquidated on
              <strong>10/02/2024</strong>.
            </Copy>
          </GradientContainer>
        </>
      )}
      <TradeButton onClick={() => withdraw()}>Withdraw</TradeButton>
    </>
  );
};

export default Withdraw;
