import { ComponentType } from 'react';
import styled from 'styled-components';

import { Button } from 'components/Button/Button';
import { useWallet } from 'providers/WalletProvider';
import { useAppContext, PopoverName } from 'providers/AppProvider';

export function withWallet<T extends object>(WrappedComponent: ComponentType<T>) {
  const HOCWithWallet = (props: T) => {
    const { isConnected } = useWallet();
    const { openPopover } = useAppContext();

    if (isConnected) {
      return <WrappedComponent {...props} />
    }

    return (
      <WithWalletContainer>
        <h4>Who knocks on the Temple gates?</h4>
        <br />
        <br />
        <span>
          <Button
            label="Connect Wallet"
            onClick={() => openPopover(PopoverName.Connect)}
            isSmall
            isUppercase
          />
        </span>
      </WithWalletContainer>
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
