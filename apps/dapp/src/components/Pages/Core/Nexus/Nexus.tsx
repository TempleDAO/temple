import { Button } from 'components/Button/Button';
import { BigNumber, BigNumberish } from 'ethers';
import { useRelic } from 'providers/RelicProvider';
import { ItemInventory, RelicItemData } from 'providers/types';
import { useWallet } from 'providers/WalletProvider';
import { FC, useEffect } from 'react';
import { Navigate, Route, Routes, useNavigate, useParams } from 'react-router-dom';
import styled from 'styled-components';
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

const NexusBody = () => {
  const { wallet, isConnected } = useWallet();
  const { inventory, updateInventory } = useRelic();

  useEffect(() => {
    updateInventory();
  }, [wallet, isConnected]);

  if (inventory === null) {
    return (
      <Header>
        <span>Loading...</span>
      </Header>
    );
  } else {
    const allItems: RelicItemData[] = [...Array(50).keys()].map((id) => ({ id, count: 0 }));
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
      <Header>
        <span>No Relics</span>
        <div>
          <Button
            label="Mint Relic"
            isSmall={true}
            onClick={async () => {
              const added = await mintRelic();
              if (added) {
                navigate(`relic/${added.id.toString()}`);
              }
            }}
          />
        </div>
      </Header>

      <ItemGrid items={[]} onClick={asyncNoop} />
    </NexusPanel>
  );
};

const RelicPanel = (props: { relics: ItemInventory['relics'] }) => {
  const { renounceRelic, unequiptRelicItem } = useRelic();
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
      <Header>
        <span>Relic #{relic.id.toString()}</span>
        <div>
          <Button
            label="Renounce Relic"
            isSmall={true}
            onClick={async () => {
              const nextRelicIdx = (relicIdx + 1) % relics.length;
              const nextRelicId = relics[nextRelicIdx].id;
              await renounceRelic(relic.id);
              navigate(`../relic/${nextRelicId.toString()}`);
            }}
          />
        </div>
      </Header>
      <ItemGrid items={relic.items} onClick={async (itemId) => unequiptRelicItem(relic.id, itemId)} />
    </NexusPanel>
  );
};

const MyItemPanel: FC<{
  relicId?: BigNumber;
  items: RelicItemData[];
}> = (props) => {
  const { relicId, items } = props;
  const { equiptRelicItem } = useRelic();

  return (
    <NexusPanel>
      <Header>
        <span>My Items</span>
      </Header>
      <ItemGrid items={items} onClick={async (itemId) => relicId && equiptRelicItem(relicId, itemId)} />
    </NexusPanel>
  );
};

const MintItemPanel: FC<{
  items: RelicItemData[];
}> = (props) => {
  const { mintRelicItem } = useRelic();
  return (
    <NexusPanel>
      <Header>
        <span>Mint Items (test only)</span>
      </Header>
      <ItemGrid items={props.items} onClick={async (item) => mintRelicItem(item)} />
    </NexusPanel>
  );
};

const GRID_COLUMN_COUNT = 5;

const ItemGrid: FC<{
  items: RelicItemData[];
  onClick: (item: number) => Promise<void>;
}> = (props) => {
  const { items } = props;
  const rowCount = Math.max(1, Math.ceil(items.length / GRID_COLUMN_COUNT));
  const itemIndexes = [...Array(rowCount * GRID_COLUMN_COUNT).keys()];
  return (
    <ItemContainer>
      {itemIndexes.map((_, idx) => {
        const item = items[idx];
        return (
          <ItemWrapper key={idx}>
            {item == undefined ? (
              <EmptyCell />
            ) : (
              <ItemCell>
                <Button key={item.id} label={`${item.id}`} onClick={() => props.onClick(item.id)} />
                {item.count > 1 && <ItemCountBadge>{item.count}</ItemCountBadge>}
              </ItemCell>
            )}
          </ItemWrapper>
        );
      })}
    </ItemContainer>
  );
};

const ItemCell = styled.div`
  > * {
    width: 100%;
    height: 100%;
    border-radius: 15%;
    position: relative;
  }
`;

const ItemCountBadge = styled.div`
  position: absolute;
  top: -0.5em;
  right: -0.5em;
  width: 2em;
  height: 2em;
  color: black;
  border-radius: 50%;
  text-align: center;
  line-height: 2em;
  background-color: ${(props) => props.theme.palette.brand};
`;

const EmptyCell = styled.div`
  background: darkgray;
  border: solid 1px darkgray;
  opacity: 0.1;
`;

const NexusBodyContainer = styled.div`
  display: flex;
  flex-flow: column;
  justify-content: center;
  align-items: center;
  width: 100%;
  > * {
    width: 46%;
    margin: 2%;
    padding: 1rem;
    min-width: 25rem;

    border: 2px solid ${(props) => props.theme.palette.brand};
    border-radius: 16px;
  }
`;

const NexusPanel = styled.div`
  > *:not(:first-child) {
    margin-top: 1rem;
  }
`;

const Header = styled.h3`
  margin: 0 0 1rem;
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

const ItemContainer = styled.div`
  display: flex;
  flex-flow: row wrap;
  width: 100%;
`;

const ItemWrapper = styled.div`
  position: relative;
  width: 20%;
  padding-top: 20%;
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
