import React, { Dispatch, SetStateAction, useEffect, useState } from 'react';
import { Howl } from 'howler';
import { AMMView } from 'components/Pages/AmmAltars';
import BackButton from 'components/Button/BackButton';
import bgImage from 'assets/images/altar-enter-bg.jpg';
import glowLeft from 'assets/images/AMM_leftcut.png';
import glowRight from 'assets/images/AMM_rightglow.png';
import enterAltarTrack from 'assets/sounds/enter-altar-bg-track.mp3';
import { getBgImgDimensions } from 'utils/imageSize';
import { BackgroundItem } from 'components/BackgroundItem/BackgroundItem';
import { Background } from 'components/BackgroundItem/Background';
import useCancellableTrack from 'hooks/use-cancellable-track';
import { CustomRoutingPageProps } from 'hooks/use-custom-spa-routing';

type BgDimension = {
  width: number;
  height: number;
  scaleH: number;
  scaleW: number;
  imageWidth: number;
  imageHeight: number;
};

const soundscape = new Howl({
  src: [enterAltarTrack],
  loop: true,
  volume: 0.15,
});

const EnterPage = ({ routingHelper }: CustomRoutingPageProps) => {
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
              changePageTo(AMMView.BUY)
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
              changePageTo(AMMView.MINT)
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
      <BackButton
        onClick={() => {
          stopTrack();
          back();
        }}
      />
    </>
  );
};

export default EnterPage;
