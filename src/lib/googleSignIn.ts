import { Capacitor } from '@capacitor/core';
import { supabase } from '@/integrations/supabase/client';

let isInitialized = false;

const ensureInitialized = async () => {
  if (!Capacitor.isNativePlatform() || isInitialized) return;
  const clientId = import.meta.env.VITE_GOOGLE_WEB_CLIENT_ID;
  if (!clientId) {
    throw new Error('VITE_GOOGLE_WEB_CLIENT_ID topilmadi');
  }
  const { GoogleSignIn } = await import('@capawesome/capacitor-google-sign-in');
  await GoogleSignIn.initialize({ clientId });
  isInitialized = true;
};

export const signInWithGoogle = async () => {
  if (!Capacitor.isNativePlatform()) {
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: 'https://avlodona.com/auth/callback'
      }
    });
    if (error) throw error;
    return { redirected: true, url: data?.url ?? null };
  }

  await ensureInitialized();
  const { GoogleSignIn } = await import('@capawesome/capacitor-google-sign-in');
  const result = await GoogleSignIn.signIn();
  if (!result?.idToken) {
    throw new Error('Google idToken kelmadi');
  }
  const { error } = await supabase.auth.signInWithIdToken({
    provider: 'google',
    token: result.idToken
  });
  if (error) throw error;
  return { redirected: false, url: null };
};

export const signOutFromGoogleNative = async () => {
  if (!Capacitor.isNativePlatform()) return;
  try {
    await ensureInitialized();
    const { GoogleSignIn } = await import('@capawesome/capacitor-google-sign-in');
    await GoogleSignIn.signOut();
  } catch {
    return;
  }
};
