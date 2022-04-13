import React from 'react';
import styled from 'styled-components';

import { useNotification } from 'providers/NotificationProvider';
import Notification from 'components/Notification/Notification';

const NotificationManager = () => {
  const { notifications } = useNotification();

  return (
    <Notifications>
      {notifications.map((notification) => {
        const { title, hash } = notification;
        return <Notification hash={hash} title={title} key={hash} />;
      })}
    </Notifications>
  );
};

const Notifications = styled.div`
  display: grid;
  grid-gap: 2rem;
  position: absolute;
  z-index: ${({ theme }) => theme.zIndexes.max};
  top: calc(${({ theme }) => theme.metrics.headerHeight} + 1rem);
  right: 2rem;
`;

export default NotificationManager;
