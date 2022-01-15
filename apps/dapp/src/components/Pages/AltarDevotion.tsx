import React, { Dispatch, SetStateAction, useEffect, useState } from 'react';
import { Howl } from 'howler';
import Altars, { AMMView } from 'components/Pages/AmmAltars';
import BackButton from 'components/Button/BackButton';
import bgImage from 'assets/images/devotion_bg.jpg';
import glow from 'assets/images/devotion_glow.png';
import devotionAltarTrack from 'assets/sounds/devotion-altar-bg-track.mp3';
import { getBgImgDimensions } from 'utils/imageSize';
import { CustomRoutingPage } from 'hooks/use-custom-spa-routing';
import useCancellableTrack from 'hooks/use-cancellable-track';
import { Background } from 'components/BackgroundItem/Background';
import { BackgroundItem } from 'components/BackgroundItem/BackgroundItem';

type BgDimension = {
  width: number;
  height: number;
  scaleH: number;
  scaleW: number;
  imageWidth: number;
  imageHeight: number;
};

const soundscape = new Howl({
  src: [devotionAltarTrack],
  loop: true,
  volume: 0.15,
});

const DevotionPage: CustomRoutingPage = ({ routingHelper }) => {
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
        <BackgroundItem
          src={glow}
          title="Buy the Dip"
          onClick={() =>
            changePageTo((props) => (
              //@ts-ignore
              <Altars {...props} view={AMMView.BTFD} />
            ))
          }
          style={{
            transform: `scale(${0.99 * bgDimensions.scaleW}%)`,
            bottom: `${0.391 * bgDimensions.height}px`,
            left:
              bgDimensions.height == window.innerHeight
                ? `${
                    bgDimensions.width * 0.197 -
                    (bgDimensions.width - window.innerWidth) / 2
                  }px`
                : `${0.197 * bgDimensions.width}px`,
          }}
        />
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

export default DevotionPage;
