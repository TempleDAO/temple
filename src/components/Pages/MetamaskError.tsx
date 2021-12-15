import React from 'react';
import styled from 'styled-components';
import { Flex } from 'components/Layout/Flex';
import Image from 'components/Image/Image';
import metamaskIcon from 'assets/icons/metamask-icon.png';

const MetamaskErrorPage = () => {
  return (
    <StyledFlex
      layout={{
        kind: 'container',
        direction: 'column',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Image src={metamaskIcon} width={100} height={100} />
      <Label>Please add MetaMask to your browser</Label>
      <a href="https://metamask.io/download.html">Click to download</a>
    </StyledFlex>
  );
};

const StyledFlex = styled(Flex)`
  height: 31.25rem;
`;

const Label = styled.p`
  color: ${({ theme }) => theme.palette.brand};
`;

export default MetamaskErrorPage;
