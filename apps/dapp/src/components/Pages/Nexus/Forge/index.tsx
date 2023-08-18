import forgeBackground from 'assets/images/nexus/forge-bg-new-hires.png';
import forgeRamp from 'assets/images/nexus/forge_ramp.png';
import { useRelic } from 'providers/RelicProvider';
import { RelicItemData } from 'providers/types';
import { useWallet } from 'providers/WalletProvider';
import Image from 'components/Image/Image';
import { useEffect, useReducer, useState } from 'react';
import styled from 'styled-components';
import { EMPTY_INVENTORY } from '../Relic';
import { getValidRecipe } from './recipes';
import { useNavigate } from 'react-router-dom';
import ItemGrid, { ItemButton } from '../Relic/ItemGrid';

import bagImage from 'assets/icons/bagicon.png';

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
    <NexusTitle>
      <span>Loading...</span>
    </NexusTitle>
  );
};

const ForgePage = () => {
  const { wallet, isConnected } = useWallet();
  const { inventory, inventoryLoading, updateInventory, transmute } = useRelic();
  const navigate = useNavigate();

  useEffect(() => {
    if (!isConnected || !wallet) {
      navigate('/nexus/relic');
    }
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
    <ForgeWrapper>
      <ForgeBackground src={forgeBackground} />
      <ForgePanel>
        {inventoryLoading && <NexusLoading />}
        {!inventoryLoading && (
          <>
            <TitleContainer>
              <NexusTitle>Forge</NexusTitle>
              <NexusSubtitle>Combine Shards to Transmute</NexusSubtitle>
            </TitleContainer>
            <ForgeResultWrapper>
              {forgeResult === null ? (
                <EmptyCell />
              ) : (
                <ItemButton key={forgeResult.id} item={forgeResult} disabled={false} onClick={forgeHandler} />
              )}
            </ForgeResultWrapper>
            <ForgeRamp src={forgeRamp} />
            <UsedShardsContainer>
              <ForgeBodyContainer>
                <NexusPanel>
                  <PanelText>Used Shards</PanelText>
                  <ItemGrid
                    items={transmuteState.shardsPendingForge || EMPTY_INVENTORY.items}
                    onClick={async (item) => usedShardsClickHandler(item)}
                  />
                </NexusPanel>
              </ForgeBodyContainer>
            </UsedShardsContainer>
            <InventoryContainer>
              <ForgeBodyContainer>
                <NexusPanel>
                  <PanelHeading>
                    <BagIcon src={bagImage} />
                    <PanelText>Inventory</PanelText>
                  </PanelHeading>
                  <ItemGrid
                    items={transmuteState.inventoryItems || EMPTY_INVENTORY.items}
                    onClick={addShardClickHandler}
                  />
                </NexusPanel>
              </ForgeBodyContainer>
            </InventoryContainer>
          </>
        )}
      </ForgePanel>
    </ForgeWrapper>
  );
};

const TitleContainer = styled.div`
  display: flex
  flex-direction: column;
  background: #000000b3;
  padding-top: 10px;
  margin-bottom: 20px;
  z-index: 1;
`;

const PanelHeading = styled.div`
  display: flex;
  flex-direction: row;
`;

const EmptyCell = styled.div`
  background: #2e261f;
  border: solid 1px #2e261f;
  position: relative;
  border-radius: 15%;
`;

const ForgeBackground = styled(Image)`
  position: absolute;
  top: -350px;
  width: 2500px;
`;

const ForgeWrapper = styled.div`
  margin-top: 40px;
  display: flex;
  flex-direction: column;
  align-items: center;
  height: 100%;
  /* full width */
  position: absolute;
  left: 0px;
  right: 0px;
  top: 0px;
  background-color: #000;
`;

const InventoryContainer = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  flex-direction: column;
  position: relative;
`;

const ForgeRamp = styled(Image)`
  width: 100%;
  margin-top: -40px;
  position: relative;
`;

const UsedShardsContainer = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  flex-direction: column;
  position: relative;
  margin-top: -50px;
`;

const ForgePanel = styled.div<{ color?: string }>`
  display: flex;
  flex-direction: column;
  width: 800px;
`;

const NexusTitle = styled.h2`
  width: 100%;
  margin: 0.1rem;
  padding: 0 5px;
  text-align: center;
  flex-direction: row;
  justify-content: space-between;
  align-items: center;
  position: relative;
`;

const NexusSubtitle = styled.h4`
  width: 100%;
  margin: 0.5rem;
  padding: 0 5px;
  text-align: center;
  flex-direction: row;
  justify-content: space-between;
  align-items: center;
  position: relative;
`;

const BagIcon = styled(Image)`
  left: 0;
  top: 0;
  width: 40px;
`;

const PanelText = styled.div`
  font-family: Megant, serif;
  color: #bd7b4f;
  width: 100%;
  margin: 2px;
  padding: 0 5px;
  text-align: left;
  font-size: 22px;
  display: flex;
  align-content: flex-start;
`;

const ForgeResultWrapper = styled.div`
  position: relative;
  margin: auto;
  width: 120px;
  height: 120px;
  border: 0.0625rem solid ${(props) => props.color ?? props.theme.palette.brand};
  border-radius: 15%;
  > * {
    &:first-child {
      position: absolute;
      top: 0px;
      left: 0px;
      right: 0px;
      bottom: 0px;
      border-radius: 15%;
    }
  }
  z-index: 2;
`;

const ForgeBodyContainer = styled.div`
  display: flex;
  flex-flow: column;
  justify-content: center;
  align-items: center;
  width: 100%;
  > * {
    margin: 2%;
    width: 100%;
    min-width: 25rem;
    max-width: 800px;
  }
`;

const NexusPanel = styled.div<{ color?: string }>`
  display: flex;
  flex-direction: column;
  border: 0.0625rem solid ${(props) => props.color ?? props.theme.palette.brand};
  border-radius: 16px;
  padding: 1rem;
  background-color: rgba(0, 0, 0, 0.6);
  backdrop-filter: blur(15px);
  background: #000000cc;

  > * {
    margin-bottom: 1rem;
  }
`;

export default ForgePage;
