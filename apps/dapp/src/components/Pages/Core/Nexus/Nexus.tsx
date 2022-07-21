import { Button } from 'components/Button/Button';
import { BigNumber, BigNumberish } from 'ethers';
import { useRelic } from 'providers/RelicProvider';
import { ItemInventory, RelicItemData } from 'providers/types';
import { useWallet } from 'providers/WalletProvider';
import { FC, useEffect, useState } from 'react';
import { Navigate, Route, Routes, useNavigate, useParams } from 'react-router-dom';
import styled, { CSSProperties } from 'styled-components';
import { asyncNoop } from 'utils/helpers';
import { NexusContainer } from '../Trade/styles';
import { PageWrapper } from '../utils';

const NexusPage = () => {
  return (
    <PageWrapper>
      <h3>Nexus</h3>
      <NexusContainer>
        <NexusBody />
      </NexusContainer>
    </PageWrapper>
  );
};

const VALID_ITEM_ID_COUNT = 15

const NexusBody = () => {
  const { wallet, isConnected } = useWallet();
  const { inventory, updateInventory } = useRelic();

  useEffect(() => {
    updateInventory();
  }, [wallet, isConnected]);

  if (inventory === null) {
    return (
      <Row>
        <span>Loading...</span>
      </Row>
    );
  } else {
    const allItems: RelicItemData[] = [...Array(VALID_ITEM_ID_COUNT).keys()].map((id) => ({ id, count: 0 }));
    const { relics, items } = inventory;

    return (
      <NexusBodyContainer>
        <RelicRoutes inventory={inventory} />
        <MyItemPanel relicId={relics[0]?.id} items={items} />
        <MintItemPanel items={allItems} />
      </NexusBodyContainer>
    );
  }
};

const RelicRoutes: FC<{ inventory: ItemInventory }> = (props) => {
  const {
    inventory: { relics },
  } = props;
  return (
    <Routes>
      <Route path="" element={<NoRelicPanel relics={relics} />} />
      <Route path="relic/:id" element={<RelicPanel relics={relics} />} />
      <Route path="*" element={<Navigate to="" />} />
    </Routes>
  );
};

const NoRelicPanel = (props: { relics: ItemInventory['relics'] }) => {
  const { relics } = props;
  if (relics.length > 0) {
    return <Navigate to={`../relic/${relics[0].id.toString()}`} />;
  }
  const { mintRelic } = useRelic();
  const navigate = useNavigate();
  return (
    <NexusPanel>
      <Row>
        <span>No Relics</span>
        <div>
          <Button isSmall
            label="Mint Relic"
            onClick={async () => {
              const added = await mintRelic();
              if (added) {
                navigate(`relic/${added.id.toString()}`);
              }
            }}
          />
        </div>
      </Row>

      <ItemGrid items={[]} onClick={asyncNoop} />
    </NexusPanel>
  );
};

const RelicPanel = (props: { relics: ItemInventory['relics'] }) => {
  const { renounceRelic, unequipRelicItems } = useRelic();
  const navigate = useNavigate();
  const { id } = useParams();
  const { relics } = props;
  const relicIdx = relics.findIndex((r) => r.id.toString() == id);
  const relic = relics[relicIdx];
  if (!relic) {
    return <Navigate to=".." />;
  }
  return (
    <NexusPanel>
      <Row>
        <span>Relic #{relic.id.toString()}</span>
        <div>
          <Button isSmall
            label="Renounce Relic"
            onClick={async () => {
              const nextRelicIdx = (relicIdx + 1) % relics.length;
              const nextRelicId = relics[nextRelicIdx].id;
              await renounceRelic(relic.id);
              navigate(`../relic/${nextRelicId.toString()}`);
            }}
          />
        </div>
      </Row>
      <BufferedItemGrid relicId={relic.id} items={relic.items}
        actionLabel="Unequip"
        onAction={async selectedItems => unequipRelicItems(relic.id, selectedItems)}
      />
    </NexusPanel>
  );
};

