import styled from 'styled-components';
import { TradeWidget } from './Trade/TradeWidget';
import { useConnectWallet } from '@web3-onboard/react';
import { useWallet } from 'providers/WalletProvider';
import { TradeButton } from '../NewUI/Home';

export const TradePage = () => {
  const [{}, connect] = useConnectWallet();
  const { wallet } = useWallet();

  return (
    <TradeContainer>
      <HeaderText>Trade</HeaderText>
      {wallet ? (
        <TradeWidget />
      ) : (
        <TradeButton
          onClick={() => {
            connect();
          }}
          style={{ whiteSpace: 'nowrap' }}
        >
          Connect Wallet
        </TradeButton>
      )}
    </TradeContainer>
  );
};

const HeaderText = styled.div`
  height: 32px;
  font-size: 36px;
  line-height: 42px;
  display: flex;
  align-items: center;
  text-align: center;
  color: #ffdec9;
  margin-top: 10px;
  margin-bottom: 40px;
`;

const TradeContainer = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
`;
