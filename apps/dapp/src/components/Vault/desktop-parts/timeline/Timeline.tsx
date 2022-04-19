import Tippy from '@tippyjs/react';
import { roundArrow, Placement } from 'tippy.js';
import { format, addSeconds } from 'date-fns';

import { Marker } from '../Marker';
import { TimelineTicks } from './TimelineTicks';
import { TimelineStartEndMarkers } from './TimelineStartEndMarkers';
import { TimelineChannel } from './TimelineChannel';
import { TimelineBackground } from './TimelineBackground';
import { Entry, Vault } from 'components/Vault/types';
import { TippyDiv } from 'components/Tooltip/Tooltip';
import { SECONDS_IN_MONTH } from '../utils';

type Props = {
  data: Vault;
  onMarkerClick: (entryData: Entry, markerEl: SVGElement) => void;
};

export const Timeline = ({ data, onMarkerClick }: Props) => {
  const markers = data.entries.map((entry, i) => {
    const amount = entry.amount;
    const startDate = format(entry.entryDate!, 'MMM do');
    const endDate = format(
      addSeconds(entry.entryDate!, SECONDS_IN_MONTH * data.months),
      'MMM do'
    );
    
    return (
      <Tippy
        content={
          <TippyDiv>
            {amount} Temple<br />
            Entry Date: {startDate}<br />
            Vesting Date: {endDate}
          </TippyDiv>
        } 
        animation="scale-subtle"
        duration={250}
        arrow={roundArrow}
        trigger="click"
        key={i}
      >
        <Marker key={entry.id} data={entry} onMarkerClick={onMarkerClick} />
      </Tippy>
    );
  });

  return (
    <g id="vault-timeline">
      <TimelineBackground />
      <TimelineChannel />
      <TimelineStartEndMarkers />
      <TimelineTicks months={data.months} />
      {markers}
    </g>
  );
};
