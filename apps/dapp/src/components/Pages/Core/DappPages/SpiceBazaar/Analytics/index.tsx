import styled from 'styled-components';
import { useState } from 'react';
import linkSvg from 'assets/icons/link.svg?react';
import { TransactionsHistory } from './Table/Table';
import { Chart } from './Chart/Chart';
import * as breakpoints from 'styles/breakpoints';
import { useMediaQuery } from 'react-responsive';
import { queryPhone } from 'styles/breakpoints';

type ItemProps = {
  isActive: boolean;
};

const Selectors = ['USD', 'DAI', 'TEMPLE', 'TGLD'];

export const Analytics = () => {
  const isPhoneOrAbove = useMediaQuery({
    query: queryPhone,
  });

  const [activeTab, setActiveTab] = useState('USD');

  return (
    <PageContainer>
      <Title>
        <TitleText>Analytics</TitleText>
        <LinkIcon />
      </Title>
      <BodyContainer>
        <Selector>
          <SelectorTitle>Base currency</SelectorTitle>
          <Items>
            {Selectors.map((item) => (
              <Item
                key={item}
                isActive={activeTab === item}
                onClick={() => setActiveTab(item)}
              >
                <ItemText>{item}</ItemText>
              </Item>
            ))}
          </Items>
        </Selector>
        <Chart />
        <InfoRow1>
          <InfoCell1>
            <Value1>$1.12 M</Value1>
            <Text1>Value of Holdings</Text1>
          </InfoCell1>
          <InfoCell1>
            <Value1>$0.69 M</Value1>
            <Text1>Nominal Equity</Text1>
          </InfoCell1>
          <InfoCell1>
            <Value1>$0.19 M</Value1>
            <Text1>Benchmarked Equity</Text1>
          </InfoCell1>
          <InfoCell1>
            <Value1>5.58% p.a.</Value1>
            <Text1>Interest Rate</Text1>
          </InfoCell1>
        </InfoRow1>

        {isPhoneOrAbove ? (
          <>
            <InfoRow2>
              <InfoCell2>
                <Value2>36%</Value2>
                <Text2>Dept Share</Text2>
              </InfoCell2>
              <InfoCell2>
                <Value2>$4.51 M</Value2>
                <Text2>Debt Ceiling</Text2>
              </InfoCell2>
              <InfoCell2>
                <Value2>25.12%</Value2>
                <Text2>Debt Ceiling Utilization</Text2>
              </InfoCell2>
              <InfoCell2>
                <Value2>2.41 DAI</Value2>
                <Text2>Total Repayment</Text2>
              </InfoCell2>
              <InfoCell2>
                <Value2>$1.20 B</Value2>
                <Text2>Principal</Text2>
              </InfoCell2>
              <InfoCell2>
                <Value2>$980.83 K</Value2>
                <Text2>Accrued dUSD Interest</Text2>
              </InfoCell2>
            </InfoRow2>
            <InfoRow2>
              <InfoCell2>
                <Value2>$0.44 B</Value2>
                <Text2>Nominal Equity</Text2>
              </InfoCell2>
              <InfoCell2>
                <Value2>$1.20 B</Value2>
                <Text2>Benchmarked Equity</Text2>
              </InfoCell2>
              <InfoCell2>
                <Value2>1.35%</Value2>
                <Text2>Nominal Performance</Text2>
              </InfoCell2>
              <InfoCell2>
                <Value2>0.38%</Value2>
                <Text2>Benchmark Performance</Text2>
              </InfoCell2>
              <InfoCell2>
                <Value2>110%</Value2>
                <Text2>Positive Threshold</Text2>
              </InfoCell2>
              <InfoCell2>
                <Value2>90%</Value2>
                <Text2>Negative Threshold</Text2>
              </InfoCell2>
            </InfoRow2>
          </>
        ) : (
          <>
            <InfoRow2>
              <InfoCell2>
                <Value2>36%</Value2>
                <Text2>Dept Share</Text2>
              </InfoCell2>
              <InfoCell2>
                <Value2>$4.51 M</Value2>
                <Text2>Debt Ceiling</Text2>
              </InfoCell2>
            </InfoRow2>
            <InfoRow2>
              <InfoCell2>
                <Value2>25.12%</Value2>
                <Text2>Debt Ceiling Utilization</Text2>
              </InfoCell2>
              <InfoCell2>
                <Value2>2.41 DAI</Value2>
                <Text2>Total Repayment</Text2>
              </InfoCell2>
            </InfoRow2>
            <InfoRow2>
              <InfoCell2>
                <Value2>$1.20 B</Value2>
                <Text2>Principal</Text2>
              </InfoCell2>
              <InfoCell2>
                <Value2>$980.83 K</Value2>
                <Text2>Accrued dUSD Interest</Text2>
              </InfoCell2>
            </InfoRow2>
            <InfoRow2>
              <InfoCell2>
                <Value2>$0.44 B</Value2>
                <Text2>Nominal Equity</Text2>
              </InfoCell2>
              <InfoCell2>
                <Value2>$1.20 B</Value2>
                <Text2>Benchmarked Equity</Text2>
              </InfoCell2>
            </InfoRow2>
            <InfoRow2>
              <InfoCell2>
                <Value2>1.35%</Value2>
                <Text2>Nominal Performance</Text2>
              </InfoCell2>
              <InfoCell2>
                <Value2>0.38%</Value2>
                <Text2>Benchmark Performance</Text2>
              </InfoCell2>
            </InfoRow2>
            <InfoRow2>
              <InfoCell2>
                <Value2>110%</Value2>
                <Text2>Positive Threshold</Text2>
              </InfoCell2>
              <InfoCell2>
                <Value2>90%</Value2>
                <Text2>Negative Threshold</Text2>
              </InfoCell2>
            </InfoRow2>
          </>
        )}
      </BodyContainer>
      <TransactionsHistory />
    </PageContainer>
  );
};

