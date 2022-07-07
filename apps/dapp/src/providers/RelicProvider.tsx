import {
  useContext,
  createContext,
  PropsWithChildren,
  useState,
} from 'react';
import { ItemInventory, RelicService } from './types';

import {
  Relic__factory,
  RelicItems__factory,
  Relic,
} from 'types/typechain';
import {
  TEMPLE_RELIC_ADDRESS,
  TEMPLE_RELIC_ITEMS_ADDRESS,
} from 'providers/env';
import { BigNumber, ContractTransaction, Signer } from 'ethers';
import { NoWalletAddressError } from './errors';
import { ZERO } from 'utils/bigNumber';
import { useAccount, useSigner } from 'wagmi';
import { asyncNoop } from 'utils/helpers';
import { Nullable } from 'types/util';
import { useNotification } from './NotificationProvider';

const INITIAL_STATE: RelicService = {
  inventory: null,
  updateInventory: asyncNoop,
  mintRelic: async () => null,
  renounceRelic: async () => null,
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
    const extractValidItems = (counts: BigNumber[]) => {
      return itemIds.filter((_, idx) => (counts[idx] && !counts[idx].eq(ZERO)));
    }
    const fetchRelicIds = async () => {
      const relicIds = [] as BigNumber[]
      try {
        for (let i = 0; i < 20; i++) { // load up to 20 relics, it's also a safe guard against infinite loop
          relicIds.push(await relicContract.tokenOfOwnerByIndex(walletAddress, i));
        }
      } catch {}
      return relicIds.sort((a, b) => a.toNumber() - b.toNumber())
    }

    const relicIds = await fetchRelicIds()
    const relics: ItemInventory['relics'] = await Promise.all(relicIds.map(async id => {
      const items = extractValidItems(await relicContract.getBalanceBatch(id, itemIds));
      return { id, items }
    }))
    const addresses = itemIds.map(_ => walletAddress)
    const items =  extractValidItems(await relicItemsContract.balanceOfBatch(addresses, itemIds))
    return { relics, items }
  }

  const updateInventory = async () => {
    console.log("updateInventory()", { walletAddress, signer })
    if (!walletAddress || !signer) {
      return;
    }
    const inventory = await fetchInventory(walletAddress, signer)
    console.log("setInventoryState()", { inventory })
    setInventoryState(inventory);
    return inventory
  }
  
  const callRelicFunction = async (fn: (relicContract: Relic) => Promise<ContractTransaction>) => {
    if (inventoryState && signer) {
      const relicContract = new Relic__factory(signer).attach(TEMPLE_RELIC_ADDRESS);
      const existingRelics = [...inventoryState.relics]
      await (await fn(relicContract)).wait()
      const newInventory = await updateInventory()
      if (newInventory) {
        const added = newInventory.relics.filter(relic => existingRelics.findIndex(r => r.id.eq(relic.id)) < 0)
        const removed = existingRelics.filter(relic => newInventory.relics.findIndex(r => r.id.eq(relic.id)) < 0)
        return { added, removed }
      }
    }
  }

  const joinRelicLabels = (relics: { id: BigNumber }[]) => {
    return relics.map(r => `Relic #${r.id.toNumber()}`).join(", ")
  }

  const mintRelic = async () => {
    const result = await callRelicFunction(relic => relic.mintRelic())
    if (result && result.added.length > 0) {
      openNotification({
        title: `Minted ${joinRelicLabels(result.added)}`,
        hash: TEMPLE_RELIC_ADDRESS,
      })
      return result.added[0]
    }
    return null
  }

  const renounceRelic = async (relicId: BigNumber) => {
    const result = await callRelicFunction(relic => relic.renounceRelic(relicId))
    if (result && result.removed.length > 0) {
      openNotification({
        title: `Renounced ${joinRelicLabels(result.removed)}`,
        hash: TEMPLE_RELIC_ADDRESS,
      })
      return result.removed[0]
    }
    return null
  }

  return (
    <RelicContext.Provider
      value={{
        inventory: inventoryState,
        updateInventory: async () => { await updateInventory() },
        mintRelic,
        renounceRelic,
      }}
    >
      {props.children}
    </RelicContext.Provider>
  );
};

export const useRelic = () => useContext(RelicContext)