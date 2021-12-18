import React from 'react';
import styled, { css } from 'styled-components';
import Account from 'components/Pages/Account';
import Dashboard from 'components/Pages/Dashboard';
import Image from 'components/Image/Image';
import { Flex } from 'components/Layout/Flex';
import BackButton from 'components/Button/BackButton';
import talismanImage from 'assets/images/comingsoon.png';
import enclavesImage from 'assets/images/openingceremony.png';
import { CustomRoutingPage } from 'hooks/use-custom-spa-routing';

const DungeonPoster: CustomRoutingPage = ({ routingHelper }) => {
  const { back, changePageTo } = routingHelper;

  return (
    <>
      <H1>DUNGEONS</H1>
      <button onClick={() => changePageTo(Dashboard)}>Dashboard</button>
      <button onClick={() => changePageTo(Account)}>Account</button>
      <BackButton width={112} height={112} onClick={back} />
    </>
  );
};

interface PosterColumnProps {
  isIndented?: boolean;
}

const PosterColumn = styled(Flex)<PosterColumnProps>`
  h3 {
    margin-top: 4rem;
  }
  ${(props) =>
    props.isIndented
      ? css`
          margin-top: 4rem;
        `
      : css`
          margin-bottom: 4rem;
        `};
`;

const H1 = styled.h1`
  width: 100%;
  text-align: center;
`;

const RedactedSection = styled.div`
  background-color: ${({ theme }) => theme.palette.grayOpaque};
  min-height: 350px;
  min-width: 350px;
`;

const ImageLabelWrapper = styled.div`
  height: 350px;
  width: 350px;
`;

const ImageLabelOverlay = styled(Flex)`
  position: absolute;
  height: 100%;
  width: 100%;
`;

const ImageLabel = styled.div`
  margin: 1rem;
  padding: 1rem 0;
  background-color: ${({ theme }) => theme.palette.dark75};
  h2 {
    margin: 0;
  }
`;

export default DungeonPoster;
