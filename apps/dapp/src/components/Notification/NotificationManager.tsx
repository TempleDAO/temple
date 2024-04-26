import styled from 'styled-components';
import { useNotification } from 'providers/NotificationProvider';
import Notification from 'components/Notification/Notification';
import { useEffect, useState } from 'react';

const AUTOHIDE_TIMER = 1000 * 10;

const NotificationManager = () => {
  const { notifications } = useNotification();

  const { closeNotification } = useNotification();

  // Array indicating which notifications are open.
  const [areOpen, setAreOpen] = useState<boolean[]>([]);

  useEffect(() => {
    // Setting all notifications to be open by default
    const listTrue = new Array(notifications.length).fill(true);
    setAreOpen(listTrue);

    // This is responsible for running the closing animation before
    // the notification is removed from the manager
    const timerForAnimation = setTimeout(function () {
      const listFalse = new Array(notifications.length).fill(false);
      setAreOpen(listFalse);
    }, AUTOHIDE_TIMER - 400);

    // This closes all notifications after AUTOHIDE_TIMER seconds,
    // removing them from the manager
    const timerForExpiration = setTimeout(function () {
      for (let i = 0; i < notifications.length; i++) {
        closeNotification(notifications[i].hash);
      }
    }, AUTOHIDE_TIMER);

    return () => {
      clearTimeout(timerForExpiration);
      clearTimeout(timerForAnimation);
    };
  }, [notifications]);

  return (
    <Notifications>
      {notifications.map((n, index) => {
        const { title, hash } = n;
        return (
          <Notification
            hash={hash}
            title={title}
            key={hash}
            isOpen={areOpen[index]}
          />
        );
      })}
    </Notifications>
  );
};

const Notifications = styled.div`
  display: grid;
  grid-gap: 2rem;
  position: fixed;
  z-index: ${(props) => props.theme.zIndexes.max};
  top: calc(${(props) => props.theme.metrics.headerHeight} + 1rem);
  right: 2rem;
  width: 20rem /* 320/16 */;
`;

export default NotificationManager;
