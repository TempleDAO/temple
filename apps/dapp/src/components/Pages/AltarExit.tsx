import React, { Dispatch, SetStateAction, useEffect, useState } from 'react';
import { Howl } from 'howler';
import { AMMView } from 'components/Pages/AmmAltars';
import BackButton from 'components/Button/BackButton';
import bgImage from 'assets/images/altar-exit.jpg';
import glow1 from 'assets/images/1_glow.png';
import glow2 from 'assets/images/2_glow.png';
import glow3 from 'assets/images/3_glow.png';
import glow4 from 'assets/images/4_glow.png';
import exitAltarTrack from 'assets/sounds/exit-altar-bg-track.mp3';
import { getBgImgDimensions } from 'utils/imageSize';
import { CustomRoutingPageProps } from 'hooks/use-custom-spa-routing';
import { BackgroundItem } from 'components/BackgroundItem/BackgroundItem';
import { Background } from 'components/BackgroundItem/Background';
import useCancellableTrack from 'hooks/use-cancellable-track';

type BgDimension = {
  width: number;
  height: number;
  scaleH: number;
  scaleW: number;
  imageWidth: number;
  imageHeight: number;
};

const soundscape = new Howl({
  src: [exitAltarTrack],
  loop: true,
  volume: 0.15,
});

const ExitPage = ({ routingHelper }: CustomRoutingPageProps) => {
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

  const stopTrack = useCancellableTrack(soundscape);

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
            src={glow1}
            title="Unlock"
            onClick={() => changePageTo(AMMView.UNLOCK)}
            style={{
              transform: `scale(${1 * bgDimensions.scaleW}%)`,
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
          <BackgroundItem
            src={glow2}
            title="Join Queue"
            onClick={() => changePageTo(AMMView.JOIN_QUEUE)}
            style={{
              transform: `scale(${1 * bgDimensions.scaleW}%)`,
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
          <BackgroundItem
            src={glow3}
            title="Withdraw"
            onClick={() => changePageTo(AMMView.WITHDRAW_TEMPLE)}
            style={{
              transform: `scale(${1 * bgDimensions.scaleW}%)`,
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
          <BackgroundItem
            src={glow4}
            title="Sell"
            onClick={() => changePageTo(AMMView.SELL)}
            style={{
              transform: `scale(${1 * bgDimensions.scaleW}%)`,
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
      <BackButton
        onClick={() => {
          stopTrack();
          back();
        }}
      />
    </div>
  );
};

export default ExitPage;
