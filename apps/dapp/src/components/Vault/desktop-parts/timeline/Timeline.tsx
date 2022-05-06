import { Marker } from '../Marker';
import { TimelineTicks } from './TimelineTicks';
import { TimelineStartEndMarkers } from './TimelineStartEndMarkers';
import { TimelineChannel } from './TimelineChannel';
import { TimelineBackground } from './TimelineBackground';
import { MarkerType, VaultGroup } from 'components/Vault/types';
import TimelineTippy from '../../TimelineTippy';

type Props = {
  vaultGroup: VaultGroup;
};

export const Timeline = ({ vaultGroup }: Props) => {
  const markers = vaultGroup.markers
    .filter((marker) => marker.type !== MarkerType.HIDDEN)
    .map((marker) => {
      return (
        <TimelineTippy marker={marker} key={marker.id}>
          <Marker marker={marker} />
        </TimelineTippy>
      );
    });

  return (
    <g id="vault-timeline">
      <TimelineBackground />
      <TimelineChannel />
      <TimelineStartEndMarkers />
      <TimelineTicks vaultGroup={vaultGroup} />
      {markers}
    </g>
  );
};