const PageContainer = styled.div`
  margin-top: -20px;
  display: flex;
  flex-direction: column;
  gap: 20px;

  ${breakpoints.phoneAndAbove(`
    gap: 40px;
  `)}
`;

const Title = styled.div`
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: 15px;
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

const LinkIcon = styled(linkSvg)`
  fill: ${({ theme }) => theme.palette.brand};
  cursor: pointer;
`;

const BodyContainer = styled.div`
  display: flex;
  flex-direction: column;
  gap: 60px;

  ${breakpoints.phoneAndAbove(`
    gap: 40px;
  `)}
`;

const Selector = styled.div`
  display: flex;
  flex-direction: row;
  gap: 25px;
  align-items: center;
`;

const SelectorTitle = styled.div`
  font-size: 16px;
  line-height: 19px;
  color: ${({ theme }) => theme.palette.brand};
`;

const Items = styled.div`  
  display: flex;
  flex-direction: row;
  justify-content: center;
  height: 37px;
  gap: 16px; 
  border: 1.5px solid ${({ theme }) => theme.palette.brand};
  border-radius: 30px;
  backdrop-filter: blur(42px)
  box-shadow: -5px -5px 250px 0px #FFFFFF05 inset;
`;

const Item = styled.button<ItemProps>`
  cursor: pointer;
  background: ${(props) =>
    props.isActive
      ? ({ theme }) => theme.palette.gradients.greyVertical
      : 'none'};
  border: ${({ isActive, theme }) =>
    isActive ? `1.5px solid ${theme.palette.brand}` : 'none'};
  border-radius: 40px;
  box-shadow: ${(props) =>
    props.isActive ? '0px 0px 20px 0px #DE5C0666' : 'none'};
  padding: 8px 20px 8px 20px;
`;

const ItemText = styled.p`
  font-size: 12px;
  font-weight: 700;
  line-height: 18px;
  color: ${({ theme }) => theme.palette.brandLight};
  margin: 0px;
`;

const InfoRow1 = styled.div`
  display: flex;
  gap: 22.5px;
  flex-direction: column;

  ${breakpoints.phoneAndAbove(`
    flex-direction: row;
  `)}
`;

const InfoRow2 = styled.div`
  display: flex;
  flex-direction: row;
  justify-content: space-around;
  padding: 0px 20px;

  ${breakpoints.phoneAndAbove(`
    gap: 0px;   
    padding: 0px 0px;
  `)}
`;

const InfoCell1 = styled.div`
  display: flex;
  flex-direction: column;
  justify-content: center;
  flex-grow: 1;
  flex-basis: 0;
  align-items: center;
  padding: 18px 30px 18px 30px;
  gap: 5px;
  border-radius: 10px;
  border: 1px solid ${({ theme }) => theme.palette.brand};
  background: linear-gradient(180deg, #0b0a0a 0%, #1d1a1a 100%);
  min-height: 136px;

  ${breakpoints.phoneAndAbove(`
    min-height: 109px;
  `)}
`;

const InfoCell2 = styled.div`
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  padding: 7px 8px 7px 8px;
  gap: 6px;
  min-width: 200px;
  height: 52px;
`;

const Value1 = styled.div`
  font-size: 24px;
  line-height: 30px;
  color: ${({ theme }) => theme.palette.brandLight};
`;

const Text1 = styled.p`
  font-size: 16px;
  line-height: 19px;
  color: ${({ theme }) => theme.palette.brand};
  margin: 0px;
`;

const Value2 = styled.p`
  font-size: 16px;
  line-height: 19px;
  color: ${({ theme }) => theme.palette.brandLight};
  margin: 0px;
`;

const Text2 = styled.p`
  font-size: 16px;
  line-height: 19px;
  color: ${({ theme }) => theme.palette.brand};
  margin: 0px;
`;
