import { Vault } from '../types';
import { BGTrack } from './timeline/BGTrack';
import { Marker } from './timeline/Marker';
import { Ticks } from './timeline/Ticks';
import TimelineTippy from '../TimelineTippy'

type Props = {
  vault: Vault;
};

export const Timeline = ({ vault }: Props) => {
  const markers = vault.entries.map((entry) => (
    <TimelineTippy
      vault={vault}
      entry={entry}
      key={entry.id}
    >
      <Marker entry={entry} />
    </TimelineTippy>
  ));

  return (
    <>
      <BGTrack />
      <Ticks vault={vault} />
      {markers}
    </>
  );
};
