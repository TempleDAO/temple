import { useEffect, useState } from 'react';
import styled, { useTheme } from 'styled-components';
import { subDays } from 'date-fns';
import { format } from 'date-fns';
import { formatNumberAbbreviated } from 'utils/formatter';
import CustomBarChart from '../components/BarChart';
import * as breakpoints from 'styles/breakpoints';
import { InputSelect, Option } from '../../components/InputSelector';
import Loader from 'components/Loader/Loader';

type XAxisTickFormatter = (timestamp: number) => string;

export const tickFormatter: XAxisTickFormatter = (timestamp) =>
  format(new Date(timestamp), 'MMM dd');

type Metric = {
  name: string;
  value1: number;
  value2: number;
  value3: number;
  value4: number;
};

const data = [
  {
    name: 'KAMI',
    value1: 1.0,
    value2: 0.4,
    value3: 1.6,
    value4: 1.1,
  },
  {
    name: 'ENA',
    value1: 1.8,
    value2: 1.0,
    value3: 0.5,
    value4: 0.5,
  },
  {
    name: 'BRRR',
    value1: 1.9,
    value2: 0.2,
    value3: 1.0,
    value4: 1.0,
  },
  {
    name: 'iRED',
    value1: 2.5,
    value2: 0.0,
    value3: 1.0,
    value4: 1.0,
  },
];

const auctionOptions = [
  { label: 'KAMI', value: 'KAMI' },
  { label: 'ENA', value: 'ENA' },
  { label: 'BRRR', value: 'BRRR' },
  { label: 'iRED', value: 'iRED' },
];

const series = [
  { key: 'value1', color: '#FFDEC9' },
  { key: 'value2', color: '#D0BE75' },
  { key: 'value3', color: '#BD7B4F' },
  { key: 'value4', color: '#95613F' },
];

export const ValueOfSpiceAuc = () => {
  const theme = useTheme();
  const [metrics, setMetrics] = useState<Metric[]>([]);

  useEffect(() => {
    setMetrics(data);
  }, []);

  const [selectedAuctions, setSelectedAuctions] = useState<Option[]>([
    auctionOptions[0],
    auctionOptions[1],
    auctionOptions[2],
    auctionOptions[3],
    auctionOptions[4],
    auctionOptions[5],
    auctionOptions[6],
  ]);

  const handleChange = (selected: Option[]) => {
    setSelectedAuctions(selected);
  };

  if (!metrics.length) return <Loader />;

  return (
    <PageContainer>
      <HeaderContainer>
        <Title>Value of Spice Auctions</Title>
        <Options>
          <SelectMetricContainer1>
            <InputSelect
              options={auctionOptions}
              defaultValue={selectedAuctions}
              onChange={handleChange}
              width="150px"
              fontSize="1rem"
              maxMenuItems={7}
              textAlloptions="All tokens"
            />
          </SelectMetricContainer1>
        </Options>
      </HeaderContainer>
      <BodyContainer>
        <LeftContainer>
          <Box>
            <Sum>$1,123,181</Sum>
            <BoxTitle>Total Real Market Value</BoxTitle>
          </Box>
          <Box>
            <Sum>5,834 TGLD</Sum>
            <BoxTitle>Burned TGLD</BoxTitle>
          </Box>
        </LeftContainer>
        <CustomBarChart
          chartData={data.filter((d) =>
            selectedAuctions.some((option) => option.label === d.name)
          )}
          series={series}
          xDataKey="name"
          xTickFormatter={(val: any) => val}
          yTickFormatter={(val: any) =>
            `$${formatNumberAbbreviated(val).number.toFixed(2)}`
          }
          tooltipLabelFormatter={(value: any) => value}
          yDomain={[1.0, 2.5, 4.0, 5.5]}
          tooltipValuesFormatter={(value) => [
            `$ ${value.toFixed(2)} M`,
            'Value',
          ]}
        />
      </BodyContainer>
    </PageContainer>
  );
};

const PageContainer = styled.div`
  height: 100%;
  display: flex;
  flex-direction: column;
  gap: 20px;
  width: 100%;
`;

const HeaderContainer = styled.div`
  display: flex;
  flex-direction: column;
  gap: 20px;
`;

const Title = styled.h3`
  line-height: 45px;
  font-size: 24px;
  font-weight: 400;
  color: ${({ theme }) => theme.palette.brandLight};
  margin: 0px;
`;

const Options = styled.div`
  display: flex;
  flex-direction: row;
  gap: 20px;
  width: 320px;
`;

const SelectMetricContainer1 = styled.div`
  flex: 1;
  max-width: 100px;
`;

const BodyContainer = styled.div`
  display: flex;
  flex-direction: row;
  gap: 60px;
`;

const LeftContainer = styled.div`
  display: flex;
  flex-direction: row;
  gap: 20px;
  height: 309px;

  ${breakpoints.phoneAndAbove(`
    flex-direction: column;
    min-width: 460px;
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

const BoxTitle = styled.div`
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
