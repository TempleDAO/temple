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
import eyeImage from 'assets/images/eye.svg';
import gateImage from 'assets/images/gate.svg';
import planetsImage from 'assets/images/planets.svg';
import sunImage from 'assets/images/sun-art.svg';
import sunsetImage from 'assets/images/sunset.svg';

import socialDiscordIcon from 'assets/images/social-discord.png';
import socialDocsIcon from 'assets/images/social-docs.png';
import socialMediumIcon from 'assets/images/social-medium.png';
import socialMessageIcon from 'assets/images/social-twitter.png';
import socialTelegramIcon from 'assets/images/social-telegram.png';
import socialTwitterIcon from 'assets/images/social-twitter.png';
import footerBg from 'assets/images/footer-bg.png';
import Image from 'components/Image/Image';

import { ResponsiveImage } from 'styles/common';

const HomePage = () => {
  const treasuryMetrics = useRefreshableTreasuryMetrics();
  const isAboveMobile = useMediaQuery({
    query: queryMinTablet,
  });

  return (
    <>
      <Row>
        <RowCell>
          <EarnBetterYieldsWrapper>
            <EnableBetterYieldsHeader>
              Earn Better Yields
            </EnableBetterYieldsHeader>
            <SustainableYieldFarmingText>
              Sustainable yield farming for the passive investor
            </SustainableYieldFarmingText>
            <ButtonGroup>
              {isAboveMobile && (
                <ButtonContainer>
                  {
                    // TODO: Where should this go?
                  }
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
                {
                  // TODO: Where should we link?
                }
                <Link to={'/core'}>
                  <StyledButton label={'Learn More'} isUppercase isSmall />
                </Link>
              </ButtonContainer>
            </ButtonGroup>
            {treasuryMetrics ? (
              <MetricsWrapper>
                <Metrics
                  treasuryMetrics={treasuryMetrics}
                  isHome
                  alignCenter={!isAboveMobile}
                />
              </MetricsWrapper>
            ) : null}
          </EarnBetterYieldsWrapper>
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
              Buy and stake $TEMPLE to earn more yield than traditional
              stablecoin farms. Plus get whale like investment strategies with
              any size investment.
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
            {
              // TODO: Do we want to replace these images?
            }
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
            <h2>Reduce Risk</h2>
            <p>
              Take the risk out of cryptocurrency with our low-volatility stable
              coin treasury. Reduce your transaction fees and the associated
              risks that come from interacting with a large number of contracts
              when moving from farm-to-farm.
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
            <h2>Get Extra Rewards</h2>
            <p>
              Temple token holders receive exclusive airdrops and additional
              rewards from our "Powered by Temple" projects.
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
      <FooterStyled>
        <FooterContainer>
          <Flex
            layout={{
              kind: 'container',
              direction: 'row',

              canWrap: true,
              canWrapDesktop: false,
            }}
          >
            <Flex
              layout={{
                kind: 'container',
                canWrap: true,
                canWrapTablet: false,
              }}
            >
              <Flex
                layout={{
                  kind: 'item',
                  direction: 'column',
                  colTablet: 'three-quarter',
                }}
              >
                <h3 className={'margin-remove'}>TempleDAO</h3>
                <br />
                <p>
                  Stop investing in volatile cryptocurrencies. Join Temple,
                  Stake, and sleep easy.
                </p>
                <br />
                <br />
                <strong>
                  &copy; {new Date().getFullYear()} TempleDAO. All rights
                  reserved.
                </strong>
              </Flex>
            </Flex>
            <Flex
              layout={{
                kind: 'container',
              }}
            >
              <Flex
                layout={{
                  kind: 'item',
                  direction: 'column',
                  colTablet: 'third',
                }}
              >
                <h4>Community</h4>
                <ul>
                  <li>
                    <a
                      href={'https://discord.gg/templedao'}
                      target={'_blank'}
                      rel="noreferrer"
                    >
                      <Image
                        src={socialDiscordIcon}
                        alt={''}
                        width={24}
                        height={24}
                      />
                      <strong>Discord</strong>
                    </a>
                  </li>
                  <li>
                    <a
                      href={'https://twitter.com/templedao'}
                      target={'_blank'}
                      rel="noreferrer"
                    >
                      <Image
                        src={socialTwitterIcon}
                        alt={''}
                        width={24}
                        height={24}
                      />
                      <strong>Twitter</strong>
                    </a>
                  </li>
                  <li>
                    <a
                      href={'https://t.me/TempleDAOcommunity'}
                      target={'_blank'}
                      rel="noreferrer"
                    >
                      <Image
                        src={socialTelegramIcon}
                        alt={''}
                        width={24}
                        height={24}
                      />
                      <strong>Telegram</strong>
                    </a>
                  </li>
                </ul>
              </Flex>
              <Flex
                layout={{
                  kind: 'item',
                  direction: 'column',
                  colTablet: 'third',
                }}
              >
                <h4>Resources</h4>
                <ul>
                  <li>
                    <a
                      href={'https://templedao.medium.com/'}
                      target={'_blank'}
                      rel="noreferrer"
                    >
                      <Image
                        src={socialMediumIcon}
                        alt={''}
                        width={24}
                        height={24}
                      />
                      <strong>Medium</strong>
                    </a>
                  </li>
                  <li>
                    <a
                      href={'https://docs.templedao.link/'}
                      target={'_blank'}
                      rel="noreferrer"
                    >
                      <Image
                        src={socialDocsIcon}
                        alt={''}
                        width={24}
                        height={24}
                      />
                      <strong>Docs</strong>
                    </a>
                  </li>
                  <li>
                    <a href={'mailto:templedao@protonmail.com'}>
                      <Image
                        src={socialMessageIcon}
                        alt={''}
                        width={24}
                        height={24}
                      />
                      <strong>Contact Us</strong>
                    </a>
                  </li>
                </ul>
              </Flex>
              <Flex
                layout={{
                  kind: 'item',
                  direction: 'column',
                  colTablet: 'third',
                }}
              >
                <h4>Links</h4>
                <Link to={'/disclaimer'}>
                  <strong>Disclaimer</strong>
                </Link>
              </Flex>
            </Flex>
          </Flex>
        </FooterContainer>
      </FooterStyled>
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

const FooterStyled = styled.footer`
  padding: 1.75rem /* 28/16 */;
  margin-top: 2rem;
  background: url(${footerBg});
`;

const FooterContainer = styled.div`
  max-width: ${(props) => props.theme.metrics.desktop.maxWidth};
  margin: 0 auto;
  padding: 0 16px;

  h4 {
    margin-top: 0;
  }

  ul {
    margin: 0;
    padding: 0;
  }

  li {
    list-style-type: none;

    a {
      display: flex;
      align-items: center;

      strong {
        margin-left: 0.75rem;
      }
    }
  }

  li + li {
    margin-top: 1rem;
  }
`;

export default HomePage;
