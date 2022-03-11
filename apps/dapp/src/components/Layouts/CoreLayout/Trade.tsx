import React from 'react';
import styled from 'styled-components';
import { Outlet } from 'react-router-dom';
import { Nav } from 'components/DApp/Nav';
import { Container } from 'components/DApp/NavComponents';
import BgImage from 'assets/images/dapp-bg.svg';

//FIXME: get cleaner way to do this;
const HEADER_HEIGHT = `68px`;

const Trade = () => {
  return (
    <Background>
      <Modal>
        <Container>
          <Nav />
          <Outlet />
        </Container>
      </Modal>
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

const Modal = styled.div`
  display: flex;
  justify-content: center;
  align-items: center;
  height: 50vh;
  width: 50vw;

  background: black;
`;
