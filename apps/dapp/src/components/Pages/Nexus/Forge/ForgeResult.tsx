import { RelicItemData } from 'providers/types';
import { EmptyCell, ItemButton } from '../Relic/ItemGrid';
import styled from 'styled-components';

const ForgeResult = (props: { forgeResult: RelicItemData | null; onClickHandler: (item: number) => Promise<void> }) => {
  const { forgeResult, onClickHandler } = props;
  return (
    <ForgeResultWrapper>
      {forgeResult === null ? (
        <EmptyCell />
      ) : (
        <ItemButton key={forgeResult.id} item={forgeResult} disabled={false} onClick={onClickHandler} />
      )}
    </ForgeResultWrapper>
  );
};

export default ForgeResult;

export const ForgeResultWrapper = styled.div`
  position: relative;
  margin: auto;
  width: 15%;
  padding-top: 15%;
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
