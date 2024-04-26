import React, {
  createContext,
  PropsWithChildren,
  useContext,
  useState,
} from 'react';
import { NotificationProps } from 'components/Notification/Notification';
import { noop } from 'utils/helpers';

interface NotificationProviderState {
  notifications: Array<NotificationProps>;

  openNotification(notification: NotificationProps): void;

  closeNotification(notificationHash: string): void;
}

export const INITIAL_STATE: NotificationProviderState = {
  notifications: [],
  openNotification: noop,
  closeNotification: noop,
};

export const NotificationContext =
  createContext<NotificationProviderState>(INITIAL_STATE);

/**
 * NotificationProvider controls the active notifications on the app
 */
// eslint-disable-next-line @typescript-eslint/ban-types
export const NotificationProvider = (props: PropsWithChildren<{}>) => {
  const [notifications, setNotifications] = useState<Array<NotificationProps>>(
    INITIAL_STATE.notifications
  );
  const { children } = props;

  /**
   * removes the notification with `hash`
   */
  const closeNotification = (notificationHash: string) => {
    setNotifications((notifications) => {
      return notifications.filter(({ hash }) => hash !== notificationHash);
    });
  };

  /**
   * Adds a notification
   */
  const openNotification = (notification: NotificationProps) => {
    // spreading notifications to get react state to update
    setNotifications((notifications) => [...notifications, notification]);
  };

  return (
    <NotificationContext.Provider
      value={{
        notifications,
        closeNotification,
        openNotification,
      }}
    >
      {children}
    </NotificationContext.Provider>
  );
};

export const useNotification = () => useContext(NotificationContext);
