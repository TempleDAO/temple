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
import { useState } from 'react';
import { Trade } from './TradeNew';

const Home = () => {
  const [tradeFormVisible, setTradeFormVisible] = useState(false);

  const tradeButtonClickHandler = () => {
    setTradeFormVisible((tradeFormVisible) => !tradeFormVisible);
    console.log(tradeFormVisible);
  };

  return (
    <>
      <TopContainer>
        <TradeWindow>
          <ContentContainer>
            {tradeFormVisible ? (
              <Trade />
            ) : (
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
        </TradeWindow>
        <BuildingsImage src={buildings} />
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

      <MainContainer>
        <LowerContainerColumn>
          <PriceHistory>Price History</PriceHistory>
          <ChartContainer>
            <PriceChartNew />
          </ChartContainer>

          <HowDoesItWorkText>How Does It Work?</HowDoesItWorkText>
          <MarketingRow>
            <ObtainTempleImage src={obtainTemple} />
            <MarketingTextWrapper>
              <MarketingHeader>Obtain $TEMPLE</MarketingHeader>
              <MarketingText>
                Provide your tokens, growing the Temple Treasury and recieving $TEMPLE in return.
              </MarketingText>
            </MarketingTextWrapper>
          </MarketingRow>
          <MarketingRow>
            <MarketingTextWrapper>
              <MarketingHeader>Intrinsic value</MarketingHeader>
              <MarketingText>
                Each $TEMPLE token has intrinsic value equal to the treasury value, divided by the number of $TEMPLE
                tokens.
              </MarketingText>
            </MarketingTextWrapper>
            <IntrinsicValueImage src={intrValue} />
          </MarketingRow>
          <MarketingRow>
            <TreasuryGrowthImage src={treasuryGrowth} />
            <MarketingTextWrapper>
              <MarketingHeader>Treasury Growth</MarketingHeader>
              <MarketingText>
                The Temple Treasury is put to work, generating revenue for the protocol. This will drive up the
                intrinsic value of each $TEMPLE token over time.
              </MarketingText>
            </MarketingTextWrapper>
          </MarketingRow>
          <MarketingRow>
            <MarketingTextWrapper>
              <MarketingHeader>Elastic Floor</MarketingHeader>
              <MarketingText>
                If the $TEMPLE token price drops below the intrinsic value, a contract will buy back tokens at
                randomised times and in randomised amounts, restoring the price and maintaining an elastic floor.
              </MarketingText>
            </MarketingTextWrapper>
            <ElasticFloorImage src={elasticFloor} />
          </MarketingRow>
        </LowerContainerColumn>
      </MainContainer>

      <FooterContainer>
        <FooterLine />
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
                <Link to={'/disclaimer'}>
                  <strong>Disclaimer</strong>
                </Link>
              </li>
              <li>
                <Link to={'/disclaimer'}>
                  <strong>Claim from vaults (Legacy)</strong>
                </Link>
              </li>
              <li>
                <Link to={'/disclaimer'}>
                  <strong>Unstake OGT (Legacy)</strong>
                </Link>
              </li>
            </ul>
          </Links>
        </LinkRow>
        <CopywriteRow>© 2022 TempleDAO. All rights reserved.</CopywriteRow>
      </FooterContainer>
    </>
  );
};

const primaryColor = '#bd7b4f';
const secondaryColor = '#ffdec9';

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

const LearnMoreLink = styled.a`
  font-size: 0.75rem;
  letter-spacing: 0.095rem;
  text-decoration-line: underline;
  margin-top: 1rem;
`;

const TradeDetailText = styled.div`
  font-size: 1.25rem;
  margin-top: 1rem;
`;

const NewTempleText = styled.div`
  font-size: 1.75rem;
  margin-top: 1rem;
  color: ${secondaryColor};
`;

const TradeWindow = styled.div`
  margin: 4rem 0 0 1rem; // offset so ring can match rays
  min-width: 600px;
  width: 600px;
  height: 600px;
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

const MetricValue = styled.div`
  font-size: 2rem;
  color: ${secondaryColor};
`;

const MetricTitle = styled.div`
  font-size: 1.25rem;
`;

const Metric = styled.div`
  width: 250px;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  border: 1px solid ${primaryColor};
  border-radius: 0.75rem;
  padding: 10px;
  gap: 10px;
  padding: 1rem 0;
  background: #0b0a0a;
`;

const MetricsRow = styled.div`
  position: absolute;
  bottom: 2rem;
  display: flex;
  flex-direction: row;
  justify-content: space-evenly;
  gap: 4rem;
  z-index: 2;
`;

const ChartContainer = styled.div`
  width: 100%;
  height: 500px;
`;

const HowDoesItWorkText = styled.div`
  font-size: 36px;
  display: flex;
  align-items: center;
  z-index: 2;
  padding-top: 100px;
`;

const PriceHistory = styled.div`
  font-size: 36px;
  display: flex;
  align-items: center;
  z-index: 2;
`;

const BuildingsImage = styled(Image)`
  height: 550px;
  position: absolute;
  bottom: -2rem;
`;

const TopContainer = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  color: ${primaryColor};
  height: 100vh;
  background: url(${rays}) no-repeat;
  background-position: center;
`;

const FooterLine = styled.div`
  border-top: 3px solid #351f11;
  width: 100%;
`;

const CopywriteRow = styled.div`
  height: 20px;
  padding: 30px;
  font-size: 14px;
  letter-spacing: 0.095em;
  color: ${primaryColor};
`;

const Links = styled.div`
  display: flex;
  flex-direction: column;
`;

const LinkRow = styled.div`
  display: flex;
  flex-direction: row;
  justify-content: space-evenly;
  align-items: flex-start;
  width: 1000px;

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

const FooterContainer = styled.div`
  width: 100%;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  background-image: url('${footerTexture}');
  background-size: cover;
`;

const MarketingTextWrapper = styled.div`
  display: flex;
  flex-direction: column;
`;

const MarketingHeader = styled.div``;

const MarketingText = styled.div`
  align-self: stretch;
  position: relative;
  display: inline-block;
  font-size: 16px;
  letter-spacing: 0.05em;
  line-height: 120%;
  color: ${primaryColor};
  -webkit-text-stroke: 0.2px ${primaryColor};
`;

const ObtainTempleImage = styled(Image)`
  // display: block;
  //   margin-top: -100px;
`;

const IntrinsicValueImage = styled(Image)`
  // foo
`;

const TreasuryGrowthImage = styled(Image)`
  //foo
`;

const ElasticFloorImage = styled(Image)`
  // foo
`;

const MarketingRow = styled.div`
  display: flex;
  flex-direction: row;
  justify-content: center;
  align-items: center;
  margin-top: -100px;
`;

const LowerContainerColumn = styled.div`
  display: flex;
  flex-direction: column;
  justify-content: center;
`;

const MainContainer = styled.div`
  display: flex;
  flex-direction: column;
  width: 1100px;
  justify-content: center;
  margin: auto;
`;

export default Home;
