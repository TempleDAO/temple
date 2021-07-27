import { ComponentMeta, ComponentStory } from '@storybook/react';
import React from 'react';
import BuyImage from '../../public/images/buy-art.svg';

import { Apy } from './Apy';

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
    alt: ''
  }
};

