import { useEffect, useState } from 'react';
import styled from 'styled-components';
import { useNetwork, chain as chains, AddChainError, useSwitchNetwork } from 'wagmi';

import { UnstyledList } from 'styles/common';
import { Button } from 'components/Button/Button';

import { Popover } from 'components/Popover';
import { Nullable } from 'types/util';
import { LOCAL_CHAIN } from 'components/WagmiProvider';
import env from '../../../constants/env';

const ENV_VARS = import.meta.env;
const ENV = ENV_VARS.VITE_ENV;
const IS_PROD = ENV === 'production';

export const WrongNetworkPopover = () => {
  const { switchNetwork, error, isLoading: loading } = useSwitchNetwork();
  const { chain } = useNetwork();
  const [dismissedChainId, setDismissedChainId] = useState<Nullable<number>>(null);
  const [isOpen, setIsOpen] = useState(false);

  const currentNetworkId = chain?.id;
  const defaultChainForEnv = ENV_CHAIN_MAPPING.get(ENV) || chains.mainnet;

  useEffect(() => {
    if (loading || !currentNetworkId || dismissedChainId === currentNetworkId) {
      return;
    }

    const isSupported = isSupportedChain(currentNetworkId);
    if ((!isSupported && !isOpen) || (!IS_PROD && defaultChainForEnv.id !== currentNetworkId)) {
      setIsOpen(true);
    } else if (isSupported && isOpen) {
      setIsOpen(false);
    }
  }, [currentNetworkId, setIsOpen, isOpen, loading, dismissedChainId, defaultChainForEnv]);

  const onDismiss = () => {
    // Only allow dismissing popover in staging and dev environments.
    setIsOpen(false);
    setDismissedChainId(currentNetworkId!);
  };

  // Not all wallets allow switching network programatically.
  let switchNetworkButton = (
    <SwitchNetworkButton role="button" isSmall onClick={onDismiss}>
      Dismiss
    </SwitchNetworkButton>
  );

  if (switchNetwork) {
    switchNetworkButton = (
      <SwitchNetworkButton
        role="button"
        isSmall
        disabled={loading}
        onClick={async () => {
          if (switchNetwork) {
            await switchNetwork(defaultChainForEnv.id);
          }
        }}
      >
        Switch to {defaultChainForEnv.name}
      </SwitchNetworkButton>
    );
  }

  let errorMessage = error && <ErrorMessage>{error.message}</ErrorMessage>;
  if (!IS_PROD && defaultChainForEnv.id === LOCAL_CHAIN.id && error instanceof AddChainError) {
    errorMessage = (
      <ErrorMessage>
        Error connecting to {LOCAL_CHAIN.name}. Please make sure you have {LOCAL_CHAIN.name} added to your MetaMask
        Networks with RPC Url: {LOCAL_CHAIN.rpcUrls[0]} and ChainId: {LOCAL_CHAIN.id}.
      </ErrorMessage>
    );
  }

  return (
    <Popover isOpen={isOpen} onClose={onDismiss} showCloseButton={!switchNetwork || !IS_PROD} header="Wrong Network">
      <Message>
        {IS_PROD || !defaultChainForEnv ? (
          <>This app only works on Ethereum Mainnet.</>
        ) : (
          <>
            The default chain for {ENV} is {defaultChainForEnv.name}.
          </>
        )}
      </Message>
      <Menu>
        <li>{switchNetworkButton}</li>
        {!IS_PROD && (
          <li>
            <SwitchNetworkButton role="button" isSmall disabled={loading} onClick={onDismiss}>
              {!!chain?.name ? <>Continue with {chain.name}</> : <>Continue</>}
            </SwitchNetworkButton>
          </li>
        )}
      </Menu>
      {errorMessage}
    </Popover>
  );
};

const ENV_CHAIN_MAPPING = env.featureFlags.nexusOnlyMode
  ? new Map([
      ['production', chains.arbitrum],
      ['preview', chains.arbitrumGoerli],
      ['local', LOCAL_CHAIN],
    ])
  : new Map([
      ['production', chains.mainnet],
      ['preview', chains.goerli],
      ['local', LOCAL_CHAIN],
    ]);

const isSupportedChain = (chainId: number) => {
  return Array.from(ENV_CHAIN_MAPPING).some(([_, chain]) => chain.id === chainId);
};

const Message = styled.p`
  text-align: center;
  color: ${({ theme }) => theme.palette.brand};
  margin: 0 0 3rem;
`;

const SwitchNetworkButton = styled(Button)`
  border: 1px solid;
  color: ${({ theme }) => theme.palette.brand};
  margin: 0;
`;

const ErrorMessage = styled.span`
  display: flex;
  justify-content: center;
  color: ${({ theme }) => theme.palette.enclave.chaos};
  margin: 1rem 0 0;
`;

const Menu = styled(UnstyledList)`
  > li {
    ${SwitchNetworkButton} {
      border-bottom: none;
    }

    &:last-of-type {
      ${SwitchNetworkButton} {
        border-bottom: 1px solid;
      }
    }
  }
`;
