import styled from 'styled-components';
import checkmark from 'assets/images/newui-images/check.svg';

export const Checkbox = styled.input.attrs({ type: 'checkbox' })`
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
