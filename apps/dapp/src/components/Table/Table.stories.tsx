import React from 'react';
import { ComponentMeta, ComponentStory } from '@storybook/react';

import { Table, Row, Cell, Body, Head } from './Table';

const ExampleTable = () => (
  <Table $expand>
    <Head>
      <Row>
        <Cell as="th">
          Position
        </Cell>
        <Cell $align="center" as="th">
          Start/End
        </Cell>
        <Cell $align="center" as="th">
          Amount
        </Cell>
        <Cell $align="center" as="th">
          Claimable
        </Cell>
      </Row>
    </Head>
    <Body>
      <Row>
        <Cell>
          68 Days
        </Cell>
        <Cell $align="center">
          Jan 01, 2022 -<br />
          June 01,2022
        </Cell>
        <Cell $align="center">
          T$ 301,452
        </Cell>
        <Cell $align="center" $icon="claim">
          T$ 32,150
        </Cell>
      </Row>
      <Row>
        <Cell>
          38 Days
        </Cell>
        <Cell $align="center">
          Feb 01, 2022 -<br />
          July 01,2022
        </Cell>
        <Cell $align="center">
          T$ 33,198
        </Cell>
        <Cell $align="center">
          NO
        </Cell>
      </Row>
      <Row>
        <Cell>
          68 Days
        </Cell>
        <Cell $align="center">
          Jan 01, 2022 -<br />
          June 01,2022
        </Cell>
        <Cell $align="center">
          T$ 301,452
        </Cell>
        <Cell $align="center">
          NO
        </Cell>
      </Row>
      <Row>
        <Cell>
          68 Days
        </Cell>
        <Cell $align="center">
          Jan 01, 2022 -<br />
          June 01,2022
        </Cell>
        <Cell $align="center">
          T$ 301,452
        </Cell>
        <Cell $icon="claim" $align="center">
          T$ 32,150
        </Cell>
      </Row>
    </Body>
  </Table>
);

export default {
  title: 'Components/Table',
  component: ExampleTable,
} as ComponentMeta<typeof ExampleTable>;

const Template: ComponentStory<typeof ExampleTable> = () => (
  <ExampleTable />
);

export const Primary = Template.bind({});
Primary.args = {};
