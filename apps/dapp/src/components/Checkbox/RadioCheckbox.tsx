import styled from 'styled-components';

export const RadioCheckbox = styled.input.attrs({ type: 'checkbox' })`
  /* removing default appearance */
  -webkit-appearance: none;
  appearance: none;
  /* creating a custom design */
  width: 1.15em;
  height: 1.15em;
  margin-right: 0.5em;
  display: grid;
  place-content: center;

  border: ${({ theme }) => `0.15em solid ${theme.palette.brand}`};
  border-radius: 50%;
  cursor: pointer;

  &:checked {
    background-color: ${({ theme }) => `${theme.palette.black}`};
  }

  &:before {
    content: '';
    width: 0.5em;
    height: 0.5em;
    border-radius: 50%;
    transform: scale(0);
    background-color: ${({ theme }) => `${theme.palette.brand}`};
  }

  &:checked::before {
    transform: scale(1);
  }
`;
