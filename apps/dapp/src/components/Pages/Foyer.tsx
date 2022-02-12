import React, { Dispatch, SetStateAction, useEffect, useState } from 'react';
import { Howl } from 'howler';
import RitualsPosters from 'components/Pages/RitualsMoviePoster';
// import Portals from 'components/Pages/Portals';
import BackButton from 'components/Button/BackButton';
import useUnmountableTrack from 'hooks/use-unmountable-track';
import bgImage from 'assets/images/foyer.jpg';
import midGlow from 'assets/images/mid-glow.png';
import leftGlow from 'assets/images/left-glow.png';
import rightGlow from 'assets/images/right-glow.png';
import foyerTrack from 'assets/sounds/foyer-bg-track.mp3';
import { getBgImgDimensions } from 'utils/imageSize';
import { CustomRoutingPageProps } from 'hooks/use-custom-spa-routing';
// import DashboardDoorPage from 'components/Pages/DashboardDoor';
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
  src: [foyerTrack],
  loop: true,
  volume: 0.15,
});

const FoyerPage = ({ routingHelper }: CustomRoutingPageProps) => {
  // Used to determine door images size and position
  const [bgDimensions, setBgDimensions]: [
    BgDimension | undefined,
    Dispatch<SetStateAction<BgDimension | undefined>>
  ] = useState();

  const { back, changePageTo } = routingHelper;

  useUnmountableTrack(track);

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
            src={leftGlow}
            title="Rituals"
            onClick={() => changePageTo('RitualsPosters')}
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
          <BackgroundItem
            src={midGlow}
            title="Altars"
            onClick={() => changePageTo('Portals')}
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
          <BackgroundItem
            src={rightGlow}
            title="Dashboard"
            onClick={() => changePageTo('DashboardDoor')}
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
    </>
  );
};

export default FoyerPage;
