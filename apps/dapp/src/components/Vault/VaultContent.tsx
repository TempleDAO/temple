import { Button } from 'components/Button/Button';
import { PropsWithChildren } from 'react';
import styled from 'styled-components';

const VaultContent = ({ children }: PropsWithChildren<{}>) => {
  return <Content>{children}</Content>;
};

const Content = styled.div`
  display: flex;
  flex-direction: column;
  justify-content: center;
  text-align: center;
  border-radius: 50%;
  /* TODO: adjust once in the 'Vault' */
  width: 100%;
  height: 500px;
`;

export const VaultButton = styled(Button)`
  align-self: center;
`;
export default VaultContent;
