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
import Loader from 'components/Loader/Loader';
import useRefreshablePriceMetrics, {
  PriceMetrics,
} from 'hooks/use-refreshable-price-metrics';
import sunImage from 'assets/images/sun-art.svg';
import 'react-vis/dist/style.css';

const CHART_SIZE = {
  width: 800,
  height: 300,
};

const CORRUPTED_TIMESTAMPS = [1640696724000, 1640700414000];

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
  { interval: TIME_INTERVAL.ONE_DAY, label: '24H' },
  { interval: TIME_INTERVAL.ONE_WEEK, label: '1W' },
  { interval: TIME_INTERVAL.ONE_MONTH, label: '1M' },
  { interval: TIME_INTERVAL.SIX_MONTHS, label: '6M' },
  { interval: TIME_INTERVAL.ONE_YEAR, label: '1Y' },
];

export type ChartData = {
  priceDataPoints: DataPoint[];
  ivDataPoints: DataPoint[];
  templeThresholdDataPoints: DataPoint[];
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
  noTicks?: boolean;
};

const Container = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  //not using rem as not to have the value hardcoded
  //see <FlexibleXYPlot> component usage below
  //min-width: ${CHART_SIZE.width}px;
  //min-height: ${CHART_SIZE.height}px;
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
  font-size: 0.9rem;
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
  font-size: 1rem;
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

const LoaderContainer = styled.div`
  display: flex;
  justify-content: center;
  align-items: center;
  width: 100%;
  height: 100%;
`;

export const PriceChart = ({
  timeInterval = TIME_INTERVAL.ONE_WEEK,
  noTicks,
}: LineChartProps) => {
  const [selectedInterval, setSelectedInterval] = useState(timeInterval);
  const [loading, setLoading] = useState(true);
  const data = useProtocolMetrics(selectedInterval);

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
  }, [data]);

  if (loading) {
    return (
      <LoaderContainer>
        <Loader iconSize={72} />
        Reading the scriptures...
      </LoaderContainer>
    );
  }

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
              tickTotal={noTicks ? 0 : 10}
            />
            <YAxis
              style={{
                line: { stroke: '#2b2a2d' },
                ticks: { stroke: '#6b6b76' },
                text: { stroke: 'none', fill: '#6b6b76', fontWeight: 600 },
              }}
              //{...(noTicks ? { tickTotal: 0 } : {})}
              tickFormat={(v) => `$${v}`}
            />
            <LineSeries
              data={dataPoints.ivDataPoints}
              color={'#696766'}
              curve={curveCatmullRom}
              //this prop exists, typedef must be outdated
              //@ts-ignore
              strokeWidth={3}
              strokeStyle="dashed"
              onNearestX={onNearestX}
            />
            <LineSeries
              data={dataPoints.templeThresholdDataPoints}
              color={'#7D4D2C'}
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
              strokeWidth={2}
              onNearestX={onNearestX}
            />
            <Crosshair
              values={crosshairValues}
              titleFormat={(d) => ({
                title: 'date',
                value: formatDate(d[0].x),
              })}
              itemsFormat={(d) => [
                { title: 'price', value: `$${+Number(d[0].y).toFixed(4)}` },
                { title: 'IV', value: `$${+Number(d[1].y).toFixed(4)}` },
                {
                  title: 'threshold',
                  value: `${
                    isNaN(d[2].y) ? 'N/A' : '$' + +Number(d[2].y).toFixed(4)
                  }`,
                },
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

export default PriceChart;

function useProtocolMetrics(timeInterval: TIME_INTERVAL) {
  const { hourlyPriceMetrics, dailyPriceMetrics } =
    useRefreshablePriceMetrics();

  let hourlyData: ChartData = {
    priceDataPoints: [],
    ivDataPoints: [],
    templeThresholdDataPoints: [],
  };

  let dailyData: ChartData = {
    priceDataPoints: [],
    ivDataPoints: [],
    templeThresholdDataPoints: [],
  };

  if (dailyPriceMetrics.length && hourlyPriceMetrics.length) {
    hourlyData = formatMetrics(hourlyPriceMetrics);
    dailyData = formatMetrics(dailyPriceMetrics);
  }

  return timeInterval <= TIME_INTERVAL.ONE_WEEK ? hourlyData : dailyData;
}

function useCrosshairs(data: ChartData) {
  const dataArr = [
    data.priceDataPoints,
    data.ivDataPoints,
    data.templeThresholdDataPoints,
  ];

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
      dataPoints: {
        priceDataPoints: [],
        ivDataPoints: [],
        templeThresholdDataPoints: [],
      },
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
    templeThresholdDataPoints:
      data.templeThresholdDataPoints.filter(domainFilter),
  };

  const upperPriceThreshold = Math.abs(
    Math.max(...domainDataPoints.priceDataPoints.map(({ y }) => y)) * 1.5
  );

  const xDomain = [lowerDateThreshold, now];
  const yDomain = [0, upperPriceThreshold];

  let priceData: {
    currentPrice: number;
    domainPriceChangePercentage: number;
    domainPriceChange: number;
  };

  if (domainDataPoints.priceDataPoints.length > 0) {
    const currentPrice = domainDataPoints.priceDataPoints[0].y;
    const oldestDomainPrice =
      domainDataPoints.priceDataPoints[
        domainDataPoints.priceDataPoints.length - 1
      ].y;

    priceData = {
      currentPrice,
      domainPriceChangePercentage:
        ((currentPrice - oldestDomainPrice) / oldestDomainPrice) * 100,
      domainPriceChange: currentPrice - oldestDomainPrice,
    };
  } else {
    priceData = {
      currentPrice: 0,
      domainPriceChangePercentage: 0,
      domainPriceChange: 0,
    };
  }

  return { dataPoints: domainDataPoints, xDomain, yDomain, priceData };
}

function formatMetrics(metrics: PriceMetrics[]) {
  type ReducerState = {
    priceDataPoints: DataPoint[];
    ivDataPoints: DataPoint[];
    templeThresholdDataPoints: DataPoint[];
  };

  const initialReducerState: ReducerState = {
    priceDataPoints: [],
    ivDataPoints: [],
    templeThresholdDataPoints: [],
  };

  const { priceDataPoints, ivDataPoints, templeThresholdDataPoints } =
    metrics.reduce((acc, dataPoint) => {
      const utcTimestamp = Number(dataPoint.timestamp) * 1000;

      if (CORRUPTED_TIMESTAMPS.includes(utcTimestamp)) {
        return acc;
      }

      acc.priceDataPoints.push({
        x: utcTimestamp,
        y: Number(dataPoint.templePrice),
      });

      acc.ivDataPoints.push({
        x: utcTimestamp,
        y: Number(dataPoint.intrinsicValue),
      });

      const threshold = Number(dataPoint.thresholdTemplePrice);

      acc.templeThresholdDataPoints.push({
        x: utcTimestamp,
        // threshold being 0 means the subgraph has no data for it at this timestamp
        // so we use NaN as a fallback and manipulate the tooltip in Crosshair props
        y:
          threshold === 0
            ? NaN
            : //TODO: revert after threshold decay is fixed on the contract
              Math.max(0.98 * Number(dataPoint.templePrice), threshold),
      });

      return acc;
    }, initialReducerState);

  return { priceDataPoints, ivDataPoints, templeThresholdDataPoints };
}

function formatDate(utcDate: Date) {
  const iso = utcDate.toISOString();
  const [date, time] = iso.split('T');
  return `${date} @ ${time.split('.')[0]} UTC+0`;
}
