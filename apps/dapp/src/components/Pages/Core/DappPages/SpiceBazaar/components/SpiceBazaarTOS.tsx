// src/components/Pages/Core/DappPages/SpiceBazaar/components/SpiceBazaarTOS.tsx

import { useState, useRef, useEffect } from 'react';
import styled from 'styled-components';
import { Button } from 'components/Button/Button';
import { useWallet } from 'providers/WalletProvider';
import * as breakpoints from 'styles/breakpoints';
import { backgroundImage, buttonResets } from 'styles/mixins';
import close from 'assets/icons/close.svg';
import { SpiceBazaarTOSContent } from './SpiceBazaarTOSContent';
import {
  buildSpiceBazaarTosMessage,
  getSpiceBazaarTosStorageKey,
  isSpiceBazaarTosSignatureValidAsync,
} from 'utils/spiceBazaarTos';

interface SpiceBazaarTOSProps {
  onSuccess: () => void;
  onCancel: () => void;
}

export const SpiceBazaarTOS = ({
  onSuccess,
  onCancel,
}: SpiceBazaarTOSProps) => {
  const { signer, wallet: walletAddress, getConnectedSigner } = useWallet();
  const [hasScrolledToBottom, setHasScrolledToBottom] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const handleScroll = () => {
    const container = scrollContainerRef.current;
    if (!container) return;

    const threshold = 10;
    const isBottom =
      container.scrollHeight - container.scrollTop - container.clientHeight <
      threshold;

    if (isBottom && !hasScrolledToBottom) {
      setHasScrolledToBottom(true);
    }
  };

  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    // Check if content is already fully visible (no scrolling needed)
    if (container.scrollHeight <= container.clientHeight) {
      setHasScrolledToBottom(true);
    }
  }, []);

  const handleSign = async () => {
    if (!walletAddress) {
      setError('Connect a wallet to sign the Terms.');
      return;
    }

    // Clear any previous error when retrying
    setError(null);
    setIsLoading(true);

    try {
      const activeSigner = signer ?? getConnectedSigner();
      if (!activeSigner?.provider) {
        throw new Error('No signer provider');
      }

      const normalizedWallet = walletAddress.toLowerCase();
      const messageWallet = walletAddress;
      const timestamp = new Date().toISOString();
      const message = buildSpiceBazaarTosMessage(messageWallet, timestamp);
      const signature = await activeSigner.signMessage(message);

      if (!signature) {
        throw new Error('Empty signature');
      }

      const provider = activeSigner.provider;
      if (!provider) {
        throw new Error('No provider available');
      }

      const { isValid, isContractWallet } =
        await isSpiceBazaarTosSignatureValidAsync(
          messageWallet,
          timestamp,
          signature,
          provider
        );
      if (!isValid) {
        throw new Error('Signature does not match connected wallet');
      }

      // Store signature with timestamp only after a valid signature
      const tosData = JSON.stringify({
        signature,
        timestamp,
        walletAddress: messageWallet,
        isContractWallet,
      });
      window.localStorage[getSpiceBazaarTosStorageKey(normalizedWallet)] =
        tosData;
      onSuccess();
    } catch (err: any) {
      console.error('TOS signature failed:', err);
      // Show error message instead of closing the modal
      const errorMessage =
        err?.code === 'ACTION_REJECTED' || err?.code === 4001
          ? 'Signature rejected. Please try again.'
          : err?.message || 'Signature failed. Please try again.';
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Container>
      <CloseIcon onClick={onCancel} />
      <TitleContainer>
        <Title>Spice Bazaar Terms</Title>
      </TitleContainer>

      <ScrollContainer ref={scrollContainerRef} onScroll={handleScroll}>
        <TOSText>
          <SpiceBazaarTOSContent />
        </TOSText>
      </ScrollContainer>

      <ConfirmationText>
        <ConfirmationTitle>
          BY CLICKING &quot;I AGREE&quot;, YOU:
        </ConfirmationTitle>
        <ConfirmationList>
          <li>
            confirm you have read and agree to be bound by these Terms and the{' '}
            <a href="/privacypolicy" target="_blank" rel="noopener noreferrer">
              Privacy Policy
            </a>
            ;
          </li>
          <li>
            confirm you are not a Restricted Person and are not using VPN/proxy
            to evade controls;
          </li>
          <li>
            acknowledge Spice Bazaar is not your broker/dealer/adviser/custodian
            and provides no advice;
          </li>
          <li>
            acknowledge on-chain transactions are final and you assume all
            risks;
          </li>
          <li>
            agree to the disclaimers, limitation of liability, indemnity, and
            dispute resolution provisions
          </li>
        </ConfirmationList>
      </ConfirmationText>

      {error && (
        <ErrorMessage>
          <ErrorText>{error}</ErrorText>
        </ErrorMessage>
      )}

      <SignButton
        onClick={handleSign}
        disabled={!hasScrolledToBottom || isLoading}
      >
        {isLoading ? 'SIGNING...' : 'I AGREE'}
      </SignButton>
    </Container>
  );
};

