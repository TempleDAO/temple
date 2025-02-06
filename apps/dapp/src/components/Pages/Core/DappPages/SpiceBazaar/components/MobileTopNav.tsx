import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import styled from 'styled-components';
import expandLess from 'assets/icons/mobile_expand_less.svg?react';
import expandMore from 'assets/icons/mobile_expand_more.svg?react';

interface NavCellProps {
  selected: boolean;
}

export type MenuNavItem = {
  label: string;
  path: string;
  selected: boolean;
  options?: { label: string; path: string }[];
};

type TopNavProps = {
  menuNavItems: MenuNavItem[];
  onSelectMenuNavItems: (mi: MenuNavItem) => void;
};

export const MobileTopNav = (props: TopNavProps) => {
  const { menuNavItems, onSelectMenuNavItems } = props;
  const navigate = useNavigate();
  const location = useLocation();

  const [openDropdownIndex, setOpenDropdownIndex] = useState<number | null>(
    null
  );

  const handleNavClick = (index: number, item: MenuNavItem) => {
    if (item.options && item.options.length > 0) {
      // If clicking on an item with options, toggle the dropdown.
      // Close the dropdown if it was already open or open a new one.
      setOpenDropdownIndex(openDropdownIndex === index ? null : index);
    } else {
      onSelectMenuNavItems(item);
      navigate(item.path);
    }
  };

  const handleOptionClick = (option: { label: string; path: string }) => {
    navigate(option.path);
    setOpenDropdownIndex(null);
  };

  return (
    <PageContainer>
      <TopNavContainer>
        {menuNavItems.map((item, index) => (
          <NavCellWrapper key={item.label}>
            <NavCell
              selected={item.selected}
              onClick={() => handleNavClick(index, item)}
            >
              {item.label}
              {item.options && item.options.length > 0 && (
                <StyledIconWrapper>
                  {openDropdownIndex === index ? (
                    <ExpandLessIcon />
                  ) : (
                    <ExpandMoreIcon />
                  )}
                </StyledIconWrapper>
              )}
            </NavCell>
            {item.options && openDropdownIndex === index && (
              <Dropdown>
                {item.options.map((option) => (
                  <DropdownItem
                    key={option.label}
                    onClick={() => handleOptionClick(option)}
                    isSelected={location.pathname === option.path}
                  >
                    {option.label}
                  </DropdownItem>
                ))}
              </Dropdown>
            )}
          </NavCellWrapper>
        ))}
      </TopNavContainer>
    </PageContainer>
  );
};

const PageContainer = styled.div`
  display: flex;
  flex-direction: row;
  align-items: left;
  border-top: 1px solid ${({ theme }) => theme.palette.brand};
  padding: 8px 8px 4px 8px;
  height: 64px;
  margin-top: -25px;
  margin-left: -20px;
  margin-right: -20px;
`;

const TopNavContainer = styled.div`
  display: flex;
  flex-direction: row;
  gap: 10px;
  white-space: nowrap;
`;

const NavCellWrapper = styled.div`
  position: relative;
  min-width: 181px;
`;

const NavCell = styled.div<NavCellProps>`
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 5px;
  padding: 16px 16px;
  min-width: 181px;
  border: 1px solid;
  border-image-source: linear-gradient(
    180deg,
    #643c22 0%,
    #95613f 52.5%,
    #58321a 99.5%
  );
  border-image-slice: 1;
  font-size: 16px;
  line-height: 20px;
  font-weight: 700;
  cursor: pointer;
  color: ${({ selected, theme }) =>
    selected ? theme.palette.brandLight : theme.palette.brand};
`;

const StyledIconWrapper = styled.div`
  display: flex;
  align-items: center;
  gap: 5px;
`;

const ExpandMoreIcon = styled(expandMore)`
  width: 20px;
  height: 20px;
`;

const ExpandLessIcon = styled(expandLess)`
  width: 20px;
  height: 20px;
`;

const Dropdown = styled.div`
  position: absolute;
  top: 100%;
  left: 0;
  right: 0;
  border-radius: 4px;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
  width: 100%;
  max-height: none;
  overflow-y: visible;
  margin-top: 5px;
`;

const DropdownItem = styled.div<{ isSelected: boolean }>`
  padding: 10px 16px;
  font-size: 14px;
  line-height: 18px;
  font-weight: 700;
  cursor: pointer;
  color: ${({ theme, isSelected }) =>
    isSelected ? theme.palette.brandLight : theme.palette.brand};

  background: ${({ isSelected }) =>
    isSelected
      ? 'linear-gradient(180deg, #353535 45.25%, #101010 81.46%, #0B0A0A 87.55%)'
      : 'linear-gradient(180deg, #5E402C 0%, #0C0B0B 100%)'};
  background-color: ${({ isSelected }) => (isSelected ? '#FFDEC9' : '#BD7B4F')};

  box-shadow: 3px 6px 5.5px 0px #00000080;
`;
