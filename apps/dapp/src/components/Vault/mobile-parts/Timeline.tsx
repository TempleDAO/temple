import { VaultGroup } from '../types';
import { BGTrack } from './timeline/BGTrack';
import { Marker } from './timeline/Marker';
import { Ticks } from './timeline/Ticks';
import TimelineTippy from '../TimelineTippy'

type Props = {
  vaultGroup: VaultGroup;
};

export const Timeline = ({ vaultGroup }: Props) => {
  const vaultsWithBalances = vaultGroup.vaults.filter(({ entries }) => entries.length > 0);
  const markers = vaultsWithBalances.flatMap((vault, i) => {
    return vault.entries.map((entry) => {
      return (
        <TimelineTippy
          vault={vault}
          entry={entry}
          key={`${entry.id}${i}`}
        >
          <Marker entry={entry} />
        </TimelineTippy>
      );
    });
  });


  return (
    <>
      <BGTrack />
      <Ticks vaultGroup={vaultGroup} />
      {markers}
    </>
  );
};
