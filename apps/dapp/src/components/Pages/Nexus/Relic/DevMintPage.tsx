import { useRelic } from 'providers/RelicProvider';
import { useMemo } from 'react';
import ItemGrid from './ItemGrid';
import MintRelicPanel from './MintRelicPanel';
import { NexusPanel, NexusPanelRow } from './styles';

const VALID_ITEM_ID_COUNT = 15;

export const DevMintPage = () => {
  console.log('--- LOADED DEV MINT PAGE');
  const { mintRelicItem } = useRelic();

  const mintRelicWrapper = (item: number) => {
    console.log('---- item');
    console.log(item);
    return mintRelicItem(item);
  };
  const allItems = useMemo(() => [...Array(VALID_ITEM_ID_COUNT).keys()].map((id) => ({ id, count: 1 })), []);
  return (
    <>
      <MintRelicPanel />
      <NexusPanel>
        <NexusPanelRow>
          <span>Mint Item (dev testing only)</span>
        </NexusPanelRow>
        <ItemGrid items={allItems} onClick={async (item) => mintRelicWrapper(item)} />
      </NexusPanel>
    </>
  );
};
