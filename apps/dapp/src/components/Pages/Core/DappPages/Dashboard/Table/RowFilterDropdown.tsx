import { Dispatch, SetStateAction, useState } from 'react';
import styled from 'styled-components';
import { FilterButton } from 'components/Pages/Ascend/components/Trade/styles';
import checkmark from 'assets/images/newui-images/check.svg';
import { RowFilter } from '../hooks/use-dashboardv2-txHistory';
import { TableHeaders } from './TxnHistoryTable';

export type DropdownCheckOption = {
  label: string;
  checked: boolean;
};
export type DropdownCheckOptions = Array<DropdownCheckOption>;
export type RowFilterDropdownProps = {
  setRowFilter: Dispatch<SetStateAction<RowFilter>>;
  dropdownOptions: DropdownCheckOptions;
};

export type updateRowDropdownCheckbox = (newOption: DropdownCheckOption) => void;
type Props = {
  name: TableHeaders;
  rowFilter: RowFilterDropdownProps;
  updateRowDropdownCheckbox: updateRowDropdownCheckbox;
};

export const RowFilterDropdown = (props: Props) => {
  const { rowFilter, name, updateRowDropdownCheckbox } = props;
  const [dropdownOpened, setDropdownOpened] = useState(false);
  return (
    <>
      <FilterButton onClick={() => setDropdownOpened(!dropdownOpened)} />
      {dropdownOpened && (
        <DropdownOptionsContainer>
          {rowFilter.dropdownOptions.map((op, idx) => (
            <DropdownOption key={idx} isChecked={op.checked}>
              <Checkbox
                key={idx}
                defaultChecked={op.checked}
                onChange={(e) => {
                  switch (name) {
                    case TableHeaders.Type:
                      rowFilter.setRowFilter((s) => ({ ...s, type: e.target.checked ? op.label : undefined }));
                      break;
                    case TableHeaders.Strategy:
                      rowFilter.setRowFilter((s) => ({ ...s, strategy: e.target.checked ? op.label : undefined }));
                      break;
                    case TableHeaders.Token:
                      rowFilter.setRowFilter((s) => ({ ...s, token: e.target.checked ? op.label : undefined }));
                      break;
                  }
                  updateRowDropdownCheckbox({ label: op.label, checked: e.target.checked });
                  setDropdownOpened(!dropdownOpened);
                }}
              />
              <OptionLabel>{op.label}</OptionLabel>
            </DropdownOption>
          ))}
        </DropdownOptionsContainer>
      )}
    </>
  );
};

const OptionLabel = styled.label`
  vertical-align: super;
`;

const DropdownOptionsContainer = styled.div`
  position: absolute;
  display: flex;
  flex-direction: column;
  min-width: 5rem;
  margin-top: 2rem;
  background-color: ${(props) => props.theme.palette.dark};
  border-radius: 5px 5px 0px 0px;
  border: 1px solid;
  border-color: ${({theme}) => theme.palette.brand}
`;

const DropdownOption = styled.div<{ isChecked: boolean }>`
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

const Checkbox = styled.input.attrs({ type: 'checkbox' })`
  /* removing default appearance */
  -webkit-appearance: none;
  appearance: none;
  /* creating a custom design */
  width: 1.6em;
  height: 1.6em;
  border-radius: 0.15em;
  margin-right: 0.5em;
  border: ${({ theme }) => `0.15em solid ${theme.palette.brand}`};
  outline: none;
  cursor: pointer;
  &:checked {
    background-color: ${({ theme }) => `${theme.palette.brand}`};
    position: relative;
  }
  &:checked::before {
    content: ${`url('${checkmark}')`};
    font-size: 1.5em;
    color: ${({ theme }) => `${theme.palette.black}`};
    position: absolute;
    right: 1px;
    top: -5px;
  }
`;
