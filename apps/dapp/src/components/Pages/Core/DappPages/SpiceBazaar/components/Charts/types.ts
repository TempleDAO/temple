export interface AxisConfig {
  title?: string;
  domain?: [number, number];
  ticks?: number[];
}

export interface BaseChartProps<T> {
  chartData: T[];
  xDataKey: keyof T;
  yDataKey: keyof T;
  xAxisTitle?: string;
  yAxisTitle?: string;
  yAxisDomain?: [number, number];
  yAxisTicks?: number[];
  xTickFormatter: (xValue: any, index?: number) => string;
  tooltipLabelFormatter: (value: any) => string;
  tooltipValuesFormatter?: (
    value: number,
    name: string,
    props?: any
  ) => string | string[];
}

export interface DotChartProps<T> extends BaseChartProps<T> {
  highlightKey?: keyof T;
  xTicks?: number[];
  dotRadius?: number;
  colors?: {
    dot?: string;
    highlight?: string;
  };
}

export interface BarChartProps<T> extends BaseChartProps<T> {
  yTickFormatter?: (yValue: any, index: number) => string;
  barColors?: string[];
}
