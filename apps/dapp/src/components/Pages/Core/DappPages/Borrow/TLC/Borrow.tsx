import { TradeButton } from '../../../NewUI/Home';
import { Input } from '../../../NewUI/HomeInput';
import checkmark from 'assets/images/newui-images/check.svg';
import { ITlcDataTypes } from 'types/typechain/contracts/interfaces/v2/templeLineOfCredit/ITempleLineOfCredit';
import {
  Copy,
  FlexBetween,
  FlexColCenter,
  GradientContainer,
  InfoCircle,
  MAX_LTV,
  MarginTop,
  Prices,
  RangeLabel,
  RangeSlider,
  RemoveMargin,
  Rule,
  State,
  Title,
  TlcInfo,
  Warning,
} from '../index';
import { fromAtto, toAtto } from 'utils/bigNumber';
import styled from 'styled-components';
import { ReactNode, useEffect, useMemo, useState } from 'react';

interface IProps {
  accountPosition: ITlcDataTypes.AccountPositionStructOutput | undefined;
  state: State;
  tlcInfo: TlcInfo | undefined;
  prices: Prices;
  liquidationInfo: (debt?: number) => ReactNode;
  setState: React.Dispatch<React.SetStateAction<State>>;
  borrow: () => void;
}

export const Borrow: React.FC<IProps> = ({
  accountPosition,
  state,
  tlcInfo,
  liquidationInfo,
  setState,
  borrow,
  prices,
}) => {
  const [checkbox, setCheckbox] = useState(false);

  const getEstimatedLTV = (): string => {
    const tpi = prices.tpi;
    return accountPosition
      ? (
          ((fromAtto(accountPosition.currentDebt) + Number(state.borrowValue)) /
            (fromAtto(accountPosition?.collateral) * tpi)) *
          100
        ).toFixed(2)
      : '0.00';
  };

  const maxBorrowValueWithCircuitBreaker = useMemo((): {
    value: number;
    isCircuitBreakerActive: boolean;
  } => {
    const userMaxBorrow = accountPosition
      ? fromAtto(accountPosition.collateral) * prices.tpi * (MAX_LTV / 100) -
        fromAtto(accountPosition.currentDebt)
      : 0;

    const userMaxBorrowBigNumber = toAtto(userMaxBorrow);

    if (!tlcInfo) {
      return { value: userMaxBorrow, isCircuitBreakerActive: false };
    }

    if (tlcInfo.daiCircuitBreakerRemaining.lt(userMaxBorrowBigNumber)) {
      return {
        value: fromAtto(tlcInfo.daiCircuitBreakerRemaining),
        isCircuitBreakerActive: true,
      };
    }

    return { value: userMaxBorrow, isCircuitBreakerActive: false };
  }, [tlcInfo, accountPosition, prices.tpi]);

  return (
    <>
      <RemoveMargin />
      <Title>Borrow DAI</Title>
      <Input
        crypto={{
          kind: 'value',
          value: 'DAI',
        }}
        handleChange={(value: string) =>
          setState({ ...state, borrowValue: value })
        }
        isNumber
        value={state.borrowValue}
        placeholder="1000"
        onHintClick={() => {
          setState({
            ...state,
            borrowValue: maxBorrowValueWithCircuitBreaker.value.toFixed(2),
          });
        }}
        min={1000}
        hint={`Max: ${maxBorrowValueWithCircuitBreaker.value.toFixed(2)}`}
        width="100%"
      />

      {tlcInfo && tlcInfo.minBorrow > Number(state.borrowValue) && (
        <Warning>
          <InfoCircle>
            <p>i</p>
          </InfoCircle>
          <p>
            You must borrow at least {tlcInfo.minBorrow} {state.outputToken}
          </p>
        </Warning>
      )}
      {tlcInfo && tlcInfo.minBorrow < Number(state.borrowValue) && (
        <Warning>
          <InfoCircle>
            <p>i</p>
          </InfoCircle>
          <p>
            The maximum borrow amount is subject to the supplied collateral and
            the Daily Borrow Limit for across all users.
          </p>
        </Warning>
      )}
      {tlcInfo && tlcInfo.strategyBalance < Number(state.borrowValue) && (
        <Warning>
          <InfoCircle>
            <p>i</p>
          </InfoCircle>
          <p>
            Amount exceeds available DAI.
            <br />
            Current max borrow:{' '}
            {tlcInfo.strategyBalance
              ? Number(tlcInfo.strategyBalance).toFixed(4)
              : 0}{' '}
            DAI
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
            fromAtto(accountPosition.collateral) * prices.tpi * ltvPercent -
            fromAtto(accountPosition.currentDebt)
          ).toFixed(2);
          setState({
            ...state,
            borrowValue: `${Number(daiValue) > 0 ? daiValue : '0'}`,
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
      <GradientContainer>
        <Apy>
          {tlcInfo ? (tlcInfo.borrowRate * 100).toFixed(2) : 0}%{' '}
          <span>interest rate</span>
        </Apy>
        <Rule />
        <Copy>{liquidationInfo(Number(state.borrowValue))}</Copy>
      </GradientContainer>
      <RiskAcknowledgement>
        <Checkbox
          onClick={() => setCheckbox(!checkbox)}
          isChecked={checkbox}
          src={checkmark}
        />
        <div>
          <p>
            I acknowledge the risks of borrowing including increased risk of
            liquidation.
          </p>
          {/* <a href="#">Find out more</a> */}
        </div>
      </RiskAcknowledgement>
      <FlexColCenter>
        <TradeButton
          onClick={() => borrow()}
          disabled={
            !checkbox ||
            (accountPosition &&
              fromAtto(accountPosition.maxBorrow) <
                Number(state.borrowValue)) ||
            (tlcInfo && tlcInfo.minBorrow > Number(state.borrowValue)) ||
            (tlcInfo && tlcInfo.strategyBalance < Number(state.borrowValue)) ||
            Number(getEstimatedLTV()) > MAX_LTV ||
            (maxBorrowValueWithCircuitBreaker.isCircuitBreakerActive &&
              Number(state.borrowValue) >
                maxBorrowValueWithCircuitBreaker.value)
          }
        >
          Borrow
        </TradeButton>
      </FlexColCenter>
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
  background: ${({ src, isChecked }) =>
    isChecked ? `url('${src}')` : 'transparent'};
  background-repeat: no-repeat;
  background-position: center;
  background-size: 1.1rem;
`;

export default Borrow;
