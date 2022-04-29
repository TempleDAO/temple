import { Marker } from '../Marker';
import { TimelineTicks } from './TimelineTicks';
import { TimelineStartEndMarkers } from './TimelineStartEndMarkers';
import { TimelineChannel } from './TimelineChannel';
import { TimelineBackground } from './TimelineBackground';
import { VaultGroup } from 'components/Vault/types';
import TimelineTippy from '../../TimelineTippy'

type Props = {
  vault: VaultGroup;
};

export const Timeline = ({ vault }: Props) => {
  const vaultsWithBalances = vault.vaults.filter(({ entries }) => entries.length > 0);
  const markers = vaultsWithBalances.flatMap((vault, i) => {
    return vault.entries.map((entry) => {
      return (
        <TimelineTippy
          vault={vault}
          entry={entry}
          key={`${entry.id}${i}`}
        >
          <Marker data={entry} />
        </TimelineTippy>
      );
    });
  });

  const months = vault.vaults[0].months;

  return (
    <g id="vault-timeline">
      <TimelineBackground />
      <TimelineChannel />
      <TimelineStartEndMarkers />
      <TimelineTicks months={months} />
      {markers}
    </g>
  );
};