const MyItemPanel: FC<{
  relicId?: BigNumber;
  items: RelicItemData[];
}> = (props) => {
  const { relicId, items } = props;
  const { equipRelicItems } = useRelic();

  return (
    <NexusPanel>
      <Row>
        <span>My Items</span>
      </Row>
      <BufferedItemGrid relicId={relicId} items={items}
        actionLabel="Equip"
        onAction={async selectedItems => {
          if (relicId) {
            await equipRelicItems(relicId, selectedItems)
          }
        }}
      />
    </NexusPanel>
  );
};

const BufferedItemGrid: FC<{
  relicId?: BigNumber;
  items: RelicItemData[];
  actionLabel: string
  onAction: (selectedItems: RelicItemData[]) => Promise<void>
}> = (props) => {
  const { relicId } = props;
  const [unselectedItems, setUnselectedItems] = useState<RelicItemData[]>([])
  const [selectedItems, setSelectedItems] = useState<RelicItemData[]>([])
  useEffect(() => {
    const unselected = props.items.map(item => {
      const selected = selectedItems.find(i => i.id == item.id)
      const itemCount = item.count - (selected?.count ?? 0)
      return { id: item.id, count: itemCount }
    }).filter(item => item.count > 0)
    setUnselectedItems(unselected)
  }, [props.items, selectedItems])

  return <>
    <ItemGrid items={unselectedItems} disabled={!relicId}
      onClick={async itemId => {
        if (unselectedItems.find(i => i.id == itemId)) {
          setSelectedItems(addItemToArray(itemId, selectedItems))
        }
      }}
    />
    <div/>
    { (relicId && selectedItems.length > 0) && 
        <BufferPanel items={selectedItems} 
          onItemClicked={itemId => {
            const result = removeItemFromArray(itemId, selectedItems)
            if (result) {
              setSelectedItems(result)
            }
          }}
          actionLabel={props.actionLabel}
          onAction={async () => {
            await props.onAction(selectedItems)
            setSelectedItems([])
          }}
          onCancel={() => {
            setSelectedItems([])
          }}
        />
    }
  </>
}

function addItemToArray(itemId: number, itemArray: RelicItemData[]) {
  const existing = itemArray.find(i => i.id == itemId)
  if (existing) {
    existing.count += 1
  } else {
    itemArray.push({ id: itemId, count: 1 })
    itemArray.sort((a, b) => a.id - b.id)
  }
  return [...itemArray]
}

function removeItemFromArray(itemId: number, itemArray: RelicItemData[]) {
  const idx = itemArray.findIndex(i => i.id == itemId)
  const item = itemArray[idx]
  if (!item) {
    return
  }
  item.count--
  if (item.count <= 0) {
    itemArray.splice(idx)
  }
  return [...itemArray]
}

const BufferPanel: FC<{
  items: RelicItemData[]
  onItemClicked: (itemId: number) => void
  actionLabel: string
  onAction: () => Promise<void>
  onCancel: () => void
}> = (props) => {
  const { items } = props
  return (
    <NexusPanel style={{
      width: '80%',
      borderWidth: 1,
    }}>
      <ItemGrid columnCount={4}
        items={items}
        onClick={async itemId => props.onItemClicked(itemId)}
      />
      <Row>
        <Button isSmall
          label="Cancel"
          onClick={props.onCancel}
        />
        <Button isSmall
          label={props.actionLabel}
          onClick={props.onAction}
        />
      </Row>
    </NexusPanel>
  )
}

const MintItemPanel: FC<{
  items: RelicItemData[];
}> = (props) => {
  const { mintRelicItem } = useRelic();
  return (
    <NexusPanel>
      <Row>
        <span>Mint Items (test only)</span>
      </Row>
      <ItemGrid items={props.items} onClick={async (item) => mintRelicItem(item)} />
    </NexusPanel>
  );
};

const DEFAULT_COLUMN_COUNT = 5;
const ITEM_IMAGE_BASE_URL = "https://myst.mypinata.cloud/ipfs/QmTmng8Skqv8sqckArgpi6RqQQTHh7LNLzmRyMWyxU24th"
const MAX_IMAGE_ITEM_ID = 2

