import { useEffect, useRef } from 'react';
import styled, { css } from 'styled-components';
import { useConnect } from 'wagmi';

import { tabletAndAbove } from 'styles/breakpoints';
import { UnstyledList } from 'styles/common';
import { Button } from 'components/Button/Button';
import { backgroundImage, buttonResets } from 'styles/mixins';

import walletConnectIcon from 'assets/icons/walletconnect-circle-white.svg';
import metamaskIcon from 'assets/icons/metamask-icon.png';
import hamburgerX from 'assets/icons/core-x-hamburger.svg';

interface Props {
  onClose: () => void;
  isOpen: boolean;
}

// TODO(Fujisawa): Make reusable popover that animates open/shut.
export const ConnectorPopover = ({ onClose, isOpen }: Props) => {
  const [{ data, error, loading }, connect] = useConnect();

  const connected = data.connected;
  useEffect(() => {
    if (connected && isOpen) {
      onClose();
    }
  }, [connected, isOpen]);

  return (
    <>
      {isOpen && <Dimmer />}
      <Wrapper isOpen={isOpen}>
        <SelectWalletLabel>Select Wallet</SelectWalletLabel>
        <XIcon onClick={() => onClose()}/>
        <Menu>
          {data.connectors.map((connector) => (
            <li key={connector.id}>
              <ConnectorButon
                disabled={!connector.ready || loading}
                onClick={() => {
                  connect(connector);
                }}
              >
                <ButtonContent>
                  {getConnectorIcon(connector.name)}
                  <span>{connector.name} {!connector.ready ? ' (unsupported)' : ''}</span>
                </ButtonContent>
              </ConnectorButon>
            </li>
          ))}
        </Menu>
        {error && <ErrorMessage>{error?.message ?? 'Failed to connect'}</ErrorMessage>}
      </Wrapper>
    </>
  );
};

const getConnectorIcon = (name: string) => {
  switch (name) {
    case 'MetaMask': return <Icon bgImg={metamaskIcon} />;
    case 'WalletConnect': return <Icon bgImg={walletConnectIcon} />;
  }
  return null;
}

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

const XIcon = styled.button`
  ${backgroundImage(hamburgerX)}
  ${buttonResets}
  width: 1.25rem;
  height: 1.25rem;
  position: absolute;
  right: 2rem;
  top: 1.5rem;
`;

const ConnectorButon = styled(Button)`
  border: 1px solid;
  color: ${({ theme }) => theme.palette.brand};
  margin: 0 0 0 0.5rem;
`;

const SelectWalletLabel = styled.h4`
  color: ${({ theme }) => theme.palette.brand};
  margin-top: 0;
`;

const ErrorMessage = styled.span`
  display: flex;
  justify-content: center;
  color: ${({ theme }) => theme.palette.enclave.chaos};
  margin: 1rem 0 0;
`;

const Wrapper = styled.div<{ isOpen: boolean }>`
  display: ${({ isOpen }) => isOpen ? 'flex' : 'none'};
  background: #1D1A1A;
  position: fixed;
  left: 0;
  top: 0;
  right: 0;
  bottom: 0;
  z-index: 1000;
  padding: 1.5rem 2rem 2rem;
  flex-direction: column;

  ${(tabletAndAbove(css`
    width: 25rem; // 400px
    left: 50%;
    top: 50%;
    right: auto;
    bottom: auto;
    transform: translate(-50%, -50%);
    box-shadow: 0 0 4rem rgba(0, 0, 0, .8);
  `))}
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

const Dimmer = styled.div`
  background: rgba(0, 0, 0, .4);
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 1000;
`;