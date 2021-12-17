import React from 'react';
import styled, { css } from 'styled-components';
import Image from 'components/Image/Image';
import { Flex } from 'components/Layout/Flex';
import talismanImage from 'assets/images/comingsoon.png';
import enclavesImage from 'assets/images/openingceremony.png';
import triangle from 'assets/images/triangle.svg';


const RitualsMoviePoster = () => {
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
          <Flex layout={{ kind: 'container' }}>
            <ImageLabelWrapper>
              <ImageLabelOverlay
                layout={{
                  kind: 'container',
                  direction: 'column',
                  justifyContent: 'center',
                }}
              >
                <ImageLabel>
                  <h2 className={'color-light align-text-center opaque'}>
                    Reopening soon
                  </h2>
                </ImageLabel>
              </ImageLabelOverlay>
              <Image src={enclavesImage} alt={''} fillContainer={true} />
            </ImageLabelWrapper>
          </Flex>

          <h3 className={'color-light align-text-center'}>ENCLAVES</h3>
        </PosterColumn>

        <PosterColumn
          layout={{
            kind: 'item',
            direction: 'column',
            col: 'third',
            justifyContent: 'center',
          }}
        >
          <Flex layout={{ kind: 'container' }}>
            <ImageLabelWrapper>
              <ImageLabelOverlay
                layout={{
                  kind: 'container',
                  direction: 'column',
                  justifyContent: 'center',
                }}
              >
                <ImageLabel>
                  <h2 className={'color-light align-text-center opaque'}>
                    Opening soon
                  </h2>
                </ImageLabel>
              </ImageLabelOverlay>
              <Image src={talismanImage} alt={''} fillContainer={true} />
            </ImageLabelWrapper>
          </Flex>
          <h3 className={'color-light align-text-center'}>TALISMAN</h3>
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
          <Flex layout={{ kind: 'container' }}>
            <ImageLabelWrapper>
              <ImageLabelOverlay
                layout={{
                  kind: 'container',
                  direction: 'column',
                  justifyContent: 'center',
                }}
              >
                <ImageLabel>
                  <h2 className={'color-light align-text-center opaque'}>
                    Opening soon
                  </h2>
                </ImageLabel>
              </ImageLabelOverlay>
              <RedactedSection />
            </ImageLabelWrapper>
          </Flex>
          <h3 className={'color-light align-text-center'}>REDACTED</h3>
        </PosterColumn>
      </Flex>
      <Flex
        layout={{
          kind: 'item',
          direction: 'row',
          justifyContent: 'center',
        }}
      >
        <Image src={triangle} width={112} height={112} />
      </Flex>
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

export default RitualsMoviePoster;