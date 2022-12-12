import { createContext, PropsWithChildren, useContext, useEffect, useState } from 'react';
import { RelicEnclave, ItemInventory, RelicItemData, RelicService, RelicRarity, RelicData } from './types';

import { BigNumber, ContractReceipt, ContractTransaction, Signer } from 'ethers';
import env from '../constants/env';
import { Relic, Shards, Shards__factory, Relic__factory } from 'types/typechain';
import { Nullable } from 'types/util';
import { asyncNoop } from 'utils/helpers';
import { useAccount, useSigner } from 'wagmi';
import { NoWalletAddressError } from './errors';
import { useNotification } from './NotificationProvider';
import { useWallet } from './WalletProvider';

const INITIAL_STATE: RelicService = {
  inventory: null,
  inventoryLoading: false,
  updateInventory: asyncNoop,
  mintRelic: async () => null,
  renounceRelic: async () => null,
  mintRelicItem: asyncNoop,
  equipRelicItems: asyncNoop,
  unequipRelicItems: asyncNoop,
  transmute: asyncNoop,
};

const RelicContext = createContext(INITIAL_STATE);

export const RelicProvider = (props: PropsWithChildren<{}>) => {
  const { data: signer } = useSigner();
  const { wallet } = useWallet();
  const { openNotification } = useNotification();

  const [inventoryState, setInventoryState] = useState<Nullable<ItemInventory>>(INITIAL_STATE.inventory);
  // TODO: Also handle error
  const [inventoryLoading, setInventoryLoading] = useState(false);

  const fetchInventory = async (walletAddress: string, signer: Signer): Promise<ItemInventory> => {
    if (!walletAddress) {
      throw new NoWalletAddressError();
    }

    const relicContract = new Relic__factory(signer).attach(env.nexus.templeRelicAddress);
    // TODO: Update with shards
    const relicItemsContract = new Shards__factory(signer).attach(env.nexus.templeRelicItemsAddress);

    const itemIds = [...Array(200).keys()];

    const extractValidItems = (counts: BigNumber[]): RelicItemData[] => {
      return counts.map((count, idx) => ({ id: idx, count: count.toNumber() })).filter(({ count }) => count > 0);
    };

    const fetchRelicIds = async () => {
      const relicIds = [] as BigNumber[];
      try {
        for (let i = 0; i < 20; i++) {
          // load up to 20 relics, it's also a safe guard against infinite loop
          relicIds.push(await relicContract.tokenOfOwnerByIndex(walletAddress, i));
        }
      } catch {}
      return relicIds.sort((a, b) => a.toNumber() - b.toNumber());
    };

    const fetchRelicData = async (relicIds: BigNumber[]) => {
      return Promise.all(
        relicIds.map(async (relicId) => {
          const [itemBalances, [rarity, enclave], xp] = await Promise.all([
            relicContract.getBalanceBatch(relicId, itemIds),
            relicContract.getRelicInfos(relicId) as Promise<[RelicRarity, RelicEnclave]>,
            relicContract.getRelicXP(relicId),
          ]);
          const items = extractValidItems(itemBalances);
          return { id: relicId, enclave, rarity, xp, items } as RelicData;
        })
      );
    };

    const relics = await fetchRelicIds().then(fetchRelicData);
    const addresses = itemIds.map((_) => walletAddress);
    console.log('about to call');
    console.log(addresses);
    console.log(itemIds);
    const items = extractValidItems(await relicItemsContract.balanceOfBatch(addresses, itemIds));
    return { relics, items };
  };

  const updateInventory = async () => {
    // TODO: Better handle this, bubble up to UI
    if (!wallet) {
      throw new NoWalletAddressError();
    }

    if (!signer) {
      return;
    }
    setInventoryLoading(true);
    const inventory = await fetchInventory(wallet, signer);
    console.log('-Updated inv');
    console.log(inventory);
    setInventoryState(inventory);
    setInventoryLoading(false);
    return inventory;
  };

  const callRelicFunction = async (fn: (relicContract: Relic) => Promise<ContractTransaction>) => {
    // TODO: Update with Shards contract
    if (inventoryState && signer) {
      const relicContract = new Relic__factory(signer).attach(env.nexus.templeRelicAddress);
      const receipt = await (await fn(relicContract)).wait();
      const inventory = (await updateInventory())!;
      return { inventory, receipt };
    }
  };

  const transmute = async (recipeId: number) => {
    if (signer) {
      // TODO: Add error handling
      const relicItemsContract = new Shards__factory(signer).attach(env.nexus.templeRelicItemsAddress);

      let receipt: ContractReceipt;
      try {
        const txnReceipt = await relicItemsContract.transmute(recipeId);
        receipt = await txnReceipt.wait();
      } catch (error: any) {
        console.log(error.message);
        // TODO: Error handling in the forge UI
        return;
      } finally {
        await updateInventory();
      }

      openNotification({
        title: `Minted ${recipeId}`,
        hash: receipt.transactionHash,
      });
    }
  };

  const callRelicItemsFunction = async (fn: (relicItemsContract: Shards) => Promise<ContractTransaction>) => {
    // TODO: Error handling?
    if (inventoryState && signer) {
      const relicItemsContract = new Shards__factory(signer).attach(env.nexus.templeRelicItemsAddress);
      const receipt = await (await fn(relicItemsContract)).wait();
      const inventory = (await updateInventory())!;
      return { inventory, receipt };
    }
  };

  const callRelicFunctionAndDiffRelics = async (fn: (relicContract: Relic) => Promise<ContractTransaction>) => {
    if (inventoryState) {
      const oldRelics = [...inventoryState.relics];
      const callResult = await callRelicFunction(fn);
      if (callResult) {
        const {
          inventory: { relics: newRelics },
          receipt,
        } = callResult;
        const added = newRelics.filter((relic) => oldRelics.findIndex((r) => r.id.eq(relic.id)) < 0);
        const removed = oldRelics.filter((relic) => newRelics.findIndex((r) => r.id.eq(relic.id)) < 0);
        return { added, removed, receipt };
      }
    }
  };

  const joinRelicLabels = (relics: { id: BigNumber }[]) => {
    return relics.map((r) => `Relic #${r.id.toNumber()}`).join(', ');
  };

  const mintRelic = async (enclave: RelicEnclave) => {
    // TODO: Add error handling
    const result = await callRelicFunctionAndDiffRelics((relic) => relic.mintRelic(enclave));
    if (result && result.added.length > 0) {
      openNotification({
        title: `Minted ${joinRelicLabels(result.added)}`,
        hash: result.receipt.transactionHash,
      });
      return result.added[0];
    }
    return null;
  };

  const renounceRelic = async (relicId: BigNumber) => {
    const result = await callRelicFunctionAndDiffRelics((relic) => relic.renounceRelic(relicId));
    if (result && result.removed.length > 0) {
      openNotification({
        title: `Renounced ${joinRelicLabels(result.removed)}`,
        hash: result.receipt.transactionHash,
      });
      return result.removed[0];
    }
    return null;
  };

  const mintRelicItem = async (itemId: number) => {
    console.log('---- inside mintRelicItem');
    const result = await callRelicItemsFunction((relicItems) => relicItems.mintFromUser(itemId));
    console.log(result);
    if (result) {
      openNotification({
        title: `Minted Relic Item #${itemId.toString()}`,
        hash: result.receipt.transactionHash,
      });
    }
  };

  const equipRelicItems = async (relicId: BigNumber, items: RelicItemData[]) => {
    if (items.length == 0) {
      return;
    }
    const itemIds = items.map((item) => item.id);
    const itemCounts = items.map((item) => item.count);
    const result = await callRelicFunction((relicContract) =>
      relicContract.batchEquipShard(relicId, itemIds, itemCounts)
    );
    if (result) {
      const idString = itemIds.map((id) => `#${id}`).join(', ');
      openNotification({
        title: `Equipped Item(s) ${idString} to Relic #${relicId.toString()}`,
        hash: result.receipt.transactionHash,
      });
    }
  };

  const unequipRelicItems = async (relicId: BigNumber, items: RelicItemData[]) => {
    if (items.length == 0) {
      return;
    }
    const itemIds = items.map((item) => item.id);
    const itemCounts = items.map((item) => item.count);
    const result = await callRelicFunction((relic) => relic.batchUnequipShard(relicId, itemIds, itemCounts));
    if (result) {
      const idString = itemIds.map((id) => `#${id}`).join(', ');
      openNotification({
        title: `Unequipped Items ${idString} to Relic #${relicId.toString()}`,
        hash: result.receipt.transactionHash,
      });
    }
  };

  return (
    <RelicContext.Provider
      value={{
        inventory: inventoryState,
        inventoryLoading,
        updateInventory: async () => {
          await updateInventory();
        },
        mintRelic,
        renounceRelic,
        mintRelicItem,
        equipRelicItems,
        unequipRelicItems,
        transmute,
      }}
    >
      {props.children}
    </RelicContext.Provider>
  );
};

export const useRelic = () => useContext(RelicContext);
