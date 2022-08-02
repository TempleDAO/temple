import { Button } from 'components/Button/Button';
import { BigNumber } from 'ethers';
import { useRelic } from 'providers/RelicProvider';
import { Enclave, ItemInventory, RelicItemData } from 'providers/types';
import { FC, useMemo } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import BufferedItemGrid from './BufferedItemGrid';
import ItemGrid from './ItemGrid';
import { NexusPanel, NexusPanelRow } from './styles';

export const NoRelicPanel = (props: { inventory: ItemInventory }) => {
  const { relics } = props.inventory;
  if (relics.length > 0) {
    return <Navigate to={`../${relics[0].id.toString()}`} />;
  }
  const { mintRelic } = useRelic();
  const navigate = useNavigate();
  return (
    <NexusPanel>
      <NexusPanelRow>
        <span>You do not yet possess a Relic</span>
      </NexusPanelRow>

      <div/>
      <div/>

      <Button
        label="Mint Relic"
        onClick={async () => {
          const added = await mintRelic(Enclave.Structure);
          if (added) {
            navigate(`relic/${added.id.toString()}`);
          }
        }}
      />
    </NexusPanel>
  );
};

export const NexusBody: FC<{ inventory: ItemInventory }> = (props) => {
  const { relics, items } = props.inventory
  return <>
    <RelicPanel relics={relics} />
    <MyItemPanel relicId={relics[0]?.id} items={items} />
  </>
};

const RelicPanel = (props: { relics: ItemInventory['relics'] }) => {
  const { renounceRelic, unequipRelicItems } = useRelic();
  const navigate = useNavigate();
  const { id } = useParams();
  const { relics } = props;
  const relicIdx = relics.findIndex((r) => r.id.toString() == id);
  const relic = relics[relicIdx];
  if (!relic) {
    return <Navigate to=".." />;
  }
  return (
    <NexusPanel>
      <NexusPanelRow>
        <span>Relic #{relic.id.toString()}</span>
        <div>
          <Button isSmall
            label="Renounce Relic"
            onClick={async () => {
              const nextRelicIdx = (relicIdx + 1) % relics.length;
              const nextRelicId = relics[nextRelicIdx].id;
              await renounceRelic(relic.id);
              navigate(`../${nextRelicId.toString()}`);
            }}
          />
        </div>
      </NexusPanelRow>
      <BufferedItemGrid items={relic.items}
        actionLabel="Unequip"
        onAction={async selectedItems => unequipRelicItems(relic.id, selectedItems)}
      />
    </NexusPanel>
  );
};

const MyItemPanel: FC<{
  relicId?: BigNumber;
  items: RelicItemData[];
}> = (props) => {
  const { relicId, items } = props;
  const { equipRelicItems } = useRelic();

  return (
    <NexusPanel>
      <NexusPanelRow>
        <span>My Items</span>
      </NexusPanelRow>
      <BufferedItemGrid disabled={!relicId} items={items}
        actionLabel="Equip"
        onAction={async selectedItems => {
          if (relicId) {
            await equipRelicItems(relicId, selectedItems)
          }
        }}
      />
    </NexusPanel>
  );
};


const VALID_ITEM_ID_COUNT = 15

export const DevMintItemPanel = () => {
  const { mintRelicItem } = useRelic();
  const allItems = useMemo(() => [...Array(VALID_ITEM_ID_COUNT).keys()].map((id) => ({ id, count: 1 })), [])
      
  return (
    <NexusPanel>
      <NexusPanelRow>
        <span>Mint Item (dev testing only)</span>
      </NexusPanelRow>
      <ItemGrid items={allItems} onClick={async (item) => mintRelicItem(item)} />
    </NexusPanel>
  );
};
