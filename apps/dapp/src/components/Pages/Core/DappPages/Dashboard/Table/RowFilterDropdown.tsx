import { Dispatch, SetStateAction, useEffect, useRef, useState } from 'react';
import styled from 'styled-components';
import { FilterButton } from 'components/Pages/Ascend/components/Trade/styles';
import { RowFilter } from '../hooks/use-dashboardv2-txHistory';
import { TableHeaders } from './TxnHistoryTable';
import { RadioCheckbox } from 'components/Checkbox/RadioCheckbox';

export type DropdownCheckOption = {
  label: string;
  checked: boolean;
};
export type DropdownCheckOptions = Array<DropdownCheckOption>;

export type updateRowDropdownCheckbox = (clickedHeader: TableHeaders, newOption: DropdownCheckOption) => void;
type Props = {
  name: TableHeaders;
  dropdownOptions: DropdownCheckOptions;
  setRowFilter: Dispatch<SetStateAction<RowFilter>>;
  updateRowDropdownCheckbox: updateRowDropdownCheckbox;
};

export const RowFilterDropdown = (props: Props) => {
  const { name, dropdownOptions, setRowFilter, updateRowDropdownCheckbox } = props;
  const [dropdownOpened, setDropdownOpened] = useState(false);

  const ref = useOutsideClick(() => {
    setDropdownOpened(false);
  });

  return (
    <>
      <FilterButton onClick={() => setDropdownOpened(!dropdownOpened)} />
      {dropdownOpened && (
        <DropdownOptionsContainer ref={ref}>
          {dropdownOptions.map((op, idx) => (
            <DropdownOption key={idx} isChecked={op.checked}>
              <RadioCheckbox 
                id={op.label}
                defaultChecked={op.checked}
                onClick={(e) => {
                  const target = e.target as HTMLInputElement;
                  switch (name) {
                    case TableHeaders.Type:
                      setRowFilter((s) => ({ ...s, type: target.checked ? op.label : undefined }));
                      break;
                    case TableHeaders.Strategy:
                      setRowFilter((s) => ({ ...s, strategy: target.checked ? op.label : undefined }));
                      break;
                    case TableHeaders.Token:
                      setRowFilter((s) => ({ ...s, token: target.checked ? op.label : undefined }));
                      break;
                  }
                  updateRowDropdownCheckbox(name, { label: op.label, checked: target.checked });
                  setDropdownOpened(!dropdownOpened);
                }}
              />
              <OptionLabel htmlFor={op.label}>{op.label}</OptionLabel>
            </DropdownOption>
          ))}
        </DropdownOptionsContainer>
      )}
    </>
  );
};

function useOutsideClick(callback: () => void) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClick = (ev: MouseEvent) => {
      const target = ev.target as HTMLDivElement;
      if (ref.current && !ref.current.contains(target)) {
        callback();
      }
    };
    document.addEventListener('click', handleClick, true);

    return () => {
      document.removeEventListener('click', handleClick, true);
    };
  }, [ref, callback]);

  return ref;
}

const OptionLabel = styled.label`
  vertical-align: super;
  cursor: pointer;
`;

const DropdownOptionsContainer = styled.div`
  position: absolute;
  display: flex;
  flex-direction: column;
  min-width: 5rem;
  margin-top: 1.7rem;
  background-color: ${(props) => props.theme.palette.dark};
  border-radius: 2px;
  border: 1.5px solid;
  border-color: ${({ theme }) => theme.palette.brand};
`;

const DropdownOption = styled.div<{ isChecked: boolean }>`
  display: flex;
  flex-direction: row;
  padding: 5px 10px;
  ${({ isChecked, theme }) => {
    if (!isChecked) return `background-color: ${theme.palette.dark}`;

    return `
    background: var(
      --gradient-light-horizontal,
      ${theme.palette.gradients.grey}
    );`;
  }}
`;
