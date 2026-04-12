import { useGlobalMessageListener } from '@/hooks/useGlobalMessageListener';

/**
 * Renders nothing — just activates the global real-time message listener.
 * Must be placed inside BrowserRouter so useNavigate works.
 */
export const GlobalMessageListener = () => {
  useGlobalMessageListener();
  return null;
};
