import React, { useCallback } from 'react';
import styled from 'styled-components';
import Image from 'components/Image/Image';
import discordImage from 'assets/images/discord-logo.svg';
import chaosImage from 'assets/images/circle-chaos.png';
import logicImage from 'assets/images/circle-logic.png';
import mysteryImage from 'assets/images/circle-mystery.png';
import orderImage from 'assets/images/circle-order.png';
import structureImage from 'assets/images/circle-structure.png';

const ENV_VARS = import.meta.env;

const enclaveImages = {
  chaos: chaosImage,
  logic: logicImage,
  mystery: mysteryImage,
  order: orderImage,
  structure: structureImage,
};

interface EnclaveCardProps {
  enclave: string;
  unsetDiscrodData: () => null;
}

function capitalizeFirstLetter(string) {
  return string.charAt(0).toUpperCase() + string.slice(1);
}

const EnclaveCard = ({ enclave, unsetDiscrodData }: EnclaveCardProps) => {
  const params = new URLSearchParams({
    client_id: ENV_VARS.VITE_DISCORD_CLIENT_ID,
    redirect_uri: `${window.location.protocol}//${window.location.host}/account`,
    response_type: 'token',
    scope: 'identify',
  });
  const discordAuthUrl = `https://discord.com/oauth2/authorize?${params.toString()}`;

  const logout = useCallback(() => {
    localStorage.removeItem('discord-id');
    unsetDiscrodData();
  }, [unsetDiscrodData]);

  if (!enclave || !enclaveImages[enclave]) {
    return (
      <Container>
        <Label>{`Connect to Discord`}</Label>
        <a href={discordAuthUrl}>
          <CardStyled>
            <LoginImage src={discordImage} alt={'discord Enclave'} />
          </CardStyled>
        </a>
      </Container>
    );
  }

  return (
    <Container>
      <Label enclave={enclave}>{`Enclave of ${capitalizeFirstLetter(
        enclave
      )}`}</Label>
      <CardStyled>
        <LogoutOverlay onClick={logout}>Logout Discord</LogoutOverlay>
        <EnclaveImage src={enclaveImages[enclave]} alt={'Temple Enclave'} />
      </CardStyled>
    </Container>
  );
};

interface CardWrapperProps {
  flipped: boolean;
}

const CardStyled = styled.div<CardWrapperProps>`
  position: relative;
  border: 1px solid ${(props) => props.theme.palette.brand50};
  border-radius: 50%;
  width: 100%;
  overflow: hidden;
`;

const EnclaveImage = styled(Image)`
  height: 12rem;
  width: 100%;
`;

const LoginImage = styled(EnclaveImage)`
  transform: scale(0.7, 0.7);
  filter: grayscale(100%);
`;

const Container = styled.div`
  position: relative;
  width: 12rem;
`;

const Label = styled.div`
  ${(props) => props.theme.typography.fonts.fontHeading};
  color: ${(props) =>
    props.enclave
      ? props.theme.palette.enclave[props.enclave]
      : props.theme.palette.light};
  text-align: center;
`;

const LogoutOverlay = styled.div`
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  opacity: 0;
  background-color: ${(props) => props.theme.palette.dark};
  color: ${(props) => props.theme.palette.light};
  cursor: pointer;
  text-align: center;
  line-height: 12rem;

  &:hover {
    opacity: 0.8;
  }
`;

export default EnclaveCard;
