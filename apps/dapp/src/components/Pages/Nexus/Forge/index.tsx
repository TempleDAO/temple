import bgActive from 'assets/images/nexus-room-active.jpg';
import bgInactive from 'assets/images/nexus-room-inactive.jpg';
import { useRelic } from 'providers/RelicProvider';
import { RelicItemData } from 'providers/types';
import { useWallet } from 'providers/WalletProvider';
import { useEffect, useMemo, useState } from 'react';
import styled from 'styled-components';
import { PageWrapper } from '../../Core/utils';
import ItemGrid, { EmptyCell, ItemButton, ItemsContainer, ItemWrapper } from '../Relic/ItemGrid';
import { NexusBackground, NexusBodyContainer, NexusContainer, NexusPanel } from '../Relic/styles';
import InventoryPanel from './InventoryPanel';
import UsedShardsPanel from './UsedShardsPanel';

const VALID_ITEM_ID_COUNT = 15;

const ForgePage = () => {
  const { wallet, isConnected } = useWallet();
  const { inventory, updateInventory } = useRelic();

  useEffect(() => {
    updateInventory();
  }, [wallet, isConnected]);
  const bgImage = bgInactive;

  const allItems = useMemo(() => [...Array(VALID_ITEM_ID_COUNT).keys()].map((id) => ({ id, count: 1 })), []);

  const clickHandler = (item: number) => {
    console.log(`clicked: ${item}`);
  };

  const [shardsPendingForge, setShardsPendingForge] = useState<RelicItemData[]>([]);

  const clickHandler2 = async (item: number): Promise<void> => {
    console.log(`clickedin here: ${item}`);
  };

  const testItem = undefined;

  return (
    <PageWrapper>
      <NexusBackground
        style={{
          backgroundImage: `url(${bgImage})`,
        }}
      />
      <ForgePanel>
        <NexusPanelRow>Forge</NexusPanelRow>
        <NexusPanelRow2>Combine Shards to Forge</NexusPanelRow2>
        {/* // TODO: Split into own component */}
        <ForgeResultWrapper>
          {testItem == undefined ? (
            <EmptyCell />
          ) : (
            <ItemButton key={testItem.id} item={testItem} disabled={false} onClick={clickHandler2} />
          )}
        </ForgeResultWrapper>
        <UsedShardsPanel items={shardsPendingForge} />
        <InventoryPanel />
      </ForgePanel>
    </PageWrapper>
  );
};

export const ForgeResultWrapper = styled.div`
  position: relative;
  margin: auto;
  width: 15%;
  padding-top: 15%;
  > * {
    &:first-child {
      position: absolute;
      top: 5px;
      left: 5px;
      right: 5px;
      bottom: 5px;
      border-radius: 15%;
    }
  }
`;

export const ForgePanel = styled.div<{ color?: string }>`
  flex-direction: column;
  align-items: center;
  border: 2px solid ${(props) => props.color ?? props.theme.palette.brand};
  border-radius: 16px;
  padding: 1rem;
  background-color: rgba(0, 0, 0, 0.3);
  backdrop-filter: blur(15px);

  > * {
    margin-bottom: 1rem;
  }
`;

const NexusPanelRow = styled.h2`
  width: 100%;
  margin: 0.1rem;
  padding: 0 5px;
  text-align: center;
  flex-direction: row;
  justify-content: space-between;
  align-items: center;
  * > {
    &:first-child {
      flex: 1;
    }
  }
`;

const NexusPanelRow2 = styled.h4`
  width: 100%;
  margin: 0.5rem;
  padding: 0 5px;
  text-align: center;
  flex-direction: row;
  justify-content: space-between;
  align-items: center;
  * > {
    &:first-child {
      flex: 1;
    }
  }
`;

export default ForgePage;
