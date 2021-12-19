import React, {
  Dispatch,
  SetStateAction,
  useLayoutEffect,
  useState,
} from 'react';
import styled, { keyframes } from 'styled-components';
import Altars, { AMMView } from 'components/Pages/AmmAltars';
import BackButton from 'components/Button/BackButton';
import bgImage from 'assets/images/altar-enter-bg.jpg';
import glowLeft from 'assets/images/AMM_leftcut.png';
import glowRight from 'assets/images/AMM_rightglow.png';
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

const EnterPage: CustomRoutingPage = ({ routingHelper }) => {
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
    return () => {
      window.removeEventListener('resize', () => handleResize());
      window.onload = null;
    };
  }, []);

  return (
    <Background id="background" style={{ overflow: 'hidden' }}>
      {bgDimensions != null && (
        <>
          <DoorGlow
            src={glowLeft}
            title="Buy"
            onClick={() =>
              changePageTo((props) => (
                //@ts-ignore
                <Altars {...props} view={AMMView.BUY} />
              ))
            }
            style={{
              transform: `scale(${1 * bgDimensions.scaleW}%)`,
              bottom: `${0.02 * bgDimensions.height}px`,
              left:
                bgDimensions.height == window.innerHeight
                  ? `${
                      bgDimensions.width * 0.0 -
                      (bgDimensions.width - window.innerWidth) / 2
                    }px`
                  : `${0.0 * bgDimensions.width}px`,
            }}
          />
          <DoorGlow
            src={glowRight}
            title="Stake"
            onClick={() =>
              changePageTo((props) => (
                //@ts-ignore
                <Altars {...props} view={AMMView.STAKE} />
              ))
            }
            style={{
              transform: `scale(${1 * bgDimensions.scaleW}%)`,
              bottom: `${0.042 * bgDimensions.height}px`,
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
export default EnterPage;
