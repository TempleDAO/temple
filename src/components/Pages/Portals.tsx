import React, {
  Dispatch,
  SetStateAction,
  useEffect,
  useLayoutEffect,
  useState,
} from 'react';
import styled, { keyframes } from 'styled-components';
import AltarEnter from './AltarEnter';
import AltarExit from './AltarExit';
import AltarDevotion from './AltarDevotion';
import BackButton from 'components/Button/BackButton';
import MetamaskButton from 'components/Button/MetamaskButton';
import portalImage from 'assets/images/PortalRoom.png';
import midGlow from 'assets/images/glow_center.png';
import leftGlow from 'assets/images/glow_left.png';
import rightGlow from 'assets/images/glow_right.png';
import scrollGlow from 'assets/images/glow_scroll.png';
import { PriceChart } from '../Charts/PriceChart';
import { getBgImgDimensions } from 'utils/imageSize';
import { CustomRoutingPage } from 'hooks/use-custom-spa-routing';

type BgDimension = {
  width: number;
  height: number;
  scaleH: number;
  scaleW: number;
  imageWidth: number;
  imageHeight: number;
};

enum Pages {
  Foyer,
  Left,
  Center,
  Right,
}

const PortalPage: CustomRoutingPage = ({ routingHelper }) => {
  // Used to determine door images size and position
  const [bgDimensions, setBgDimensions]: [
    BgDimension | undefined,
    Dispatch<SetStateAction<BgDimension | undefined>>
  ] = useState();

  // Change visibility of chart component
  const [chartVisible, setChartVisible] = useState(false);

  const { back, changePageTo } = routingHelper;

  // Update bgDimensions state
  function handleResize() {
    const backgroundDimensions = getBgImgDimensions(
      document.querySelector('#background'),
      portalImage
    );
    if (!backgroundDimensions) return;
    setBgDimensions(backgroundDimensions);
  }

  // Set event listeners for load and resize to handleResize()
  useLayoutEffect(() => {
    window.onload = () => handleResize();
    window.addEventListener('resize', () => handleResize());
    setTimeout(() => handleResize(), 500);
    return window.removeEventListener('resize', () => handleResize());
  }, []);

  return (
    <Background id="background" style={{ overflow: 'hidden' }}>
      {bgDimensions != null && (
        <>
          <MetamaskButton />
          <DoorGlow
            src={leftGlow}
            title="Devotion"
            onClick={() => changePageTo(AltarDevotion)}
            style={{
              transform: `scale(${0.5 * bgDimensions.scaleW}%)`,
              bottom: `${0.405 * bgDimensions.height}px`,
              left:
                bgDimensions.height == window.innerHeight
                  ? `${
                      bgDimensions.width * 0.17 -
                      (bgDimensions.width - window.innerWidth) / 2
                    }px`
                  : `${0.17 * bgDimensions.width}px`,
            }}
          />
          <DoorGlow
            src={midGlow}
            title="Enter"
            onClick={() => changePageTo(AltarEnter)}
            style={{
              transform: `scale(${0.5 * bgDimensions.scaleW}%)`,
              bottom: `${0.423 * bgDimensions.height}px`,
              left:
                bgDimensions.height == window.innerHeight
                  ? `${
                      bgDimensions.width * 0.415 -
                      (bgDimensions.width - window.innerWidth) / 2
                    }px`
                  : `${0.416 * bgDimensions.width}px`,
            }}
          />
          <DoorGlow
            src={rightGlow}
            title="Exit"
            onClick={() => changePageTo(AltarExit)}
            style={{
              transform: `scale(${0.5 * bgDimensions.scaleW}%)`,
              bottom: `${0.405 * bgDimensions.height}px`,
              left:
                bgDimensions.height == window.innerHeight
                  ? `${
                      bgDimensions.width * 0.66 -
                      (bgDimensions.width - window.innerWidth) / 2
                    }px`
                  : `${0.661 * bgDimensions.width}px`,
            }}
          />
          <DoorGlow
            src={scrollGlow}
            title="Scroll"
            onClick={() => setChartVisible(!chartVisible)}
            style={{
              transform: `scale(${0.5 * bgDimensions.scaleW}%)`,
              bottom: `${-0.018 * bgDimensions.height}px`,
              left:
                bgDimensions.height == window.innerHeight
                  ? `${
                      bgDimensions.width * 0.04 -
                      (bgDimensions.width - window.innerWidth) / 2
                    }px`
                  : `${0.037 * bgDimensions.width}px`,
            }}
          />
          <OffClick
            onClick={(e) => {
              if (chartVisible) {
                e.preventDefault();
                e.stopPropagation();
                setChartVisible(false);
              }
            }}
            style={{
              backgroundColor: chartVisible ? 'black' : 'transparent',
            }}
          />
          <ChartContainer
            style={{
              transform: chartVisible ? 'scale(100%)' : 'scale(0%)',
            }}
          >
            <PriceChart />
          </ChartContainer>
        </>
      )}
      <BackButton width={112} height={112} onClick={back} />
    </Background>
  );
};

const Background = styled.div`
  height: 100vh;
  width: 100vw;
  background-image: url(${portalImage});
  background-size: cover;
  background-repeat: no-repeat;
  background-position: center bottom;
  position: relative;
`;

const flicker = keyframes`
    0% {
      opacity: 0.3;
    }

    33% {
      opacity: 0.6;
    }

    60% {
      opacity: 0.4;
    }

    100% {
      opacity: 0.8;
    }
  `;

const DoorGlow = styled.img`
  position: absolute;
  transform-origin: bottom left;
  opacity: 0.75;
  transition: opacity 150ms;
  z-index: 1;
  &:hover {
    opacity: 1;
    cursor: pointer;
    animation: none;
  }
  animation: ${flicker} 3s infinite alternate ease-out;
`;

const OffClick = styled.div`
  position: absolute;
  height: 100vh;
  width: 100vw;
  z-index: 0;
  transition: background 300ms;
  opacity: 0.3;
`;

const ChartContainer = styled.div`
  position: absolute;
  bottom: 0;
  margin-left: 5vw;
  width: 90vw;
  height: 60vh;
  background: rgba(0, 0, 0, 0.95);
  z-index: 20;
  transition: transform 150ms;
`;

export default PortalPage;
