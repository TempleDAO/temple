import { forwardRef } from 'react';
import { format, addSeconds } from 'date-fns';
import { SECONDS_IN_MONTH } from './utils';
import { Point } from '../types';

type MarkerProps = {
  months: number;
  position: Point;
  entry: any;
};

export const MarkerBubble = forwardRef<SVGGElement, MarkerProps>(
  ({ months, position, entry }, ref = null) => {
    const amount = entry.amount;
    const startDate = format(entry.entryDate, 'MMM do');
    const endDate = format(
      addSeconds(entry.entryDate, SECONDS_IN_MONTH * months),
      'MMM do'
    );
    const t = `translate(${position.x} ${position.y})`;

    return (
      <g id="MarkerBubble" transform={t} ref={ref}>
        <g id="bubble">
          <mask id="path-54-inside-1_4015_16261" fill="#fff">
            <path
              fillRule="evenodd"
              clipRule="evenodd"
              d="M236 .5c7.732 0 14 6.268 14 14v118c0 7.732-6.268 14-14 14h-50c-18.616 0-25.347 7.803-31.943 15.451-6.337 7.346-12.55 14.549-29.057 14.549-16.507 0-22.72-7.203-29.057-14.549C89.347 154.303 82.615 146.5 64 146.5H14c-7.732 0-14-6.268-14-14v-118C0 6.768 6.268.5 14 .5h222Zm-87 146c0 13.255-10.745 24-24 24s-24-10.745-24-24 10.745-24 24-24 24 10.745 24 24Z"
            />
          </mask>
          <path
            fillRule="evenodd"
            clipRule="evenodd"
            d="M236 .5c7.732 0 14 6.268 14 14v118c0 7.732-6.268 14-14 14h-50c-18.616 0-25.347 7.803-31.943 15.451-6.337 7.346-12.55 14.549-29.057 14.549-16.507 0-22.72-7.203-29.057-14.549C89.347 154.303 82.615 146.5 64 146.5H14c-7.732 0-14-6.268-14-14v-118C0 6.768 6.268.5 14 .5h222Zm-87 146c0 13.255-10.745 24-24 24s-24-10.745-24-24 10.745-24 24-24 24 10.745 24 24Z"
            fill="#232121"
          />
          <path
            d="M236 146.5v1-1Zm-50 0v-1 1Zm-31.943 15.451-.757-.654.757.654Zm-58.114 0-.757.653.757-.653ZM0 132.5h1-1Zm0-118h-1 1Zm251 0c0-8.284-6.716-15-15-15v2c7.18 0 13 5.82 13 13h2Zm0 118v-118h-2v118h2Zm-15 15c8.284 0 15-6.716 15-15h-2c0 7.18-5.82 13-13 13v2Zm-50 0h50v-2h-50v2Zm-31.186 15.104c3.309-3.836 6.545-7.577 11.223-10.389 4.653-2.798 10.805-4.715 19.963-4.715v-2c-9.458 0-15.979 1.985-20.994 5.001-4.991 3-8.418 6.985-11.706 10.796l1.514 1.307ZM125 177.5c8.412 0 14.279-1.839 18.867-4.668 4.56-2.813 7.791-6.569 10.947-10.228l-1.514-1.307c-3.181 3.688-6.225 7.206-10.483 9.832-4.229 2.609-9.721 4.371-17.817 4.371v2Zm-29.814-14.896c3.156 3.659 6.387 7.415 10.947 10.228 4.588 2.829 10.455 4.668 18.867 4.668v-2c-8.096 0-13.588-1.762-17.817-4.371-4.258-2.626-7.302-6.144-10.483-9.832l-1.514 1.307ZM64 147.5c9.158 0 15.31 1.917 19.963 4.715 4.678 2.812 7.914 6.553 11.223 10.389l1.514-1.307c-3.288-3.811-6.715-7.796-11.706-10.796C79.979 147.485 73.458 145.5 64 145.5v2Zm-50 0h50v-2H14v2Zm-15-15c0 8.284 6.716 15 15 15v-2c-7.18 0-13-5.82-13-13h-2Zm0-118v118h2v-118h-2Zm15-15c-8.284 0-15 6.716-15 15h2c0-7.18 5.82-13 13-13v-2Zm222 0H14v2h222v-2Zm-111 172c13.807 0 25-11.193 25-25h-2c0 12.703-10.297 23-23 23v2Zm-25-25c0 13.807 11.193 25 25 25v-2c-12.703 0-23-10.297-23-23h-2Zm25-25c-13.807 0-25 11.193-25 25h2c0-12.703 10.297-23 23-23v-2Zm25 25c0-13.807-11.193-25-25-25v2c12.703 0 23 10.297 23 23h2Z"
            fill="#FFDEC9"
            mask="url(#path-54-inside-1_4015_16261)"
          />
        </g>
        <text
          id="amount"
          fill="#fff"
          xmlSpace="preserve"
          style={{ whiteSpace: 'pre' }}
          fontFamily="Caviar Dreams"
          fontSize={18}
          fontWeight="bold"
          letterSpacing="0em"
        >
          <tspan x={22} y={46.762}>
            {`${amount} Temple`}
          </tspan>
        </text>
        <text
          id="entrydate"
          fill="#fff"
          xmlSpace="preserve"
          style={{ whiteSpace: 'pre' }}
          fontFamily="Caviar Dreams"
          fontSize={14}
          fontWeight="bold"
          letterSpacing="0em"
        >
          <tspan x={22} y={72.871}>
            {`Entry Date:  ${startDate}`}
          </tspan>
        </text>
        <text
          id="Vesting Date: 6/1/2022"
          fill="#fff"
          xmlSpace="preserve"
          style={{ whiteSpace: 'pre' }}
          fontFamily="Caviar Dreams"
          fontSize={14}
          fontWeight="bold"
          letterSpacing="0em"
        >
          <tspan x={22} y={97.871}>
            {`Vesting Date: ${endDate}`}
          </tspan>
        </text>
      </g>
    );
  }
);
