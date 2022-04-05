import React from 'react';
import { ComponentStory, ComponentMeta } from '@storybook/react';

import RegisterToken from 'components/RegisterToken/RegisterToken';
import { TEMPLE_TOKEN } from 'constants/tokens';

export default {
  title: 'Components/RegisterToken',
  component: RegisterToken,
  parameters: {
    layout: 'centered',
  },
} as ComponentMeta<typeof RegisterToken>;

const Template: ComponentStory<typeof RegisterToken> = (args) => (
  <RegisterToken {...args}>
    <small style={{ marginLeft: '1rem' }}>
      Register Token
    </small>
  </RegisterToken>
);

export const Default = Template.bind({});

Default.args = {
  token: TEMPLE_TOKEN
};
