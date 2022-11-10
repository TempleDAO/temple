import { useRelic } from 'providers/RelicProvider';
import { useWallet } from 'providers/WalletProvider';
import { useEffect, useMemo } from 'react';
import styled from 'styled-components';
import { EMPTY_INVENTORY } from '../Relic';
import ItemGrid from '../Relic/ItemGrid';
import { NexusBodyContainer, NexusContainer, NexusPanel } from '../Relic/styles';
import { PanelText } from './UsedShardsPanel';

const InventoryPanel = () => {
  const { wallet, isConnected } = useWallet();
  const { inventory, updateInventory } = useRelic();

  useEffect(() => {
    updateInventory();
  }, [wallet, isConnected]);

  const clickHandler = async (item: number): Promise<void> => {
    console.log(`clicked: ${item}`);
  };

  const items = inventory?.items || EMPTY_INVENTORY.items;

  return (
    <NexusContainer>
      <NexusBodyContainer>
        <NexusPanel>
          <PanelText>Inventory</PanelText>
          <ItemGrid items={items} onClick={clickHandler} />
        </NexusPanel>
      </NexusBodyContainer>
    </NexusContainer>
  );
};

export default InventoryPanel;
