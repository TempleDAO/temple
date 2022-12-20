import { useVaultContext } from 'components/Pages/Core/VaultContext';
import { getMarkers } from 'components/Vault/utils';
import { MarkerType } from '../types';
import { BGTrack } from './timeline/BGTrack';
import { Marker } from './timeline/Marker';
import { Ticks } from './timeline/Ticks';
import TimelineTippy from '../TimelineTippy';

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
    <>
      <BGTrack />
      <Ticks vaultGroup={vaultGroup!} />
      {markers}
    </>
  );
};
