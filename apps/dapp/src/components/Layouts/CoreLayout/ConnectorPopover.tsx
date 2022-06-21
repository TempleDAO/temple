import { useEffect } from 'react';
import styled from 'styled-components';
import { useConnect } from 'wagmi';

import { UnstyledList } from 'styles/common';
import { Button } from 'components/Button/Button';
import { backgroundImage } from 'styles/mixins';

import walletConnectIcon from 'assets/icons/walletconnect-circle-white.svg';
import metamaskIcon from 'assets/icons/metamask-icon.png';
import coinbaseAppIcon from 'assets/icons/coinbase-wallet-appicon.svg';
import { Popover } from 'components/Popover';

interface Props {
  onClose: () => void;
  isOpen: boolean;
}

export const ConnectorPopover = ({ onClose, isOpen }: Props) => {
  const {
    error,
    isConnecting: loading,
    connect,
    isConnected: connected,
    connectors,
  } = useConnect();

  useEffect(() => {
    if (connected && isOpen) {
      onClose();
    }
  }, [connected, isOpen]);

  return (
    <Popover
      isOpen={isOpen}
      onClose={onClose}
      header="Select Wallet"
      closeOnEscape
      closeOnClickOutside
    >
      <Menu>
        {connectors.map((connector) => (
          <li key={connector.id}>
            <ConnectorButon
              disabled={!connector.ready || loading}
              onClick={() => {
                connect(connector);
              }}
            >
              <ButtonContent>
                {getConnectorIcon(connector.id)}
                <span>{connector.name} {!connector.ready ? ' (unsupported)' : ''}</span>
              </ButtonContent>
            </ConnectorButon>
          </li>
        ))}
      </Menu>
      {error && <ErrorMessage>{error?.message ?? 'Failed to connect'}</ErrorMessage>}
    </Popover>
  );
};

const getConnectorIcon = (connectorId: string) => {
  switch (connectorId) {
    case 'injected': return <Icon bgImg={metamaskIcon} />;
    case 'walletConnect': return <Icon bgImg={walletConnectIcon} />;
    case 'coinbaseWallet': return <Icon bgImg={coinbaseAppIcon} />;
  }
  return null;
};

const Icon = styled.span<{ bgImg: string }>`
  ${({ bgImg }) => backgroundImage(bgImg)}
  display: block;
  width: 2rem;
  height: 2rem;
`;

const ButtonContent = styled.span`
  display: flex;
  flex-direction: row;
  align-items: center;

  ${Icon} {
    margin-right: 1rem;
  }
`;

const ConnectorButon = styled(Button)`
  border: 1px solid;
  color: ${({ theme }) => theme.palette.brand};
  margin: 0 0 0 0.5rem;
`;

const ErrorMessage = styled.span`
  display: flex;
  justify-content: center;
  color: ${({ theme }) => theme.palette.enclave.chaos};
  margin: 1rem 0 0;
`;

const Menu = styled(UnstyledList)`
  > li {
    ${ConnectorButon} { 
      border-bottom: none;
    }

    &:last-of-type {
      ${ConnectorButon} {
        border-bottom: 1px solid;
      }
    }
  }
`;
