import React, { Dispatch, SetStateAction, useEffect, useState } from 'react';
import styled, { keyframes } from 'styled-components';
import Altars, { AMMView } from 'components/Pages/AmmAltars';
import BackButton from 'components/Button/BackButton';
import bgImage from 'assets/images/altar-enter-bg.jpg';
import glowLeft from 'assets/images/AMM_leftcut.png';
import glowRight from 'assets/images/AMM_rightglow.png';
import { getBgImgDimensions } from 'utils/imageSize';
import { CustomRoutingPage } from 'hooks/use-custom-spa-routing';
import { BackgroundItem } from 'components/BackgroundItem/BackgroundItem';
import { Background } from 'components/BackgroundItem/Background';

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
  function handleResize(container: EventTarget & HTMLImageElement) {
    const backgroundDimensions = getBgImgDimensions(container, container.src);
    if (!backgroundDimensions) return;
    setBgDimensions(backgroundDimensions);
  }

  useEffect(() => {
    return () => {
      window.onresize = null;
    };
  }, []);

  return (
    <>
      <Background
        src={bgImage}
        onLoad={(e) => {
          const el = e.currentTarget;
          window.onresize = () => {
            handleResize(el);
          };
          handleResize(el);
        }}
      />
      {bgDimensions != null && (
        <>
          <BackgroundItem
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
          <BackgroundItem
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
    </>
  );
};

export default EnterPage;
