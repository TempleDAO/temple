import React from 'react';
import styled from 'styled-components';

type DropdownOptions = {
  selected: string;
  options: string[];
};

const StyledDropdown = styled.select`
  height: 3rem;
  width: 7.375rem /* 118/16 */;
  padding: 0.5rem 0.9375rem /* 8/16 15/16 */;

  border: 1px solid ${({ theme }) => theme.palette.brand};
  border-radius: 1.5rem /* 20/16 */;
  box-sizing: border-box;

  color: #ffdec9;
  font-size: 1.5rem /* 24/16 */;
  background-color: black;

  /* for Firefox */
  -moz-appearance: none;
  /* for Chrome */
  -webkit-appearance: none;

  /* For IE10 */
  select::-ms-expand {
    display: none;
  }

  outline: none;

  option {
    background-color: red;
  }
`;

export const Dropdown = ({ selected, options }: DropdownOptions) => {
  return (
    <StyledDropdown name={selected}>
      {options.map((option) => (
        <option key={option}>{option}</option>
      ))}
    </StyledDropdown>
  );
};
