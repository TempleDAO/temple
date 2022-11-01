import { createContext, PropsWithChildren, useContext, useState } from 'react';
import { RelicEnclave, ItemInventory, RelicItemData, RelicService, RelicRarity, RelicData } from './types';

import { BigNumber, ContractTransaction, Signer } from 'ethers';
import { TEMPLE_RELIC_ADDRESS, TEMPLE_RELIC_ITEMS_ADDRESS } from 'providers/env';
import { Relic, RelicItems, RelicItems__factory, Relic__factory } from 'types/typechain';
import { Nullable } from 'types/util';
import { asyncNoop } from 'utils/helpers';
import { useAccount, useSigner } from 'wagmi';
import { NoWalletAddressError } from './errors';
import { useNotification } from './NotificationProvider';

const INITIAL_STATE: RelicService = {
  inventory: null,
  updateInventory: asyncNoop,
  mintRelic: async () => null,
  renounceRelic: async () => null,
  mintRelicItem: asyncNoop,
  equipRelicItems: asyncNoop,
  unequipRelicItems: asyncNoop,
};

const RelicContext = createContext(INITIAL_STATE);

export const RelicProvider = (props: PropsWithChildren<{}>) => {
  const { data: signer } = useSigner();
  const { data: accountData } = useAccount();
  const { openNotification } = useNotification();

  const [inventoryState, setInventoryState] = useState<Nullable<ItemInventory>>(INITIAL_STATE.inventory);
  const walletAddress = accountData?.address;

  const fetchInventory = async (walletAddress: string, signer: Signer): Promise<ItemInventory> => {
    if (!walletAddress) {
      throw new NoWalletAddressError();
    }

    const relicContract = new Relic__factory(signer).attach(TEMPLE_RELIC_ADDRESS);
    const relicItemsContract = new RelicItems__factory(signer).attach(TEMPLE_RELIC_ITEMS_ADDRESS);

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

    const fetchRelicData = async(relicIds: BigNumber[]) => {
      return Promise.all(relicIds.map(async relicId => {
        const [itemBalances, [rarity, enclave], xp] = await Promise.all([
          relicContract.getBalanceBatch(relicId, itemIds),
          relicContract.getRelicInfos(relicId) as Promise<[RelicRarity, RelicEnclave]>,
          relicContract.getRelicXP(relicId),
        ])
        const items = extractValidItems(itemBalances);
        return { id: relicId, enclave, rarity, xp, items } as RelicData
      }))
    }

    const relics = await fetchRelicIds().then(fetchRelicData)
    const addresses = itemIds.map((_) => walletAddress);
    const items = extractValidItems(await relicItemsContract.balanceOfBatch(addresses, itemIds));
    return { relics, items };
  };

  const updateInventory = async () => {
    if (!walletAddress || !signer) {
      return;
    }
    const inventory = await fetchInventory(walletAddress, signer);
    setInventoryState(inventory);
    return inventory;
  };

  const callRelicFunction = async (fn: (relicContract: Relic) => Promise<ContractTransaction>) => {
    if (inventoryState && signer) {
      const relicContract = new Relic__factory(signer).attach(TEMPLE_RELIC_ADDRESS);
      const receipt = await (await fn(relicContract)).wait();
      const inventory = (await updateInventory())!;
      return { inventory, receipt };
    }
  };

  const callRelicItemsFunction = async (fn: (relicItemsContract: RelicItems) => Promise<ContractTransaction>) => {
    if (inventoryState && signer) {
      const relicItemsContract = new RelicItems__factory(signer).attach(TEMPLE_RELIC_ITEMS_ADDRESS);
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
    const result = await callRelicItemsFunction((relicItems) => relicItems.mintFromUser(itemId));
    if (result) {
      openNotification({
        title: `Minted Relic Item #${itemId.toString()}`,
        hash: result.receipt.transactionHash,
      });
    }
  };

  const equipRelicItems = async (relicId: BigNumber, items: RelicItemData[]) => {
    if (items.length == 0) {
      return
    }
    const itemIds = items.map(item => item.id)
    const itemCounts = items.map(item => item.count)
    const result = await callRelicFunction((relic) => relic.batchEquipItems(relicId, itemIds, itemCounts));
    if (result) {
      const idString = itemIds.map(id => `#${id}`).join(", ")
      openNotification({
        title: `Equipped Item(s) ${idString} to Relic #${relicId.toString()}`,
        hash: result.receipt.transactionHash,
      });
    }
  };

  const unequipRelicItems = async (relicId: BigNumber, items: RelicItemData[]) => {
    if (items.length == 0) {
      return
    }
    const itemIds = items.map(item => item.id)
    const itemCounts = items.map(item => item.count)
    const result = await callRelicFunction((relic) => relic.batchUnequipItems(relicId, itemIds, itemCounts));
    if (result) {
      const idString = itemIds.map(id => `#${id}`).join(", ")
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
        updateInventory: async () => {
          await updateInventory();
        },
        mintRelic,
        renounceRelic,
        mintRelicItem,
        equipRelicItems,
        unequipRelicItems,
      }}
    >
      {props.children}
    </RelicContext.Provider>
  );
};

export const useRelic = () => useContext(RelicContext);
