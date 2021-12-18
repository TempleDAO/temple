import React, {
  Dispatch,
  SetStateAction,
  useLayoutEffect,
  useState,
} from 'react';
import styled, { keyframes } from 'styled-components';
import RitualsPosters from 'components/Pages/RitualsMoviePoster';
import BackButton from 'components/Button/BackButton';
import bgImage from 'assets/images/unstakequeue_0_unlit.png';
import triangle from 'assets/images/triangle.svg';
import glow1 from 'assets/images/1_glow.png';
import glow2 from 'assets/images/2_glow.png';
import glow3 from 'assets/images/3_glow.png';
import glow4 from 'assets/images/4_glow.png';
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

const ExitPage = () => {
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
      bgImage
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
          <DoorGlow
            src={glow1}
            title="Enter"
            // onClick={() => changePageTo(RitualsPosters)}
            style={{
              transform: `scale(${0.5 * bgDimensions.scaleW}%)`,
              bottom: `${-0.04 * bgDimensions.height}px`,
              left:
                bgDimensions.height == window.innerHeight
                  ? `${
                      bgDimensions.width * 0.151 -
                      (bgDimensions.width - window.innerWidth) / 2
                    }px`
                  : `${0.151 * bgDimensions.width}px`,
            }}
          />
          <DoorGlow
            src={glow2}
            title="Enter"
            // onClick={() => changePageTo(RitualsPosters)}
            style={{
              transform: `scale(${0.5 * bgDimensions.scaleW}%)`,
              bottom: `${-0.035 * bgDimensions.height}px`,
              left:
                bgDimensions.height == window.innerHeight
                  ? `${
                      bgDimensions.width * 0.309 -
                      (bgDimensions.width - window.innerWidth) / 2
                    }px`
                  : `${0.309 * bgDimensions.width}px`,
            }}
          />
          <DoorGlow
            src={glow3}
            title="Enter"
            // onClick={() => changePageTo(RitualsPosters)}
            style={{
              transform: `scale(${0.5 * bgDimensions.scaleW}%)`,
              bottom: `${-0.036 * bgDimensions.height}px`,
              left:
                bgDimensions.height == window.innerHeight
                  ? `${
                      bgDimensions.width * 0.54 -
                      (bgDimensions.width - window.innerWidth) / 2
                    }px`
                  : `${0.54 * bgDimensions.width}px`,
            }}
          />
          <DoorGlow
            src={glow4}
            title="Enter"
            // onClick={() => changePageTo(RitualsPosters)}
            style={{
              transform: `scale(${0.5 * bgDimensions.scaleW}%)`,
              bottom: `${-0.03 * bgDimensions.height}px`,
              left:
                bgDimensions.height == window.innerHeight
                  ? `${
                      bgDimensions.width * 0.697 -
                      (bgDimensions.width - window.innerWidth) / 2
                    }px`
                  : `${0.697 * bgDimensions.width}px`,
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
  background-image: url(${bgImage});
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
export default ExitPage;
