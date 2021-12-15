import React from 'react';
import styled from 'styled-components';
import { ComponentStory, ComponentMeta } from '@storybook/react';

import { PriceChart, ChartData } from 'components/Charts/PriceChart';

const Container = styled.div`
  display: flex;
  height: 100%;
  width: 1000px;
`;

export default {
  title: 'Components/PriceChart',
  component: PriceChart,
  parameters: {
    layout: 'fullscreen',
  },
} as ComponentMeta<typeof PriceChart>;

const Template: ComponentStory<typeof PriceChart> = (args) => {
  return (
    <Container>
      <PriceChart />
    </Container>
  );
};

export const Default = Template.bind({});
Default.args = {};
