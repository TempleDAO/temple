import React, { memo } from 'react';

interface ListItemProps {
  SummaryComponent: React.ElementType;
  DetailComponent: React.ElementType;
  id: string | number;
  isOpen: boolean;
}
const ListItem = ({ id, isOpen, SummaryComponent, DetailComponent, ...rest }: ListItemProps) => {
  console.log('open?');
  console.log(id);
  console.log(!!isOpen);
  return (
    <li
      role="button"
      tabIndex={0}
      aria-expanded={isOpen}
      aria-controls={`acc-content-${id}`}
      id={id.toString()}
      key={id.toString()}
      className="acc-item"
    >
      {' '}
      {isOpen ? (
        <div role="definition" className="acc-content" id={`acc-content-${id}`}>
          <DetailComponent id={id} {...rest} isOpen={isOpen} />
        </div>
      ) : (
        <SummaryComponent id={id} {...rest} isOpen={isOpen} />
      )}
    </li>
  );
};

export default memo(ListItem);
