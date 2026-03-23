import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { User as SupabaseUser, Session } from '@supabase/supabase-js';
import { generateBaseUsername, ensureUniqueUsername } from '@/utils/usernameUtils';

interface Profile {
  id: string;
  name: string | null;
  username: string | null;
  bio: string | null;
  avatar_url: string | null;
  theme_mode?: string | null;
  bg_theme?: string | null;
  gender: string | null;
  hide_highlights?: boolean | null;
  hide_collections?: boolean | null;
  is_private?: boolean | null;
  hide_online_status?: boolean | null;
  hide_mentions?: boolean | null;
  hide_saved_posts?: boolean | null;
  subscription_tier?: 'free' | 'pro' | string;
  created_at: string;
  updated_at: string;
}

interface AuthContextType {
  user: SupabaseUser | null;
  profile: Profile | null;
  session: Session | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  logout: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<SupabaseUser | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchProfile = async (userId: string) => {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const sb: any = supabase;
      const { data, error } = await sb
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle();

      if (error) {
        console.error('Error fetching profile:', error);
        return null;
      }

      // If profile row is missing OR incomplete, self-heal from OAuth metadata
      if (!data || !data.username || !data.name || data.name === 'Foydalanuvchi' || !data.avatar_url) {
        // Generate a username for users who don't have one (e.g., Google login)
        // Also sync their name from OAuth metadata if missing
        const { data: userData } = await supabase.auth.getUser();
        const user = userData?.user;
        const currentUserEmail = user?.email;
        const currentFullName = user?.user_metadata?.full_name || user?.user_metadata?.name;
        const currentAvatarUrl =
          (user?.user_metadata as { avatar_url?: string; picture?: string } | undefined)?.avatar_url ||
          (user?.user_metadata as { avatar_url?: string; picture?: string } | undefined)?.picture;
        
        const updates: Partial<Profile> = {};

        if ((!data || !data.username) && currentUserEmail) {
          const baseUsername = generateBaseUsername(currentUserEmail);
          const finalUsername = await ensureUniqueUsername(supabase, baseUsername, userId);
          updates.username = finalUsername;
        }

        if ((!data || !data.name || data.name === 'Foydalanuvchi') && currentFullName) {
          updates.name = currentFullName;
        }

        if ((!data || !data.avatar_url) && currentAvatarUrl) {
          updates.avatar_url = currentAvatarUrl;
        }
        
        if (Object.keys(updates).length > 0) {
          console.log('Fixing profile data for user:', userId, updates);
          const { data: updatedData, error: updateError } = await sb
            .from('profiles')
            .upsert({ id: userId, ...updates }, { onConflict: 'id' })
            .select()
            .single();
            
          if (updateError) {
            console.error('Error auto-updating profile:', updateError);
          } else {
            console.log('Successfully auto-updated profile for user:', userId, updatedData);
            return updatedData as Profile;
          }
        }
      }

      return data as Profile | null;
    } catch (error) {
      console.error('Error fetching profile:', error);
      return null;
    }
  };

  const refreshProfile = async () => {
    if (user) {
      const profileData = await fetchProfile(user.id);
      setProfile(profileData);
    }
  };

  // Update last_seen periodically
  useEffect(() => {
    if (!user) return;
    
    const updateLastSeen = () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const sb: any = supabase;
      sb.from('profiles').update({ last_seen: new Date().toISOString() }).eq('id', user.id).then();
    };
    
    updateLastSeen(); // on mount
    const interval = setInterval(updateLastSeen, 60000); // every 60s
    
    return () => clearInterval(interval);
  }, [user]);

  useEffect(() => {
    let isMounted = true;

    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (!isMounted) return;

        console.log('Auth state changed:', event, session?.user?.email);
        
        setSession(session);
        setUser(session?.user ?? null);

        if (session?.user) {
          setTimeout(async () => {
            if (isMounted) {
              const profileData = await fetchProfile(session.user.id);
              if (isMounted) {
                setProfile(profileData);
              }
            }
          }, 0);
        } else {
          setProfile(null);
        }
        
        setIsLoading(false);
      }
    );

    // Then check for existing session
    const initializeAuth = async () => {
      try {
        const hashParams = new URLSearchParams(window.location.hash.substring(1));
        const accessToken = hashParams.get('access_token');
        
        if (accessToken) {
          console.log('OAuth callback detected, waiting for auth state change...');
          return;
        }

        const { data: { session } } = await supabase.auth.getSession();
        
        if (!isMounted) return;
        
        if (session) {
          setSession(session);
          setUser(session.user);
          const profileData = await fetchProfile(session.user.id);
          if (isMounted) {
            setProfile(profileData);
          }
        }
      } catch (error) {
        console.error('Error initializing auth:', error);
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    initializeAuth();

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const logout = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setProfile(null);
    setSession(null);
  };

  return (
    <AuthContext.Provider 
      value={{ 
        user, 
        profile, 
        session,
        isLoading, 
        isAuthenticated: !!user,
        logout,
        refreshProfile
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
