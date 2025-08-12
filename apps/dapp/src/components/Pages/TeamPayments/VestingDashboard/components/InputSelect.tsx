import React, { useState } from 'react';
import styled from 'styled-components';
import DropdownArrow from 'assets/icons/dropdown-arrow.svg?react';
import { theme } from 'styles/theme';

const months = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

const years = Array.from({ length: 11 }, (_, i) => 2020 + i);

export const AllDatesDropdown = () => {
  const [open, setOpen] = useState(false);

  return (
    <Wrapper>
      {!open && (
        <Trigger onClick={() => setOpen(true)}>
          <span>All dates</span>
          <Arrow open={false} />
        </Trigger>
      )}

      {open && (
        <FloatingPanel>
          <DropdownHeader onClick={() => setOpen(false)}>
            <span>All dates</span>
            <Arrow open={true} />
          </DropdownHeader>
          <DropdownContent>
            <FromTo>
              <FromToLabel>From</FromToLabel>
              <MonthYearRow>
                <SelectDropdown>
                  <select>
                    {months.map((month) => (
                      <option key={month} value={month}>
                        {month}
                      </option>
                    ))}
                  </select>
                </SelectDropdown>
                <SelectDropdown>
                  <select>
                    {years.map((year) => (
                      <option key={year} value={year}>
                        {year}
                      </option>
                    ))}
                  </select>
                </SelectDropdown>
              </MonthYearRow>
              <DateInput type="text" placeholder="11/09/2024" />
            </FromTo>
            <FromTo>
              <FromToLabel>To</FromToLabel>
              <MonthYearRow>
                <SelectDropdown>
                  <select>
                    {months.map((month) => (
                      <option key={month} value={month}>
                        {month}
                      </option>
                    ))}
                  </select>
                </SelectDropdown>
                <SelectDropdown>
                  <select>
                    {years.map((year) => (
                      <option key={year} value={year}>
                        {year}
                      </option>
                    ))}
                  </select>
                </SelectDropdown>
              </MonthYearRow>
              <DateInput type="text" placeholder="dd/mm/yyyy" />
            </FromTo>
          </DropdownContent>
        </FloatingPanel>
      )}
    </Wrapper>
  );
};

const Wrapper = styled.div`
  position: relative;
  width: 320px;
  z-index: 10;
  min-height: 34px;
`;

const FloatingPanel = styled.div`
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  background-color: ${theme.palette.black};
  border: 1px solid ${theme.palette.brand};
  border-radius: 5px;
  color: ${theme.palette.brandLight};
  z-index: 100;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4);
`;

const DropdownHeaderBase = styled.div`
  box-sizing: border-box;
  background-color: ${theme.palette.black};
  color: ${theme.palette.brandLight};
  padding: 5px 10px;
  border-radius: 5px;
  height: 34px;
  font-size: 16px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  cursor: pointer;
`;

const Trigger = styled(DropdownHeaderBase)`
  border: 1px solid ${theme.palette.brand};

  &:hover {
    border-color: ${theme.palette.brandLight};
  }
`;

const DropdownHeader = styled(DropdownHeaderBase)`
  height: 32px;
`;

const DropdownContent = styled.div`
  display: flex;
  padding: 10px;
  flex-direction: column;
  gap: 10px;
`;

const FromTo = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
`;

const FromToLabel = styled.div`
  color: ${theme.palette.brandLight};
  font-size: 16px;
  font-size: 16px;
  line-height: 100%;
  letter-spacing: -2%;
`;

const MonthYearRow = styled.div`
  display: flex;
  flex-direction: row;
  justify-content: space-between;
`;

const SelectDropdown = styled.div`
  display: flex;

  select {
    background-color: ${theme.palette.black};
    color: ${theme.palette.brand};
    font-family: 'Caviar Dreams';
    font-weight: 700;
    font-size: 16px;
    letter-spacing: 5%;
    border: 1px solid ${theme.palette.black};
  }
`;

const DateInput = styled.input`
  width: 100%;
  background-color: ${theme.palette.black};
  color: ${theme.palette.brand};
  border: 1px solid ${theme.palette.brand};
  padding: 8px 10px;
  border-radius: 5px;
  font-family: Caviar Dreams;
  font-weight: 700;
  font-size: 12px;
  line-height: 150%;
  letter-spacing: 5%;

  &::placeholder {
    color: ${theme.palette.brand};
  }
`;

const Arrow = styled(DropdownArrow)<{ open: boolean }>`
  transition: transform 200ms ease, color 200ms ease;
  transform: ${({ open }) => (open ? 'rotate(180deg)' : 'rotate(0deg)')};
  color: ${({ open }) =>
    open ? theme.palette.brandLight : theme.palette.brand};
`;
