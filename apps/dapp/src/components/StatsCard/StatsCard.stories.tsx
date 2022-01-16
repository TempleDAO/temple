import { ComponentMeta, ComponentStory } from '@storybook/react';
import React from 'react';
import { theme } from 'styles/theme';

import StatsCard from './StatsCard';

export default {
  title: 'Components/StatsCard',
  component: StatsCard,
} as ComponentMeta<typeof StatsCard>;

const Template: ComponentStory<typeof StatsCard> = (args) => (
  <StatsCard {...args} />
);

export const Primary = Template.bind({});
Primary.args = {
  label: 'Market Cap',
  stat: '$999M',
  statDelta: -0.03,
  backgroundColor: theme.palette.brand75,
  backgroundImageUrl: '/images/sunset.svg',
  description: <span>TEST DESCRIPTION</span>,
};
