import React, {
  Dispatch,
  SetStateAction,
  useLayoutEffect,
  useState,
} from 'react';
import styled, { keyframes } from 'styled-components';
import RitualsPosters from 'components/Pages/RitualsMoviePoster';
import BackButton from 'components/Button/BackButton';
import portalImage from 'assets/images/PortalRoom.png';
import triangle from 'assets/images/triangle.svg';
import midGlow from 'assets/images/glow_center.png';
import leftGlow from 'assets/images/glow_left.png';
import rightGlow from 'assets/images/glow_right.png';
import scrollGlow from 'assets/images/glow_scroll.png';
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

const PortalPage = () => {
  // Used to determine door images size and position
  const [bgDimensions, setBgDimensions]: [
    BgDimension | undefined,
    Dispatch<SetStateAction<BgDimension | undefined>>
  ] = useState();

  //   const { back, changePageTo } = routingHelper;

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
    setTimeout(() => handleResize(), 200);
    return window.removeEventListener('resize', () => handleResize());
  }, []);

  return (
    <Background id="background" style={{ overflow: 'hidden' }}>
      {bgDimensions != null && (
        <>
          <DoorGlow
            src={leftGlow}
            title="Enter"
            // onClick={() => changePageTo(RitualsPosters)}
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
            title="Devotion"
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
        </>
      )}
      {/* <BackButton width={112} height={112} onClick={back} /> */}
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
  &:hover {
    opacity: 1;
    cursor: pointer;
    animation: none;
  }
  animation: ${flicker} 3s infinite alternate ease-out;
`;
export default PortalPage;
