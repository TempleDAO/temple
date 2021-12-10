import { ComponentMeta, ComponentStory } from '@storybook/react';
import React from 'react';

import ProfileMetric from 'components/ProfileMetric/ProfileMetric';

export default {
  title: 'Components/ProfileMetric',
  component: ProfileMetric,
} as ComponentMeta<typeof ProfileMetric>;

const Template: ComponentStory<typeof ProfileMetric> = (args) => (
  <ProfileMetric {...args} />
);

export const Primary = Template.bind({});
Primary.args = {
  label: 'metric',
  value: '100 TEMPLE',
  detail: '$1000',
};
