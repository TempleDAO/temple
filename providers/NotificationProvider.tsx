import React, { createContext, PropsWithChildren, useContext, useState } from 'react';
import { NotificationProps } from '../components/Notification/Notification';
import { noop } from '../utils/helpers';


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

export const NotificationContext = createContext<NotificationProviderState>(INITIAL_STATE);

/**
 * NotificationProvider controls the active notifications on the app
 */
export const NotificationProvider = (props: PropsWithChildren<any>) => {
  const [notifications, setNotifications] = useState<Array<NotificationProps>>(INITIAL_STATE.notifications);
  const { children } = props;

  /**
   * removes the notification with `hash`
   */
  const closeNotification = (notificationHash: string) => {
    const newNotifications = notifications.filter(n => n.hash !== notificationHash);
    setNotifications(newNotifications);
  };

  /**
   * Adds a notification
   */
  const openNotification = (notification: NotificationProps) => {
    notifications.push(notification);
    // spreading notifications to get react state to update
    setNotifications([...notifications]);
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
