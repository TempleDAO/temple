import { ComponentMeta, ComponentStory } from '@storybook/react';
import React from 'react';
import { NotificationContext, NotificationProvider } from '../../providers/NotificationProvider';
import { Button } from '../Button/Button';
import Base from '../Layouts/Base';

import Notification from './Notification';

export default {
  title: 'Components/Notification',
  component: Notification,
  parameters: {
    layout: 'none',
  }
} as ComponentMeta<typeof Notification>;

const Template: ComponentStory<typeof Notification> = (args) => (
    <NotificationProvider>
      <NotificationContext.Consumer>
        {(notificationContext) => (
            <>
              <Base>
                <Button
                    onClick={() =>
                        notificationContext.openNotification({ ...args })
                    }
                    label={'Add notification'}
                />
              </Base>
            </>
        )}
      </NotificationContext.Consumer>
    </NotificationProvider>
);

export const Primary = Template.bind({});
Primary.args = {
  title: 'Fire Ritual offerings',
  hash: '0xa11fff0c202d8a0be307c36c819fcb597cce9b0851dba58b1f2e6e4ffaa10470'
};

