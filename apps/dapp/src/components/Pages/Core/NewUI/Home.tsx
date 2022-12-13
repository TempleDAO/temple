import styled, { keyframes } from 'styled-components';
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
import { useEffect, useState } from 'react';
import { Trade } from './TradeNew';
import ClaimModal from './ClaimModal';
import UnstakeOgtModal from './UnstakeModal';
import { useAccount } from 'wagmi';
import { Account } from 'components/Layouts/CoreLayout/Account';

const MarketingContent = [
  {
    image: obtainTemple,
    header: 'Obtain $TEMPLE',
    text: 'Provide your tokens, growing the Temple Treasury and recieving $TEMPLE in return.',
  },
  {
    image: intrValue,
    header: 'Intrinsic value',
    text: 'Each $TEMPLE token has intrinsic value equal to the treasury value, divided by the number of $TEMPLE tokens.',
  },
  {
    image: treasuryGrowth,
    header: 'Treasury Growth',
    text: 'The Temple Treasury is put to work, generating revenue for the protocol. This will drive up the intrinsic value of each $TEMPLE token over time.',
  },
  {
    image: elasticFloor,
    header: 'Elastic Floor',
    text: 'If the $TEMPLE token price drops below the intrinsic value, a contract will buy back tokens at randomised times and in randomised amounts, restoring the price and maintaining an elastic floor.',
  },
];

const Home = () => {
  const { address, isConnected } = useAccount();
  console.log(address);

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

  const [isClaimFromVaultsLegacyModalOpen, setIsClaimFromVaultsLegacyModalOpen] = useState(false);
  const [isUnstakeOgtLegacyModalOpen, setIsUnstakeOgtLegacyModalOpen] = useState(false);

  const legacyClaimClickHandler = () => {
    if (!address) {
      window.scrollTo(0, 0);
      setShowConnect(true);
      return;
    }

    setIsClaimFromVaultsLegacyModalOpen(true);
  };

  const legacyUnstakeOgtClickHandler = () => {
    if (!address) {
      window.scrollTo(0, 0);
      setShowConnect(true);
      return;
    }

    setIsUnstakeOgtLegacyModalOpen(true);
  };

  return (
    <>
      {/* Top Container */}
      <TopContainer>
        <RaysImage src={rays} />
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
                <TradeDetailText>
                  A safe and stable token,
                  <br />
                  appreciating over time.
                </TradeDetailText>
                <LearnMoreLink>Learn More</LearnMoreLink>
                <TradeButton onClick={tradeButtonClickHandler}>Trade</TradeButton>
              </>
            )}
          </ContentContainer>
        </HeroRing>
        <BuildingsImage src={buildings} />
        {/* Metrics */}
        <MetricsRow>
          <Metric>
            <MetricValue>$1.68</MetricValue>
            <MetricTitle>$TEMPLE Price</MetricTitle>
          </Metric>
          <Metric>
            <MetricValue>$1.62</MetricValue>
            <MetricTitle>Treasury Price Index</MetricTitle>
          </Metric>
          <Metric>
            <MetricValue>$26.71M</MetricValue>
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
      </MainContainer>

      {/* Footer */}
      <FooterContainer>
        <LinkRow>
          <Links>
            <h4>Community</h4>
            <ul>
              <li>
                <a href={'https://discord.gg/templedao'} target={'_blank'} rel="noreferrer">
                  <Image src={socialDiscordIcon} alt={''} width={24} height={24} />
                  <strong>Discord</strong>
                </a>
              </li>
              <li>
                <a href={'https://twitter.com/templedao'} target={'_blank'} rel="noreferrer">
                  <Image src={socialTwitterIcon} alt={''} width={24} height={24} />
                  <strong>Twitter</strong>
                </a>
              </li>
              <li>
                <a href={'https://t.me/TempleDAOcommunity'} target={'_blank'} rel="noreferrer">
                  <Image src={socialTelegramIcon} alt={''} width={24} height={24} />
                  <strong>Telegram</strong>
                </a>
              </li>
              <li>
                <a href={'https://templecodex.link'} target={'_blank'} rel="noreferrer">
                  <Image src={socialCodexIcon} alt={''} width={24} height={24} />
                  <strong>Codex</strong>
                </a>
              </li>
            </ul>
          </Links>
          <Links>
            <h4>Resources</h4>
            <ul>
              <li>
                <a href={'https://docs.templedao.link/'} target={'_blank'} rel="noreferrer">
                  <Image src={socialDocsIcon} alt={''} width={24} height={24} />
                  <strong>Docs</strong>
                </a>
              </li>
              <li>
                <a href={'https://templedao.medium.com/'} target={'_blank'} rel="noreferrer">
                  <Image src={socialMediumIcon} alt={''} width={24} height={24} />
                  <strong>Medium</strong>
                </a>
              </li>
              <li>
                <a href={'mailto:templedao@protonmail.com'}>
                  <Image src={socialMessageIcon} alt={''} width={24} height={24} />
                  <strong>Contact Us</strong>
                </a>
              </li>
            </ul>
          </Links>
          <Links>
            <h4>Links</h4>
            <ul>
              <li>
                {' '}
                <Link to={''}>
                  <strong>Disclaimer</strong>
                </Link>
              </li>
              <li>
                <ClaimFromVaultsLegacyLink to="/dapp/vaults/1m-core/claim">
                  Claim from vaults (Legacy)
                </ClaimFromVaultsLegacyLink>
              </li>
              <li>
                <UnstakeOgtLegacyLink to="/dapp/trade/unstake">Unstake OGT (Legacy)</UnstakeOgtLegacyLink>
              </li>
            </ul>
          </Links>
        </LinkRow>
        <CopywriteRow>© 2022 TempleDAO. All rights reserved.</CopywriteRow>
      </FooterContainer>
      <ClaimModal
        isOpen={isClaimFromVaultsLegacyModalOpen}
        onClose={() => setIsClaimFromVaultsLegacyModalOpen(false)}
      />
      <UnstakeOgtModal isOpen={isUnstakeOgtLegacyModalOpen} onClose={() => setIsUnstakeOgtLegacyModalOpen(false)} />
    </>
  );
};

const primaryColor = '#bd7b4f';
const secondaryColor = '#ffdec9';

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

const ClaimFromVaultsLegacyLink = styled(Link)`
  cursor: pointer;
  margin-left: 0.75rem;
`;

const UnstakeOgtLegacyLink = styled(Link)`
  cursor: pointer;
  margin-left: 0.75rem;
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
  font-size: 1.5rem;
  margin: 0 0 0.5rem 0;
`;

const MarketingText = styled.p`
  font-size: 1.1rem;
  margin: 0;
  letter-spacing: 0.05em;
  color: ${primaryColor};
  -webkit-text-stroke: 0.2px ${primaryColor};
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

const Links = styled.div`
  display: flex;
  flex-direction: column;
`;

const CopywriteRow = styled.div`
  height: 20px;
  padding: 30px;
  font-size: 14px;
  letter-spacing: 0.095em;
  color: ${primaryColor};
`;

export default Home;
