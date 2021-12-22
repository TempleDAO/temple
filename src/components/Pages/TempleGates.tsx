import React, { useEffect } from 'react';
import styled from 'styled-components';
import { Howl } from 'howler';
import Foyer from 'components/Pages/Foyer';
import { CustomRoutingPage } from 'hooks/use-custom-spa-routing';
import useUnmountableTrack from 'hooks/use-unmountable-track';
import withWallet from 'hoc/withWallet';
import templeGatesTrack from 'assets/sounds/temple-gates-bg-track.mp3';
import gatesImage from 'assets/images/EnterTheGates.jpg';

const track = new Howl({
  src: [templeGatesTrack],
  loop: true,
  volume: 0.15,
});

const TempleGatesPage: CustomRoutingPage = ({ routingHelper }) => {
  const { changePageTo } = routingHelper;

  useUnmountableTrack(track);

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
