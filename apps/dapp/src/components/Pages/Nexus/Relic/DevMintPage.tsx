import { Button } from 'components/Button/Button';
import { useRelic } from 'providers/RelicProvider';
import { Enclave } from 'providers/types';
import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import ItemGrid from './ItemGrid';
import { NexusPanel, NexusPanelRow } from './styles';

const VALID_ITEM_ID_COUNT = 15

export const DevMintPage = () => {
  const { mintRelicItem } = useRelic();
  const allItems = useMemo(() => [...Array(VALID_ITEM_ID_COUNT).keys()].map((id) => ({ id, count: 1 })), [])
  const { mintRelic } = useRelic();
  const navigate = useNavigate();

  return <>
    <NexusPanel>
      <NexusPanelRow>
        <span>Mint Relic</span>
      </NexusPanelRow>
      <div>
        <Button
          label="Mint Relic"
          onClick={async () => {
            const added = await mintRelic(Enclave.Structure);
            if (added) {
              navigate(`../${added.id.toString()}`);
            }
          }}
          
        />
      </div>
    </NexusPanel>
    <NexusPanel>
      <NexusPanelRow>
        <span>Mint Item (dev testing only)</span>
      </NexusPanelRow>
      <ItemGrid items={allItems} onClick={async (item) => mintRelicItem(item)} />
    </NexusPanel>
  </>
};
