import { createContext, useContext, useCallback, ReactNode } from 'react';
import { toast } from 'sonner';

type NotificationType = 'success' | 'error' | 'info' | 'warning';

export type AddNotificationOptions = {
  /** Secondary line shown under the title (Sonner description). */
  description?: string;
  duration?: number;
};

interface NotificationContextType {
  addNotification: (
    type: NotificationType,
    message: string,
    options?: number | AddNotificationOptions
  ) => void;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

function normalizeOptions(
  options?: number | AddNotificationOptions
): { description?: string; duration: number } {
  if (options === undefined) return { duration: 5000 };
  if (typeof options === 'number') return { duration: options };
  return {
    description: options.description,
    duration: options.duration ?? 5000,
  };
}

export const NotificationProvider = ({ children }: { children: ReactNode }) => {
  const addNotification = useCallback(
    (type: NotificationType, message: string, options?: number | AddNotificationOptions) => {
      const { description, duration } = normalizeOptions(options);
      const opts = {
        duration: duration > 0 ? duration : Infinity,
        ...(description ? { description } : {}),
      };
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
