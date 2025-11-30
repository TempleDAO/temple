import React, { useState, useRef } from 'react';
import styled from 'styled-components';
import Image from 'components/Image/Image';
import { Flex } from 'components/Layout/Flex';
import eyeImage from 'assets/images/no-pupil-eye.png';
import { Button } from 'components/Button/Button';
import wallet from 'assets/icons/wallet.svg?react';
import { useConnectWallet } from '@web3-onboard/react';

export default function IntroNotConnected() {
  const [cursorCoords, setCursorCoords] = useState([0, 0]);
  const imageRef = useRef<HTMLDivElement>(null);
  const [{}, connect] = useConnectWallet();

  const pupilStyle = {
    transform: getPupilTransform(imageRef, cursorCoords),
  };

  function getPupilTransform(
    imageRef: React.RefObject<HTMLDivElement>,
    cursorCoords: number[]
  ) {
    const headerHeight = 80;

    if (imageRef.current) {
      const x = 0 - window.innerWidth / 2 + cursorCoords[0];
      const y =
        0 -
        window.innerHeight / 2 +
        imageRef.current.offsetTop +
        cursorCoords[1] -
        headerHeight;

      const values = normalizeTransform(x, y);
      return `translate(${values[0]}px, ${values[1]}px)`;
    }
  }

  function normalizeTransform(x: number, y: number) {
    if (Math.abs(x) + Math.abs(y) <= 10) {
      return [x, y];
    }

    const multipleOfLength = (Math.abs(x) + Math.abs(y)) / 10;

    return [x / multipleOfLength, y / multipleOfLength];
  }

  return (
    <PageContainer onMouseMove={(e) => setCursorCoords([e.clientX, e.clientY])}>
      <Flex
        layout={{
          kind: 'container',
          direction: 'column',
          alignItems: 'center',
        }}
      >
        <Copy>
          <strong>Templar, you are seen.</strong>
          <br />
          <br />
          With each stone you lay the Temple stands taller.
          <br />
          <br />
          Now the Temple gives back to you.
        </Copy>

        <div ref={imageRef}>
          <EyeArea
            layout={{
              kind: 'container',
              justifyContent: 'center',
              alignItems: 'center',
            }}
          >
            <Image src={eyeImage} fillContainer />
            <Pupil style={pupilStyle} />
          </EyeArea>
        </div>
      </Flex>
      <TradeButton
        onClick={() => {
          connect();
        }}
        style={{ margin: 'auto', whiteSpace: 'nowrap' }}
      >
        <WalletIcon />
        Connect Wallet
      </TradeButton>
    </PageContainer>
  );
}

const PageContainer = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 40px;
`;

const Copy = styled.p`
  text-align: center;
  margin-bottom: 3rem;
`;

const EyeArea = styled(Flex)`
  width: 18.75rem;
  height: 18.75rem;
`;

const Pupil = styled.div`
  position: absolute;
  height: 1rem;
  width: 1rem;
  background-color: ${({ theme }) => theme.palette.brand};
  border-radius: 1rem;
`;

const WalletIcon = styled(wallet)`
  min-width: 24px;
  min-height: 24px;
`;

const TradeButton = styled(Button)`
  padding: 12px 20px 12px 20px;
  width: ${(props) => props.width || 'min-content'};
  height: min-content;
  background: linear-gradient(90deg, #58321a 20%, #95613f 84.5%);
  border: 1px solid ${({ theme }) => theme.palette.brandDark};
  box-shadow: 0px 0px 20px 0px #de5c0666;
  border-radius: 10px;
  font-size: 16px;
  line-height: 20px;
  font-weight: 700;
  text-transform: uppercase;
  color: ${({ theme }) => theme.palette.brandLight};

  /* Flex settings for centering button content */
  display: flex;
  align-items: center;
  justify-content: center;

  /* Flex settings for the span inside the button */
  & > span {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 12px;
  }
`;
