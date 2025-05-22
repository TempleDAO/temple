import {
  CowSwapWidget,
  EthereumProvider,
  TradeType,
} from '@cowprotocol/widget-react';

import { CowSwapWidgetParams } from '@cowprotocol/widget-react';
import env from 'constants/env';
import { useWallet } from 'providers/WalletProvider';
import styled from 'styled-components';
import { useCallback, useEffect, useState } from 'react';
import { useApiManager } from 'hooks/use-api-manager';

const ENV = import.meta.env;

export const TradeWidget = () => {
  const { wallet, switchNetwork, ethersProvider } = useWallet();

  const { papi } = useApiManager();

  const getChainId = useCallback(() => {
    if (ENV.VITE_ENV === 'production') {
      return 1;
    } else if (ENV.VITE_ENV === 'preview') {
      return 11155111;
    } else {
      throw new Error('Invalid environment');
    }
  }, []);

  const params: CowSwapWidgetParams = {
    appCode: 'Temple Dapp',
    width: '100%',
    height: '640px',
    chainId: getChainId(),
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

  const [provider, setProvider] = useState<EthereumProvider | undefined>(
    undefined
  );

  useEffect(() => {
    const _switchNetwork = async () => {
      await switchNetwork(getChainId());
    };
    if (wallet) {
      _switchNetwork();
      console.debug('TRADE WIDGET: Using wallet provider');
      setProvider(ethersProvider?.provider as unknown as EthereumProvider);
    } else {
      console.debug('TRADE WIDGET: Using papi provider');
      const provider = papi.getProvider(
        getChainId()
      ) as unknown as EthereumProvider;
      setProvider(provider);
    }
  }, [wallet, papi, ethersProvider, switchNetwork, getChainId]);

  return (
    <>
      <WidgetContainer>
        <CowSwapWidget params={params} provider={provider} />
      </WidgetContainer>
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
