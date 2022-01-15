import React from 'react';
import styled, { css } from 'styled-components';
import Image from 'components/Image/Image';
import { Flex } from 'components/Layout/Flex';
import BackButton from 'components/Button/BackButton';
import talismanImage from 'assets/images/comingsoon.png';
import enclavesImage from 'assets/images/openingceremony.png';
import { CustomRoutingPage } from 'hooks/use-custom-spa-routing';

const RitualsMoviePoster: CustomRoutingPage = ({ routingHelper }) => {
  const { back } = routingHelper;

  return (
    <>
      <Flex
        layout={{
          kind: 'container',
          direction: 'row',
          justifyContent: 'center',
        }}
      >
        <h1>RITUALS</h1>
      </Flex>

      <Flex
        layout={{
          kind: 'container',
          direction: 'row',
          justifyContent: 'space-evenly',
        }}
      >
        <PosterColumn
          layout={{
            kind: 'item',
            direction: 'column',
            col: 'third',
            justifyContent: 'center',
          }}
          isIndented
        >
          <Flex layout={{ kind: 'container', justifyContent: 'center' }}>
            <ImageLabelWrapper>
              <ImageLabelOverlay
                layout={{
                  kind: 'container',
                  direction: 'column',
                  justifyContent: 'center',
                }}
              >
                <ImageLabel>Reopening soon</ImageLabel>
              </ImageLabelOverlay>
              <Image src={enclavesImage} alt={''} fillContainer={true} />
            </ImageLabelWrapper>
          </Flex>
          <h3 className={'color-brand75 align-text-center'}>ENCLAVES</h3>
        </PosterColumn>

        <PosterColumn
          layout={{
            kind: 'item',
            direction: 'column',
            col: 'third',
            justifyContent: 'center',
          }}
        >
          <Flex layout={{ kind: 'container', justifyContent: 'center' }}>
            <ImageLabelWrapper>
              <ImageLabelOverlay
                layout={{
                  kind: 'container',
                  direction: 'column',
                  justifyContent: 'center',
                }}
              >
                <ImageLabel>Opening soon</ImageLabel>
              </ImageLabelOverlay>
              <Image src={talismanImage} alt={''} fillContainer={true} />
            </ImageLabelWrapper>
          </Flex>
          <h3 className={'color-brand75 align-text-center'}>TALISMAN</h3>
        </PosterColumn>

        <PosterColumn
          layout={{
            kind: 'item',
            direction: 'column',
            col: 'third',
            justifyContent: 'center',
          }}
          isIndented
        >
          <Flex layout={{ kind: 'container', justifyContent: 'center' }}>
            <ImageLabelWrapper>
              <ImageLabelOverlay
                layout={{
                  kind: 'container',
                  direction: 'column',
                  justifyContent: 'center',
                }}
              >
                <ImageLabel>Opening soon</ImageLabel>
              </ImageLabelOverlay>
              <RedactedSection />
            </ImageLabelWrapper>
          </Flex>
          <h3 className={'color-brand75 align-text-center'}>REDACTED</h3>
        </PosterColumn>
      </Flex>
      <Flex
        layout={{
          kind: 'item',
          direction: 'row',
          justifyContent: 'center',
        }}
      ></Flex>
      <BackButton onClick={back} />
    </>
  );
};

interface PosterColumnProps {
  isIndented?: boolean;
}

const PosterColumn = styled(Flex)<PosterColumnProps>`
  h3 {
    margin-top: 2rem;
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

const RedactedSection = styled.div`
  background-color: ${({ theme }) => theme.palette.grayOpaque};
  min-height: 21rem;
  min-width: 21rem;
`;

const ImageLabelWrapper = styled.div`
  height: 21rem;
  width: 21rem;
  position: relative;
`;

const ImageLabelOverlay = styled(Flex)`
  position: absolute;
  height: 100%;
  width: 100%;
`;

const ImageLabel = styled.h2`
  text-align: center;
  background-color: ${({ theme }) => theme.palette.dark75};
  color: ${({ theme }) => theme.palette.light};
`;

export default RitualsMoviePoster;
