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

export const MobileTopNavSecondary = (props: TopNavProps) => {
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
  flex-direction: column;
  width: 181px;
  align-items: left;
  margin-top: -40px;
  margin-left: -20px;
  padding-left: 8px;
`;

const NavCell = styled.div<NavCellProps>`
  display: flex;
  align-items: center;
  padding: 10px 16px;
  min-width: 181px;

  color: ${({ selected, theme }) =>
    selected ? theme.palette.brandLight : theme.palette.brand};
  background: ${({ selected }) =>
    selected
      ? 'linear-gradient(180deg, #353535 45.25%, #101010 81.46%, #0B0A0A 87.55%)'
      : 'linear-gradient(180deg, #5E402C 0%, #0C0B0B 100%)'};
  font-size: 14px;
  line-height: 18px;
  font-weight: 700;
  cursor: pointer;
`;
