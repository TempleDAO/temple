import React from 'react';
import styled, { css, keyframes } from 'styled-components';
import Image from 'components/Image/Image';
import { useWallet } from 'providers/WalletProvider';
import metamaskImage from 'assets/images/metamask-transparent.svg';

const glowKeyframes = keyframes`
  0% {
    filter: brightness(100%);
  }

  25% {
    filter: brightness(130%);
  }

  50% {
    filter: brightness(150%);
  }

  75% {
    filter: brightness(130%);
  }

  100% {
    filter: brightness(100%);
  }
`;

const Container = styled.div<{ connected: boolean }>`
  position: absolute;
  top: -0.5rem;
  right: 0;
  padding: 1rem;
  cursor: pointer;
  z-index: ${(props) => props.theme.zIndexes.top};

  ${({ connected }) =>
    connected
      ? `filter: brightness(180%)`
      : css`
          animation: ${glowKeyframes} 2s infinite ease-in;
        `}
`;

const MetamaskButton = () => {
  const { connectWallet, changeWalletAddress, wallet } = useWallet();

  return (
    <Container connected={!!wallet}>
      <Image
        src={metamaskImage}
        width={60}
        height={60}
        onClick={wallet ? changeWalletAddress : connectWallet}
      />
    </Container>
  );
};

export default MetamaskButton;
