import { FC } from 'react';
import styled from 'styled-components';

import Image from 'components/Image/Image';
import useRegisterToken from 'hooks/use-register-token';
import { Token } from 'constants/tokens';

export interface RegisterTokenProps {
  token: Token;
}

const RegisterToken: FC<RegisterTokenProps> = ({
  token,
  token: {
    options: { image, symbol, address },
  },
  children,
}) => {
  const [registerToken] = useRegisterToken(token);

  return (
    <RegisterTokenButton
      onClick={() => {
        registerToken();
      }
    }>
      <Image
        src={image}
        width={32}
        height={32}
        alt={`Register ${symbol} asset in Metamask`}
        title={`Register ${symbol} asset in Metamask`}
      />
      {/* Children can be used to add more info about the Token IE: [Image] register token [SYMBOL]*/}
      {children}
    </RegisterTokenButton>
  );
};

const RegisterTokenButton = styled.div`
  display: inline-flex;
  align-items: center;
  cursor: pointer;
`;

export default RegisterToken;
