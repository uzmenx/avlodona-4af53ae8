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
  await GoogleSignIn.initialize({
    clientId,
    scopes: ['https://www.googleapis.com/auth/userinfo.email', 'https://www.googleapis.com/auth/userinfo.profile']
  });
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
  let result: Awaited<ReturnType<typeof GoogleSignIn.signIn>>;
  try {
    result = await GoogleSignIn.signIn();
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e);
    if (message.toLowerCase().includes('canceled')) {
      throw new Error("Google oynasi yopilib ketdi (cancel). Android Client ID va SHA-1 (debug/release) to'g'ri qo'yilganini tekshiring.");
    }
    throw new Error(message);
  }
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
