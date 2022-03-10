import React from 'react';
import styled from 'styled-components';
import { Dropdown } from 'components/Dropdown/Dropdown';
import { DividerContainer } from 'components/DividerContainer/DividerContainer';
import BgImage from 'assets/images/dapp-bg.svg';

//FIXME: get cleaner way to do this;
const HEADER_HEIGHT = `68px`;
const COLOR_FONT = `#FFDEC9`;

export const Trade = () => {
  return (
    <Background>
      <Modal>
        <DividerContainer>
          <DropdownContainer>
            <Dropdown options={['FRAX', 'TEMPLE', 'FXS']} value={'FRAX'} />
            <PriceLabel>BALANCE: 5,000,442</PriceLabel>
          </DropdownContainer>
          hey
        </DividerContainer>
      </Modal>
    </Background>
  );
};

const Background = styled.div`
  display: flex;
  height: calc(100vh - ${HEADER_HEIGHT});
  justify-content: center;
  align-items: center;

  background-image: url(${BgImage});
  background-size: cover;
  background-repeat: no-repeat;
  background-position: center bottom;
`;

const Modal = styled.div`
  display: flex;
  justify-content: center;
  align-items: center;
  height: 50vh;
  width: 50vw;

  background: black;
`;

const PriceLabel = styled.label`
  padding: 0.5rem /* 8/16 */;
  height: 0.9375rem /* 15/16 */;

  color: ${COLOR_FONT};
  font-size: 0.625rem /* 10/16 */;
  font-weight: bold;
  text-align: center;
`;

const DropdownContainer = styled.div`
  display: flex;
  flex-direction: column;
`;
