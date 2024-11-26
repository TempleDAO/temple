import { useNavigate } from 'react-router-dom';
import styled from 'styled-components';

interface NavCellProps {
  selected: boolean;
}

export type MenuNavItem = {
  label: string;
  path: string;
  selected: boolean;
};

type TopNavProps = {
  menuNavItems: {
    label: string;
    path: string;
    selected: boolean;
  }[];
  onSelectMenuNavItems: (mi: MenuNavItem) => void;
};

export const MobileTopNav = (props: TopNavProps) => {
  const { menuNavItems, onSelectMenuNavItems } = props;

  const navigate = useNavigate();

  return (
    <TopNavContainer>
      {menuNavItems.map((item) => (
        <NavCell
          key={item.label}
          selected={item.selected}
          onClick={() => {
            onSelectMenuNavItems(item);
            navigate(item.path);
          }}
        >
          {item.label}
        </NavCell>
      ))}
    </TopNavContainer>
  );
};

const TopNavContainer = styled.div`
  display: flex;
  flex-direction: row;
  height: 64px;
  align-items: left;
  border-top: 1px solid ${({ theme }) => theme.palette.brand};
  padding: 8px 8px 4px 8px;
  gap: 10px;
  margin-top: -25px;
  margin-left: -20px;
  margin-right: -20px;

  /* Enable horizontal scrolling */
  overflow-x: auto;
  white-space: nowrap;

  &::-webkit-scrollbar {
    display: none;
  }
`;

const NavCell = styled.div<NavCellProps>`
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px 12px;
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
