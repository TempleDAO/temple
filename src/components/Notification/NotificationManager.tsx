import styled from 'styled-components';
import { useNotification } from 'providers/NotificationProvider';
import Notification from 'components/Notification/Notification';

const NotificationManager = () => {
  const { notifications } = useNotification();

  return (
    <Notifications>
      {notifications.map((n) => {
        const { title, hash } = n;
        return <Notification hash={hash} title={title} key={hash} />;
      })}
    </Notifications>
  );
};

const Notifications = styled.div`
  display: grid;
  grid-gap: 2rem;
  position: absolute;
  z-index: ${(props) => props.theme.zIndexes.top};
  top: calc(${(props) => props.theme.metrics.headerHeight} + 1rem);
  right: 1rem;
  width: 20rem /* 320/16 */;
`;

export default NotificationManager;
