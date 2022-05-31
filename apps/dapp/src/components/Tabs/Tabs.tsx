import { ReactNode, useState } from 'react';
import styled, { css } from 'styled-components';
import { ButtonLabel } from 'components/Button/Button';
import { noop } from 'utils/helpers';
import { pixelsToRems } from 'styles/mixins';
import { CoreButton } from 'components/Button/CoreButton';

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
    const activeTabData = tabs.find((tab) => tab.label === activeTab);
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
  overflow: auto;
  scrollbar-width: none;
  ::-webkit-scrollbar {
    display: none;
  }
`;

interface TabStyledProps {
  isActive?: boolean;
}

const TabStyled = styled(CoreButton)<TabStyledProps>`
  flex: 1;
  border-radius: 0;
  background: transparent;
  color: ${(props) => props.theme.palette.brand};
  text-transform: none;
  height: 2.25rem;
  max-width: max-content;
  border: ${pixelsToRems(1)}rem solid transparent;
  ${(props) =>
    props.isActive &&
    css`
      background-color: transparent;
      border-bottom: ${pixelsToRems(1)}rem solid
        ${(props) => props.theme.palette.brand};
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
  bottom: ${pixelsToRems(1)}rem;
  border: none;
  border-top: ${pixelsToRems(1)}rem solid
    ${(props) => props.theme.palette.brand50};
  height: 100%;
  padding: 2rem 0;
  color: ${(props) => props.theme.palette.light};

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
