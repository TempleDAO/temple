import React from 'react';
import { Link } from 'react-router-dom';
import { useMediaQuery } from 'react-responsive';
import styled, { css } from 'styled-components';

import { Button, ButtonProps } from 'components/Button/Button';
import { queryMinTablet } from 'styles/breakpoints';
import * as breakpoints from 'styles/breakpoints';
import { Flex } from 'components/Layout/Flex';
import Metrics from 'components/Metrics/Metrics';
import useRefreshableTreasuryMetrics from 'hooks/use-refreshable-treasury-metrics';

import circleBgImage from 'assets/images/circle-bg.svg';
import earnTradingFeeImage from 'assets/images/earn-trading-fee.svg';
import eyeImage from 'assets/images/eye.svg';
import gateImage from 'assets/images/gate.svg';
import planetsImage from 'assets/images/planets.svg';
import receiveTokenImage from 'assets/images/receive-token.svg';
import sunImage from 'assets/images/sun-art-new.svg';
import sunsetImage from 'assets/images/sunset.svg';

import { ResponsiveImage } from 'styles/common';

const Home = () => {
  const treasuryMetrics = useRefreshableTreasuryMetrics();
  const isAboveMobile = useMediaQuery({
    query: queryMinTablet,
  });

  return (
    <>
      <Row>
        <RowCell>
          <EarnStableGainsWrapper>
            <EarnStableGainsHeader>Earn Stable Gains</EarnStableGainsHeader>
            <SleepEasyStakingText>
              Sleep easy staking in the Temple
            </SleepEasyStakingText>
            <ButtonGroup>
              {isAboveMobile && (
                <ButtonContainer>
                  <Link to={'/the-temple'}>
                    <StyledButton
                      label={`enter temple ${String.fromCharCode(10146)}`}
                      isUppercase
                      isSmall
                    />
                  </Link>
                </ButtonContainer>
              )}
              <ButtonContainer>
                <Link to={'/dapp'}>
                  <StyledButton label={'buy now $'} isUppercase isSmall />
                </Link>
              </ButtonContainer>
            </ButtonGroup>
            {/*TODO: maybe render spinner while fetching metrics*/}
            {treasuryMetrics ? (
              <MetricsWrapper>
                <Metrics
                  treasuryMetrics={treasuryMetrics}
                  isHome
                  alignCenter={!isAboveMobile}
                />
              </MetricsWrapper>
            ) : null}
          </EarnStableGainsWrapper>
        </RowCell>
        <RowCell>
          <SunGateWrapper>
            <TempleDaoSun>
              <ResponsiveImage src={sunImage} alt={'Temple DAO'} />
            </TempleDaoSun>
            <ResponsiveImage src={gateImage} alt={'Temple DAO'} />
          </SunGateWrapper>
        </RowCell>
      </Row>
      <section>
        <h2 className={'align-text-center'}>Temple Offerings</h2>
        <Flex
          layout={{
            kind: 'container',
            direction: 'row',
            canWrap: true,
            canWrapTablet: false,
          }}
        >
          <Flex
            layout={{
              kind: 'item',
              col: 'fullwidth',
              colTablet: 'half',
              direction: 'column',
              alignItems: 'center',
            }}
          >
            <ResponsiveImage
              src={receiveTokenImage}
              alt={'Receive Tokens'}
              height={275}
              width={275}
            />
            <h3 className={'align-text-center'}>
              Stake <span className={'color-light'}>$TEMPLE</span> to play
              <br />
              the most innovative
              <br />
              long-term game in defi
            </h3>
          </Flex>
          <Flex
            layout={{
              kind: 'item',
              col: 'fullwidth',
              colTablet: 'half',
              direction: 'column',
              alignItems: 'center',
            }}
          >
            <ResponsiveImage
              src={earnTradingFeeImage}
              alt={'Earn Trading Fee'}
              height={275}
              width={275}
            />
            <h3 className={'align-text-center'}>
              Stake <span className={'color-light'}>any asset</span> to <br />
              automate and stabilise
              <br />
              <span className={'color-light'}>- coming thoon -</span>
            </h3>
          </Flex>
        </Flex>
      </section>
      <section>
        <Flex
          layout={{
            kind: 'container',
            direction: 'row',
          }}
        >
          <Flex
            layout={{
              kind: 'item',
              direction: 'column',
              justifyContent: 'center',
            }}
          >
            <h2>Principled</h2>
            <p>
              TempleDAO is designed on strong principles: building the Temple
              for the long-term, community first and fairly in all aspects, and
              prioritising stable wealth creation. Our innovative mechanics
              including safe minting, intrinsic value backed rewards, safe
              harvest, price defence incentives, and exit queue can be explored
              in our{' '}
              <a
                href={'https://templedao.medium.com'}
                target={'_blank'}
                rel={'noreferrer'}
              >
                Medium posts
              </a>
              .
            </p>
            <CircleBgWrapper>
              <ResponsiveImage
                src={circleBgImage}
                alt={''}
                aria-hidden={true}
                height={322}
                width={322}
              />
            </CircleBgWrapper>
          </Flex>
          <Flex
            layout={{
              kind: 'item',
              justifyContent: 'flex-end',
            }}
          >
            <ResponsiveImage
              src={sunsetImage}
              alt={'Earn Trading Fee'}
              height={450}
              width={450}
            />
          </Flex>
        </Flex>
        <Flex
          layout={{
            kind: 'container',
            direction: 'row',
          }}
        >
          <Flex
            layout={{
              kind: 'item',
            }}
          >
            <ResponsiveImage
              src={eyeImage}
              alt={'Earn Trading Fee'}
              height={450}
              width={450}
            />
          </Flex>
          <Flex
            layout={{
              kind: 'item',
              direction: 'column',
              justifyContent: 'center',
            }}
          >
            <h2>Ritualed</h2>
            <p>
              We reward those who help the Temple: no special deals for
              outsiders. The protocol is designed to reward the community, and
              those who give most to the Temple. Participate in RITUALS to earn
              incense and access special offers. The first step is
              <a
                href={'https://discord.gg/templedao'}
                target={'_blank'}
                rel={'noreferrer'}
              >
                {' '}
                joining Discord
              </a>{' '}
              and completing the !verify ritual. Good luck.{' '}
            </p>
            <CircleBgWrapper rightAlign>
              <ResponsiveImage
                src={circleBgImage}
                alt={''}
                aria-hidden={true}
                height={322}
                width={322}
              />
            </CircleBgWrapper>
          </Flex>
        </Flex>
        <Flex
          layout={{
            kind: 'container',
            direction: 'row',
          }}
        >
          <Flex
            layout={{
              kind: 'item',
              direction: 'column',
              justifyContent: 'center',
            }}
          >
            <h2>Ascension</h2>
            <p>
              The Templar’s end goal is ASCENSION: when the intrinsic value of
              your tokens is more than your purchase price, you have ascended.
              No price risk, your tokens have multiplied, you are a God. The
              Temple is designed for stable, long-term wealth creation, where
              the intrinsic value of your holdings increases steadily and only
              goes up.{' '}
            </p>
            <CircleBgWrapper>
              <ResponsiveImage
                src={circleBgImage}
                alt={''}
                aria-hidden={true}
                height={322}
                width={322}
              />
            </CircleBgWrapper>
          </Flex>
          <Flex
            layout={{
              kind: 'item',
              justifyContent: 'flex-end',
            }}
          >
            <ResponsiveImage
              src={planetsImage}
              alt={'Earn Trading Fee'}
              height={450}
              width={450}
            />
          </Flex>
        </Flex>
      </section>
    </>
  );
};

