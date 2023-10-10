import { createContext, PropsWithChildren, useContext, useState } from 'react';
import { RelicEnclave, ItemInventory, RelicItemData, RelicService, RelicRarity, RelicData } from './types';

import { BigNumber, ContractReceipt, ContractTransaction, Signer } from 'ethers';
import env from '../constants/env';
import {
  Relic,
  Shard,
  Shard__factory,
  Relic__factory,
  TempleSacrifice__factory,
  ERC20__factory,
  Apocrypha__factory,
  PathofTheTemplarShard__factory,
} from 'types/typechain';
import { Nullable } from 'types/util';
import { asyncNoop } from 'utils/helpers';
import useRequestState from 'hooks/use-request-state';
import { NoWalletAddressError } from './errors';
import { useNotification } from './NotificationProvider';
import { useWallet } from './WalletProvider';
import { TICKER_SYMBOL } from 'enums/ticker-symbol';
import { ZERO } from 'utils/bigNumber';
import { equipSound } from 'utils/sound';

const INITIAL_STATE: RelicService = {
  inventory: null,
  inventoryLoading: false,
  updateInventory: asyncNoop,
  mintRelic: async () => null,
  equipShards: asyncNoop,
  unequipShards: asyncNoop,
  transmute: asyncNoop,
  checkWhiteList: {
    handler: asyncNoop,
    isLoading: false,
    error: null,
    isWhitelisted: false,
  },
  sacrificeTemple: {
    handler: async () => {},
    isLoading: false,
    error: null,
  },
  fetchSacrificePrice: {
    handler: asyncNoop,
    isLoading: false,
    error: null,
    sacrificePrice: ZERO,
  },
  mintShard: {
    handler: asyncNoop,
    isLoading: false,
    error: null,
  },
  mintPathOfTemplarShard: {
    handler: asyncNoop,
    isLoading: false,
    error: null,
  },
};

const TXN_SUCCESS_CODE = 1;

const RelicContext = createContext(INITIAL_STATE);

