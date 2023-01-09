import { Button } from 'components/Button/Button';
import { RelicItemData } from 'providers/types';
import { FC, useEffect, useState } from 'react';
import ItemGrid from './ItemGrid';
import { NexusPanel, NexusPanelRow } from './styles';

const BufferedItemGrid: FC<{
  items: RelicItemData[];
  actionLabel: string;
  disabled?: boolean;
  onAction: (selectedItems: RelicItemData[]) => Promise<void>;
}> = (props) => {
  const { disabled } = props;
  const [unselectedItems, setUnselectedItems] = useState<RelicItemData[]>([]);
  const [selectedItems, setSelectedItems] = useState<RelicItemData[]>([]);
  const [processing, setProcessing] = useState(false);
  useEffect(() => {
    const unselected = props.items
      .map((item) => {
        const selected = selectedItems.find((i) => i.id == item.id);
        const itemCount = item.count - (selected?.count ?? 0);
        return { id: item.id, count: itemCount };
      })
      .filter((item) => item.count > 0);
    setUnselectedItems(unselected);
  }, [props.items, selectedItems]);

  return (
    <>
      {selectedItems.length > 0 && (
        <BufferPanel
          items={selectedItems}
          disabled={disabled || processing}
          onItemClicked={(itemId) => {
            const result = removeItemFromArray(itemId, selectedItems);
            if (result) {
              setSelectedItems(result);
            }
          }}
          actionLabel={props.actionLabel}
          onAction={async () => {
            setProcessing(true);
            await props.onAction(selectedItems).finally(() => setProcessing(false));
            setSelectedItems([]);
          }}
          onCancel={() => {
            setSelectedItems([]);
          }}
        />
      )}
      <ItemGrid
        items={unselectedItems}
        disabled={disabled || processing}
        onClick={async (itemId) => {
          if (unselectedItems.find((i) => i.id == itemId)) {
            setSelectedItems(addItemToArray(itemId, selectedItems));
          }
        }}
      />
      <div />
    </>
  );
};

function addItemToArray(itemId: number, itemArray: RelicItemData[]) {
  const existing = itemArray.find((i) => i.id == itemId);
  if (existing) {
    existing.count += 1;
  } else {
    itemArray.push({ id: itemId, count: 1 });
    itemArray.sort((a, b) => a.id - b.id);
  }
  return [...itemArray];
}

function removeItemFromArray(itemId: number, itemArray: RelicItemData[]) {
  const idx = itemArray.findIndex((i) => i.id == itemId);
  const item = itemArray[idx];
  if (!item) {
    return;
  }
  item.count--;
  if (item.count <= 0) {
    itemArray.splice(idx, 1);
  }
  return [...itemArray];
}

const BufferPanel: FC<{
  items: RelicItemData[];
  onItemClicked: (itemId: number) => void;
  disabled?: boolean;
  actionLabel: string;
  onAction: () => Promise<void>;
  onCancel: () => void;
}> = (props) => {
  const { items, disabled } = props;
  return (
    <NexusPanel
      style={{
        width: '80%',
        borderWidth: 1,
      }}
    >
      <ItemGrid disabled={disabled} items={items} onClick={async (itemId) => props.onItemClicked(itemId)} />
      <NexusPanelRow>
        <Button isSmall disabled={disabled} label="Cancel" onClick={props.onCancel} />
        <Button isSmall disabled={disabled} label={props.actionLabel} onClick={props.onAction} />
      </NexusPanelRow>
    </NexusPanel>
  );
};

export default BufferedItemGrid;
