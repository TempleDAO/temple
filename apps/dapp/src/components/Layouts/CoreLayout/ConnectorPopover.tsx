import { useEffect, useRef } from 'react';
import styled, { css } from 'styled-components';
import { useConnect } from 'wagmi';

import { useOutsideClick } from 'hooks/useOutsideClick';
import { tabletAndAbove } from 'styles/breakpoints';
import { UnstyledList } from 'styles/common';
import { Button } from 'components/Button/Button';

interface Props {
  onClose: () => void;
  isOpen: boolean;
}

// TODO(Fujisawa): Make reusable popover that animates open/shut.
export const ConnectorPopover = ({ onClose, isOpen }: Props) => {
  const popoverRef = useRef<HTMLDivElement>(null);
  const [{ data, error, loading }, connect] = useConnect();

  const connected = data.connected;
  useEffect(() => {
    if (connected && isOpen) {
      onClose();
    }
  }, [connected, isOpen]);

  // Close on click outside
  useOutsideClick(popoverRef, () => {
    onClose();
  });

  return (
    <Wrapper ref={popoverRef} isOpen={isOpen}>
      <SelectWalletLabel>Select Wallet</SelectWalletLabel>
      <Menu>
        {data.connectors.map((connector) => (
          <li key={connector.id}>
            <ConnectorButon
              disabled={!connector.ready || loading}
              onClick={() => {
                connect(connector);
              }}
              label={`
                ${connector.name}
                ${!connector.ready ? ' (unsupported)' : ''}
              `}
            />
          </li>
        ))}
      </Menu>
      {error && <ErrorMessage>{error?.message ?? 'Failed to connect'}</ErrorMessage>}
    </Wrapper>
  );
};

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