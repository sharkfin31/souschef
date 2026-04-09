import { createContext, useContext, useCallback, ReactNode } from 'react';
import { toast } from 'sonner';

type NotificationType = 'success' | 'error' | 'info' | 'warning';

interface NotificationContextType {
  addNotification: (type: NotificationType, message: string, duration?: number) => void;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export const NotificationProvider = ({ children }: { children: ReactNode }) => {
  const addNotification = useCallback(
    (type: NotificationType, message: string, duration = 5000) => {
      const opts = { duration: duration > 0 ? duration : Infinity };
      switch (type) {
        case 'success':
          toast.success(message, opts);
          break;
        case 'error':
          toast.error(message, opts);
          break;
        case 'warning':
          toast.warning(message, opts);
          break;
        case 'info':
        default:
          toast.info(message, opts);
          break;
      }
    },
    []
  );

  return (
    <NotificationContext.Provider value={{ addNotification }}>
      {children}
    </NotificationContext.Provider>
  );
};

export const useNotification = () => {
  const context = useContext(NotificationContext);
  if (context === undefined) {
    throw new Error('useNotification must be used within a NotificationProvider');
  }
  return context;
};
