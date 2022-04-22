import { useEffect, useState } from 'react';
import styled from 'styled-components';
import { useNetwork, chain } from 'wagmi';

import { UnstyledList } from 'styles/common';
import { Button } from 'components/Button/Button';

import { Popover } from 'components/Popover';
import { Nullable } from 'types/util';


export const WrongNetworkPopover = () => {
  const [{ data, loading, error }, switchNetwork] = useNetwork();
  const [dismissedChainId, setDismissedChainId] = useState<Nullable<number>>(null);
  const [isOpen, setIsOpen] = useState(false);

  const currentNetworkId = data?.chain?.id;
  const defaultChainForEnv = ENV_CHAIN_MAPPING.get(ENV) || chain.mainnet;

  useEffect(() => {
    if (loading || !currentNetworkId || dismissedChainId === currentNetworkId) {
      return;
    }

    const isSupported = isSupportedChain(currentNetworkId);
    if (
      (!isSupported && !isOpen) ||
      (!IS_PROD && defaultChainForEnv.id !== currentNetworkId)
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
    setDismissedChainId(currentNetworkId!);
  };

  // Not all wallets allow switching network programatically.
  let switchNetworkButton = (
    <SwitchNetworkButton
      role="button"
      isSmall
      onClick={onDismiss}
    >
      Dismiss
    </SwitchNetworkButton>
  );
  
  if (switchNetwork) {
    switchNetworkButton = (
      <SwitchNetworkButton
        role="button"
        isSmall
        disabled={loading}
        onClick={() => {
          if (switchNetwork) {
            // const id = defaultChainForEnv.
            let chain = defaultChainForEnv.id;
            if (defaultChainForEnv.name === 'Hardhat') {
              chain = 1337;
            }
            switchNetwork(defaultChainForEnv.id);
          }
        }}
      >
        Switch to {defaultChainForEnv.name}
      </SwitchNetworkButton>
    );
  }

  return (
    <Popover
      isOpen={isOpen}
      onClose={onDismiss}
      showCloseButton={!switchNetwork || !IS_PROD}
      header="Wrong Network"
    >
      <Message>
        {(IS_PROD || !defaultChainForEnv) ? (
          <>This app only works on Ethereum Mainnet.</>
        ) : (
          <>The default chain for {ENV} is {defaultChainForEnv.name}.</>
        )}
      </Message>
      <Menu>
        <li>
          {switchNetworkButton}
        </li>
        {!IS_PROD && (
          <li>
            <SwitchNetworkButton
              role="button"
              isSmall
              disabled={loading}
              onClick={onDismiss}
            >
              {!!data?.chain?.name ? (
               <>Continue with {data.chain.name}</>
              ) : (
                <>Continue</>
              )}
            </SwitchNetworkButton>
          </li>
        )}
      </Menu>
      {error && <ErrorMessage>{error.message}</ErrorMessage>}
    </Popover>
  );
};

const ENV_VARS = import.meta.env;
const ENV = ENV_VARS.VITE_ENV;
const IS_PROD = ENV === 'production';

const ENV_CHAIN_MAPPING = new Map([
  ['production', chain.mainnet],
  ['staging', chain.rinkeby],
  ['development', chain.hardhat],
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
