import React from 'react';
import { Link } from 'react-router-dom';
import { useMediaQuery } from 'react-responsive';

import { Flex } from 'components/Layout/Flex';
import Metrics from 'components/Metrics/Metrics';
import useRefreshableTreasuryMetrics from 'hooks/use-refreshable-treasury-metrics';
import { MOBILE_BREAKPOINT } from 'styles/breakpoints';

import circleBgImage from 'assets/images/circle-bg.svg';
import earnTradingFeeImage from 'assets/images/earn-trading-fee.svg';
import eyeImage from 'assets/images/eye.svg';
import gateImage from 'assets/images/gate.svg';
import planetsImage from 'assets/images/planets.svg';
import receiveTokenImage from 'assets/images/receive-token.svg';
import sunImage from 'assets/images/sun-art.svg';
import sunsetImage from 'assets/images/sunset.svg';

import {
  Row,
  RowCell,
  SunGateWrapper,
  TempleDaoSun,
  ResponsiveImage,
  EarnStableGainsWrapper,
  EarnStableGainsHeader,
  SleepEasyStakingText,
  ButtonGroup,
  StyledButton,
  ButtonContainer,
  CircleBgWrapper,
  MetricsWrapper,
} from './styles';

const Home = () => {
  const treasuryMetrics = useRefreshableTreasuryMetrics();
  const isDesktop = useMediaQuery({
    query: `(min-width: ${MOBILE_BREAKPOINT})`,
  });

  return (
    <>
      <Row>
        <RowCell>
          <EarnStableGainsWrapper>
            <EarnStableGainsHeader>Earn Stable Gains</EarnStableGainsHeader>
            <SleepEasyStakingText>Sleep easy staking in the Temple</SleepEasyStakingText>
            <ButtonGroup>
              {isDesktop && (
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
            {/* {treasuryMetrics ? ( */}
              <MetricsWrapper>
                <Metrics
                  treasuryMetrics={{ templeApy: 1000, treasuryValue: 125000000, templeValue: 0.72 }}
                  isHome
                  alignCenter={!isDesktop}
                />
              </MetricsWrapper>
              {/* ) : null} */}
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



export default Home;
