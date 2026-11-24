import styled from 'styled-components';
import Image from '../../../Image/Image';
import buildings from './assets/Buildings.svg';
import hero from './assets/Hero.svg';
import { Link } from 'react-router-dom';
import { Button } from 'components/Button/Button';
import { useEffect, useState } from 'react';
import { queryProtocolData, queryTrvData, subgraphQuery } from 'utils/subgraph';
import env from 'constants/env';

interface Metrics {
  price: number;
  tpi: number;
  treasury: number;
}

// Placeholder while the new landing page is designed: the hero and metrics.
const Home = () => {
  const [metrics, setMetrics] = useState<Metrics>({
    price: 0,
    tpi: 0,
    treasury: 0,
  });

  useEffect(() => {
    const fetchMetrics = async () => {
      const treasuryData = await subgraphQuery(
        env.subgraph.templeV2Balances,
        queryTrvData()
      );

      const protocolData = await subgraphQuery(
        env.subgraph.protocolMetrics,
        queryProtocolData()
      );

      const treasuryMetrics = treasuryData.treasuryReservesVaults[0];
      setMetrics({
        price: parseFloat(protocolData.metrics[0].templePrice),
        tpi: parseFloat(treasuryMetrics.treasuryPriceIndex),
        treasury:
          parseFloat(treasuryMetrics.principalUSD) +
          parseFloat(treasuryMetrics.benchmarkedEquityUSD),
      });
    };
    fetchMetrics();
  }, []);

  return (
    <TopContainer>
      <RaysImage src={hero} />
      <HeroRing>
        <ContentContainer>
          <NewTempleText>The New Temple</NewTempleText>
          <TradeDetailText>
            A Bazaar for Traders and Oasis for DeFi travelers
          </TradeDetailText>
          <LearnMoreLink href="https://docs.templedao.link/" target={'_blank'}>
            Learn More
          </LearnMoreLink>
          <ButtonContainer>
            <Link to="/dapp/granary">
              <LaunchAppButton label={'Launch App'} role="button" />
            </Link>
          </ButtonContainer>
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
          <MetricValue>${(metrics.treasury / 1000000).toFixed(2)}M</MetricValue>
          <MetricTitle>Treasury Value</MetricTitle>
        </Metric>
      </MetricsRow>
    </TopContainer>
  );
};

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
// Footer
export default Home;

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
