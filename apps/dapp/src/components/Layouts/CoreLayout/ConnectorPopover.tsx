import { useEffect } from 'react';
import styled from 'styled-components';
import { useConnect, useAccount, useDisconnect, useSignMessage } from 'wagmi';
import { utils } from 'ethers';
import { UnstyledList } from 'styles/common';
import { Button } from 'components/Button/Button';
import { backgroundImage } from 'styles/mixins';

import walletConnectIcon from 'assets/icons/walletconnect-circle-white.svg';
import metamaskIcon from 'assets/icons/metamask-icon.png';
import coinbaseAppIcon from 'assets/icons/coinbase-wallet-appicon.svg';
import { Popover } from 'components/Popover';
import env from 'constants/env';

interface Props {
  onClose: () => void;
  isOpen: boolean;
}

export const ConnectorPopover = ({ onClose, isOpen }: Props) => {
  const { address, isConnected: connected, connector } = useAccount();
  const { error, isLoading: loading, connect, connectors } = useConnect();
  const { disconnect } = useDisconnect();
  const { signMessage } = useSignMessage({
    onSuccess(data, variables) {
      const address = utils.verifyMessage(variables.message, data);
      window.localStorage[`templedao.tos.${address}`] = data;
    },
    onError: () => {
      disconnect();
    },
  });

  useEffect(() => {
    if (connected && isOpen) {
      onClose();
    }
  }, [connected, isOpen]);

  useEffect(() => {
    if (!env.featureFlags.nexusOnlyMode) {
      if (window?.localStorage !== undefined && address) {
        if (connector?.name !== 'Safe') {
          if (window?.localStorage !== undefined && address) {
            const isTosSigned = window.localStorage[`templedao.tos.${address}`];
            if (!isTosSigned) {
              const message = `I agree to the TempleDAO Terms & Conditions at:\n\nhttps://templedao.link/disclaimer`;
              signMessage({ message });
            }
          }
        }
      }
    }
  }, [address]);

  useEffect(() => {
    // Note: Metamask removed here to avoid duplication with injected connector
    const totalMetaMaskConnectors = connectors.filter((c) => c.name === 'MetaMask');
    if (totalMetaMaskConnectors.length === 2) {
      connectors.pop();
    }
  }, [connectors]);

  return (
    <Popover isOpen={isOpen} onClose={onClose} header="Select Wallet" closeOnEscape closeOnClickOutside>
      <Menu>
        {connectors.map((connector) => (
          <li key={connector.id}>
            <ConnectorButton
              disabled={!connector.ready || loading}
              onClick={() => {
                connect({ connector });
              }}
            >
              <ButtonContent>
                {getConnectorIcon(connector.id)}
                <span>
                  {connector.name} {!connector.ready ? ' (unsupported)' : ''}
                </span>
              </ButtonContent>
            </ConnectorButton>
          </li>
        ))}
      </Menu>
      {error && <ErrorMessage>{error?.message ?? 'Failed to connect'}</ErrorMessage>}
    </Popover>
  );
};

const getConnectorIcon = (connectorId: string) => {
  switch (connectorId) {
    case 'metaMask':
      return <Icon bgImg={metamaskIcon} />;
    case 'walletConnect':
      return <Icon bgImg={walletConnectIcon} />;
    case 'coinbaseWallet':
      return <Icon bgImg={coinbaseAppIcon} />;
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

const ConnectorButton = styled(Button)`
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
    ${ConnectorButton} {
      border-bottom: none;
    }

    &:last-of-type {
      ${ConnectorButton} {
        border-bottom: 1px solid;
      }
    }
  }
`;
