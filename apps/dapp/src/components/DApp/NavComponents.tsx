import React, { FC, useCallback } from 'react';
import styled from 'styled-components';
import { Link } from 'react-router-dom';
import Image from 'components/Image/Image';
import MenuSvg from 'assets/icons/menu.svg';
import CloseSvg from 'assets/images/cross.svg';

export const NavGroup: FC = ({ children }) => {
  return <UL>{children}</UL>;
};

interface ItemProps {
  isActive?: boolean;
  label: string;
  close?: () => void;
}

interface TextProps {
  isActive: boolean;
}

interface ListItemProps {
  isActive?: boolean;
}

export const NavItem: FC<ItemProps> = ({ close, label, isActive = false }) => {
  const handler = useCallback(() => {
    close && close();
  }, [close]);

  return (
    <ListItem isActive={isActive}>
      <Link to={label.toLocaleLowerCase()}>
        <Text tabIndex={0} isActive={isActive} onClick={handler}>
          {label}
        </Text>
      </Link>
    </ListItem>
  );
};

const UL = styled.ul`
  margin-top: 0px;
`;

const Text = styled.a<TextProps>`
  color: ${({ isActive }) => (isActive ? '#fff' : '#b6b6b6')};
  text-decoration: ${({ isActive }) => (isActive ? 'underline' : 'none')};
  cursor: pointer;
`;

const ListItem = styled.li<ListItemProps>`
  // padding-left: 1em;
  // text-indent: -1em;
  list-style: none;
  position: relative;
  padding: 8px;

  color: #fff;

  :after {
    position: absolute;
    top: 11px;
    left: -24px;
    content: '';
    counter-increment: steps;
    border: 1px solid #bd7b4f;
    border-radius: 50%;
    display: inline-block;
    height: 15px;
    width: 15px;
    text-align: center;
    line-height: 38px;

    background: ${({ isActive, theme }) =>
      isActive ? theme.palette.brand : '#000'};
  }

  :before {
    position: absolute;
    left: -17px;
    top: 19px;
    content: '';
    height: 37px;
    width: 0px;
    border-left: 2px solid #bd7b4f;
  }

  :last-of-type:before {
    border: none;
  }
`;

export const MenuImage = styled(Image).attrs(() => ({
  src: MenuSvg,
}))`
  position: absolute;
  top: 10px;
  left: 20px;
  width: 40px;
  cursor: pointer;
  filter: brightness(90%);

  :hover {
    filter: brightness(110%);
  }
`;

export const CloseImage = styled(Image).attrs(() => ({
  src: CloseSvg,
}))`
  position: absolute;
  top: 10px;
  right: 20px;
  width: 30px;
  cursor: pointer;
  filter: brightness(90%);

  :hover {
    filter: brightness(110%);
  }
`;

export const MobileContainer = styled.div`
  display: flex;
  flex-direction: column;
  width: 100%;
  text-align: center;
`;
export const MenuBar = styled.div`
  height: 60px;
  border-bottom: 1px solid #bd7b4f;
  h4 {
    margin: 0px;
    padding-top: 7px;
  }
`;

export const Container = styled.div`
  display: flex;
  justifiy-content: center;
  border: 1px solid #bd7b4f;
  box-sizing: border-box;
  min-height: 378px;
  display: flex;
  flex-wrap: nowrap;
  flex-grow: 1;
  background-color: ${(props) => props.theme.palette.dark};
`;

export const Main = styled.div`
  display: flex;
  justify-content: center;
  flex-grow: 2;
  padding-top: 30px;
  padding-bottom: 20px;
`;