const ItemGrid: FC<{
  columnCount?: number
  disabled?: boolean
  items: RelicItemData[]
  onClick: (item: number) => Promise<void>
}> = (props) => {
  const { items } = props;
  const columnCount = props.columnCount ?? DEFAULT_COLUMN_COUNT
  const rowCount = Math.max(1, Math.ceil(items.length / columnCount));
  const itemIndexes = [...Array(rowCount * columnCount).keys()];
  return (
    <ItemsContainer>
      {itemIndexes.map((_, idx) => {
        const item = items[idx];
        return (
          <ItemWrapper key={idx} columnCount={columnCount}>
            {item == undefined ? (
              <EmptyCell />
            ) : (
              <ItemButton key={item.id}
                item={item}
                disabled={props.disabled}
                onClick={props.onClick}
              />
            )}
          </ItemWrapper>
        );
      })}
    </ItemsContainer>
  );
};

const ItemButton: FC<{
  item: RelicItemData
  disabled?: boolean
  onClick: (item: number) => Promise<void>
}> = (props) => {
  const { item } = props
  const [processing, setProcessing] = useState(false)
  const imgUrl = item.id <= MAX_IMAGE_ITEM_ID ? `${ITEM_IMAGE_BASE_URL}/${item.id}.png` : undefined
  return <ItemCell>
    <Button key={item.id}
      label={imgUrl ? '' : `${item.id}`}
      style={{ border: 'none' }}
      disabled={props.disabled}
      onClick={() => {
        setProcessing(true)
        return props.onClick(item.id).finally(() => setProcessing(false))
      }}
    >
    </Button>
    { imgUrl && <ItemImage src={imgUrl} style={processing ? { opacity: .2 } : {}}/> }
    
    {item.count > 1 && <ItemCountBadge disabled={props.disabled} >{item.count}</ItemCountBadge>}
  </ItemCell>
}

const ItemCell = styled.div`
  border: solid 2px ${props => props.theme.palette.brand};
  border-radius: 15%;

  > * {
    width: 100%;
    height: 100%;
    position: relative;
    border-radius: 15%;
  }
  transition: opacity 2s ease;
  > img {
    opacity: .5;
  }
  &:hover > img {
    opacity: .7;
  }
`;

const ItemCountBadge = styled.div<{ disabled?: boolean }>`
  position: absolute;
  top: -0.5em;
  right: -0.5em;
  width: 2em;
  height: 2em;
  color: black;
  border-radius: 50%;
  text-align: center;
  line-height: 2em;
  background-color: ${(props) => props.disabled ? props.theme.palette.brand50 : props.theme.palette.brand};
`;

const ItemImage = styled.img`
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  opacity: .7;
  pointer-events: none;
`

const EmptyCell = styled.div`
  background: darkgray;
  border: solid 1px darkgray;
  opacity: 0.1;
`;

const NexusBodyContainer = styled.div`
  display: flex;
  flex-flow: row;
  flex-wrap: wrap;
  justify-content: center;
  align-items: top;
  width: 100%;
  > * {
    width: 46%;
    margin: 2%;
    min-width: 25rem;
  }
`;

const NexusPanel = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  border: 2px solid ${(props) => props.theme.palette.brand};
  border-radius: 16px;
  padding: 1rem;

  > * {
    margin-bottom: 1rem;
  }
`;

const Row = styled.h3`
  width: 100%;
  margin: 1rem;
  padding: 0 5px;
  text-align: left;
  display: flex;
  flex-direction: row;
  justify-content: space-between;
  align-items: center;
  * > {
    &:first-child {
      flex: 1;
    }
  }
`;

const ItemsContainer = styled.div`
  display: flex;
  flex-flow: row wrap;
  width: 100%;
  transition: height 2s ease;
`;

const ItemWrapper = styled.div<{ columnCount: number }>`
  position: relative;
  width: calc(100% / ${props => props.columnCount});
  padding-top: calc(100% / ${props => props.columnCount});
  > * {
    &:first-child {
      position: absolute;
      top: 5px;
      left: 5px;
      right: 5px;
      bottom: 5px;
      border-radius: 15%;
    }
  }
`;

export default NexusPage;
