import React from 'react';
import styled from 'styled-components';
import Search from 'assets/icons/search.svg?react';

interface SearchInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
}

export const SearchInput: React.FC<SearchInputProps> = ({
  value,
  onChange,
  placeholder = 'Search wallet address',
  disabled = false,
}) => {
  return (
    <SearchInputWrapper disabled={disabled}>
      <SearchIcon />
      <StyledInput
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        disabled={disabled}
      />
    </SearchInputWrapper>
  );
};

const SearchInputWrapper = styled.div<{ disabled?: boolean }>`
  display: flex;
  align-items: center;
  background-color: ${({ theme }) => theme.palette.dark};
  border: 1px solid ${({ theme }) => theme.palette.brand};
  border-radius: 5px;
  padding: 5px 10px;
  gap: 10px;
  width: 220px;
  box-sizing: border-box;

  ${({ disabled, theme }) =>
    disabled &&
    `
    background-color: ${theme.palette.brand25};
    cursor: not-allowed;
  `}
`;

const SearchIcon = styled(Search)`
  widht: 18px;
  height: 18px;
`;

const StyledInput = styled.input`
  ${({ theme }) => theme.typography.fonts.fontHeading};
  color: ${({ theme }) => theme.palette.brand};
  background-color: transparent;
  border: none;
  outline: none;
  width: 100%;
  font-family: Caviar Dreams;
  font-weight: 400;
  font-size: 16px;
  line-height: 120%;
  letter-spacing: 5%;

  &::placeholder {
    color: ${({ theme }) => theme.palette.brand};
    opacity: 0.8;
  }

  &:disabled {
    cursor: not-allowed;
    opacity: 0.6;
  }
`;
