import React from 'react';
import styled from 'styled-components';
import { Button } from '../components/Button/Button';
import { useWallet } from '../providers/WalletProvider';

const withWallet = (WrappedComponent: () => JSX.Element) => {
  // @ts-ignore
  return props => {
    const { isConnected, connectWallet } = useWallet();
    return (
        <>
          {isConnected ?
              <WrappedComponent {...props}/>
              : <WithWalletContainer>
                <h4>Who knocks on the Temple gates?</h4>
                <br/><br/>
                <span>
                  <Button label={'connect metamask'} onClick={connectWallet} isSmall isUppercase/>
                </span>
              </WithWalletContainer>}
        </>
    );
  };
};

const WithWalletContainer = styled.div`
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  padding: 2rem;
  width: 100%;
  max-width: 40rem;
  margin: 4rem auto 3rem;
  box-shadow: ${(props) => props.theme.shadows.base};
  border: 0.0625rem /* 1/16 */ solid ${(props) => props.theme.palette.brand};
  
`;

export default withWallet;
