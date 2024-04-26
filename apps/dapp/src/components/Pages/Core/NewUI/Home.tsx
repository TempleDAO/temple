import styled from 'styled-components';
import Image from '../../../Image/Image';
import obtainTemple from 'assets/images/newui-images/obtainTemple.svg';
import intrValue from 'assets/images/newui-images/intrValue.svg';
import treasuryGrowth from 'assets/images/newui-images/treasuryGrowth.svg';
import elasticFloor from 'assets/images/newui-images/elasticFloor.svg';
import footerTexture from 'assets/images/newui-images/footerTexture.svg';
import buildings from './assets/Buildings.svg';
import hero from './assets/Hero.svg';
import socialDiscordIcon from 'assets/images/social-discord.png';
import socialDocsIcon from 'assets/images/social-docs.png';
import socialMediumIcon from 'assets/images/social-medium.png';
import socialTelegramIcon from 'assets/images/social-telegram.png';
import socialTwitterIcon from 'assets/images/social-twitter.png';
import { Link } from 'react-router-dom';
import { TemplePriceChart } from './PriceChart';
import { RAMOSMetrics } from './RAMOSMetrics';
import { Button } from 'components/Button/Button';
import { useEffect, useState } from 'react';
import { fetchGenericSubgraph } from 'utils/subgraph';
import env from 'constants/env';

interface Metrics {
  price: number;
  tpi: number;
  treasury: number;
}

const MarketingContent = [
  {
    image: obtainTemple,
    header: 'Elevate Your Portfolio',
    text: 'Simply buy and hold $TEMPLE in your wallet, then relax as the Treasury farms on your behalf.',
  },
  {
    image: intrValue,
    header: 'Find Refuge in the Temple',
    text: 'Each $TEMPLE token is backed by stable assets in the Treasury. The $TEMPLE price tracks the growth of Treasury assets through a metric called Treasury Price Index (TPI).',
  },
  {
    image: treasuryGrowth,
    header: 'Growth that Transcends Volatility',
    text: (
      <>
        Enjoy the top stable yields in DeFi without worrying about actively
        managing any positions.
        <br />
        <br />
        TPI rises over time as the Temple Treasury generates revenue and grows
        in value.
      </>
    ),
  },
  {
    image: elasticFloor,
    header: 'A Token for All Seasons',
    text: 'If $TEMPLE price trades below the TPI, automated price protection is engaged through our AMO-styled liquidity manager (RAMOS).',
  },
];

const FooterContent = [
  {
    header: 'Community',
    links: [
      {
        text: 'Discord',
        image: socialDiscordIcon,
        link: 'https://discord.gg/templedao',
      },
      {
        text: 'Twitter',
        image: socialTwitterIcon,
        link: 'https://twitter.com/templedao',
      },
      {
        text: 'Telegram',
        image: socialTelegramIcon,
        link: 'https://t.me/templedao',
      },
    ],
  },
  {
    header: 'Resources',
    links: [
      {
        text: 'Docs',
        image: socialDocsIcon,
        link: 'https://docs.templedao.link/',
      },
      {
        text: 'Medium',
        image: socialMediumIcon,
        link: 'https://templedao.medium.com/',
      },
    ],
  },
];

