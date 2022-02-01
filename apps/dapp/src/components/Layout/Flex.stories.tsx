import { ComponentMeta } from '@storybook/react';
import React from 'react';

import { Flex } from 'components/Layout/Flex';

export default {
  title: 'Components/Flex',
  component: Flex,
} as ComponentMeta<typeof Flex>;

// const Template: ComponentStory<typeof Flex> = (args) => <Flex {...args} />;

export const Primary = () => (
  <>
    <Flex
      debug
      layout={{
        kind: 'container',
        direction: 'row',
      }}
    >
      <Flex
        debug
        layout={{
          kind: 'item',
          justifyContent: 'center',
          alignItems: 'center',
        }}
      >
        <p>1</p>
      </Flex>
    </Flex>
    <Flex
      debug
      layout={{
        kind: 'container',
        direction: 'row',
      }}
    >
      <Flex
        debug
        layout={{
          kind: 'item',
          justifyContent: 'center',
          alignItems: 'center',
        }}
      >
        <p>1/2</p>
      </Flex>
      <Flex
        debug
        layout={{
          kind: 'item',
          justifyContent: 'center',
          alignItems: 'center',
        }}
      >
        <p>1/2</p>
      </Flex>
    </Flex>
    <Flex
      debug
      layout={{
        kind: 'container',
        direction: 'row',
      }}
    >
      <Flex
        debug
        layout={{
          kind: 'item',
          justifyContent: 'center',
          alignItems: 'center',
        }}
      >
        <p>1/3</p>
      </Flex>
      <Flex
        debug
        layout={{
          kind: 'item',
          justifyContent: 'center',
          alignItems: 'center',
        }}
      >
        <p>1/3</p>
      </Flex>
      <Flex
        debug
        layout={{
          kind: 'item',
          justifyContent: 'center',
          alignItems: 'center',
        }}
      >
        <p>1/3</p>
      </Flex>
    </Flex>
    <Flex
      debug
      layout={{
        kind: 'container',
        direction: 'row',
      }}
    >
      <Flex
        debug
        layout={{
          kind: 'item',
          justifyContent: 'center',
          alignItems: 'center',
        }}
      >
        <p>1/4</p>
      </Flex>
      <Flex
        debug
        layout={{
          kind: 'item',
          justifyContent: 'center',
          alignItems: 'center',
        }}
      >
        <p>1/4</p>
      </Flex>
      <Flex
        debug
        layout={{
          kind: 'item',
          justifyContent: 'center',
          alignItems: 'center',
        }}
      >
        <p>1/4</p>
      </Flex>
      <Flex
        debug
        layout={{
          kind: 'item',
          justifyContent: 'center',
          alignItems: 'center',
        }}
      >
        <p>1/4</p>
      </Flex>
    </Flex>
  </>
);

export const Nested = () => (
  <>
    <Flex
      debug
      layout={{
        kind: 'container',
        direction: 'row',
      }}
    >
      <Flex
        debug
        layout={{
          kind: 'container',
          direction: 'row',
        }}
      >
        <Flex
          debug
          layout={{
            kind: 'item',
            justifyContent: 'center',
            alignItems: 'center',
          }}
        >
          <p>1/2</p>
        </Flex>
        <Flex
          debug
          layout={{
            kind: 'item',
            justifyContent: 'center',
            alignItems: 'center',
          }}
        >
          <p>1/2</p>
        </Flex>
        <Flex
          debug
          layout={{
            kind: 'item',
            justifyContent: 'center',
            alignItems: 'center',
          }}
        >
          <p>1/2</p>
        </Flex>
      </Flex>
      <Flex
        debug
        layout={{
          kind: 'item',
          justifyContent: 'center',
          alignItems: 'center',
          col: 'third',
        }}
      >
        <p>1/2</p>
      </Flex>
    </Flex>
    <Flex
      debug
      layout={{
        kind: 'container',
        direction: 'row',
      }}
    >
      <Flex
        debug
        layout={{
          kind: 'item',
          justifyContent: 'center',
          alignItems: 'center',
        }}
      >
        <p>1/3</p>
      </Flex>
      <Flex
        debug
        layout={{
          kind: 'item',
          justifyContent: 'center',
          alignItems: 'center',
        }}
      >
        <p>1/3</p>
      </Flex>
      <Flex
        debug
        layout={{
          kind: 'item',
          justifyContent: 'center',
          alignItems: 'center',
        }}
      >
        <p>1/3</p>
      </Flex>
    </Flex>
    <Flex
      debug
      layout={{
        kind: 'container',
        direction: 'row',
      }}
    >
      <Flex
        debug
        layout={{
          kind: 'item',
          justifyContent: 'center',
          alignItems: 'center',
        }}
      >
        <p>1/4</p>
      </Flex>
      <Flex
        debug
        layout={{
          kind: 'item',
          justifyContent: 'center',
          alignItems: 'center',
        }}
      >
        <p>1/4</p>
      </Flex>
      <Flex
        debug
        layout={{
          kind: 'item',
          justifyContent: 'center',
          alignItems: 'center',
        }}
      >
        <p>1/4</p>
      </Flex>
      <Flex
        debug
        layout={{
          kind: 'item',
          justifyContent: 'center',
          alignItems: 'center',
        }}
      >
        <p>1/4</p>
      </Flex>
    </Flex>
  </>
);