export const RelicProvider = (props: PropsWithChildren<{}>) => {
  const { wallet, ensureAllowance, signer } = useWallet();
  const { openNotification } = useNotification();

  const [inventoryState, setInventoryState] = useState<Nullable<ItemInventory>>(INITIAL_STATE.inventory);

  // TODO: Also handle error
  const [inventoryLoading, setInventoryLoading] = useState(false);

  const fetchInventory = async (walletAddress: string, signer: Signer): Promise<ItemInventory> => {
    if (!walletAddress) {
      throw new NoWalletAddressError();
    }

    const relicContract = new Relic__factory(signer).attach(env.nexus.templeRelicAddress);
    const shardsContract = new Shard__factory(signer).attach(env.nexus.templeShardsAddress);

    const itemIds = [...Array(200).keys()];

    const extractValidItems = (counts: BigNumber[]): RelicItemData[] => {
      return counts.map((count, idx) => ({ id: idx, count: count.toNumber() })).filter(({ count }) => count > 0);
    };

    const fetchRelicIds = async () => {
      if (!walletAddress) {
        return[];
      }
      try {
        
        const relicIds = await relicContract.relicsOfOwner(walletAddress);
        if (!relicIds) {
          return [];
        }
        return relicIds.sort((a, b) => a.toNumber() - b.toNumber());
      } catch (error) {
        console.error('Error fetching relic ids');
        console.error(error);
        return [];
      }
    };

    const fetchRelicData = async (relicIds: BigNumber[]) => {
      return Promise.all(
        relicIds.map(async (relicId) => {
          const [enclave, rarity, xp] = await relicContract.relicInfos(relicId);
          const [itemBalances] = await Promise.all([
            relicContract.getBalanceBatch(relicId, itemIds),
            // relicContract.getRelicInfos(relicId) as Promise<[RelicRarity, RelicEnclave]>,
            // relicContract.relicInfos(relicId),
          ]);
          // enclave: number;
          // rarity: number;
          // xp: BigNumber;
          const items = extractValidItems(itemBalances);
          return { id: relicId, enclave, rarity, xp, items } as RelicData;
        })
      );
    };

    const relicIds = await fetchRelicIds();
    let relics = [] as RelicData[];
    if (relicIds) {
      relics = await fetchRelicData(relicIds);
    }

    const addresses = itemIds.map((_) => walletAddress);
    const items = extractValidItems(await shardsContract.balanceOfBatch(addresses, itemIds));
    return { relics, items };
  };

  const updateInventory = async () => {
    // TODO: Better handle this, bubble up to UI
    if (!wallet) {
      // throw new NoWalletAddressError();
      return;
    }

    if (!signer) {
      return;
    }
    setInventoryLoading(true);
    const inventory = await fetchInventory(wallet, signer);
    setInventoryState(inventory);
    setInventoryLoading(false);

    return inventory;
  };

  const callRelicContractFunction = async (fn: (relicContract: Relic) => Promise<ContractTransaction>) => {
    if (inventoryState && signer) {
      const relicContract = new Relic__factory(signer).attach(env.nexus.templeRelicAddress);
      const receipt = await (await await fn(relicContract)).wait();
      const inventory = (await updateInventory())!;
      return { inventory, receipt };
    }
  };

  const transmute = async (recipeId: number) => {
    if (signer) {
      // TODO: Add error handling
      const shardsContract = new Shard__factory(signer).attach(env.nexus.templeShardsAddress);

      let receipt: ContractReceipt;
      try {
        const txnReceipt = await shardsContract.transmute(recipeId);
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

  const callShardsContractFunction = async (fn: (shardsContract: Shard) => Promise<ContractTransaction>) => {
    // TODO: Error handling?
    if (inventoryState && signer) {
      const shardsContract = new Shard__factory(signer).attach(env.nexus.templeShardsAddress);
      const receipt = await (await fn(shardsContract)).wait();
      const inventory = (await updateInventory())!;
      return { inventory, receipt };
    }
  };

  const callRelicFunctionAndDiffRelics = async (fn: (relicContract: Relic) => Promise<ContractTransaction>) => {
    if (inventoryState) {
      const oldRelics = [...inventoryState.relics];
      const callResult = await callRelicContractFunction(fn);
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

  const mintRelic = async (address: string, enclave: RelicEnclave) => {
    // TODO: Add error handling
    const result = await callRelicFunctionAndDiffRelics((relic) => relic.mintRelic(address, enclave));
    if (result && result.added.length > 0) {
      openNotification({
        title: `Minted ${joinRelicLabels(result.added)}`,
        hash: result.receipt.transactionHash,
      });
      return result.added[0];
    }
    return null;
  };

  const equipShards = async (relicId: BigNumber, items: RelicItemData[]) => {
    if (items.length == 0) {
      return;
    }

    if (wallet && signer) {
      const shardsContract = new Shard__factory(signer).attach(env.nexus.templeShardsAddress);
      const isApproved = await shardsContract.isApprovedForAll(wallet, env.nexus.templeRelicAddress);

      if (!isApproved) {
        const txn = await shardsContract.setApprovalForAll(env.nexus.templeRelicAddress, true);
        const txnResult = await txn.wait();

        if (txnResult.status === TXN_SUCCESS_CODE) {
          return invokeEquipShardes(relicId, items);
        }
      }

      return invokeEquipShardes(relicId, items);
    }
  };

  const invokeEquipShardes = async (relicId: BigNumber, items: RelicItemData[]) => {
    const itemIds = items.map((item) => item.id);
    const itemCounts = items.map((item) => item.count);

    console.debug('Invoking batchEquipShard');
    console.debug(`Relic ID: ${relicId.toString()}`);
    console.debug(`Item IDs: ${itemIds}`);
    console.debug(`Item IDs length: ${itemIds.length}`);
    console.debug(`Item Counts: ${itemCounts}`);
    console.debug(`Item counts length: ${itemCounts.length}`);
    console.debug('Raw items: ');
    console.debug(items);
    console.debug('Raw items length: ');
    console.debug(items.length);

    const result = await callRelicContractFunction((relicContract) =>
      relicContract.batchEquipShards(relicId, itemIds, itemCounts)
    );

    if (result) {
      const idString = itemIds.map((id) => `#${id}`).join(', ');
      equipSound.play();
      openNotification({
        title: `Equipped Item(s) ${idString} to Relic #${relicId.toString()}`,
        hash: result.receipt.transactionHash,
      });
    }
  };

  const unequipShards = async (relicId: BigNumber, items: RelicItemData[]) => {
    if (items.length == 0) {
      return;
    }
    const itemIds = items.map((item) => item.id);
    const itemCounts = items.map((item) => item.count);
    const result = await callRelicContractFunction((relic) => relic.batchUnequipShards(relicId, itemIds, itemCounts));
    if (result) {
      const idString = itemIds.map((id) => `#${id}`).join(', ');
      openNotification({
        title: `Unequipped Items ${idString} to Relic #${relicId.toString()}`,
        hash: result.receipt.transactionHash,
      });
    }
  };

  const [isWhitelisted, setIsWhitelisted] = useState(false);

  // TODO: This gets replaced effectively.
  const checkWhiteList = async () => {
    if (!wallet || !signer) {
      return;
    }

    const relicContract = new Relic__factory(signer).attach(env.nexus.templeRelicAddress);
    // const receipt = await relicContract.whitelisted(wallet);
    setIsWhitelisted(false);
  };

  const sacrificeTemple = async (amount: BigNumber, enclave: RelicEnclave) => {
    if (!wallet || !signer) {
      return;
    }

    const TEMPLE = new ERC20__factory(signer).attach(env.nexus.templeToken);
    await ensureAllowance(TICKER_SYMBOL.TEMPLE_TOKEN, TEMPLE, env.nexus.templeSacrificeAddress, amount, amount);

    const sacrificeContract = new TempleSacrifice__factory(signer).attach(env.nexus.templeSacrificeAddress);
    const txn = await sacrificeContract.sacrifice(enclave);
    const receipt = await txn.wait();

    setIsWhitelisted(true);

    openNotification({
      title: 'Sacrifice Complete',
      hash: receipt.transactionHash,
    });
  };

  const [sacrificeTempleHandler, sacrificeTempleRequestState] = useRequestState(sacrificeTemple, {
    shouldReThrow: true,
  });

  const [checkWhiteListHandler, checkWhiteListRequestState] = useRequestState(checkWhiteList, {
    shouldReThrow: true,
  });

  const fetchSacrificePrice = async () => {
    if (!wallet || !signer) {
      return;
    }

    try {
      const sacrificeContract = new TempleSacrifice__factory(signer).attach(env.nexus.templeSacrificeAddress);
      const price: BigNumber = await sacrificeContract.getPrice();
      setSacrificePrice(price); 
    } catch (error) {
      console.error('Error fetching sacrifice price');
      console.error(error);
      throw error;
    }
  };

  const [sacrificePrice, setSacrificePrice] = useState(ZERO);

  const [fetchSacrificePriceHandler, fetchSacrificePriceRequestState] = useRequestState(fetchSacrificePrice, {
    shouldReThrow: true,
  });

  const mintShard = async () => {
    if (!signer || !wallet) {
      return;
    }

    let receipt: ContractReceipt;
    try {
      const partnerMinterContract = new Apocrypha__factory(signer).attach(env.nexus.templePartnerMinterAddress);
      const txnReceipt = await partnerMinterContract.mintShard({ gasLimit: 400000 });
      receipt = await txnReceipt.wait();
    } catch (error: any) {
      console.log(error.message);
      throw error;
    }

    openNotification({
      title: 'Successfully Minted Shard',
      hash: receipt.transactionHash,
    });
  };

  const [mintShardHandler, mintShardRequestState] = useRequestState(mintShard, {
    shouldReThrow: true,
  });

  const mintPathOfTemplarShard = async (shardIndex: number) => {
    if (!signer || !wallet) {
      return;
    }

    // TODO: Add error handling
    const minterContract = new PathofTheTemplarShard__factory(signer).attach(env.nexus.pathOfTemplarShardAddress);

    let receipt: ContractReceipt;
    try {
      const txnReceipt = await minterContract.mintShard(shardIndex, { gasLimit: 400000 });
      receipt = await txnReceipt.wait();
    } catch (error: any) {
      console.log(error.message);
      throw error;
    }

    openNotification({
      title: 'Successfully Minted Shard',
      hash: receipt.transactionHash,
    });
  };

  const [mintPathOfTemplarShardHandler, mintPathOfTemplarShardRequestState] = useRequestState(mintPathOfTemplarShard, {
    shouldReThrow: true,
  });

  return (
    <RelicContext.Provider
      value={{
        inventory: inventoryState,
        inventoryLoading,
        updateInventory: async () => {
          await updateInventory();
        },
        mintRelic,
        equipShards,
        unequipShards,
        transmute,
        checkWhiteList: {
          handler: checkWhiteListHandler,
          isLoading: checkWhiteListRequestState.isLoading,
          error: checkWhiteListRequestState.error,
          isWhitelisted,
        },
        sacrificeTemple: {
          handler: sacrificeTempleHandler,
          isLoading: sacrificeTempleRequestState.isLoading,
          error: sacrificeTempleRequestState.error,
        },
        fetchSacrificePrice: {
          handler: fetchSacrificePriceHandler,
          isLoading: fetchSacrificePriceRequestState.isLoading,
          error: fetchSacrificePriceRequestState.error,
          sacrificePrice,
        },
        // TODO: Make this either more generic for all shards, or specific to the apocrypha shard
        // And in that case, then need a new method for path of templar shard claiming
        mintShard: {
          handler: mintShardHandler,
          isLoading: mintShardRequestState.isLoading,
          error: mintShardRequestState.error,
        },
        mintPathOfTemplarShard: {
          handler: mintPathOfTemplarShardHandler,
          isLoading: mintPathOfTemplarShardRequestState.isLoading,
          error: mintPathOfTemplarShardRequestState.error,
        },
      }}
    >
      {props.children}
    </RelicContext.Provider>
  );
};

export const useRelic = () => useContext(RelicContext);
