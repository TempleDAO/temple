import { RelicItemData } from 'providers/types';
import styled from 'styled-components';
import ItemGrid from '../Relic/ItemGrid';
import { NexusBodyContainer, NexusContainer, NexusPanel, NexusPanelRow } from '../Relic/styles';
import Image from '../../../Image/Image';

import tmpBagImage from 'assets/icons/mstile-70x70.png'

const InventoryPanel = (props: { inventory: RelicItemData[]; addShardClickHandler: (item: number) => Promise<void> }) => {
  return (
    <NexusContainer>
      <NexusBodyContainer>
        <NexusPanel>
          <BagIcon src={tmpBagImage}/>
          <NexusPanelRow><span>Inventory</span></NexusPanelRow>
          <ItemGrid items={props.inventory} onClick={props.addShardClickHandler} />
        </NexusPanel>
      </NexusBodyContainer>
    </NexusContainer>
  );
};

const BagIcon = styled(Image)`
  position: absolute;
  display: inline;
  left: 0;
  top: 0;
  width: 40px;
`;

export default InventoryPanel;
