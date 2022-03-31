import React from 'react';
import styled from 'styled-components';
import { Outlet } from 'react-router-dom';
import { Container } from 'components/DApp/NavComponents';
import BgImage from 'assets/images/dapp-bg.svg';

//FIXME: get cleaner way to do this;
const HEADER_HEIGHT = `68px`;

const Trade = () => {
  return (
    <Background>
      <StyledContainer>
        <Outlet />
      </StyledContainer>
    </Background>
  );
};

export default Trade;

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

const StyledContainer = styled(Container)`
  box-sizing: border-box;
  margin: 1px;
  border-radius: 1rem;
  flex-grow: 0;
  min-width: 20rem /*320/16*/;
  flex-basis: 40rem /*640/16*/;
`;