const Home = ({ tlc }: { tlc?: boolean }) => {
  const [metrics, setMetrics] = useState<Metrics>({
    price: 0,
    tpi: 0,
    treasury: 0,
  });

  useEffect(() => {
    const fetchMetrics = async () => {
      const { data: treasuryData } = await fetchGenericSubgraph<any>(
        env.subgraph.protocolMetrics,
        `{
          metrics {
            treasuryValueUSD
          }
        }`
      );
      const { data: arbitrumTreasuryData } = await fetchGenericSubgraph<any>(
        env.subgraph.protocolMetricsArbitrum,
        `{
          metrics {
            treasuryValueUSD
          }
        }`
      );
      const { data: ramosData } = await fetchGenericSubgraph<any>(
        env.subgraph.ramos,
        `{
          metrics {
            spotPrice
          }
        }`
      );

      const { data: tpiData } = await fetchGenericSubgraph<any>(
        env.subgraph.templeV2,
        `{
          tpiOracles {
            currentTpi
          }
        }`
      );
      setMetrics({
        price: parseFloat(ramosData.metrics[0].spotPrice),
        tpi: parseFloat(tpiData.tpiOracles[0].currentTpi),
        treasury:
          parseFloat(treasuryData.metrics[0].treasuryValueUSD) +
          parseFloat(arbitrumTreasuryData.metrics[0].treasuryValueUSD),
      });
    };
    fetchMetrics();
  }, []);

  return (
    <>
      {/* Top Container */}
      <TopContainer>
        <RaysImage src={hero} />
        <HeroRing>
          <ContentContainer>
            <>
              <NewTempleText>The New Temple</NewTempleText>
              <TradeDetailText>
                A wrapped treasury token with steady price growth in all
                conditions
              </TradeDetailText>
              <LearnMoreLink
                href="https://docs.templedao.link/"
                target={'_blank'}
              >
                Learn More
              </LearnMoreLink>
              <ButtonContainer>
                <Link to="/dapp/trade">
                  <LaunchAppButton label={'Launch App'} role="button" />
                </Link>
              </ButtonContainer>
            </>
          </ContentContainer>
        </HeroRing>
        <BuildingsImage src={buildings} />
        {/* Metrics */}
        <MetricsRow>
          <Metric>
            <MetricValue>${metrics.price.toFixed(4)}</MetricValue>
            <MetricTitle>$TEMPLE Price</MetricTitle>
          </Metric>
          <Metric>
            <MetricValue>${metrics.tpi.toFixed(4)}</MetricValue>
            <MetricTitle>Treasury Price Index</MetricTitle>
          </Metric>
          <Metric>
            <MetricValue>
              ${(metrics.treasury / 1000000).toFixed(2)}M
            </MetricValue>
            <MetricTitle>Treasury Value</MetricTitle>
          </Metric>
        </MetricsRow>
      </TopContainer>

      {/* Main container */}
      <MainContainer>
        {/* Price chart */}
        <Header>Price History</Header>
        <ChartContainer>
          <TemplePriceChart />
        </ChartContainer>
        <ChartContainer>
          <Header>RAMOS Analytics</Header>
          <RAMOSMetrics />
        </ChartContainer>
        {/* Marketing content */}
        <Header>How Does It Work?</Header>
        {MarketingContent.map((content, index) => (
          <MarketingRow index={index} key={index}>
            <MarketingImage src={content.image} />
            <MarketingTextWrapper>
              <MarketingHeader>{content.header}</MarketingHeader>
              <MarketingText>{content.text}</MarketingText>
            </MarketingTextWrapper>
          </MarketingRow>
        ))}
        <LaunchAppWrapper>
          <Link to="/dapp/dashboard">
            <LaunchAppButton
              isUppercase={false}
              label={'Launch App'}
              role="button"
            />
          </Link>
        </LaunchAppWrapper>
      </MainContainer>

      {/* Footer */}
      <FooterContainer>
        <LinkRow>
          {FooterContent.map((col, i) => (
            <Links key={i}>
              <h4>{col.header}</h4>
              <ul>
                {col.links.map((link, j) => (
                  <li key={j}>
                    <a href={link.link} target="_blank" rel="noreferrer">
                      <FooterImage src={link.image} alt={link.text} />
                      <strong>{link.text}</strong>
                    </a>
                  </li>
                ))}
              </ul>
            </Links>
          ))}
          <Links>
            <h4>Links</h4>
            <ul>
              <li>
                <Link to="/disclaimer">Disclaimer</Link>
              </li>
            </ul>
          </Links>
        </LinkRow>
        <CopyrightRow>
          © {new Date().getFullYear()} TempleDAO. All rights reserved.
        </CopyrightRow>
      </FooterContainer>
    </>
  );
};

const LaunchAppWrapper = styled.div`
  display: flex;
  justify-content: center;
  width: 100%;
`;

// Top Container
const TopContainer = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  color: ${({ theme }) => theme.palette.brand};
  height: 100vh;
  position: relative;
  overflow: hidden;
`;

const RaysImage = styled(Image)`
  position: absolute;
  top: -170px;
  width: 1300px;
  height: 1050px;

  @media (max-height: 700px) {
    margin-top: -100px;
  }
  @media (max-height: 520px) {
    margin-top: -200px;
  }
`;

const HeroRing = styled.div`
  position: absolute;
  top: 150px;
  min-width: 500px;
  width: 500px;
  height: 500px;
  margin-left: 16px;
  margin-bottom: 50px;
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1;
  text-align: center;

  @media (max-height: 700px) {
    margin-top: -100px;
  }
  @media (max-height: 520px) {
    margin-top: -200px;
  }
`;

const ContentContainer = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 0 6rem;
  height: 100%;
`;

const NewTempleText = styled.div`
  font-size: 1.75rem;
  margin-top: 1rem;
  color: ${({ theme }) => theme.palette.brandLight};
`;

const TradeDetailText = styled.div`
  font-size: 1.25rem;
  margin-top: 1rem;
`;

const LearnMoreLink = styled.a`
  font-size: 0.85rem;
  letter-spacing: 0.06rem;
  margin-top: 1rem;
  padding-bottom: 0.15rem;
  border-bottom: 1px solid ${({ theme }) => theme.palette.brand};
  cursor: pointer;
  &:hover {
    color: ${({ theme }) => theme.palette.brandLight};
    border-bottom: 1px solid ${({ theme }) => theme.palette.brandLight};
  }
`;

const ButtonContainer = styled.div`
  display: flex;
  flex-direction: row;
  justify-content: center;
  gap: 1.5rem;
  margin-top: 20px;
`;

export const LaunchAppButton = styled(Button)`
  padding: 0.75rem 1.5rem;
  width: 175px;
  height: 3.5rem;
  background: ${({ theme }) => theme.palette.gradients.dark};
  border: 1px solid ${({ theme }) => theme.palette.brandDark};
  box-shadow: 0px 0px 20px rgba(222, 92, 6, 0.4);
  border-radius: 0.75rem;
  font-weight: bold;
  font-size: 12pt;
  letter-spacing: 0.1rem;
  text-transform: uppercase;
  color: ${({ theme }) => theme.palette.brandLight};
`;

