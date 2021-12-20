import React, { Dispatch, SetStateAction, useEffect, useState } from 'react';
import Dashboard from 'components/Pages/Dashboard';
import Account from 'components/Pages/Account';
import BackButton from 'components/Button/BackButton';
import bgImage from 'assets/images/dashboardroom_bg.jpg';
import glowLeft from 'assets/images/dashboardroom_glowleft.png';
import glowRight from 'assets/images/dashboardroom_glowright.png';
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

const DashboardDoorPage: CustomRoutingPage = ({ routingHelper }) => {
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
            title="Dashboard"
            onClick={() => changePageTo(Dashboard)}
            style={{
              transform: `scale(${0.98 * bgDimensions.scaleW}%)`,
              bottom: `${0.217 * bgDimensions.height}px`,
              left:
                bgDimensions.height == window.innerHeight
                  ? `${
                      bgDimensions.width * 0.172 -
                      (bgDimensions.width - window.innerWidth) / 2
                    }px`
                  : `${0.172 * bgDimensions.width}px`,
            }}
          />
          <BackgroundItem
            src={glowRight}
            title="Account"
            onClick={() => changePageTo(Account)}
            style={{
              transform: `scale(${0.98 * bgDimensions.scaleW}%)`,
              bottom: `${0.22 * bgDimensions.height}px`,
              left:
                bgDimensions.height == window.innerHeight
                  ? `${
                      bgDimensions.width * 0.624 -
                      (bgDimensions.width - window.innerWidth) / 2
                    }px`
                  : `${0.624 * bgDimensions.width}px`,
            }}
          />
        </>
      )}
      <BackButton width={112} height={112} onClick={back} />
    </>
  );
};

export default DashboardDoorPage;
