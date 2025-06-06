import { useState, useRef, useEffect } from 'react';
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
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0 });
  const navCellRefs = useRef<(HTMLDivElement | null)[]>([]);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        openDropdownIndex !== null &&
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node) &&
        !navCellRefs.current[openDropdownIndex]?.contains(event.target as Node)
      ) {
        setOpenDropdownIndex(null);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [openDropdownIndex]);

  const handleNavClick = (index: number, item: MenuNavItem) => {
    if (item.options && item.options.length > 0) {
      const navCell = navCellRefs.current[index];
      if (navCell) {
        const rect = navCell.getBoundingClientRect();
        setDropdownPosition({
          top: rect.bottom + window.scrollY,
          left: rect.left + window.scrollX,
        });
      }
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
              ref={(el) => {
                navCellRefs.current[index] = el;
              }}
              selected={item.selected}
              onClick={() => handleNavClick(index, item)}
            >
              {item.label}
              {/* {item.options && item.options.length > 0 && (
                <StyledIconWrapper>
                  {openDropdownIndex === index ? (
                    <ExpandLessIcon />
                  ) : (
                    <ExpandMoreIcon />
                  )}
                </StyledIconWrapper>
              )} */}
            </NavCell>
            {item.options && openDropdownIndex === index && (
              <Dropdown
                ref={dropdownRef}
                style={{
                  top: `${dropdownPosition.top}px`,
                  left: `${dropdownPosition.left}px`,
                }}
              >
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
  border-top: 1px solid ${({ theme }) => theme.palette.brand};
  padding: 8px 8px 4px 8px;
  margin-top: -25px;
  margin-left: -20px;
  margin-right: -20px;
  position: relative;
  z-index: 1000;
`;

const TopNavContainer = styled.div`
  display: flex;
  flex-direction: row;
  gap: 10px;
  white-space: nowrap;
  overflow-x: auto;
  overflow-y: visible;
  position: relative;
  -webkit-overflow-scrolling: touch;
  scrollbar-width: none;
  min-width: 100%;
  z-index: 1000;

  &::-webkit-scrollbar {
    display: none;
  }
`;

const NavCellWrapper = styled.div`
  position: relative;
  min-width: 181px;
  z-index: 1000;
  display: flex;
  flex-direction: column;
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
  position: relative;
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
  position: fixed;
  top: auto;
  left: 0;
  right: auto;
  width: 181px;
  z-index: 1001;
  background: linear-gradient(180deg, #353535 45.25%, #101010 87.55%);
  border-radius: 4px;
  box-shadow: 0px 8px 16px rgba(0, 0, 0, 0.4);
  overflow: visible;
  pointer-events: auto;
  transform: translateY(0);
  margin-top: 4px;
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

  &:hover {
    background: linear-gradient(
      180deg,
      #353535 45.25%,
      #101010 81.46%,
      #0b0a0a 87.55%
    );
  }
`;