export const TradeButton = styled(Button)`
  padding: 0.75rem 1.5rem;
  margin-top: 1.5rem;
  width: ${(props) => props.width || 'min-content'};
  height: min-content;
  background: ${({ theme }) => theme.palette.gradients.dark};
  border: 1px solid ${({ theme }) => theme.palette.brandDark};
  box-shadow: 0px 0px 20px rgba(222, 92, 6, 0.4);
  border-radius: 0.75rem;
  font-weight: 700;
  font-size: 1rem;
  letter-spacing: 0.1rem;
  text-transform: uppercase;
  color: ${({ theme }) => theme.palette.brandLight};
`;

const BuildingsImage = styled(Image)`
  height: 550px;
  position: absolute;
  bottom: -2rem;
`;

// Metrics
const MetricsRow = styled.div`
  position: absolute;
  bottom: 2rem;
  display: flex;
  flex-direction: row;
  justify-content: space-evenly;
  gap: 4rem;
  z-index: 2;

  @media (max-width: 768px) {
    flex-direction: column;
    gap: 1rem;
    border: 1px solid ${({ theme }) => theme.palette.brand};
    border-radius: 0.75rem;
    background: ${({ theme }) => theme.palette.black};
    padding: 1rem;
    width: 80%;
  }
`;

const Metric = styled.div`
  width: 250px;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  border: 1px solid ${({ theme }) => theme.palette.brand};
  border-radius: 0.75rem;
  gap: 10px;
  padding: 1rem 0;
  background: ${({ theme }) => theme.palette.black};

  @media (max-width: 768px) {
    width: 100%;
    gap: 0;
    padding: 0;
    flex-direction: row-reverse;
    justify-content: space-between;
    border: 0;
  }
`;

const MetricValue = styled.div`
  font-size: 2rem;
  color: ${({ theme }) => theme.palette.brandLight};

  @media (max-width: 768px) {
    font-size: 1.25rem;
  }
`;

const MetricTitle = styled.div`
  font-size: 1.25rem;
`;

const MainContainer = styled.div`
  display: flex;
  flex-direction: column;
  max-width: 1100px;
  width: 100%;
  justify-content: center;
  margin: auto;
  padding: 4rem 2rem;
`;

const Header = styled.h2`
  font-size: 36px;
  display: flex;
  align-items: center;
  z-index: 2;
  margin: 2rem 0;
  color: ${({ theme }) => theme.palette.brandLight};
`;

const ChartContainer = styled.div`
  width: 100%;
  min-height: 500px;
`;

const MarketingRow = styled.div.attrs((props: { index: number }) => props)`
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 2rem;
  margin-top: -3rem;
  flex-direction: row;
  ${(props) =>
    props.index % 2 === 1 && `flex-direction: row-reverse; text-align: right;`}

  @media (max-width: 768px) {
    flex-direction: column;
    gap: 1rem;
    text-align: center;
    margin-top: 5rem;
    ${(props) => props.index === 0 && `margin-top: 0;`}
  }
`;

const MarketingTextWrapper = styled.div`
  display: flex;
  flex-direction: column;
  max-width: 500px;
`;

const MarketingHeader = styled.h3`
  color: ${({ theme }) => theme.palette.brandLight};
  font-size: 1.6rem;
  margin: 0 0 0.75rem 0;
`;

const MarketingText = styled.p`
  font-size: 1.2rem;
  margin: 0;
  letter-spacing: 0.05em;
  line-height: 1.75rem;
  color: ${({ theme }) => theme.palette.brand};
`;

const MarketingImage = styled(Image)`
  height: 500px;
  width: 500px;

  @media (max-width: 768px) {
    height: 300px;
    width: 300px;
  }
`;

// Footer
const FooterContainer = styled.div`
  width: 100%;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  background-image: url('${footerTexture}');
  background-size: cover;
  border-top: 3px solid ${({ theme }) => theme.palette.brandDarker};
`;

const LinkRow = styled.div`
  display: flex;
  flex-direction: row;
  justify-content: space-evenly;
  align-items: flex-start;
  max-width: 1000px;
  width: 100%;
  gap: 2rem;
  padding: 1rem;

  h4 {
    margin-top: 2rem;
    margin-bottom: 1rem;
    @media (max-width: 768px) {
      font-size: 1.25rem;
      margin: 0.5rem 0;
    }
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
        @media (max-width: 768px) {
          margin-left: 0;
        }
      }
    }
  }

  li + li {
    margin-top: 1rem;
  }
`;

const Links = styled.div`
  display: flex;
  flex-direction: column;
`;

const FooterImage = styled(Image)`
  height: 24px;
  width: 24px;

  @media (max-width: 768px) {
    display: none;
  }
`;

const CopyrightRow = styled.div`
  height: 20px;
  padding: 30px;
  font-size: 14px;
  letter-spacing: 0.095em;
  color: ${({ theme }) => theme.palette.brand};
`;

export default Home;
