import React from 'react';
import styled, { css } from 'styled-components';
import BaseDropdown, { ReactDropdownProps } from 'react-dropdown';
import dropdownArrow from 'assets/icons/dropdown-arrow.svg';
import 'react-dropdown/style.css';

const COLOR_BACKGROUND = css`linear-gradient(180deg, #222020 38.95%, #211F1F 45.25%, #000000 87.55%);`;
const COLOR_FONT = `#FFDEC9`;

interface StyledDropdownProps extends ReactDropdownProps {
  open?: boolean;
}

const StyledDropdown = styled(BaseDropdown)<StyledDropdownProps>`
    height: 2.8125rem /* 45/16 */;
    width: 7.375rem /* 118/16 */;
    font-size: 1.125rem /* 18/16 */;
    font-weight: bold;

    * {
      cursor: pointer;
      color: ${COLOR_FONT};
    }

    .Dropdown-control{
      display: flex;
      justify-content: space-between;
      align-items: center;

      padding: 0.5rem 0.9375rem /* 8/16 15/16 */;
      background: ${COLOR_BACKGROUND}
      border: 1px solid ${({ theme }) => theme.palette.brand};
      border-radius: 1.25rem /* 20/16 */;
    }

    .Dropdown-menu {
      background: ${COLOR_BACKGROUND}
      border: 1px solid ${({ theme }) => theme.palette.brand};
      border-radius: 1.25rem /* 20/16 */;
    }

    .is-selected:not(.Dropdown-placeholder) {
      color: black;
      background: ${({ theme }) => theme.palette.brand};
    }

    .Dropdown-arrow-wrapper {
      height: 0.5625rem /* 9/16 */;
      width: 0.6875rem /* 11/16 */;
      color: white;
      background: url(${dropdownArrow});
      background-repeat: no-repeat;

      ${({ open }) => open && `transform: rotate(180deg)`};
    }
    
    .Dropdown-arrow {
      display: none;
    }
`;

export const Dropdown = StyledDropdown;
