import leftCaret from 'assets/images/newui-images/leftCaret.svg';
import { TradeButton } from '../Home';
import { Input } from '../HomeInput';
import checkmark from 'assets/images/newui-images/check.svg';
import { formatToken } from 'utils/formatter';
import { ITlcDataTypes } from 'types/typechain/contracts/interfaces/v2/templeLineOfCredit/ITempleLineOfCredit';
import {
  BackButton,
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
import { BigNumber } from 'ethers';
import styled from 'styled-components';
import { useState } from 'react';

interface IProps {
  accountPosition: ITlcDataTypes.AccountPositionStructOutput | undefined;
  state: State;
  minBorrow: BigNumber | undefined;
  borrowRate: BigNumber | undefined;
  setState: React.Dispatch<React.SetStateAction<State>>;
  borrow: () => void;
  back: () => void;
}

export const Borrow: React.FC<IProps> = ({ accountPosition, state, minBorrow, borrowRate, setState, borrow, back }) => {
  const [checkbox, setCheckbox] = useState(false);

  const getEstimatedLTV = (): string => {
    return accountPosition
      ? (
          ((fromAtto(accountPosition.currentDebt) + Number(state.borrowValue)) /
            fromAtto(accountPosition?.collateral)) *
          100
        ).toFixed(2)
      : '0.00';
  };

  return (
    <>
      <RemoveMargin />
      <BackButton src={leftCaret} onClick={() => back()} />
      <Title>Borrow DAI</Title>
      <Input
        crypto={{
          kind: 'value',
          value: 'DAI',
        }}
        handleChange={(value: string) => setState({ ...state, borrowValue: value })}
        isNumber
        value={state.borrowValue}
        placeholder="1000"
        onHintClick={() => {
          setState({
            ...state,
            borrowValue: accountPosition
              ? (
                  fromAtto(accountPosition.collateral) * (MAX_LTV / 100) -
                  fromAtto(accountPosition.currentDebt)
                ).toFixed(2)
              : '0',
          });
        }}
        min={1000}
        hint={`Max: ${
          accountPosition
            ? (fromAtto(accountPosition.collateral) * (MAX_LTV / 100) - fromAtto(accountPosition.currentDebt)).toFixed(
                2
              )
            : 0
        }`}
      />
      {minBorrow && fromAtto(minBorrow) > Number(state.borrowValue) && (
        <Warning>
          <InfoCircle>
            <p>i</p>
          </InfoCircle>
          <p>
            You must borrow at least {formatToken(minBorrow, state.outputToken)} {state.outputToken}
          </p>
        </Warning>
      )}
      <MarginTop />
      <RangeLabel>Estimated DAI LTV: {getEstimatedLTV()}%</RangeLabel>
      <RangeSlider
        onChange={(e) => {
          if (!accountPosition) return;
          let ltvPercent = ((Number(e.target.value) / 100) * MAX_LTV) / 100;
          // Min LTV allowed is the current LTV
          const minLtv = fromAtto(accountPosition.loanToValueRatio);
          if (ltvPercent < minLtv) ltvPercent = minLtv;
          // Compute the DAI value for the input element based on the LTV change
          const daiValue = (
            fromAtto(accountPosition.collateral) * ltvPercent -
            fromAtto(accountPosition.currentDebt)
          ).toFixed(2);
          setState({ ...state, borrowValue: `${Number(daiValue) > 0 ? daiValue : '0'}` });
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
      <GradientContainer>
        <Apy>
          {borrowRate ? (fromAtto(borrowRate) * 100).toFixed(2) : 0}% <span>APR</span>
        </Apy>
        {/* <Rule />
        <Copy style={{ textAlign: 'left' }}>
          Given the current TPI price of <strong>$1.06</strong>, your TEMPLE collateral will be liquidated on
          <strong>10/02/2024</strong>.
        </Copy> */}
      </GradientContainer>
      <RiskAcknowledgement>
        <Checkbox onClick={() => setCheckbox(!checkbox)} isChecked={checkbox} src={checkmark} />
        <div>
          <p>I acknowledge the risks of borrowing including increased risk of liquidation.</p>
          <a href="#">Find out more</a>
        </div>
      </RiskAcknowledgement>
      <TradeButton
        onClick={() => borrow()}
        disabled={
          !checkbox ||
          (accountPosition && fromAtto(accountPosition.maxBorrow) < Number(state.borrowValue)) ||
          (minBorrow && fromAtto(minBorrow) > Number(state.borrowValue))
        }
      >
        Borrow
      </TradeButton>
    </>
  );
};

const Apy = styled.p`
  font-size: 1.75rem;
  color: ${({ theme }) => theme.palette.brandLight};
  margin: 0.75rem 0;
  span {
    font-size: 0.9rem;
  }
`;

const RiskAcknowledgement = styled.div`
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  margin-top: 1rem;
  background: #24272c;
  border-radius: 0.375rem;
  padding: 0.5rem;
  text-align: left;
  font-size: 0.85rem;
  line-height: 1.1rem;
  p {
    font-size: 0.85rem;
    color: ${({ theme }) => theme.palette.brandLight};
    margin: 0;
    margin-bottom: 0.5rem;
  }
  a {
    color: ${({ theme }) => theme.palette.brand};
    text-decoration: underline;
    &:hover {
      text-decoration: none;
    }
  }
`;

const Checkbox = styled.div<{ src: string; isChecked: boolean }>`
  display: block;
  padding: 0.88rem;
  margin: 0.25rem;
  border-radius: 50%;
  border: 2px solid ${({ theme }) => theme.palette.brand};
  cursor: pointer;
  background: ${({ src, isChecked }) => (isChecked ? `url('${src}')` : 'transparent')};
  background-repeat: no-repeat;
  background-position: center;
  background-size: 1.1rem;
`;

export default Borrow;
