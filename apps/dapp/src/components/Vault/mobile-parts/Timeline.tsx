import { Entry, Vault } from '../types';
import { BGTrack } from './timeline/BGTrack';
import { Marker } from './timeline/Marker';
import { Ticks } from './timeline/Ticks';

type Props = {
  vault: Vault;
  onMarkerClick: (entryData: Entry, markerEl: SVGElement) => void;
};

export const Timeline = ({ vault, onMarkerClick }: Props) => {
  const markers = vault.entries.map((entry) => (
    <Marker key={entry.id} entry={entry} onMarkerClick={onMarkerClick} />
  ));

  return (
    <>
      <BGTrack />
      <Ticks vault={vault} />
     {markers}
    </>
  );
};
