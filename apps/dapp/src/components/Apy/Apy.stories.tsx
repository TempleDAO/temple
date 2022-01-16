import React from 'react';
import { ComponentMeta, ComponentStory } from '@storybook/react';
import BuyImage from 'assets/images/buy-art.svg';
import { Apy } from 'components/Apy/Apy';

export default {
  title: 'Components/Apy',
  component: Apy,
} as ComponentMeta<typeof Apy>;

const Template: ComponentStory<typeof Apy> = (args) => <Apy {...args} />;

export const Primary = Template.bind({});

Primary.args = {
  cryptoName: '$TEMPLE',
  imageData: {
    imageUrl: BuyImage,
    alt: '',
  },
};
