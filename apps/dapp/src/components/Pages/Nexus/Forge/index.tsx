import forgeBackground from 'assets/images/nexus/forge_bg.jpg';
import { useRelic } from 'providers/RelicProvider';
import { RelicItemData } from 'providers/types';
import { useWallet } from 'providers/WalletProvider';
import { useEffect, useReducer, useState } from 'react';
import styled from 'styled-components';
import { PageWrapper } from '../../Core/utils';
import { EMPTY_INVENTORY } from '../Relic';
import { NexusBackground } from '../Relic/styles';
import InventoryPanel from './InventoryPanel';
import UsedShardsPanel from './UsedShardsPanel';
import { getValidRecipe } from './recipes';
import ForgeResult from './ForgeResult';
import { useNavigate } from 'react-router-dom';

type TransmuteState = {
  shardsPendingForge: RelicItemData[];
  inventoryItems: RelicItemData[];
};

const transmuteReducer = (state: TransmuteState, action: { type: string; payload: any }): TransmuteState => {
  if (action.type === 'ADD_TO_PENDING') {
    // map each shard, if it is the one we update, do the logic
    let didUpdate = false;
    let tmpShards: RelicItemData[] = [];
    let tmpInventory: RelicItemData[] = [];

    tmpShards = state.shardsPendingForge.map((shard) => {
      // this shard is the one we clicked
      if (shard.id === action.payload) {
        didUpdate = true;
        // loop over inventory and update accordingly
        tmpInventory = state.inventoryItems.map((inventoryItem) => {
          if (inventoryItem.id === action.payload) {
            // this is the item we are pulling from
            if (inventoryItem.count > 0) {
              shard.count++;
              inventoryItem.count--;
            }
          }
          return inventoryItem;
        });
      }
      return shard;
    });

    if (!didUpdate) {
      tmpInventory = state.inventoryItems.map((inventoryItem) => {
        if (inventoryItem.id === action.payload) {
          // this is the item we are pulling from
          if (inventoryItem.count > 0) {
            inventoryItem.count--;
          }
          return inventoryItem;
        }
        // return unmodified
        return inventoryItem;
      });
      tmpShards.push({ id: action.payload, count: 1 });
    }

    return { inventoryItems: tmpInventory, shardsPendingForge: tmpShards };
  }

  if (action.type === 'REMOVE_FROM_PENDING') {
    // map each shard, if it is the one we update, do the logic
    let tmpShards: RelicItemData[] = [];
    let tmpInventory: RelicItemData[] = [];

    tmpShards = state.shardsPendingForge.map((shard) => {
      // this shard is the one we clicked
      if (shard.id === action.payload) {
        // loop over inventory and update accordingly
        tmpInventory = state.inventoryItems.map((inventoryItem) => {
          if (inventoryItem.id === action.payload) {
            shard.count--;
            inventoryItem.count++;
          }
          return inventoryItem;
        });
      }
      return shard;
    });

    // remove empty items completely
    tmpShards = tmpShards.filter((shard) => shard.count > 0);

    return { inventoryItems: tmpInventory, shardsPendingForge: tmpShards };
  }

  if (action.type === 'INIT') {
    return {
      shardsPendingForge: [],
      inventoryItems: action.payload,
    };
  }

  return state;
};

const NexusLoading = () => {
  return (
    <NexusPanelRow>
      <span>Loading...</span>
    </NexusPanelRow>
  );
};

const ForgePage = () => {
  const { wallet, isConnected } = useWallet();
  const { inventory, inventoryLoading, updateInventory, transmute } = useRelic();
  const navigate = useNavigate();

  useEffect(() => {
    updateInventory();
  }, [wallet, isConnected]);

  useEffect(() => {
    if (inventory?.relics.length === 0) {
      navigate('/nexus/relic');
    }
    dispatch({ type: 'INIT', payload: inventory?.items });
  }, [inventory]);

  // TODO: Should we move all this into its own hook?
  const [forgeResult, setForgeResult] = useState<RelicItemData | null>(null);
  const [recipeId, setRecipeId] = useState<number | null>(null);

  const [transmuteState, dispatch] = useReducer(transmuteReducer, {
    shardsPendingForge: [],
    inventoryItems: EMPTY_INVENTORY.items,
  });

  useEffect(() => {
    const validRecipe = getValidRecipe(transmuteState.shardsPendingForge);
    if (validRecipe) {
      setRecipeId(validRecipe.id);
      setForgeResult({ id: validRecipe.reward_ids[0], count: validRecipe.reward_amounts[0] });
    }
    return () => {
      setForgeResult(null);
      setRecipeId(null);
    };
  }, [transmuteState]);

  const forgeHandler = async (_item: number): Promise<void> => {
    if (recipeId !== null) {
      await transmute(recipeId);
    }
  };

  const usedShardsClickHandler = (item: number) => {
    dispatch({ type: 'REMOVE_FROM_PENDING', payload: item });
  };

  const addShardClickHandler = async (item: number): Promise<void> => {
    dispatch({ type: 'ADD_TO_PENDING', payload: item });
  };

  return (
    <PageWrapper>
      <NexusBackground
        style={{
          backgroundImage: `url(${forgeBackground})`,
        }}
      />
      <ForgePanel>
        {inventoryLoading && <NexusLoading />}
        {!inventoryLoading && (
          <>
            <NexusPanelRow>Forge</NexusPanelRow>
            <NexusPanelRow2>Combine Shards to Forge</NexusPanelRow2>
            <ForgeResult forgeResult={forgeResult} onClickHandler={forgeHandler} />
            <UsedShardsPanel
              items={transmuteState.shardsPendingForge || EMPTY_INVENTORY.items}
              usedShardsClickHandler={usedShardsClickHandler}
            />
            <InventoryPanel
              inventory={transmuteState.inventoryItems || EMPTY_INVENTORY.items}
              addShardClickHandler={addShardClickHandler}
            />
          </>
        )}
      </ForgePanel>
    </PageWrapper>
  );
};

export const ForgePanel = styled.div<{ color?: string }>`
  flex-direction: column;
  align-items: center;
  border: 0.0625rem solid ${(props) => props.color ?? props.theme.palette.brand};
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
