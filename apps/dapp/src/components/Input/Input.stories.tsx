import { action } from '@storybook/addon-actions';
import { ComponentMeta, ComponentStory } from '@storybook/react';

import { Input } from 'components/Input/Input';
import React from 'react';

export default {
  title: 'Components/Input',
  component: Input,
} as ComponentMeta<typeof Input>;

const Template: ComponentStory<typeof Input> = (args) => <Input {...args} />;

const storyOptions = [
  { value: '$FRAX', label: '$FRAX' },
  { value: '$TEMPLE', label: '$TEMPLE' },
  { value: '$ETH', label: '$ETH' },
];

export const Primary = Template.bind({});
Primary.args = {
  placeholder: '0.00',
  hint: 'Balance: 52,000.25',
  crypto: {
    kind: 'select',
    cryptoOptions: storyOptions,
    defaultValue: storyOptions[0],
    /* TODO: Find how to link nested handlers */
    onCryptoChange: action('onCryptoChange'),
  },
};

export const Value = Template.bind({});
Value.args = {
  placeholder: '0.00',
  hint: 'Balance: 52,000.25',
  crypto: {
    kind: 'value',
    value: '$TEMPLE',
  },
};

export const Disabled = Template.bind({});
Disabled.args = {
  value: '110.00',
  hint: 'Balance: 52,000.25',
  crypto: {
    kind: 'value',
    value: '$TEMPLE',
  },
  disabled: true,
};
