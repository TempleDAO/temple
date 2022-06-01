import { Link, useNavigate } from 'react-router-dom';
import { useMediaQuery } from 'react-responsive';
import styled, { css } from 'styled-components';
import Lottie from 'react-lottie';

import { Button, ButtonProps } from 'components/Button/Button';
import * as breakpoints from 'styles/breakpoints';
import { Flex } from 'components/Layout/Flex';
import Metrics from 'components/Metrics/Metrics';

import circleBgImage from 'assets/images/circle-bg.svg';
import eyeImage from 'assets/images/eye.svg';
import gateImage from 'assets/images/gate.svg';
import planetsImage from 'assets/images/planets.svg';
import sunsetImage from 'assets/images/sunset.svg';

import { ResponsiveImage } from 'styles/common';
import useRefreshableTreasuryMetrics from 'hooks/use-refreshable-treasury-metrics';
import animationData from 'assets/animations/logo-animation.json';

const REWARDS_IMAGE_HEIGHT = 322;
const EARN_IMAGE_HEIGHT = 450;

const HomePage = () => {
  const treasuryMetrics = useRefreshableTreasuryMetrics();

  const isAboveMobile = useMediaQuery({
    query: breakpoints.queryMinTablet,
  });
  const navigate = useNavigate();

  const aniOptions = {
    loop: true,
    autoplay: true,
    animationData: animationData,
    rendererSettings: {
      preserveAspectRatio: 'xMidYMid slice',
    },
  };

  return (
    <>
      <HeaderStyled>
        <NavContainer>
          <Link to="/">
            <AppLogo>TempleDAO</AppLogo>
          </Link>
          <MenuContainer>
            <DAppButton label={'launch dapp'} onClick={() => navigate('/core/dapp')} isSmall isUppercase />
          </MenuContainer>
        </NavContainer>
      </HeaderStyled>
      <Row>
        <RowCell>
          <EarnBetterYieldsWrapper>
            <EnableBetterYieldsHeader>Earn Better Yields</EnableBetterYieldsHeader>
            <SustainableYieldFarmingText>
              Sustainable yield farming for the passive investor
            </SustainableYieldFarmingText>
            <ButtonGroup>
              {isAboveMobile && (
                <ButtonContainer>
                  <Link to={'/core/dapp/trade'}>
                    <StyledButton label={`Buy Now $`} isUppercase isSmall />
                  </Link>
                </ButtonContainer>
              )}
              <ButtonContainer>
                <Link to={'/core/dapp/vaults'}>
                  <StyledButton label={`Start Earning`} isUppercase isSmall showArrow />
                </Link>
              </ButtonContainer>
            </ButtonGroup>
            <MetricsWrapper>
              {treasuryMetrics ? (
                <MetricsWrapper>
                  <Metrics treasuryMetrics={treasuryMetrics} isHome alignCenter={!isAboveMobile} />
                </MetricsWrapper>
              ) : null}
            </MetricsWrapper>
          </EarnBetterYieldsWrapper>
        </RowCell>
        <RowCell>
          <SunGateWrapper>
            <TempleDaoSun>
              <Lottie options={aniOptions} height={400} width={400} />
            </TempleDaoSun>
            <ResponsiveImage src={gateImage} alt={'Temple DAO'} />
          </SunGateWrapper>
        </RowCell>
      </Row>
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
            <h2>Sustainable Income</h2>
            <p>
              Buy and stake $TEMPLE to earn more yield than traditional stablecoin farms. Plus get whale like investment
              strategies with any size investment.
            </p>
            <CircleBgWrapper>
              <ResponsiveImage src={circleBgImage} alt={''} aria-hidden={true} height={322} width={322} />
            </CircleBgWrapper>
          </Flex>
          <Flex
            layout={{
              kind: 'item',
              justifyContent: 'flex-end',
            }}
          >
            <ResponsiveImage src={sunsetImage} alt={'Earn Trading Fee'} height={450} width={450} />
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
            <ResponsiveImage src={eyeImage} alt={'Earn Trading Fee'} height={450} width={450} />
          </Flex>
          <Flex
            layout={{
              kind: 'item',
              direction: 'column',
              justifyContent: 'center',
            }}
          >
            <h2>Reduce Risk</h2>
            <p>
              Take the risk out of cryptocurrency with our low-volatility stable coin treasury. Reduce your transaction
              fees and the associated risks that come from interacting with a large number of contracts when moving from
              farm-to-farm.
            </p>
            <CircleBgWrapper rightAlign>
              <ResponsiveImage src={circleBgImage} alt={''} aria-hidden={true} height={322} width={322} />
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
            <h2>Get Extra Rewards</h2>
            <p>
              Temple token holders receive exclusive airdrops and additional rewards from our "Powered by Temple"
              projects.
            </p>
            <CircleBgWrapper>
              <ResponsiveImage
                src={circleBgImage}
                alt={''}
                aria-hidden={true}
                height={REWARDS_IMAGE_HEIGHT}
                width={REWARDS_IMAGE_HEIGHT}
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
              height={EARN_IMAGE_HEIGHT}
              width={EARN_IMAGE_HEIGHT}
            />
          </Flex>
        </Flex>
      </section>
    </>
  );
};

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
const EnableBetterYieldsHeader = styled.h2`
  text-align: center;
  font-size: 3rem;
  line-height: 3.5rem;
  margin: 0;

  ${breakpoints.tabletAndAbove(`
    text-align: left;
    margin: 2em 0;
  `)}
`;

const SustainableYieldFarmingText = styled.h4`
  margin: 0 0 2em;

  ${breakpoints.tabletAndAbove(`
    margin: 0 0 2.75em;
  `)}
`;

const EarnBetterYieldsWrapper = styled.div`
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
  transform: translateY(16%);
  translate-origin: center center;
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

const HeaderStyled = styled.header`
  position: fixed;
  z-index: ${(props) => props.theme.zIndexes.top};
  top: 0;
  left: 0;
  height: ${(props) => props.theme.metrics.headerHeight};
  padding: 1rem;
  display: flex;
  justify-content: space-between;
  align-items: center;
  color: ${(props) => props.theme.palette.brand};
  background-color: ${(props) => props.theme.palette.dark};
  width: 100%;

  ${breakpoints.tabletAndAbove(`
    width: 100vw;
    justify-content: center;
  `)}
`;

const NavContainer = styled.div`
  position: relative;
  max-width: ${(props) => props.theme.metrics.desktop.maxWidth};
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex: 1;
  height: 100%;
`;

// Special case font sizing/line height for TempleDAO Logo
const AppLogo = styled.h1`
  font-size: 1.5rem;
  line-height: 2.75rem;
  margin: 0;
`;

const MenuContainer = styled.div`
  display: flex;

  ${breakpoints.tabletAndAbove(`
    width: 10rem;
  `)}
`;

const DAppButton = styled(Button)`
  width: 10rem;
`;

export default HomePage;
