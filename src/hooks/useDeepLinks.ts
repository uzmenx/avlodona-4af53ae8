import { useEffect } from 'react';
import { App, URLOpenListenerEvent } from '@capacitor/app';
import { Browser } from '@capacitor/browser';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';

export const useDeepLinks = () => {
  const navigate = useNavigate();

  useEffect(() => {
    const handleDeepLink = async (event: URLOpenListenerEvent) => {
      console.log('App opened with URL:', event.url);
      
      // Check if it's an OAuth callback URL
      if (event.url.includes('auth/callback')) {
        // If the URL was opened via Capacitor Browser, close it to return to the app
        await Browser.close().catch(() => {
          console.log('No browser to close or failed to close');
        });

        // Supabase-js automatically listens for hash fragment changes and sets the session 
        // if we update the window location.
        // We can manually extract and set session or just update location hash.
        try {
          const urlObj = new URL(event.url);
          const hashParams = new URLSearchParams(urlObj.hash.substring(1));
          
          const accessToken = hashParams.get('access_token');
          const refreshToken = hashParams.get('refresh_token');

          if (accessToken && refreshToken) {
            console.log('Tokens found in deep link, setting session...');
            const { error } = await supabase.auth.setSession({
              access_token: accessToken,
              refresh_token: refreshToken
            });
            
            if (error) {
              console.error('Error setting session from deep link:', error);
            } else {
              console.log('Session successfully set from deep link!');
              navigate('/'); // redirect to home
            }
          } else if (urlObj.searchParams.has('code')) {
             // In case PKCE flow was used and code is returned instead of access_token
             const code = urlObj.searchParams.get('code');
             if (code) {
               console.log('Code found in deep link, exchanging for session...');
               const { error } = await supabase.auth.exchangeCodeForSession(code);
               if (error) {
                 console.error('Error exchanging code:', error);
               } else {
                 console.log('Session successfully set from code!');
                 navigate('/');
               }
             }
          }
        } catch (err) {
          console.error('Error parsing deep link URL:', err);
        }
      }
    };

    // Add listener
    const listener = App.addListener('appUrlOpen', handleDeepLink);

    // Cleanup listener on unmount
    return () => {
      listener.then(l => l.remove());
    };
  }, [navigate]);
};
