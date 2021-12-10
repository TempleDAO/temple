import React, {
  useState,
  useCallback,
  useEffect,
  MouseEventHandler,
} from 'react';
import styled from 'styled-components';
import { curveCatmullRom } from 'd3-shape';
import { FlexibleXYPlot, XAxis, YAxis, LineSeries, Crosshair } from 'react-vis';
import { formatNumber } from 'utils/formatter';
import Image from 'components/Image/Image';
import useRefreshablePriceMetrics from 'hooks/use-refreshable-price-metrics';
import sunImage from 'assets/images/sun-art.svg';
import 'react-vis/dist/style.css';

const CHART_SIZE = {
  width: 800,
  height: 300,
};

export enum TIME_INTERVAL {
  ONE_HOUR = 60 * 60 * 1000,
  ONE_DAY = 24 * ONE_HOUR,
  ONE_WEEK = 7 * ONE_DAY,
  TWO_WEEKS = ONE_WEEK * 2,
  ONE_MONTH = ONE_DAY * 30,
  THREE_MONTHS = ONE_MONTH * 3,
  SIX_MONTHS = ONE_MONTH * 6,
  ONE_YEAR = ONE_MONTH * 12,
}

const availableIntervals = [
  { interval: TIME_INTERVAL.ONE_HOUR, label: '1H' },
  { interval: TIME_INTERVAL.ONE_DAY, label: '1D' },
  { interval: TIME_INTERVAL.ONE_WEEK, label: '1W' },
  { interval: TIME_INTERVAL.ONE_MONTH, label: '1M' },
  { interval: TIME_INTERVAL.SIX_MONTHS, label: '6M' },
  { interval: TIME_INTERVAL.ONE_YEAR, label: '1Y' },
];

export type ChartData = {
  priceDataPoints: DataPoint[];
  ivDataPoints: DataPoint[];
};

export type DataPoint = {
  x: number;
  y: number;
};

type CrosshairData = {
  x: Date;
  y: number;
};

type LineChartProps = {
  timeInterval?: TIME_INTERVAL;
};

const Container = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  //not using rem as not to have the value hardcoded
  //see <FlexibleXYPlot> component usage below
  min-width: ${CHART_SIZE.width}px;
  min-height: ${CHART_SIZE.height}px;
  width: 100%;
  height: 100%;
  * {
    font-family: megant;
  }
`;

const TogglerRow = styled.div`
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: space-between;
  gap: 1.25rem;
  width: 90%;
`;

const TogglerContainer = styled.div`
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: 1.25rem;
  font-size: 0.7rem;
`;

const PriceInfoContainer = styled.div`
  display: flex;
  flex-direction: column;
`;

const TemplePrice = styled.span`
  font-size: 2rem;
  color: #ffffff;
  font-weight: bold;
  opacity: 0.7;
`;

const PriceChange = styled.span`
  display: inline-block;
  font-size: 0.7rem;
  color: ${({ theme }) => theme.palette.brand};
  font-weight: bold;
`;

type ToggleProps = {
  selected?: boolean;
  onClick: MouseEventHandler;
};

const Toggle = styled.span<ToggleProps>`
  display: inline-block;
  user-select: none;
  cursor: pointer;
  color: ${({ selected, theme }) =>
    selected ? theme.palette.brand : '#6b6b76'};
  &:hover {
    color: white;
  }
  font-weight: bold;
`;

const NotEnoughData = styled.div`
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  width: 100%;
  height: 100%;