const Container = styled.div`
  display: flex;
  flex-direction: column;
  width: 90vw;
  max-width: 600px;
  padding: 0px 24px 10px 24px;
  gap: 24px;
  background: ${({ theme }) => theme.palette.black};
  position: relative;

  ${breakpoints.phoneAndAbove(`
    padding: 0px 32px 10px 32px;
  `)}
`;

const CloseIcon = styled.button`
  ${backgroundImage(close)}
  ${buttonResets}
  width: 24px;
  height: 24px;
  position: absolute;
  right: 2rem;
  top: 26.5px;
  z-index: 10;
`;

const TitleContainer = styled.div`
  display: flex;
  flex-direction: row;
  height: 77px;
  width: 100%;
  justify-content: center;
  align-items: center;
  background: ${({ theme }) => theme.palette.gradients.grey};
`;

const Title = styled.h3`
  display: flex;
  color: ${({ theme }) => theme.palette.brandLight};
  font-size: 24px;
  line-height: 44px;
  text-align: center;
  margin: 0px;
`;

const ScrollContainer = styled.div`
  display: flex;
  flex-direction: column;
  max-height: 400px;
  overflow-y: auto;
  padding-right: 12px;
  border: 1px solid ${({ theme }) => theme.palette.brand};
  border-radius: 10px;
  background: ${({ theme }) => theme.palette.brandDarker};
  padding: 20px;

  /* Custom scrollbar styling */
  &::-webkit-scrollbar {
    width: 8px;
  }

  &::-webkit-scrollbar-track {
    background: ${({ theme }) => theme.palette.black};
    border-radius: 4px;
  }

  &::-webkit-scrollbar-thumb {
    background: ${({ theme }) => theme.palette.brand};
    border-radius: 4px;
  }

  &::-webkit-scrollbar-thumb:hover {
    background: ${({ theme }) => theme.palette.brandLight};
  }
`;

const TOSText = styled.div`
  color: ${({ theme }) => theme.palette.brandLight};
  font-size: 14px;
  line-height: 1.6;

  ${breakpoints.phoneAndAbove(`
    font-size: 15px;
  `)}
`;

const ConfirmationText = styled.div`
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  width: 100%;
  border: 2px solid transparent;
  border-image-source: linear-gradient(
    180deg,
    rgba(149, 97, 63, 0.1) 0%,
    rgba(255, 255, 255, 0) 100%
  );
  border-image-slice: 1;
  border-radius: 6px;
  padding: 16px 10px 16px 10px;
  gap: 12px;
  background: #24272c;
`;

const ConfirmationTitle = styled.div`
  font-size: 12px;
  font-weight: 700;
  color: ${({ theme }) => theme.palette.brandLight};
  text-transform: uppercase;
  letter-spacing: 0.5px;
  line-height: 18px;
`;

const ConfirmationList = styled.ul`
  margin: 0;
  padding-left: 20px;
  color: ${({ theme }) => theme.palette.brandLight};
  font-size: 12px;
  line-height: 18px;
  font-weight: 700;

  li {
    margin-bottom: 8px;

    &:last-child {
      margin-bottom: 0;
    }
  }
`;

const ErrorMessage = styled.div`
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 16px;
  background: rgba(220, 38, 38, 0.1);
  border: 1px solid rgba(220, 38, 38, 0.3);
  border-radius: 8px;
  width: 100%;
`;

const ErrorIcon = styled.span`
  font-size: 18px;
  line-height: 1;
`;

const ErrorText = styled.p`
  margin: 0;
  color: #fca5a5;
  font-size: 14px;
  line-height: 18px;
  font-weight: 600;
`;

const SignButton = styled(Button)`
  padding: 10px 20px;
  width: auto;
  height: min-content;
  align-self: center;
  background: linear-gradient(90deg, #58321a 20%, #95613f 84.5%);
  border: 1px solid ${({ theme }) => theme.palette.brandDark};
  box-shadow: 0px 0px 20px 0px #de5c0666;
  border-radius: 10px;
  font-size: 16px;
  line-height: 20px;
  font-weight: 700;
  color: ${({ theme }) => theme.palette.brandLight};

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
`;
