import styled, { css } from 'styled-components';

import { tabletAndAbove } from 'styles/breakpoints';
import EllipsisLoader from 'components/EllipsisLoader';
import Tooltip, { TooltipIcon } from 'components/Tooltip/Tooltip';
import { Input } from 'components/Pages/Core/NewUI/HomeInput';
import { Button } from 'components/Button/Button';
import { useEffect, useState } from 'react';
import { useDebouncedCallback } from 'use-debounce';
import { useWallet } from 'providers/WalletProvider';
import { ethers } from "ethers";
import { EthersAdapter } from '@safe-global/protocol-kit';
import { useConnectWallet } from '@web3-onboard/react';

const SafeAdmin = () => {

  const [safeTxId, setSafeTxId] = useState(undefined);

  const [{ wallet }] = useConnectWallet();
  const { walletAddress, signer } = useWallet();

  useEffect(() => {
    if (!wallet) return;
    const ethersProvider = new ethers.providers.Web3Provider(wallet.provider);
    // const ethAdapter = new EthersAdapter({
    //   ethers,
    //   signerOrProvider: ethersProvider.getSigner()
    // })
    
  }, [wallet]);

  

  console.log('walletAddress', walletAddress);

  return (
    <Container>
      <InputArea>
        <h3>Safe App</h3>
        <TitleWrapper>
          <p>Enter the Safe Tx Id you want to sign or execute</p>
          <Tooltip
            content={
              <>
                <p>Remove liquidity from balancer pool receiving both</p>
                <p>Treasury Price Floor is expected to be within bounds of multisig set range.</p>
                <p>
                  Withdraw and unwrap BPT tokens from Aura staking and send to balancer pool to receive both tokens.
                </p>
              </>
            }
          >
            <TooltipIcon />
          </Tooltip>
        </TitleWrapper>

        <Input
          crypto={{ kind: 'value', value: 'Tx Id' }}
          small
          handleChange={useDebouncedCallback((e) => {
            setSafeTxId(e);
          }, 300)}
        />
        <Button
          isSmall
          label="SIGN / EXECUTE"
          onClick={async () => {
            console.log('click', safeTxId);
          }}
        />
      </InputArea>
    </Container>
  );
};

export default SafeAdmin;


const Container = styled.div`
  display: grid;
  grid-template-columns: 1fr;
  gap: 2rem;
  ${tabletAndAbove(css`
    grid-template-columns: 1fr 1fr;
  `)}
`;

const InputArea = styled.div`
  h3 {
    margin-top: 0.5rem;
    margin-bottom: 0;
  }
  p {
    margin: 0;
  }
  display: flex;
  border: ${({ theme }) => `1px solid ${theme.palette.brand}`};
  border-radius: 2rem;
  padding: 1rem;
  flex-direction: column;
  gap: 1rem;
`;

const TitleWrapper = styled.div`
  display: flex;
  gap: 0.5rem;
  align-items: center;
  small {
    margin-top: 0.5rem;
  }
`;