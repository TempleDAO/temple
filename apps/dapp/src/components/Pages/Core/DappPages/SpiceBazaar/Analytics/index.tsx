import styled from 'styled-components';
import { Chart } from './Chart/Chart';
import * as breakpoints from 'styles/breakpoints';
import { useMediaQuery } from 'react-responsive';
import { queryPhone } from 'styles/breakpoints';
import { ValueOfSpiceAuc } from './Chart/ValueOfSpiceAuc';
import { InputSelect } from 'components/InputSelect/InputSelect';
import { useState } from 'react';

const metricOptions: { value: string; label: string }[] = [
  { label: 'Chain 1', value: 'chain1' },
  { label: 'Opt 2', value: 'opt2' },
  { label: 'Opt 3', value: 'opt3' },
];

export const Analytics = () => {
  const isPhoneOrAbove = useMediaQuery({
    query: queryPhone,
  });
  const [selectedMetric1, setSelectedMetric1] = useState('chain1');

  const selectMetric1 = (metric: string) => {
    setSelectedMetric1(metric);
  };

  return (
    <PageContainer>
      <TopContainer>
        <HeaderContainer>
          <TitleText>Analytics</TitleText>
          <Options>
            <InputSelect
              options={metricOptions}
              defaultValue={metricOptions.find(
                (m) => m.value === selectedMetric1
              )}
              onChange={(e) => selectMetric1(e.value)}
              isSearchable={false}
              fontSize={'16px'}
              fontWeight={'400'}
            />
          </Options>
        </HeaderContainer>
        <BoxContainer>
          <Box>
            <Sum>$1,123,181</Sum>
            <Title>Total Bids for TGLD</Title>
          </Box>
          <Box>
            <Sum>45,213 TGLD</Sum>
            <Title>Total Bids for Spice Tokens</Title>
          </Box>
        </BoxContainer>
        <BoxContainer>
          <Box>
            <Sum>$5,192,192</Sum>
            <Title>Total Value for Spice Auctions</Title>
          </Box>
          <Box>
            <Sum>4,918 TGLD</Sum>
            <Title>TEMPLE Weekly Staking Yield</Title>
          </Box>
          <Box>
            <Sum>10,385,192 TGLD</Sum>
            <Title>Total Vested</Title>
          </Box>
        </BoxContainer>
      </TopContainer>
      <BodyContainer>
        <Subtitle>Key TGLD Metrics</Subtitle>
        <Chart />
      </BodyContainer>
      <ButtomContainer>
        <ValueOfSpiceAuc />
      </ButtomContainer>
    </PageContainer>
  );
};

const PageContainer = styled.div`
  margin-top: -20px;
  display: flex;
  flex-direction: column;
  gap: 20px;

  ${breakpoints.phoneAndAbove(`
    gap: 60px;
  `)}
`;

const TopContainer = styled.div`
  display: flex;
  flex-direction: column;
  gap: 40px;
`;

const HeaderContainer = styled.div`
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: 20px;
`;

const Options = styled.div`
  width: 118px;
`;

const TitleText = styled.h2`
  color: ${({ theme }) => theme.palette.brandLight};
  margin: 0px;
  font-size: 28px;
  line-height: 52px;

  ${breakpoints.phoneAndAbove(`
    font-size: 36px;
    line-height: 67px;
  `)}
`;

const BoxContainer = styled.div`
  display: flex;
  flex-direction: column;
  gap: 20px;

  ${breakpoints.phoneAndAbove(`
    flex-direction: row;
  `)}
`;

const Box = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  flex-grow: 1;
  flex-basis: 0;
  min-height: 136px;
  gap: 12px;
  padding: 10px;
  border: 1px solid ${({ theme }) => theme.palette.brand};
  border-radius: 10px;
  background: linear-gradient(
    to bottom,
    #0b0a0a,
    #1d1a1a
  ); //it is lighter than the grey from theme.palette
`;

const Title = styled.div`
  font-size: 16px;
  line-height: 19px;
  color: ${({ theme }) => theme.palette.brand};
`;

const Sum = styled.div`
  font-size: 24px;
  font-weight: 700;
  line-height: 29px;
  color: ${({ theme }) => theme.palette.brandLight};
`;

const BodyContainer = styled.div`
  display: flex;
  flex-direction: column;
  gap: 20px;

  ${breakpoints.phoneAndAbove(`
  `)}
`;

const Subtitle = styled.h3`
  line-height: 45px;
  font-size: 24px;
  color: ${({ theme }) => theme.palette.brandLight};
  margin: 0px;
`;

const ButtomContainer = styled.div`
  display: flex;

  ${breakpoints.phoneAndAbove(`
  `)}
`;
