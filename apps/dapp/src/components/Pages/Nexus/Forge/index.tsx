import bgActive from 'assets/images/nexus-room-active.jpg';
import bgInactive from 'assets/images/nexus-room-inactive.jpg';
import { useRelic } from 'providers/RelicProvider';
import { RelicItemData } from 'providers/types';
import { useWallet } from 'providers/WalletProvider';
import { useEffect, useMemo, useState } from 'react';
import styled from 'styled-components';
import { PageWrapper } from '../../Core/utils';
import { EMPTY_INVENTORY } from '../Relic';
import { EmptyCell, ItemButton } from '../Relic/ItemGrid';
import { NexusBackground } from '../Relic/styles';
import InventoryPanel from './InventoryPanel';
import UsedShardsPanel from './UsedShardsPanel';
import { getValidRecipe, Recipe } from './recipes';
import { Relic } from 'types/typechain';

// const VALID_ITEM_ID_COUNT = 15;

const ForgePage = () => {
  const { wallet, isConnected } = useWallet();
  const { inventory, updateInventory, transmute } = useRelic();

  useEffect(() => {
    updateInventory();
  }, [wallet, isConnected]);

  const bgImage = bgInactive;

  // TODO: We should move all this into its own hook or context
  const [shardsPendingForge, setShardsPendingForge] = useState<RelicItemData[]>([]);
  const [forgeResult, setForgeResult] = useState<RelicItemData | null>(null);
  const [recipeId, setRecipeId] = useState<number | null>(null);

  useEffect(() => {
    const validRecipe = getValidRecipe(shardsPendingForge);
    if (validRecipe) {
      setRecipeId(validRecipe.id);
      setForgeResult({ id: validRecipe.reward_ids[0], count: validRecipe.reward_amounts[0] });
    }
    return () => {
      setForgeResult(null);
      setRecipeId(null);
    };
  }, [shardsPendingForge]);

  const forgeHandler = async (_item: number): Promise<void> => {
    if (recipeId !== null) {
      await transmute(recipeId);
    }
  };

  // TODO: Update counts (inventory and shards pending) as you add/remove shards
  const usedShardsClickHandler = (item: number) => {
    setShardsPendingForge((previous) => previous.filter((selectedShard) => selectedShard.id !== item));
  };

  // TODO: Update counts (inventory and shards pending) as you add/remove shards
  const addShardClickHandler = async (item: number): Promise<void> => {
    if (shardsPendingForge.filter((shard) => shard.id === item).length === 0) {
      setShardsPendingForge((previous) => [...previous, { id: item, count: 1 }]);
    }
    getValidRecipe(shardsPendingForge);
  };

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
          {forgeResult == undefined ? (
            <EmptyCell />
          ) : (
            <ItemButton key={forgeResult.id} item={forgeResult} disabled={false} onClick={forgeHandler} />
          )}
        </ForgeResultWrapper>
        <UsedShardsPanel items={shardsPendingForge} usedShardsClickHandler={usedShardsClickHandler} />
        <InventoryPanel
          inventory={inventory?.items || EMPTY_INVENTORY.items}
          addShardClickHandler={addShardClickHandler}
        />
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
