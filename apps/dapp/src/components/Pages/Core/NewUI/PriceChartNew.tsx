import React, { useState, useCallback, useEffect, MouseEventHandler } from 'react';
import styled from 'styled-components';
import { useMediaQuery } from 'react-responsive';
import { curveCatmullRom } from 'd3-shape';
import { FlexibleXYPlot, XAxis, YAxis, LineSeries, Crosshair, HorizontalGridLines } from 'react-vis';
import Image from 'components/Image/Image';
import Loader from 'components/Loader/Loader';
import useRefreshablePriceMetrics, { PriceMetrics } from 'hooks/use-refreshable-price-metrics';
import sunImage from 'assets/images/sun-art-new.svg';
import 'react-vis/dist/style.css';
import { queryPhone } from 'styles/breakpoints';

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
  { interval: TIME_INTERVAL.ONE_DAY, label: '1D' },
  { interval: TIME_INTERVAL.ONE_WEEK, label: '1W' },
  { interval: TIME_INTERVAL.ONE_MONTH, label: '1M' },
  { interval: TIME_INTERVAL.ONE_YEAR, label: '1Y' },
];

export type ChartData = {
  templePriceDataPoints: DataPoint[];
  ramosPriceDataPoints: DataPoint[];
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

function useProtocolMetrics(timeInterval: TIME_INTERVAL) {
  const { hourlyPriceMetrics, dailyPriceMetrics } = useRefreshablePriceMetrics();

  let hourlyData: ChartData = {
    templePriceDataPoints: [],
    ramosPriceDataPoints: [],
  };

  let dailyData: ChartData = {
    templePriceDataPoints: [],
    ramosPriceDataPoints: [],
  };

  if (dailyPriceMetrics.length && hourlyPriceMetrics.length) {
    hourlyData = formatMetrics(hourlyPriceMetrics);
    dailyData = formatMetrics(dailyPriceMetrics);
  }

  return timeInterval <= TIME_INTERVAL.ONE_WEEK ? hourlyData : dailyData;
}

function useCrosshairs(data: ChartData) {
  const dataArr = [data.templePriceDataPoints, data.ramosPriceDataPoints];

  const [crosshairValues, setCrosshairValues] = useState<CrosshairData[]>([]);

  function curateValue(dataPoint: DataPoint): CrosshairData {
    const { x: date, y: price } = dataPoint;
    return { x: new Date(date), y: price };
  }

  const onMouseLeave = useCallback(() => setCrosshairValues([]), [setCrosshairValues]);

  const onNearestX = useCallback(
    (_value, { index }) => {
      setCrosshairValues(dataArr.map((d) => curateValue(d[index])));
    },
    [setCrosshairValues, data]
  );

  return { crosshairValues, onMouseLeave, onNearestX };
}

function useTemplePrice(data: ChartData, interval: TIME_INTERVAL) {
  if (!data?.templePriceDataPoints?.length) {
    return {
      dataPoints: {
        templePriceDataPoints: [],
        ramosPriceDataPoints: [],
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
    templePriceDataPoints: data.templePriceDataPoints.filter(domainFilter),
    ramosPriceDataPoints: data.ramosPriceDataPoints.filter(domainFilter),
  };

  const lowerPriceThreshold = Math.abs(Math.min(...domainDataPoints.templePriceDataPoints.map(({ y }) => y)) * 0.5);
  const upperPriceThreshold = Math.abs(Math.max(...domainDataPoints.templePriceDataPoints.map(({ y }) => y)) * 1.1);

  const xDomain = [lowerDateThreshold, now];
  const yDomain = [lowerPriceThreshold, upperPriceThreshold];

  let priceData: {
    currentPrice: number;
    domainPriceChangePercentage: number;
    domainPriceChange: number;
  };

  if (domainDataPoints.templePriceDataPoints.length > 0) {
    const currentPrice = domainDataPoints.templePriceDataPoints[0].y;
    const oldestDomainPrice =
      domainDataPoints.templePriceDataPoints[domainDataPoints.templePriceDataPoints.length - 1].y;

    priceData = {
      currentPrice,
      domainPriceChangePercentage: ((currentPrice - oldestDomainPrice) / oldestDomainPrice) * 100,
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
    templePriceDataPoints: DataPoint[];
    ramosPriceDataPoints: DataPoint[];
  };

  const initialReducerState: ReducerState = {
    templePriceDataPoints: [],
    ramosPriceDataPoints: [],
  };

  const { templePriceDataPoints, ramosPriceDataPoints } = metrics.reduce((acc, dataPoint) => {
    const utcTimestamp = Number(dataPoint.timestamp) * 1000;

    if (CORRUPTED_TIMESTAMPS.includes(utcTimestamp)) {
      return acc;
    }

    acc.templePriceDataPoints.push({
      x: utcTimestamp,
      y: Number(dataPoint.templePrice),
    });

    acc.ramosPriceDataPoints.push({
      x: utcTimestamp,
      y: Number(dataPoint.intrinsicValue),
    });

    return acc;
  }, initialReducerState);

  return { templePriceDataPoints, ramosPriceDataPoints };
}

function formatDate(utcDate: Date) {
  const iso = utcDate.toISOString();
  const [date, time] = iso.split('T');
  return `${date} @ ${time.split('.')[0]} UTC+0`;
}

export const PriceChart = ({ timeInterval = TIME_INTERVAL.ONE_WEEK }: LineChartProps) => {
  const [selectedInterval, setSelectedInterval] = useState(timeInterval);
  const [loading, setLoading] = useState(true);
  const data = useProtocolMetrics(selectedInterval);

  const { dataPoints, xDomain, yDomain, priceData } = useTemplePrice(data, selectedInterval);

  const { crosshairValues, onMouseLeave, onNearestX } = useCrosshairs(dataPoints);

  const isDesktop = useMediaQuery({
    query: queryPhone,
  });

  useEffect(() => {
    if (data.templePriceDataPoints.length && loading) {
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

  const TEMPLE_COLOR = '#FFDEC9';
  const RAMOS_COLOR = '#BD7B4F';

  return (
    <Container>
      <>
        {dataPoints.templePriceDataPoints.length >= 2 ? (
          <>
            <LegendRow>
              <Legend>
                <Circle color={TEMPLE_COLOR} /> Temple Price
              </Legend>
              <Legend>
                <Circle color={RAMOS_COLOR} /> RAMOS floor price
              </Legend>
            </LegendRow>
            <FlexibleXYPlot xType={'time-utc'} xDomain={xDomain} yDomain={yDomain} onMouseLeave={onMouseLeave}>
              <XAxis
                style={{
                  line: { stroke: '#2b2a2d' },
                  ticks: { stroke: '#6b6b76' },
                  text: {
                    stroke: 'none',
                    fill: '#FFDEC9',
                    fontFamily: 'Caviar Dreams',
                    fontSize: 14,
                  },
                }}
                tickTotal={isDesktop ? 5 : 4}
              />
              <YAxis
                style={{
                  line: { stroke: '#2b2a2d' },
                  ticks: { stroke: '#6b6b76' },
                  text: { stroke: 'none', fill: '#FFDEC9', fontSize: 14 },
                }}
                tickFormat={(v) => `${v}`}
                tickTotal={5}
                tickLabelAngle={isDesktop ? 0 : -90}
              />
              <HorizontalGridLines tickTotal={5} style={{ stroke: RAMOS_COLOR }} />
              <LineSeries
                data={dataPoints.ramosPriceDataPoints}
                color={RAMOS_COLOR}
                curve={curveCatmullRom}
                //this prop exists, typedef must be outdated
                //@ts-ignore
                strokeWidth={3}
                strokeStyle="solid"
                onNearestX={onNearestX}
              />
              <LineSeries
                data={dataPoints.templePriceDataPoints}
                color={TEMPLE_COLOR}
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
                  { title: 'Temple Price', value: `$${+Number(d[0].y).toFixed(4)}` },
                  { title: 'Ramos Price', value: `$${+Number(d[1].y).toFixed(4)}` },
                ]}
              />
            </FlexibleXYPlot>
            <TogglerRow>
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
          </>
        ) : (
          <NotEnoughData>
            <p className={'color-brand'}>Not enough data for this interval. Try again later.</p>
            <Image src={sunImage} width={70} height={70} />
          </NotEnoughData>
        )}
      </>
    </Container>
  );
};

export default PriceChart;

const Circle = styled.div<{ color?: string }>`
  width: 20px;
  height: 20px;
  background-color: ${(props) => (props.color ? props.color : 'green')};
  border-radius: 50%;
  margin-right: 10px;
`;

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

const Legend = styled.div`
  display: flex;
  flex-direction: row;
`;

const LegendRow = styled.div`
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: flex-end;
  gap: 1.25rem;
  width: 90%;
`;

const TogglerRow = styled.div`
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: flex-end;
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

type ToggleProps = {
  selected?: boolean;
  onClick: MouseEventHandler;
};

const Toggle = styled.span<ToggleProps>`
  display: inline-block;
  user-select: none;
  cursor: pointer;
  color: ${({ selected, theme }) => (selected ? theme.palette.brandLight : theme.palette.brand)};
  &:hover {
    color: white;
  }
  font-size: 1rem;
  font-weight: ${({ selected }) => (selected ? 'bold' : '')};
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
