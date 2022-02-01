import { action } from '@storybook/addon-actions';
import { ComponentMeta, ComponentStory } from '@storybook/react';
import React from 'react';
import { Button } from 'components/Button/Button';

import Card from './Card';

export default {
  title: 'Components/Card',
  component: Card,
} as ComponentMeta<typeof Card>;

const Template: ComponentStory<typeof Card> = (args) => <Card {...args} />;

export const Primary = Template.bind({});
Primary.args = {
  frontContent: (
    <>
      <Button label={'FRONT'} onClick={() => console.info(`FRONt CLICK`)} />
    </>
  ),
  backContent: (
    <>
      <Button label={'BACK'} onClick={() => console.info(`back CLICK`)} />
    </>
  ),
  flipped: false,
};
