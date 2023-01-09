import React, { memo } from 'react';
import styled from 'styled-components';

interface ListItemProps {
  SummaryComponent: React.ElementType;
  DetailComponent: React.ElementType;
  id: string | number;
  isOpen: boolean;
}
const QuestAccordionItem = ({ id, isOpen, SummaryComponent, DetailComponent, ...rest }: ListItemProps) => {
  return (
    <AccItem
      role="button"
      tabIndex={0}
      aria-expanded={isOpen}
      aria-controls={`acc-content-${id}`}
      id={id.toString()}
      key={id.toString()}
    >
      {' '}
      {isOpen ? (
        <DetailContainer role="definition" id={`acc-content-${id}`}>
          <DetailComponent id={id} {...rest} isOpen={isOpen} />
        </DetailContainer>
      ) : (
        <SummaryComponent id={id} {...rest} isOpen={isOpen} />
      )}
    </AccItem>
  );
};

const DetailContainer = styled.div`
  max-height: 0;
  opacity: 0;
  overflow: hidden;
`;

const AccItem = styled.li`
  list-style: none;
  padding-left: 0;

  > div:first-of-type > * {
    pointer-events: none;
  }

  > div:first-of-type {
    cursor: pointer;
  }
`;

export default memo(QuestAccordionItem);
