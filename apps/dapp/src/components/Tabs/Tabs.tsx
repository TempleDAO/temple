import React, { ReactNode, useState } from 'react';
import styled, { css } from 'styled-components';
import { Button, ButtonLabel } from 'components/Button/Button';
import { noop } from 'utils/helpers';

export interface Tab {
  // the label to use on the Tab
  label: string;
  // the content for the Tab
  content: ReactNode;
  // will disable the tab content and show a message
  disabledMessage?: string;
}

interface TabsProps {
  /**
   * The tabs labels and contents of each tab
   */
  tabs: Array<Tab>;

  /**
   * Callback to get the current tab
   */
  onChange?(tab: string): void;
}

export const Tabs = ({ tabs, onChange = noop }: TabsProps) => {
  const [activeTab, setActiveTab] = useState<string>(tabs[0].label);

  const getTabsContents = () => {
    const activeTabData: Tab | undefined = tabs.filter(
      (tab) => tab.label === activeTab
    )[0];
    if (activeTabData?.disabledMessage) {
      return (
        <>
          <TabDisabledMessage>
            {activeTabData.disabledMessage}
          </TabDisabledMessage>
        </>
      );
    }
    return activeTabData?.content || null;
  };

  const handleTabUpdate = (tab: string) => {
    setActiveTab(tab);
    if (onChange) {
      onChange(tab);
    }
  };

  return (
    <TabsStyled>
      <TabsWrapper>
        {tabs.map((tab) => (
          <TabStyled
            label={tab.label}
            onClick={() => handleTabUpdate(tab.label)}
            isActive={tab.label === activeTab}
            key={tab.label}
            isUppercase
          />
        ))}
      </TabsWrapper>
      <TabsContent>{getTabsContents()}</TabsContent>
    </TabsStyled>
  );
};

const TabsStyled = styled.div`
  flex: 1;
  display: flex;
  flex-direction: column;
  background-color: ${(props) => props.theme.palette.dark};
`;

const TabsWrapper = styled.div`
  display: flex;
  align-items: center;
`;

interface TabStyledProps {
  isActive?: boolean;
}

const TabStyled = styled(Button)<TabStyledProps>`
  flex: 1;
  text-transform: none;
  height: 3.25rem /* 52/16 */;
  ${(props) =>
    props.isActive &&
    css`
      background-color: ${(props) => props.theme.palette.brand};
      color: ${(props) => props.theme.palette.light};
    `};
  transition: ${(props) => props.theme.transitions.color},
    ${(props) => props.theme.transitions.backgroundColor};
  margin: 0;

  :hover {
    ${(props) =>
      !props.isActive &&
      css`
        background-color: ${(props) => props.theme.palette.brand25};
      `};
  }

  ${ButtonLabel} {
    font-family: ${(props) => props.theme.typography.fonts.fontHeading};
    font-size: 18px;
  }
`;

const TabsContent = styled.div`
  position: relative;
  border: 0.0625rem /* 1/16 */ solid ${(props) => props.theme.palette.brand};
  border-top: none;
  height: 100%;
  min-height: 31.25rem /* 500/16 */;
  padding: 2rem;
  color: ${(props) => props.theme.palette.light};
  box-shadow: ${(props) => props.theme.shadows.base};

  ${ButtonLabel} {
    text-transform: uppercase;
  }
`;

const TabDisabledMessage = styled.h4`
  position: absolute;
  z-index: ${(props) => props.theme.zIndexes.up};
  top: 0;
  right: 0;
  left: 0;
  bottom: 0;
  padding: 2rem;
  text-align: center;
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: ${(props) => props.theme.palette.dark};
  pointer-events: none;
`;
