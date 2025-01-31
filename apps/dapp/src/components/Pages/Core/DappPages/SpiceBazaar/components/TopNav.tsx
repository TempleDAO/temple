import { useNavigate } from 'react-router-dom';
import styled from 'styled-components';
import selector from 'assets/icons/selector.svg?react';

interface TopNavContainerProps {
  height?: string;
  borderButtomGradient?: string;
  borderBottomWidth?: string;
  backgroundColor?: string;
}

interface NavCellProps {
  selected: boolean;
  fontWeight?: number;
  borderVerticalStyle?: string;
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
  showSelector?: boolean;
  height?: string;
  fontWeight?: number;
  borderButtomGradient?: string;
  borderVerticalStyle?: string;
  borderBottomWidth?: string;
  backgroundColor?: string;
};

export const TopNav = (props: TopNavProps) => {
  const {
    menuNavItems,
    onSelectMenuNavItems,
    showSelector,
    height,
    fontWeight,
    borderButtomGradient,
    borderVerticalStyle,
    borderBottomWidth,
    backgroundColor,
  } = props;

  const navigate = useNavigate();

  return (
    <TopNavContainer
      height={height}
      borderButtomGradient={borderButtomGradient}
      borderBottomWidth={borderBottomWidth}
      backgroundColor={backgroundColor}
    >
      {menuNavItems.map((item) => (
        <NavCell
          key={item.label}
          selected={item.selected}
          onClick={() => {
            onSelectMenuNavItems(item);
            navigate(item.path);
          }}
          fontWeight={fontWeight}
          borderVerticalStyle={borderVerticalStyle}
        >
          {item.label}
          {item.selected && showSelector && (
            <SelectorWrapper selected={item.selected}>
              <Selector />
            </SelectorWrapper>
          )}
        </NavCell>
      ))}
    </TopNavContainer>
  );
};

const TopNavContainer = styled.div<TopNavContainerProps>`
  display: flex;
  flex-direction: row;
  height: ${({ height }) => height || '78px'};
  align-items: left;
  border-bottom: ${({ borderBottomWidth }) => borderBottomWidth || '1px'} solid;
  border-image-source: ${({ borderButtomGradient }) =>
    borderButtomGradient ||
    'linear-gradient(90deg, #58321A 20%, #95613F 84.5%)'};
  border-image-slice: 1;
  padding: 0px 90px;
  margin-top: -40px;
  margin-left: -120px;
  margin-right: -120px;
  background: ${({ backgroundColor, theme }) =>
    backgroundColor || `${theme.palette.black}4C`};
`;

const NavCell = styled.div<NavCellProps>`
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 10px 20px;
  min-width: 200px;
  border-right: ${({ borderVerticalStyle }) =>
    borderVerticalStyle ? `${borderVerticalStyle} solid` : '1px solid'};
  border-image-source: ${({ borderVerticalStyle }) =>
    borderVerticalStyle
      ? 'linear-gradient(180deg, #643C22 0%, #95613F 52.5%, #58321A 99.5%)'
      : 'linear-gradient(180deg, #643C22 0%, #95613F 52.5%, #58321A 99.5%)'};
  border-image-slice: 1;
  &:first-child {
    border-left: ${({ borderVerticalStyle }) =>
      borderVerticalStyle ? `${borderVerticalStyle} solid` : '1px solid'};
    border-image-source: ${({ borderVerticalStyle }) =>
      borderVerticalStyle
        ? 'linear-gradient(180deg, #643C22 0%, #95613F 52.5%, #58321A 99.5%)'
        : 'linear-gradient(180deg, #643C22 0%, #95613F 52.5%, #58321A 99.5%)'};
  }
  font-size: 16px;
  line-height: 20px;
  font-weight: ${({ fontWeight }) => fontWeight || 700};
  height: 100%;
  cursor: pointer;
  color: ${({ selected, theme }) =>
    selected ? theme.palette.brandLight : theme.palette.brand};
  position: relative;
  z-index: 2;
`;

const SelectorWrapper = styled.div<{ selected: boolean }>`
  position: absolute;
  bottom: -55%;
  left: 45%; // make something to be sure it,s in the middle
  width: 100%;
  z-index: 3;
  pointer-events: none;
`;

const Selector = styled(selector)`
  // width: 19px;
  // height: 24px;
`;
