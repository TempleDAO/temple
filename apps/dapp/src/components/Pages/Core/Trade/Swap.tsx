import React from 'react';
import styled from 'styled-components';
import { Dropdown } from 'components/Dropdown/Dropdown';
import { DividerContainer } from 'components/DividerContainer/DividerContainer';
import { Input } from 'components/Input/Input';
import arrow from 'assets/icons/amm-arrow.svg';

const COLOR_FONT = `#FFDEC9`;

export const Swap = () => {
  return (
    <SwapContainer>
      <DividerContainer>
        <DropdownFrame>
          <Dropdown options={['$FRAX', '$TEMPLE', '$ETH']} value={'$FRAX'} />
          <PriceLabel>BALANCE: 5,000,442</PriceLabel>
        </DropdownFrame>
        <StyledInput isNumber />
      </DividerContainer>
      <Spacer />
      <DividerContainer dark>
        <DropdownFrame>
          <SwapTickerSymbol>FRAX</SwapTickerSymbol>
          <PriceLabel>BALANCE: 5,000,442</PriceLabel>
        </DropdownFrame>
        <StyledInput isNumber disabled value={1000000} />
      </DividerContainer>
      <InvertButton />
    </SwapContainer>
  );
};

const SwapContainer = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  flex-direction: column;
  position: relative;
`;

const PriceLabel = styled.label`
  padding: 0.5rem /* 8/16 */;
  height: 0.9375rem /* 15/16 */;

  color: ${COLOR_FONT};
  font-size: 0.625rem /* 10/16 */;
  font-weight: bold;
  text-align: center;
`;

const DropdownFrame = styled.div`
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
`;

const StyledInput = styled(Input)`
  background-color: transparent;
  border: none;
`;

const SwapTickerSymbol = styled.label`
  display: inline-block;
  height: 2.8125rem /* 45/16 */;
  width: 7.375rem /* 118/16 */;
  padding-top: 0.5rem /* 8/16*/;

  color: ${COLOR_FONT};
  font-size: 1.125rem /* 18/16 */;
  font-weight: bold;
  text-align: center;
`;

const InvertButton = styled.button`
  position: absolute;

  height: 2.5rem /* 40/16 */;
  width: 2.5rem /* 40/16 */;
  top: calc(50% - 1.25rem);
  left: calc(50% - 1.25rem);

  border: none;
  cursor: pointer;

  background: url(${arrow});
  background-repeat: no-repeat;
  background-size: cover;
  border-radius: 100%;
`;

const Spacer = styled.div`
  height: 1rem; /* 16/16 */
`;