// TODO(MrFujisawa):
// Replace this and the row cell with grid framework once we have a replacement for
//<Flex /> figured out.
const Row = styled.section`
  display: flex;
  flex-direction: column;
  width: 100%;
  padding: 1rem 0;

  ${breakpoints.tabletAndAbove(`
    flex-direction: row;
  `)}
`;

const RowCell = styled.div`
  position: relative;
  display: flex;
  justify-content: center;
  flex-direction: column;
  align-items: center;

  ${breakpoints.tabletAndAbove(`
    width: 50%;
    align-items: flex-start;

    &:nth-child(odd) {
      padding-right: 1.5rem;
    }

    &:nth-child(even) {
      padding-left: 1.5rem;
    }
  `)}
`;

const SunGateWrapper = styled.div`
  position: relative;
  display: flex;
  justify-content: center;
  width: fit-content;
`;

// Special case heading h2 for landing page.
const EarnStableGainsHeader = styled.h2`
  text-align: center;
  font-size: 3rem;
  line-height: 3.5rem;
  margin: 0;

  ${breakpoints.tabletAndAbove(`
    text-align: left;
    margin: 2em 0;
  `)}
`;

const SleepEasyStakingText = styled.h4`
  margin: 0 0 2em;

  ${breakpoints.tabletAndAbove(`
    margin: 0 0 2.75em;
  `)}
`;

const EarnStableGainsWrapper = styled.div`
  margin: 1rem 0 3rem;
  display: flex;
  flex-direction: column;
  justify-content: center;
  text-align: center;
  width: 100%;

  ${breakpoints.tabletAndAbove(`
    margin: 0;
    text-align: initial;
    margin-bottom: 3rem;
  `)}
`;

const TempleDaoSun = styled.div`
  z-index: ${(props) => props.theme.zIndexes.up};

  position: absolute;
  transform-origin: center center;
  transform: translateY(44%);
  translate-origin: center center;

  width: 53%;

  img {
    animation: ${(props) => props.theme.animations.spin};
  }
`;

const ButtonGroup = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 20px;
  max-width: 24rem;
  width: 100%;
  margin: 0 auto 3rem;

  ${breakpoints.tabletAndAbove(`
    margin: 0 0 3.5rem;
    justify-content: space-between;
  `)}
`;

const MetricsWrapper = styled.div`
  display: flex;
  justify-content: center;
  max-width: 26.5rem;
  margin: 0 auto;

  ${breakpoints.tabletAndAbove(`
    justify-content: flex-start;
    margin: 0;
  `)}
`;

interface CircleBgWrapperProps {
  rightAlign?: boolean;
}

const CircleBgWrapper = styled.div<CircleBgWrapperProps>`
  position: absolute;
  transform: translateX(-50%);

  ${(props) =>
    props.rightAlign &&
    css`
      right: 0;
      transform: translateX(50%);
    `}
`;

const ButtonContainer = styled.div`
  width: 9.6875rem;
`;

const StyledButton = styled(Button)<ButtonProps>`
  width: 100%;
`;

export default Home;
