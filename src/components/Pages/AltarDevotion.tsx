import React, { Dispatch, SetStateAction, useState } from 'react';
import Altars, { AMMView } from 'components/Pages/AmmAltars';
import BackButton from 'components/Button/BackButton';
import bgImage from 'assets/images/devotion_bg.jpg';
import glow from 'assets/images/devotion_glow.png';
import { getBgImgDimensions } from 'utils/imageSize';
import { CustomRoutingPage } from 'hooks/use-custom-spa-routing';
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

enum Pages {
  Foyer,
  Left,
  Center,
  Right,
}

const DevotionPage: CustomRoutingPage = ({ routingHelper }) => {
  // Used to determine door images size and position
  const [bgDimensions, setBgDimensions]: [
    BgDimension | undefined,
    Dispatch<SetStateAction<BgDimension | undefined>>
  ] = useState();

  const { back, changePageTo } = routingHelper;

  // Update bgDimensions state
  function handleResize(
    container: EventTarget & HTMLImageElement,
    src: string
  ) {
    const backgroundDimensions = getBgImgDimensions(container, src);
    if (!backgroundDimensions) return;
    setBgDimensions(backgroundDimensions);
  }

  return (
    <>
      <Background
        src={bgImage}
        onLoad={(e) => handleResize(e.currentTarget, bgImage)}
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
      <BackButton onClick={back} />
    </>
  );
};

export default DevotionPage;
