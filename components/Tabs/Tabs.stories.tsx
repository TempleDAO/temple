import { ComponentMeta, ComponentStory } from '@storybook/react';
import React from 'react';

import { Tabs } from './Tabs';

export default {
  title: 'Components/Tabs',
  component: Tabs,
} as ComponentMeta<typeof Tabs>;

const Template: ComponentStory<typeof Tabs> = (args) => <Tabs {...args} />;

export const Primary = Template.bind({});
Primary.args = {
  tabs: [
    {
      label: 'label 1',
      content: <pre>label 1</pre>,
      disabledMessage: 'Disable message',
    },
    {
      label: 'label 2',
      content: <pre>label 2</pre>
    },
    {
      label: 'label 3',
      content: <pre>label 3</pre>
    },
  ]
};

