import { Marker } from '../Marker';
import { TimelineTicks } from './TimelineTicks';
import { TimelineStartEndMarkers } from './TimelineStartEndMarkers';
import { TimelineChannel } from './TimelineChannel';
import { TimelineBackground } from './TimelineBackground';
import { Entry, Vault } from 'components/Vault/types';

type Props = {
  data: Vault;
  onMarkerClick: (entryData: Entry, markerEl: SVGElement) => void;
};

export const Timeline = ({ data, onMarkerClick }: Props) => {
  const markers = data.entries.map((entry) => (
    <Marker key={entry.id} data={entry} onMarkerClick={onMarkerClick} />
  ));

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
