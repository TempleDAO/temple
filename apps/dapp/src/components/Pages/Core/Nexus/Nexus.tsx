import { Button } from 'components/Button/Button';
import { useRelic } from 'providers/RelicProvider';
import { ItemInventory } from 'providers/types';
import { useWallet } from 'providers/WalletProvider';
import { FC, useEffect } from 'react';
import { Navigate, Route, Routes, useNavigate, useParams } from 'react-router-dom';
import styled from 'styled-components';
import { NexusContainer } from '../Trade/styles';
import { PageWrapper } from '../utils';

const NexusPage = () => {
  return (
    <PageWrapper>
      <h3>Nexus</h3>
      <NexusContainer>
        <NexusBody/>
      </NexusContainer>
    </PageWrapper>
  )
}

const NexusBody = () => {
  const { wallet, isConnected } = useWallet()
  const { inventory, updateInventory } = useRelic()

  useEffect(() => {
    updateInventory();
  }, [wallet, isConnected])

  if (inventory === null) {
    return <Header>
      <span>Loading...</span>
    </Header>
  } else {
    return <NexusBodyContainer>
      <RelicRoutes inventory={inventory}/>
      <ItemPanel heading="Items"/>
    </NexusBodyContainer> 
  }
}

const RelicRoutes: FC<{ inventory: ItemInventory }> = (props) => {
  const { inventory: { relics } } = props
  return <Routes>
    <Route path="" element={<NoRelicPanel relics={relics}/>}/>
    <Route path="relic/:id" element={<RelicPanel relics={relics}/>}/>
    <Route path="*" element={<Navigate to=""/>}/>
  </Routes>
}

const NoRelicPanel = (props: { relics: ItemInventory['relics'] }) => {
  const { relics } = props
  if (relics.length > 0) {
    return <Navigate to={`../relic/${relics[0].id.toString()}`}/>
  }
  const { mintRelic } = useRelic();
  const navigate = useNavigate();
  return <NexusPanel>
    <Header>
      <span>No Relics</span>
        <div><Button
          label="Mint Relic"
          isSmall={true}
          onClick={async () => {
            const added = await mintRelic()
            if (added) {
              navigate(`relic/${added.id.toString()}`);
            }
          }}
        />
      </div>
    </Header>

    <ItemGrid disabled/>
  </NexusPanel>
}

const RelicPanel = (props: { relics: ItemInventory['relics'] }) => {
  const { renounceRelic } = useRelic();
  const navigate = useNavigate();
  const { id } = useParams();
  const { relics } = props;
  const relicIdx = relics.findIndex(r => r.id.toString() == id);
  const relic = relics[relicIdx]
  if (!relic) {
    return <Navigate to=".."/>
  }
  return <NexusPanel>
    <Header>
      <span>Relic #{relic.id.toString()}</span>
      <div>
        <Button
          label="Renounce Relic"
          isSmall={true}
          onClick={async () => {
            const nextRelicIdx = (relicIdx + 1) % relics.length
            const nextRelicId = relics[nextRelicIdx].id
            await renounceRelic(relic.id)
            navigate(`../relic/${nextRelicId.toString()}`);
          }}
        />
      </div>
    </Header>
    <ItemGrid/>
  </NexusPanel>
}

const ItemPanel: FC<{
  heading: string
}> = (props) => {
  return <NexusPanel>
    <Header>
      <span>{props.heading}</span>
    </Header>
    <ItemGrid/>
  </NexusPanel>
}

const ItemGrid: FC<{
  disabled?: boolean
}> = (props) => {
  const opacity = props.disabled ? .5 : 1;
  return <ItemContainer style={{ opacity }}>
    { [...Array(5).keys()].map((_, idx) => {
      return <ItemWrapper>
        <div style={{
          background: 'darkgray',
          border: 'solid 1px darkgray',
          opacity: .25,
        }}
        />
      </ItemWrapper>
    }) }
  </ItemContainer>
}

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
`

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
`

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
`

export default NexusPage;