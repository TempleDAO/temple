import { Marker } from '../Marker';
import { TimelineTicks } from './TimelineTicks';
import { TimelineStartEndMarkers } from './TimelineStartEndMarkers';
import { TimelineChannel } from './TimelineChannel';
import { TimelineBackground } from './TimelineBackground';
import { MarkerType } from 'components/Vault/types';
import TimelineTippy from '../../TimelineTippy';
import { useVaultContext } from 'components/Pages/Core/VaultContext';
import { getMarkers } from 'components/Vault/utils';

export const Timeline = () => {
  const {
    vaultGroup,
    balances: { balances },
  } = useVaultContext();

  const markers = getMarkers(vaultGroup!, balances[vaultGroup!.id])
    .filter((marker) => marker.type !== MarkerType.HIDDEN)
    .map((marker) => {
      return (
        <TimelineTippy marker={marker} key={marker.vaultId}>
          <Marker marker={marker} />
        </TimelineTippy>
      );
    });

  return (
    <g id="vault-timeline">
      <TimelineBackground />
      <TimelineChannel />
      <TimelineStartEndMarkers />
      <TimelineTicks vaultGroup={vaultGroup!} />
      {markers}
    </g>
  );
};
