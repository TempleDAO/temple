import { PropsWithChildren, ComponentProps } from 'react';
import styled from 'styled-components';

import { useWallet } from 'providers/WalletProvider';
import { Button } from 'components/Button/Button';

// eslint-disable-next-line @typescript-eslint/ban-types
const VaultContent = ({ children }: PropsWithChildren<{}>) => {
  return <Content>{children}</Content>;
};

const Content = styled.div`
  display: flex;
  flex-direction: column;
  text-align: center;
  width: 90%;
  height: 100%;
  overflow-y: auto;
`;

const BaseVaultButton = styled(Button).attrs(
  (props: { marginTop: string }) => props
)`
  align-self: center;
  margin-top: ${(props) => props.marginTop || '0rem'};
  border-radius: 12px;
  letter-spacing: 0.4rem;
  text-transform: uppercase;
  width: auto;
  transition: none;
  min-height: 4.75rem;
`;

export const VaultButton = (props: ComponentProps<typeof BaseVaultButton>) => {
  const { isConnected } = useWallet();

  if (!isConnected) {
    // User needs to be connected to perform vault actions.
    return (
      <BaseVaultButton
        disabled
        marginTop={props.marginTop}
        label="Connect Wallet"
      />
    );
  }

  return <BaseVaultButton {...props} />;
};

export default VaultContent;
