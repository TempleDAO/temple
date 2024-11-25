import {
  CowSwapWidget,
  EthereumProvider,
  TradeType,
} from '@cowprotocol/widget-react';

import { CowSwapWidgetParams } from '@cowprotocol/widget-react';
import { useSetChain } from '@web3-onboard/react';
import Loader from 'components/Loader/Loader';
import env from 'constants/env';
import { useWallet } from 'providers/WalletProvider';
import styled from 'styled-components';

export const TradeWidget = () => {
  const [{ connectedChain }] = useSetChain();
  const { ethersProvider } = useWallet();

  const params: CowSwapWidgetParams = {
    appCode: 'Temple Dapp',
    width: '100%',
    height: '640px',
    chainId: Number(connectedChain?.id) || 1,
    tokenLists: [env.tradeTokenListUrl],
    tradeType: TradeType.SWAP,
    sell: {
      asset: 'DAI',
      amount: '100',
    },
    buy: {
      asset: 'TEMPLE',
      amount: '100',
    },
    forcedOrderDeadline: {
      swap: 7,
    },
    enabledTradeTypes: [TradeType.SWAP],
    theme: {
      baseTheme: 'dark',
      primary: '#bd7b4f',
      paper: '#0c0b0b',
      info: '#4a90e2',
      success: '#28a745',
      background: '#0c0b0b',
      danger: '#ff4343',
      warning: '#ffa500',
      alert: '#ff8c00',
      text: '#ffdec9',
    },
    standaloneMode: false,
    disableToastMessages: false,
    disableProgressBar: false,
    hideBridgeInfo: false,
    hideOrdersTable: false,
    images: {
      emptyOrders: null,
    },
    sounds: {
      postOrder: null,
      orderError: null,
      orderExecuted: null,
    },
  };

  return (
    <>
      {!ethersProvider && <Loader />}
      {ethersProvider && (
        <WidgetContainer>
          <CowSwapWidget
            params={params}
            provider={ethersProvider.provider as unknown as EthereumProvider}
          />
        </WidgetContainer>
      )}
    </>
  );
};

const WidgetContainer = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  border: 0.0625rem solid rgb(189, 123, 79);
  border-radius: 10px;
  width: 500px;
`;
