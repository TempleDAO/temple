import styled from 'styled-components';
import Image from '../../../Image/Image';

import obtainTemple from 'assets/images/newui-images/obtainTemple.svg';
import intrValue from 'assets/images/newui-images/intrValue.svg';
import treasuryGrowth from 'assets/images/newui-images/treasuryGrowth.svg';
import elasticFloor from 'assets/images/newui-images/elasticFloor.svg';
import footerTexture from 'assets/images/newui-images/footerTexture.svg';
import buildings from './assets/Buildings.svg';
import ring from './assets/Ring.svg';
import rays from './assets/Rays.svg';

import socialDiscordIcon from 'assets/images/social-discord.png';
import socialDocsIcon from 'assets/images/social-docs.png';
import socialCodexIcon from 'assets/images/social-codex.png';
import socialMediumIcon from 'assets/images/social-medium.png';
import socialMessageIcon from 'assets/images/social-twitter.png';
import socialTelegramIcon from 'assets/images/social-telegram.png';
import socialTwitterIcon from 'assets/images/social-twitter.png';
import { Link } from 'react-router-dom';
import PriceChartNew from './PriceChartNew';
import { Button } from 'components/Button/Button';
import { useEffect, useState, useRef } from 'react';
import { Trade } from './TradeNew';
import { useAccount } from 'wagmi';
import { Account } from 'components/Layouts/CoreLayout/Account';
import { fetchGenericSubgraph } from 'utils/subgraph';
import { Background } from 'components/Vault/desktop-parts/Background';
import { Definitions } from 'components/Vault/desktop-parts/Definitions';

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
        Enjoy the top stable yields in DeFi without worrying about actively managing any positions.
        <br />
        <br />
        TPI rises over time as the Temple Treasury generates revenue and grows in value.
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
        text: 'Telegram',
        image: socialTelegramIcon,
        link: 'https://t.me/templedao',
      },
      {
        text: 'Twitter',
        image: socialTwitterIcon,
        link: 'https://twitter.com/templedao',
      },
      {
        text: 'Codex',
        image: socialCodexIcon,
        link: 'https://codex.templedao.link/',
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
        link: 'https://medium.com/templedao',
      },
      {
        text: 'Contact Us',
        image: socialMessageIcon,
        link: 'mailto:templedao@protonmail.com/',
      },
    ],
  },
];

