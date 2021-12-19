import React from 'react';
import styled from 'styled-components';
import Foyer from 'components/Pages/Foyer';
import gatesImage from 'assets/images/EnterTheGates.png';
import { CustomRoutingPage } from 'hooks/use-custom-spa-routing';
import withWallet from 'hoc/withWallet';

const TempleGatesPage: CustomRoutingPage = ({ routingHelper }) => {
  const { changePageTo } = routingHelper;

  return (
    <TempleGatesContainer>
      <KeyForm onSubmit={(e) => e.preventDefault()}>
        <EnterButton onClick={() => changePageTo(Foyer)}>ENTER</EnterButton>
      </KeyForm>
    </TempleGatesContainer>
  );
};

const TempleGatesContainer = styled.div`
  background-image: url(${gatesImage});
  background-size: cover;
  background-position: center;
  height: 100vh;
  width: 100vw;
`;

const KeyForm = styled.form`
  position: absolute;
  bottom: 2rem;
  right: 2rem;
  display: flex;
`;

const EnterButton = styled.button`
  ${(props) => props.theme.typography.h2};
  background: transparent;
  border: none;
  border-radius: 2px;
  color: ${(props) => props.theme.palette.brand};
  cursor: pointer;
  font-size: 2rem;
  padding: 0rem 1rem;
  &:focus {
    outline: 1px solid ${(props) => props.theme.palette.brand25};
  }
`;

export default withWallet(TempleGatesPage);