`;

export const PriceChart = ({
  timeInterval = TIME_INTERVAL.ONE_WEEK,
}: LineChartProps) => {
  const [selectedInterval, setSelectedInterval] = useState(timeInterval);
  const [loading, setLoading] = useState(true);
  const data = useProtocolMetrics();

  const { dataPoints, xDomain, yDomain, priceData } = useTemplePrice(
    data,
    selectedInterval
  );

  const { crosshairValues, onMouseLeave, onNearestX } =
    useCrosshairs(dataPoints);

  const priceChange = formatNumber(priceData.domainPriceChangePercentage);

  useEffect(() => {
    if (data.priceDataPoints.length && loading) {
      setLoading(false);
    }
  }, [data, loading, setLoading]);

  return (
    <Container>
      <>
        <TogglerRow>
          <PriceInfoContainer>
            <TemplePrice>{`$${formatNumber(
              priceData.currentPrice
            )}`}</TemplePrice>
            <PriceChange>
              {`${priceChange <= 0 ? '' : '+'}${priceChange} % past ${
                availableIntervals.find(
                  ({ interval }) => interval === selectedInterval
                )!.label
              }`}
            </PriceChange>
          </PriceInfoContainer>
          <TogglerContainer>
            {availableIntervals.map(({ interval, label }) => (
              <Toggle
                key={interval}
                onClick={() => setSelectedInterval(interval)}
                selected={interval === selectedInterval}
              >
                {label}
              </Toggle>
            ))}
          </TogglerContainer>
        </TogglerRow>
        {dataPoints.priceDataPoints.length >= 2 ? (
          <FlexibleXYPlot
            xType={'time-utc'}
            xDomain={xDomain}
            yDomain={yDomain}
            onMouseLeave={onMouseLeave}
          >
            <XAxis
              style={{
                line: { stroke: '#2b2a2d' },
                ticks: { stroke: '#6b6b76' },
                text: {
                  stroke: 'none',
                  fill: '#6b6b76',
                  fontFamily: 'CaviarDreams',
                  fontSize: 10,
                },
              }}
              tickTotal={10}
            />
            <YAxis
              style={{
                line: { stroke: '#2b2a2d' },
                ticks: { stroke: '#6b6b76' },
                text: { stroke: 'none', fill: '#6b6b76', fontWeight: 600 },
              }}
            />
            <LineSeries
              data={dataPoints.ivDataPoints}
              color={'#696766'}
              curve={curveCatmullRom}
              //this prop exists, typedef must be outdated
              //@ts-ignore
              strokeWidth={2}
              strokeStyle="dashed"
              onNearestX={onNearestX}
            />
            <LineSeries
              data={dataPoints.priceDataPoints}
              color={'#BD7B4F'}
              curve={curveCatmullRom}
              //this prop exists, typedef must be outdated
              //@ts-ignore
              strokeWidth={5}
              onNearestX={onNearestX}
            />
            {/* array of x values per index */}
            <Crosshair
              values={crosshairValues}
              titleFormat={(d) => ({
                title: 'date',
                value: formatDate(d[0].x),
              })}
              itemsFormat={(d) => [
                { title: 'price', value: `$${+Number(d[0].y).toFixed(4)}` },
                { title: 'IV', value: `$${+Number(d[1].y).toFixed(4)}` },
              ]}
            />
          </FlexibleXYPlot>
        ) : (
          <NotEnoughData>
            <p className={'color-brand'}>
              Not enough data for this interval. Try again later.
            </p>
            <Image src={sunImage} width={70} height={70} />
          </NotEnoughData>
        )}
      </>
    </Container>
  );
};

function useProtocolMetrics() {
  const metrics = useRefreshablePriceMetrics();
  let data: ChartData = {
    priceDataPoints: [],
    ivDataPoints: [],
  };

  if (metrics.length) {
    const priceDataPoints = metrics.map((dataPoint) => ({
      x: Number(dataPoint.timestamp) * 1000,
      y: Number(dataPoint.templePrice),
    }));

    const ivDataPoints = metrics.map((dataPoint) => ({
      x: Number(dataPoint.timestamp) * 1000,
      y: Number(dataPoint.treasuryStables) / Number(dataPoint.templeSupply),
    }));

    data = { priceDataPoints, ivDataPoints };
  }

  return data;
}

function useCrosshairs(data: ChartData) {
  const dataArr = [data.priceDataPoints, data.ivDataPoints];
  const [crosshairValues, setCrosshairValues] = useState<CrosshairData[]>([]);

  function curateValue(dataPoint: DataPoint): CrosshairData {
    const { x: date, y: price } = dataPoint;
    return { x: new Date(date), y: price };
  }

  const onMouseLeave = useCallback(
    () => setCrosshairValues([]),
    [setCrosshairValues]
  );

  const onNearestX = useCallback(
    (_value, { index }) => {
      setCrosshairValues(dataArr.map((d) => curateValue(d[index])));
    },
    [setCrosshairValues, data]
  );

  return { crosshairValues, onMouseLeave, onNearestX };
}

function useTemplePrice(data: ChartData, interval: TIME_INTERVAL) {
  if (!data?.priceDataPoints?.length) {
    return {
      dataPoints: { priceDataPoints: [], ivDataPoints: [] },
      xDomain: [],
      yDomain: [],
      priceData: { currentPrice: 0, domainPriceChangePercentage: 0 },
    };
  }

  const now = Date.now();
  const lowerDateThreshold = now - interval;
  const domainFilter = ({ x }: DataPoint) => x > lowerDateThreshold;

  const domainDataPoints: ChartData = {
    priceDataPoints: data.priceDataPoints.filter(domainFilter),
    ivDataPoints: data.ivDataPoints.filter(domainFilter),
  };

  const upperPriceThreshold = Math.abs(
    Math.max(...domainDataPoints.priceDataPoints.map(({ y }) => y)) * 1.5
  );

  const xDomain = [lowerDateThreshold, now];
  const yDomain = [0, upperPriceThreshold];

  const oldestDomainPrice = domainDataPoints.priceDataPoints[0].y;
  const currentPrice =
    domainDataPoints.priceDataPoints[
      domainDataPoints.priceDataPoints.length - 1
    ].y;

  const priceData = {
    currentPrice,
    domainPriceChangePercentage: (currentPrice - oldestDomainPrice) * 100,
    domainPriceChange: currentPrice - oldestDomainPrice,
  };

  return { dataPoints: domainDataPoints, xDomain, yDomain, priceData };
}

function formatDate(utcDate: Date) {
  const iso = utcDate.toISOString();
  const [date, time] = iso.split('T');
  return `${date} @ ${time.split('.')[0]} UTC+0`;
}
