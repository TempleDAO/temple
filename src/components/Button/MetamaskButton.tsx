import React from 'react';
import styled from 'styled-components';
import Image from 'components/Image/Image';
import { useWallet } from 'providers/WalletProvider';
import metamaskImage from 'assets/images/metamask-transparent.svg';

const Container = styled.div`
  position: absolute;
  top: 0;
  right: 0;
  padding: 1rem;
  cursor: pointer;
  &: hover {
    filter: brightness(150%);
  }
`;

const MetamaskButton = () => {
  const { connectWallet, changeWalletAddress, wallet } = useWallet();

  return (
    <Container>
      <Image
        src={metamaskImage}
        width={97}
        height={97}
        onClick={wallet ? changeWalletAddress : connectWallet}
      />
    </Container>
  );
};

export default MetamaskButton;
