import Image from 'components/Image/Image';
import { useNotification } from 'providers/NotificationProvider';
import { FC } from 'react';
import styled from 'styled-components';

export interface Token {
  type: 'ERC20',
  options: {
    address: string,
    symbol: string,
    decimals: number,
    image: string,
  },
}

export interface RegisterTokenProps {
  token: Token;
}

const RegisterToken: FC<RegisterTokenProps> = ({token, token: {options: {image,symbol, address}}, children}) => {
  const { openNotification } = useNotification();
  const handleRegisterToken = async () => {
    try {
      // wasAdded is a boolean. Like any RPC method, an error may be thrown.
      // @ts-ignore ethereum not visible by IDE
      const wasAdded = await window.ethereum.request({
        method: 'wallet_watchAsset',
        params: token,
      });

      if (wasAdded) {
        openNotification({
          title: `Token ${symbol} added to your assets`,
          hash: address,
          kind: 'SIMPLE'
        })
      } else {
        console.log(`FAILED: Adding Token ${symbol} to your assets`);
      }
    } catch (error) {
      console.log(error);
    }
  }
  return <RegisterTokenButton onClick={handleRegisterToken}>
    <Image src={image} width={32} height={32}  alt={`Register ${symbol} asset in Metamask`} title={`Register ${symbol} asset in Metamask`}/>
    {/* Children can be used to add more info about the Token IE: [Image] register token [SYMBOL]*/}
    {children}
  </RegisterTokenButton>
}

const RegisterTokenButton = styled.div`
  display: inline-flex;
  align-items: center;
  cursor: pointer;
`

export default RegisterToken;
