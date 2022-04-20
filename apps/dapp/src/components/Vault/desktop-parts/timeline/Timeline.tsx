import { Marker } from '../Marker';
import { TimelineTicks } from './TimelineTicks';
import { TimelineStartEndMarkers } from './TimelineStartEndMarkers';
import { TimelineChannel } from './TimelineChannel';
import { TimelineBackground } from './TimelineBackground';
import { Vault } from 'components/Vault/types';
import TimelineTippy from '../../TimelineTippy'

type Props = {
  vault: Vault;
};

export const Timeline = ({ vault }: Props) => {
  const markers = vault.entries.map((entry) => {
    return (
      <TimelineTippy
        vault={vault}
        entry={entry}
        key={entry.id}
      >
        <Marker data={entry} />
      </TimelineTippy>
    );
  });

  return (
    <g id="vault-timeline">
      <TimelineBackground />
      <TimelineChannel />
      <TimelineStartEndMarkers />
      <TimelineTicks months={vault.months} />
      {markers}
    </g>
  );
};
