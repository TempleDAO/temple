import React, {
  Dispatch,
  SetStateAction,
  useLayoutEffect,
  useState,
} from 'react';
import styled, { keyframes } from 'styled-components';
import RitualsPosters from 'components/Pages/RitualsMoviePoster';
import Portals from 'components/Pages/Portals';
import BackButton from 'components/Button/BackButton';
import MetamaskButton from 'components/Button/MetamaskButton';
import foyerImage from 'assets/images/foyer.png';
import midGlow from 'assets/images/mid-glow.png';
import leftGlow from 'assets/images/left-glow.png';
import rightGlow from 'assets/images/right-glow.png';
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

const FoyerPage: CustomRoutingPage = ({ routingHelper }) => {
  // Used to determine door images size and position
  const [bgDimensions, setBgDimensions]: [
    BgDimension | undefined,
    Dispatch<SetStateAction<BgDimension | undefined>>
  ] = useState();

  const { back, changePageTo } = routingHelper;

  // Update bgDimensions state
  function handleResize() {
    const backgroundDimensions = getBgImgDimensions(
      document.querySelector('#background'),
      foyerImage
    );
    if (!backgroundDimensions) return;
    setBgDimensions(backgroundDimensions);
  }

  // Set event listeners for load and resize to handleResize()
  useLayoutEffect(() => {
    window.onload = () => handleResize();
    window.addEventListener('resize', () => handleResize());
    setTimeout(() => handleResize(), 500);
    return () => {
      window.removeEventListener('resize', () => handleResize());
      window.onload = null;
    };
  }, []);

  return (
    <>
      <Background id="background">
        {bgDimensions != null && (
          <>
            <DoorGlow
              src={leftGlow}
              title="Rituals"
              onClick={() => changePageTo(RitualsPosters)}
              style={{
                transform: `scale(${0.965 * bgDimensions.scaleW}%)`,
                bottom: `${0.234 * bgDimensions.height}px`,
                left:
                  bgDimensions.height == window.innerHeight
                    ? `${
                        bgDimensions.width * 0.18 -
                        (bgDimensions.width - window.innerWidth) / 2
                      }px`
                    : `${0.18 * bgDimensions.width}px`,
              }}
            />
            <DoorGlow
              src={midGlow}
              title="Altars"
              onClick={() => changePageTo(Portals)}
              style={{
                transform: `scale(${0.97 * bgDimensions.scaleW}%)`,
                bottom: `${0.448 * bgDimensions.height}px`,
                left:
                  bgDimensions.height == window.innerHeight
                    ? `${
                        bgDimensions.width * 0.439 -
                        (bgDimensions.width - window.innerWidth) / 2
                      }px`
                    : `${0.439 * bgDimensions.width}px`,
              }}
            />
            <DoorGlow
              src={rightGlow}
              title="Dashboard"
              // onClick={() => changePageTo(Portals)} // TODO: Add route
              style={{
                transform: `scale(${0.965 * bgDimensions.scaleW}%)`,
                bottom: `${0.238 * bgDimensions.height}px`,
                left:
                  bgDimensions.height == window.innerHeight
                    ? `${
                        bgDimensions.width * 0.685 -
                        (bgDimensions.width - window.innerWidth) / 2
                      }px`
                    : `${0.685 * bgDimensions.width}px`,
              }}
            />
          </>
        )}
        <BackButton onClick={back} />
      </Background>
    </>
  );
};

const Background = styled.div`
  height: 100vh;
  width: 100vw;
  background-image: url(${foyerImage});
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
export default FoyerPage;
