import { Button } from 'components/Button/Button';
import { useWindowResize } from 'components/Vault/useWindowResize';
import { RelicItemData } from 'providers/types';
import { FC, useEffect, useRef, useState } from 'react';
import styled from 'styled-components';

const ITEM_IMAGE_BASE_URL = "https://myst.mypinata.cloud/ipfs/QmTmng8Skqv8sqckArgpi6RqQQTHh7LNLzmRyMWyxU24th"
const MAX_IMAGE_ITEM_ID = 2

const ItemGrid: FC<{
  disabled?: boolean
  items: RelicItemData[]
  onClick: (item: number) => Promise<void>
}> = (props) => {
  const { items } = props;
  const containerRef = useRef<HTMLDivElement>(null)
  const windowWidth = useWindowResize()
  const [componentWidth, setComponentWidth] = useState(100)
  useEffect(() => {
    setComponentWidth(containerRef.current?.offsetWidth ?? 100)
  }, [windowWidth])
  // slightly scale with item width
  const itemWidthTarget = Math.max(0, Math.min(300, componentWidth - 200)) / 10 + 60
  const columnCount = Math.floor(componentWidth / itemWidthTarget)
  const rowCount = Math.max(1, Math.ceil(items.length / columnCount));
  const itemIndexes = [...Array(rowCount * columnCount).keys()];

  return (
    <ItemsContainer ref={containerRef}>
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
  return <ItemCell style={{
    backgroundImage: `url(${imgUrl})`,
    opacity: processing ? .3 : 1,
  }}
  >
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
    
    {item.count > 1 && <ItemCountBadge disabled={props.disabled} >{item.count}</ItemCountBadge>}
  </ItemCell>
}

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

const ItemCell = styled.div`
  border: solid 2px ${props => props.theme.palette.brand};
  border-radius: 15%;
  background-color: #333;
  background-size: cover;
  background-position: center;

  > * {
    width: 100%;
    height: 100%;
    position: relative;
    border-radius: 15%;
  }
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

export default ItemGrid;