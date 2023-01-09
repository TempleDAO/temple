import { useRelic } from 'providers/RelicProvider';
import { RelicItemData } from 'providers/types';
import { useWallet } from 'providers/WalletProvider';
import { useEffect, useMemo } from 'react';
import styled from 'styled-components';
import { EMPTY_INVENTORY } from '../Relic';
import ItemGrid from '../Relic/ItemGrid';
import { NexusBodyContainer, NexusContainer, NexusPanel } from '../Relic/styles';
import { PanelText } from './UsedShardsPanel';

const InventoryPanel = (props: { inventory: RelicItemData[]; addShardClickHandler: (item: number) => Promise<void> }) => {
  return (
    <NexusContainer>
      <NexusBodyContainer>
        <NexusPanel>
          <PanelText>Inventory</PanelText>
          <ItemGrid items={props.inventory} onClick={props.addShardClickHandler} />
        </NexusPanel>
      </NexusBodyContainer>
    </NexusContainer>
  );
};

export default InventoryPanel;
