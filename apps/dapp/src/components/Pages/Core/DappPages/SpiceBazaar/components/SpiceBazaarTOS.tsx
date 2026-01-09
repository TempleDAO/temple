// src/components/Pages/Core/DappPages/SpiceBazaar/components/SpiceBazaarTOS.tsx

import { useState } from 'react';
import styled from 'styled-components';
import { utils } from 'ethers';
import LargeRoundCheckBox from './LargeRoundCheckBox';
import { Button } from 'components/Button/Button';
import { useWallet } from 'providers/WalletProvider';
import * as breakpoints from 'styles/breakpoints';

interface SpiceBazaarTOSProps {
  onSuccess: () => void;
  onCancel: () => void;
}

export const SpiceBazaarTOS = ({
  onSuccess,
  onCancel,
}: SpiceBazaarTOSProps) => {
  const { signer, wallet: walletAddress } = useWallet();
  const [checkbox1, setCheckbox1] = useState(false);
  const [checkbox2, setCheckbox2] = useState(false);
  const [checkbox3, setCheckbox3] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleSign = async () => {
    if (!signer || !walletAddress) {
      console.error('No signer or wallet address');
      return;
    }

    setIsLoading(true);

    try {
      const message = `I agree to the Spice Bazaar Terms & Conditions at:\n\nhttps://templedao.link/spice-bazaar-disclaimer`;
      const signature = await signer.signMessage(message);

      // Verify and store
      // Store signature
      window.localStorage[
        `templedao.spicebazaar.tos.${walletAddress?.toLowerCase()}`
      ] = signature;
      onSuccess();
    } catch (error) {
      console.error('TOS signature failed:', error);
      onCancel();
    } finally {
      setIsLoading(false);
    }
  };

  const canSign = checkbox1 && checkbox2 && checkbox3;

  return (
    <Container>
      <Title>Welcome to TempleDAO</Title>

      <ScrollContainer>
        <IntroText>
          By accessing or using TempleDAO, I agree to the{' '}
          <Link
            href="https://templedao.link/terms"
            target="_blank"
            rel="noopener noreferrer"
          >
            Terms Of Service
          </Link>{' '}
          and confirm that I have read and understood the{' '}
          <Link
            href="https://templedao.link/disclaimer"
            target="_blank"
            rel="noopener noreferrer"
          >
            TempleDAO Disclaimer
          </Link>{' '}
          and the{' '}
          <Link
            href="https://templedao.link/privacy"
            target="_blank"
            rel="noopener noreferrer"
          >
            Privacy Policy
          </Link>
          . I hereby further represent and warrant that:
        </IntroText>

        <CheckboxSection>
          <CheckboxItem>
            <LargeRoundCheckBox checked={checkbox1} onToggle={setCheckbox1} />
            <CheckboxText>
              I am not a resident of or located in the United States of America
              (including its territories) or any other jurisdiction where the
              provision or use of TempleDAO would be contrary to applicable
              laws, rules or regulations of any governmental authority.
            </CheckboxText>
          </CheckboxItem>

          <CheckboxItem>
            <LargeRoundCheckBox checked={checkbox2} onToggle={setCheckbox2} />
            <CheckboxText>
              I understand that for leveraged Spice Bazaar auctions there may be
              a delay or suspension in the access to my deposited tokens{' '}
              <Underline>until a rebalance or liquidity event occurs</Underline>{' '}
              and that any such restricted access or delay may result in such
              tokens or assets diminishing in value.
            </CheckboxText>
          </CheckboxItem>

          <CheckboxItem>
            <LargeRoundCheckBox checked={checkbox3} onToggle={setCheckbox3} />
            <CheckboxText>
              I acknowledge that TempleDAO and related software are experimental
              and subject to change at any time without notice. I understand and
              accept <Underline>all the inherent risks</Underline> associated
              with TempleDAO, including (but not limited to) hacking risks,
              third-party risks and future technological development.
            </CheckboxText>
          </CheckboxItem>
        </CheckboxSection>
      </ScrollContainer>

      <SignButton onClick={handleSign} disabled={!canSign || isLoading}>
        {isLoading ? 'SIGNING...' : 'SIGN'}
      </SignButton>
    </Container>
  );
};

const Container = styled.div`
  display: flex;
  flex-direction: column;
  width: 90vw;
  max-width: 600px;
  padding: 32px 24px 24px 24px;
  gap: 24px;
  background: ${({ theme }) => theme.palette.black};

  ${breakpoints.phoneAndAbove(`
    padding: 40px 32px 32px 32px;
  `)}
`;

const Title = styled.h2`
  font-size: 32px;
  line-height: 1.2;
  text-align: center;
  color: ${({ theme }) => theme.palette.brandLight};
  margin: 0;

  ${breakpoints.phoneAndAbove(`
    font-size: 36px;
  `)}
`;

const ScrollContainer = styled.div`
  display: flex;
  flex-direction: column;
  gap: 20px;
  overflow-y: visible;
  padding-right: 8px;
`;

const IntroText = styled.p`
  font-size: 14px;
  line-height: 1.6;
  color: ${({ theme }) => theme.palette.brandLight};
  margin: 0;

  ${breakpoints.phoneAndAbove(`
    font-size: 16px;
  `)}
`;

const Link = styled.a`
  color: ${({ theme }) => theme.palette.brand};
  text-decoration: underline;
  cursor: pointer;

  &:hover {
    color: ${({ theme }) => theme.palette.brandLight};
  }
`;

const Underline = styled.span`
  text-decoration: underline;
`;

const CheckboxSection = styled.div`
  display: flex;
  flex-direction: column;
  gap: 20px;
`;

const CheckboxItem = styled.div`
  display: flex;
  gap: 12px;
  align-items: flex-start;
`;

const CheckboxText = styled.p`
  font-size: 13px;
  line-height: 1.5;
  color: ${({ theme }) => theme.palette.brandLight};
  margin: 0;
  flex: 1;

  ${breakpoints.phoneAndAbove(`
    font-size: 14px;
  `)}
`;

const SignButton = styled(Button)`
  width: 200px;
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
