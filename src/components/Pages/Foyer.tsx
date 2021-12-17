import React, { Dispatch, SetStateAction, useEffect, useState } from 'react';
import styled, { keyframes } from 'styled-components';
import foyerImage from 'assets/images/foyer.png';
import midGlow from 'assets/images/mid-glow.png';
import leftGlow from 'assets/images/left-glow.png';
import rightGlow from 'assets/images/right-glow.png';
import { getBgImgDimensions } from 'utils/imageSize';

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

const FoyerPage = () => {
  const [visiblePage, setVisiblePage] = useState(Pages.Foyer);

  // Used to determine door images size and position
  const [bgDimensions, setBgDimensions]: [
    BgDimension | undefined,
    Dispatch<SetStateAction<BgDimension | undefined>>
  ] = useState();

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
  useEffect(() => {
    window.onload = () => handleResize();
    window.addEventListener('resize', () => handleResize());
    return window.removeEventListener('resize', () => handleResize());
  }, []);

  return (
    <>
      {visiblePage == Pages.Foyer ? (
        <Background id="background">
          {bgDimensions != null && (
            <>
              <DoorGlow
                src={leftGlow}
                title="Rituals"
                onClick={() => setVisiblePage(Pages.Left)}
                style={{
                  transform: `scale(${0.965 * bgDimensions.scaleW}%)`,
                  bottom: `${0.234 * bgDimensions.height}px`,
                  left:
                    bgDimensions.height == window.innerHeight
                      ? `${
                          bgDimensions.imageWidth * 0.425 -
                          (bgDimensions.imageWidth - window.innerWidth) / 2
                        }px`
                      : `${0.18 * bgDimensions.width}px`,
                }}
              />
              <DoorGlow
                src={midGlow}
                title="Altars"
                onClick={() => setVisiblePage(Pages.Center)}
                style={{
                  transform: `scale(${0.97 * bgDimensions.scaleW}%)`,
                  bottom: `${0.448 * bgDimensions.height}px`,
                  left:
                    bgDimensions.height == window.innerHeight
                      ? `${
                          bgDimensions.imageWidth * 0.485 -
                          (bgDimensions.imageWidth - window.innerWidth) / 2
                        }px`
                      : `${0.439 * bgDimensions.width}px`,
                }}
              />
              <DoorGlow
                src={rightGlow}
                title="Dungeon" // TODO: Update title
                onClick={() => setVisiblePage(Pages.Right)}
                style={{
                  transform: `scale(${0.965 * bgDimensions.scaleW}%)`,
                  bottom: `${0.238 * bgDimensions.height}px`,
                  left:
                    bgDimensions.height == window.innerHeight
                      ? `${
                          bgDimensions.imageWidth * 0.545 -
                          (bgDimensions.imageWidth - window.innerWidth) / 2
                        }px`
                      : `${0.685 * bgDimensions.width}px`,
                }}
              />
            </>
          )}
        </Background>
      ) : visiblePage == Pages.Left ? (
        <p>Left</p>
      ) : visiblePage == Pages.Center ? (
        <p>center</p>
      ) : (
        <p>right</p>
      )}
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