const Home = () => {
  const { address, isConnected } = useAccount();
  const [metrics, setMetrics] = useState<Metrics>({ price: 0, tpi: 0, treasury: 0 });
  const [tradeFormVisible, setTradeFormVisible] = useState(false);
  const [showConnect, setShowConnect] = useState(false);

  useEffect(() => {
    setShowConnect(false);
  }, [isConnected]);

  const tradeButtonClickHandler = () => {
    if (address) {
      setTradeFormVisible((tradeFormVisible) => !tradeFormVisible);
    } else {
      setShowConnect(true);
    }
  };

  let targetRef = useRef<HTMLHeadingElement>(null);

  const scrollToContent = () => {
    // @ts-ignore
    targetRef.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    const fetchMetrics = async () => {
      // const { data: treasuryData } = await fetchSubgraph(`{
      //     protocolMetrics(first: 1, orderBy: timestamp, orderDirection: desc) {
      //       lockedStables
      //     }
      //   }`);
      const { data: ramosData } = await fetchGenericSubgraph(
        'https://api.thegraph.com/subgraphs/name/templedao/templedao-ramos',
        `{
          metrics {
            treasuryPriceIndexUSD
            templePriceUSD
          }
        }`
      );
      setMetrics({
        price: parseFloat(ramosData.metrics[0].templePriceUSD),
        tpi: parseFloat(ramosData.metrics[0].treasuryPriceIndexUSD),
        // treasury: parseFloat(treasuryData.protocolMetrics[0].lockedStables),
        treasury: 37000000,
      });
    };
    fetchMetrics();
  });

  return (
    <>
      <LegacyLinkHeader>
        <LegacyText>Legacy features</LegacyText>
        <LegacyLink to="/dapp/vaults/1m-core/claim">Claim from vaults</LegacyLink>
        <LegacyLink to="/dapp/trade/unstake">Unstake OGT</LegacyLink>
      </LegacyLinkHeader>
      {/* Top Container */}
      <TopContainer>
        <RaysImage src={rays} />
        <BackgroundTexture viewBox="0 0 1000 1000" fill="none">
          <Background />
          <Definitions />
        </BackgroundTexture>
        <HeroRing>
          <ContentContainer>
            {tradeFormVisible && <Trade />}
            {showConnect && (
              <ConnectWalletContainer>
                <ConnectWalletText>Connect Wallet to Continue</ConnectWalletText>
                <ConnectButtonWrapper>
                  <Account />
                </ConnectButtonWrapper>
              </ConnectWalletContainer>
            )}
            {!tradeFormVisible && !showConnect && (
              <>
                <NewTempleText>The New Temple</NewTempleText>
                <TradeDetailText>A wrapped treasury token with steady price growth in all conditions</TradeDetailText>
                <LearnMoreLink onClick={scrollToContent}>Learn More</LearnMoreLink>
                <TradeButton onClick={tradeButtonClickHandler}>Trade</TradeButton>
              </>
            )}
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
            <MetricValue>${(metrics.treasury / 1000000).toFixed(0)}M</MetricValue>
            <MetricTitle>Treasury Value</MetricTitle>
          </Metric>
        </MetricsRow>
      </TopContainer>

      {/* Main container */}
      <MainContainer>
        {/* Price chart */}
        <Header>Price History</Header>
        <ChartContainer>
          <PriceChartNew />
        </ChartContainer>
        {/* Marketing content */}
        <Header
          ref={(ref) => {
            // @ts-ignore
            targetRef = ref;
          }}
        >
          How Does It Work?
        </Header>
        {MarketingContent.map((content, index) => (
          <MarketingRow index={index} key={index}>
            <MarketingImage src={content.image} />
            <MarketingTextWrapper>
              <MarketingHeader>{content.header}</MarketingHeader>
              <MarketingText>{content.text}</MarketingText>
            </MarketingTextWrapper>
          </MarketingRow>
        ))}
      </MainContainer>

      {/* Footer */}
      <FooterContainer>
        <LinkRow>
          {FooterContent.map((col, index) => (
            <Links key={index}>
              <h4>{col.header}</h4>
              <ul>
                {col.links.map((link, index) => (
                  <li>
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
              <li>
                <Link to="/dapp/vaults/1m-core/claim">Claim from vaults (Legacy)</Link>
              </li>
              <li>
                <Link to="/dapp/trade/unstake">Unstake OGT (Legacy)</Link>
              </li>
            </ul>
          </Links>
        </LinkRow>
        <CopyrightRow>© 2022 TempleDAO. All rights reserved.</CopyrightRow>
      </FooterContainer>
    </>
  );
};

const primaryColor = '#bd7b4f';
const secondaryColor = '#ffdec9';

const LegacyText = styled.span`
  padding: 5px;
  margin-right: 10px;
  color: ${primaryColor};
`;

const LegacyLink = styled(Link)`
  text-decoration: underline;
  padding: 5px;
  cursor: pointer;
  margin-right: 10px;
  margin-left: 10px;
`;

const LegacyLinkHeader = styled.div`
  position: absolute;
  width: 100%;
  display: flex;
  flex-direction: row;
  justify-content: right;
  padding: 5px;
  background-color: black;
  background-image: url('${footerTexture}');
  background-size: cover;
  border-bottom: 2px solid #351f11;
  border-top: 2px solid #351f11;
  font-size: 14px;
  z-index: 3;
`;

// Top Container
const TopContainer = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  color: ${primaryColor};
  height: 100vh;
`;

const RaysImage = styled(Image)`
  position: absolute;
  margin-top: -6rem;
  width: 1300px;
`;

const BackgroundTexture = styled.svg`
  position: absolute;
  margin-top: -4rem;
  width: 700px;
`;

const HeroRing = styled.div`
  margin: -8rem 0 0 1rem; // offset so ring can match rays
  min-width: 500px;
  width: 500px;
  height: 500px;
  background: url(${ring}) center no-repeat;
  background-size: contain;
  z-index: 1;
  text-align: center;
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
  color: ${secondaryColor};
`;

const TradeDetailText = styled.div`
  font-size: 1.25rem;
  margin-top: 1rem;
`;

const LearnMoreLink = styled.a`
  font-size: 0.75rem;
  letter-spacing: 0.095rem;
  text-decoration-line: underline;
  margin-top: 1rem;
  cursor: pointer;
`;

const ConnectWalletText = styled.div`
  font-size: 1.75rem;
  margin: auto;
  color: ${secondaryColor};
  padding-bottom: 20px;
`;

const ConnectButtonWrapper = styled.div`
  width: 200px;
  margin: auto;
`;

const ConnectWalletContainer = styled.div`
  margin: auto;
  display: flex;
  flex-direction: column;
`;

const TradeButton = styled(Button)`
  padding: 0.75rem 1.5rem;
  margin-top: 1.5rem;
  width: min-content;
  height: min-content;
  background: linear-gradient(180deg, #353535 45.25%, #101010 87.55%);
  border: 1px solid #95613f;
  box-shadow: 0px 0px 20px rgba(222, 92, 6, 0.4);
  border-radius: 0.75rem;
  font-weight: 700;
  font-size: 1rem;
  letter-spacing: 0.1rem;
  text-transform: uppercase;
  color: ${secondaryColor};
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
    border: 1px solid ${primaryColor};
    border-radius: 0.75rem;
    background: #0b0a0a;
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
  border: 1px solid ${primaryColor};
  border-radius: 0.75rem;
  gap: 10px;
  padding: 1rem 0;
  background: #0b0a0a;

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
  color: ${secondaryColor};

  @media (max-width: 768px) {
    font-size: 1.25rem;
  }
`;

const MetricTitle = styled.div`
  font-size: 1.25rem;
`;

// Main Container
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
  color: ${secondaryColor};
`;

// Price Chart
const ChartContainer = styled.div`
  width: 100%;
  height: 500px;
`;

// Marketing Container
const MarketingRow = styled.div.attrs((props: { index: number }) => props)`
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 2rem;
  margin-top: -3rem;
  flex-direction: row;
  ${(props) => props.index % 2 === 1 && `flex-direction: row-reverse; text-align: right;`}

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
  color: ${secondaryColor};
  font-size: 1.6rem;
  margin: 0 0 0.75rem 0;
`;

const MarketingText = styled.p`
  font-size: 1.2rem;
  margin: 0;
  letter-spacing: 0.05em;
  line-height: 1.75rem;
  color: ${primaryColor};
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
  border-top: 3px solid #351f11;
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
  color: ${primaryColor};
`;

export default Home;
