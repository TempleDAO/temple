import { ComponentMeta, ComponentStory } from '@storybook/react';
import { ExampleTable } from 'components/Table/Table.stories';
import { Claim } from './Claim';
import { Stake } from './Stake';
import React from 'react';

import VaultContent from './VaultContent';

export default {
  title: 'Components/VaultContent',
  component: VaultContent,
  parameters: {
    layout: 'centered',
  },
} as ComponentMeta<typeof VaultContent>;

const Template: ComponentStory<typeof VaultContent> = (args) => (
  <VaultContent {...args} />
);

export const StakeContent = Template.bind({});
export const ClaimContent = Template.bind({});
export const TimingContent = Template.bind({});

ClaimContent.args = {
  children: <Claim />,
};

StakeContent.args = {
  children: <Stake />,
};
