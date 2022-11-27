import styled from 'styled-components';

export interface QuestHeaderProps {
  id: string;
  title: string;
  isOpen: boolean;
}

const QuestCell = ({ id, title }: QuestHeaderProps) => {
  return (
    <CellContainer>
      <CellRow>
        <RowText align={'left'} bold={true}>
          {title}
        </RowText>
        <RowText align={'right'} bold={true}>
          {`Quest #${id}`}
        </RowText>
      </CellRow>
    </CellContainer>
  );
};

const CellRow = styled.div`
  padding: 10px;
  display: flex;
  justify-content: space-between;
`;

const RowText = styled.span<{ align?: string; bold?: boolean }>`
  font-weight: ${(props) => (props.bold ? 'bold' : 'normal')};
  text-align: ${(props) => (props.align === 'right' ? 'right' : 'left')};
  flex: 1;
`;

const CellContainer = styled.div<{ color?: string }>`
  transition: transform 100ms ease-in-out;
  flex-direction: column;
  align-items: center;
  border: 0.0625rem solid ${(props) => props.color ?? props.theme.palette.brand};
  border-radius: 16px;
  padding: 1rem;
  color: #000;
  margin: 15px 0 15px 0;
  background-color: ${(props) => props.color ?? props.theme.palette.brand75};
`;

export default QuestCell;
