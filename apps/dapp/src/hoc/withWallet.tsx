import React, { ComponentType } from 'react';
import styled from 'styled-components';
import { Button } from 'components/Button/Button';
import { useWallet } from 'providers/WalletProvider';
import MetamaskErrorPage from 'components/MetamaskError/MetamaskError';
import { isDevelopmentEnv } from 'utils/helpers';

export function withWallet<T>(WrappedComponent: ComponentType<T>) {
  const HOCWithWallet = (props: T) => {
    const { wallet, connectWallet, network } = useWallet();

    const isValidNetwork = () => isDevelopmentEnv() || network?.chainId == 1;

    return (
      window.ethereum ? (
        <>
          {wallet && isValidNetwork() ? (
            <WrappedComponent {...props} />
          ) : wallet && !isValidNetwork() ? (
            <WithWalletContainer>
              <h4>Switch to Mainnet to access the Temple</h4>
              <br />
              <br />
              <span>
                <Button
                  label={'Change network'}
                  onClick={() => {
                    if (window.ethereum) {
                      window.ethereum.request({
                        method: 'wallet_switchEthereumChain',
                        params: [{ chainId: '0x1' }],
                      });
                    }
                  }}
                  isSmall
                  isUppercase
                />
              </span>
            </WithWalletContainer>
          ) : (
            <WithWalletContainer>
              <h4>Who knocks on the Temple gates?</h4>
              <br />
              <br />
              <span>
                <Button
                  label={'connect metamask'}
                  onClick={connectWallet}
                  isSmall
                  isUppercase
                />
              </span>
            </WithWalletContainer>
          )}
        </>
      ) : (
        <MetamaskErrorPage />
      )
    );
  };

  return HOCWithWallet;
}

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
