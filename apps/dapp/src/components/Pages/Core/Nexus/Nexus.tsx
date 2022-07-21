import { Button } from 'components/Button/Button';
import { BigNumber } from 'ethers';
import { useRelic } from 'providers/RelicProvider';
import { ItemInventory, RelicItemData } from 'providers/types';
import { useWallet } from 'providers/WalletProvider';
import { FC, useEffect, useMemo, useState } from 'react';
import { Navigate, Route, Routes, useNavigate, useParams } from 'react-router-dom';
import styled from 'styled-components';
import { asyncNoop } from 'utils/helpers';
import { NexusContainer } from '../Trade/styles';
import { PageWrapper } from '../utils';
import BufferedItemGrid from './BufferedItemGrid';
import ItemGrid from './ItemGrid';
import { NexusPanel, NexusPanelRow } from './styles';

const NexusPage = () => {
  return (
    <PageWrapper>
      <h3>Nexus</h3>
      <NexusContainer>
        <NexusBody />
      </NexusContainer>
    </PageWrapper>
  );
};

const NexusBody = () => {
  const { wallet, isConnected } = useWallet();
  const { inventory, updateInventory } = useRelic();

  useEffect(() => {
    updateInventory();
  }, [wallet, isConnected]);

  if (inventory === null) {
    return (
      <NexusPanelRow>
        <span>Loading...</span>
      </NexusPanelRow>
    );
  } else {
    const { relics, items } = inventory;

    return (
      <NexusBodyContainer>
        <RelicRoutes inventory={inventory} />
        <MyItemPanel relicId={relics[0]?.id} items={items} />
        <MintItemPanel />
      </NexusBodyContainer>
    );
  }
};

const RelicRoutes: FC<{ inventory: ItemInventory }> = (props) => {
  const {
    inventory: { relics },
  } = props;
  return (
    <Routes>
      <Route path="" element={<NoRelicPanel relics={relics} />} />
      <Route path="relic/:id" element={<RelicPanel relics={relics} />} />
      <Route path="*" element={<Navigate to="" />} />
    </Routes>
  );
};

const NoRelicPanel = (props: { relics: ItemInventory['relics'] }) => {
  const { relics } = props;
  if (relics.length > 0) {
    return <Navigate to={`../relic/${relics[0].id.toString()}`} />;
  }
  const { mintRelic } = useRelic();
  const navigate = useNavigate();
  return (
    <NexusPanel>
      <NexusPanelRow>
        <span>No Relics</span>
        <div>
          <Button isSmall
            label="Mint Relic"
            onClick={async () => {
              const added = await mintRelic();
              if (added) {
                navigate(`relic/${added.id.toString()}`);
              }
            }}
          />
        </div>
      </NexusPanelRow>

      <ItemGrid items={[]} onClick={asyncNoop} />
    </NexusPanel>
  );
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
              navigate(`../relic/${nextRelicId.toString()}`);
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

const MintItemPanel = () => {
  const { mintRelicItem } = useRelic();
  const allItems = useMemo(() => [...Array(VALID_ITEM_ID_COUNT).keys()].map((id) => ({ id, count: 1 })), [])
      
  return (
    <NexusPanel>
      <NexusPanelRow>
        <span>Mint Items (test only)</span>
      </NexusPanelRow>
      <ItemGrid items={allItems} onClick={async (item) => mintRelicItem(item)} />
    </NexusPanel>
  );
};

const NexusBodyContainer = styled.div`
  display: flex;
  flex-flow: row;
  flex-wrap: wrap;
  justify-content: center;
  align-items: top;
  width: 100%;
  > * {
    width: 46%;
    margin: 2%;
    min-width: 25rem;
  }
`;

export default NexusPage;
