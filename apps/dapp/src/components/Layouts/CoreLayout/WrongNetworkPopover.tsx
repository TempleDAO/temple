import { useEffect, useMemo, useState } from 'react';
import styled from 'styled-components';

import { UnstyledList } from 'styles/common';
import { Button } from 'components/Button/Button';

import { Popover } from 'components/Popover';
import { Nullable } from 'types/util';
import { useSetChain } from '@web3-onboard/react';
import {
  ChainDefinition,
  ENV_CHAIN_MAPPING,
  LOCAL_CHAIN,
  MAINNET_CHAIN,
  getChainById,
  isSupportedChain,
} from 'utils/envChainMapping';

const ENV_VARS = import.meta.env;
const ENV = ENV_VARS.VITE_ENV;
const IS_PROD = ENV === 'production';

export const WrongNetworkPopover = () => {
  const [{ connectedChain, settingChain: loading }, setChain] = useSetChain();

  const [currentChain, setCurrentChain] =
    useState<Nullable<ChainDefinition>>(null);

  const currentNetworkId = useMemo(
    () => parseInt(connectedChain?.id || '', 16),
    [connectedChain]
  );

  useEffect(() => {
    if (connectedChain) {
      const _currentChain = getChainById(connectedChain.id);
      setCurrentChain(_currentChain);
    }
  }, [connectedChain]);

  const [dismissedChainId, setDismissedChainId] =
    useState<Nullable<number>>(null);
  const [isOpen, setIsOpen] = useState(false);

  const [error, setError] = useState<Nullable<Error>>(null);

  const defaultChainForEnv = ENV_CHAIN_MAPPING.get(ENV) || MAINNET_CHAIN;

  useEffect(() => {
    if (loading || !currentNetworkId || dismissedChainId === currentNetworkId) {
      return;
    }

    const isSupported = isSupportedChain(currentNetworkId);
    if (
      (!isSupported && !isOpen) ||
      defaultChainForEnv.id !== currentNetworkId
    ) {
      setIsOpen(true);
    } else if (isSupported && isOpen) {
      setIsOpen(false);
    }
  }, [
    currentNetworkId,
    setIsOpen,
    isOpen,
    loading,
    dismissedChainId,
    defaultChainForEnv,
  ]);

  const onDismiss = () => {
    // Only allow dismissing popover in staging and dev environments.
    setIsOpen(false);
    setDismissedChainId(currentNetworkId);
  };

  // Not all wallets allow switching network programatically.
  let switchNetworkButton = (
    <SwitchNetworkButton role="button" isSmall onClick={onDismiss}>
      Dismiss
    </SwitchNetworkButton>
  );

  if (setChain) {
    switchNetworkButton = (
      <SwitchNetworkButton
        role="button"
        isSmall
        disabled={loading}
        onClick={async () => {
          if (setChain) {
            try {
              await setChain({
                chainId: `0x${defaultChainForEnv.id.toString(16)}`,
              });
            } catch (e: any) {
              setError(e);
            }
          }
        }}
      >
        Switch to {defaultChainForEnv.name}
      </SwitchNetworkButton>
    );
  }

  let errorMessage = error && <ErrorMessage>{error.message}</ErrorMessage>;
  if (error && !IS_PROD && defaultChainForEnv.id === LOCAL_CHAIN.id) {
    errorMessage = (
      <ErrorMessage>
        Error connecting to {LOCAL_CHAIN.name}. Please make sure you have{' '}
        {LOCAL_CHAIN.name} added to your MetaMask Networks with RPC Url:
        http://localhost:8545 and ChainId: {LOCAL_CHAIN.id}.
      </ErrorMessage>
    );
  }

  return (
    <Popover
      isOpen={isOpen}
      onClose={onDismiss}
      showCloseButton={!setChain || !IS_PROD}
      header="Wrong Network"
    >
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
            <SwitchNetworkButton
              role="button"
              isSmall
              disabled={loading}
              onClick={onDismiss}
            >
              {!!currentChain?.name ? (
                <>Continue with {currentChain.name}</>
              ) : (
                <>Continue</>
              )}
            </SwitchNetworkButton>
          </li>
        )}
      </Menu>
      {errorMessage}
    </Popover>
  );
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
