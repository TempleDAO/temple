import { Button } from 'components/Button/Button';
import { PropsWithChildren } from 'react';
import styled from 'styled-components';

const VaultContent = ({ children }: PropsWithChildren<{}>) => {
  return <Content>{children}</Content>;
};

const Content = styled.div`
  display: flex;
  flex-direction: column;
  text-align: center;
  width: 90%;
  height: 100%;
`;

export const VaultButton = styled(Button)`
  align-self: center;
`;

export default VaultContent;
