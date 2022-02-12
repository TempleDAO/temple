import React, { Dispatch, SetStateAction, useEffect, useState } from 'react';
import { Howl } from 'howler';
import styled from 'styled-components';
import useUnmountableTrack from 'hooks/use-unmountable-track';
import doorwaysToAltarsTrack from 'assets/sounds/doorways-to-altars-bg-track.mp3';
import BackButton from 'components/Button/BackButton';
import bgImage from 'assets/images/PortalRoom.jpg';
import midGlow from 'assets/images/glow_center.png';
import leftGlow from 'assets/images/glow_left.png';
import rightGlow from 'assets/images/glow_right.png';
import scrollGlow from 'assets/images/glow_scroll.png';
import { PriceChart } from 'components/Charts/PriceChart';
import { getBgImgDimensions } from 'utils/imageSize';
import { CustomRoutingPageProps } from 'hooks/use-custom-spa-routing';
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

const track = new Howl({
  src: [doorwaysToAltarsTrack],
  loop: true,
  volume: 0.15,
});

const PortalPage = ({ routingHelper, preloadPages }: CustomRoutingPageProps) => {
  // Used to determine door images size and position
  const [bgDimensions, setBgDimensions]: [
    BgDimension | undefined,
    Dispatch<SetStateAction<BgDimension | undefined>>
  ] = useState();

  React.useEffect(() => {
    if (preloadPages) {
      preloadPages();
    }
  }, []);

  // Change visibility of chart component
  const [chartVisible, setChartVisible] = useState(false);

  const { back, changePageTo } = routingHelper;

  // Update bgDimensions state
  function handleResize(container: EventTarget & HTMLImageElement) {
    const backgroundDimensions = getBgImgDimensions(container, container.src);
    if (!backgroundDimensions) return;
    setBgDimensions(backgroundDimensions);
  }

  useUnmountableTrack(track);

  useEffect(() => {
    return () => {
      window.onresize = null;
    };
  }, []);

  return (
    <div
      style={{
        height: '100vh',
        width: '100vw',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
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
            src={leftGlow}
            title="Devotion"
            onClick={() => changePageTo('AltarDevotion')}
            style={{
              transform: `scale(${0.99 * bgDimensions.scaleW}%)`,
              bottom: `${0.443 * bgDimensions.height}px`,
              left:
                bgDimensions.height == window.innerHeight
                  ? `${
                      bgDimensions.width * 0.17 -
                      (bgDimensions.width - window.innerWidth) / 2
                    }px`
                  : `${0.17 * bgDimensions.width}px`,
            }}
          />
          <BackgroundItem
            src={midGlow}
            title="Enter"
            onClick={() => changePageTo('AltarEnter')}
            style={{
              transform: `scale(${0.99 * bgDimensions.scaleW}%)`,
              bottom: `${0.466 * bgDimensions.height}px`,
              left:
                bgDimensions.height == window.innerHeight
                  ? `${
                      bgDimensions.width * 0.416 -
                      (bgDimensions.width - window.innerWidth) / 2
                    }px`
                  : `${0.416 * bgDimensions.width}px`,
            }}
          />
          <BackgroundItem
            src={rightGlow}
            title="Exit"
            onClick={() => changePageTo('AltarExit')}
            style={{
              transform: `scale(${0.99 * bgDimensions.scaleW}%)`,
              bottom: `${0.443 * bgDimensions.height}px`,
              left:
                bgDimensions.height == window.innerHeight
                  ? `${
                      bgDimensions.width * 0.661 -
                      (bgDimensions.width - window.innerWidth) / 2
                    }px`
                  : `${0.661 * bgDimensions.width}px`,
            }}
          />
          <BackgroundItem
            src={scrollGlow}
            title="Scroll"
            onClick={() => setChartVisible(!chartVisible)}
            style={{
              transform: `scale(${1 * bgDimensions.scaleW}%)`,
              bottom: `${-0.018 * bgDimensions.height}px`,
              left:
                bgDimensions.height == window.innerHeight
                  ? `${
                      bgDimensions.width * 0.037 -
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
      <BackButton onClick={back} />
    </div>
  );
};

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
  /* TODO: user existing or add this as new theme color */
  background: rgba(0, 0, 0, 0.95);
  z-index: 20;
  transition: transform 150ms;
`;

export default PortalPage;
