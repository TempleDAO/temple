import { MarkerType, VaultGroup } from '../types';
import { BGTrack } from './timeline/BGTrack';
import { Marker } from './timeline/Marker';
import { Ticks } from './timeline/Ticks';
import TimelineTippy from '../TimelineTippy';

type Props = {
  vaultGroup: VaultGroup;
};

export const Timeline = ({ vaultGroup }: Props) => {
  const markers = vaultGroup.markers
    .filter((marker) => marker.type !== MarkerType.HIDDEN)
    .map((marker) => {
      return (
        <TimelineTippy marker={marker} key={marker.vaultId}>
          <Marker marker={marker} />
        </TimelineTippy>
      );
    });

  return (
    <>
      <BGTrack />
      <Ticks vaultGroup={vaultGroup} />
      {markers}
    </>
  );
};
