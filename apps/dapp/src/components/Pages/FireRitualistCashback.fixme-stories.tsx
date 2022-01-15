import React from 'react';
import { ComponentMeta, ComponentStory } from '@storybook/react';
import FireRitualistPage from 'components/Pages/FireRitualistCashback';

export default {
  title: 'Pages/FireRitualistCashback',
  component: FireRitualistPage,
} as ComponentMeta<typeof FireRitualistPage>;

const Template: ComponentStory<typeof FireRitualistPage> = () => (
  <FireRitualistPage />
);

export const Primary = Template.bind({});
Primary.args = {
  label: 'cashback',
};
