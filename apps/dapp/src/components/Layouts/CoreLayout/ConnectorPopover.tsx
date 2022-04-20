import styled, { css } from 'styled-components';
import { useConnect } from 'wagmi';

import { tabletAndAbove } from 'styles/breakpoints';
import { UnstyledList } from 'styles/common';
import { Button } from 'components/Button/Button';

interface Props {
  onClose: () => void;
  isOpen: boolean;
}

export const ConnectorPopover = ({ onClose, isOpen }: Props) => {
  const [{ data, error, loading }, connect] = useConnect();

  return (
    <Wrapper isOpen={isOpen}>
      <Menu>
        {data.connectors.map((connector) => (
          <li key={connector.id}>
            <ConnectorButon
              disabled={!connector.ready || loading}
              onClick={async () => {
                try {
                  console.log(connector)
                  await connect(connector);
                  onClose();
                } catch (err) {
                  // empty
                  console.log(err)
                }
              }}
              label={`
                ${connector.name}
                ${!connector.ready ? ' (unsupported)' : ''}
              `}
            />
          </li>
        ))}
      </Menu>
      {error && <div>{error?.message ?? 'Failed to connect'}</div>}
    </Wrapper>
  );
};

const ConnectorButon = styled(Button)`
  border: 1px solid;
  color: ${({ theme }) => theme.palette.brand};
  margin: 0 0 0 0.5rem;
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
  padding: 2rem;
  flex-direction: column;

  ${(tabletAndAbove(css`
    width: 25rem; // 400px
    left: 50%;
    top: 50%;
    right: auto;
    bottom: auto;
    transform: translate(-50%, -50%);
  `))}
`;

const Menu = styled(UnstyledList)``;