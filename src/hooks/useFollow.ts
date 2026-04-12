import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useUnfollowHistory } from './useUnfollowHistory';

export const useFollow = (targetUserId: string | undefined) => {
  const { user } = useAuth();
  const [isFollowing, setIsFollowing] = useState(false);
  const [isRequested, setIsRequested] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [followersCount, setFollowersCount] = useState(0);
  const [followingCount, setFollowingCount] = useState(0);
  const { recordUnfollow } = useUnfollowHistory();

  // Check if current user follows target user
  const checkFollowStatus = useCallback(async () => {
    if (!user?.id || !targetUserId) return;

    try {
      const { data } = await supabase
        .from('follows')
        .select('id, status')
        .eq('follower_id', user.id)
        .eq('following_id', targetUserId)
        .maybeSingle();

      if (data) {
        if (data.status === 'pending') {
          setIsFollowing(false);
          setIsRequested(true);
        } else {
          setIsFollowing(true);
          setIsRequested(false);
        }
      } else {
        setIsFollowing(false);
        setIsRequested(false);
      }
    } catch (error) {
      console.error('Error checking follow status:', error);
    }
  }, [user?.id, targetUserId]);

  // Fetch followers and following counts
  const fetchCounts = useCallback(async () => {
    if (!targetUserId) return;

    try {
      // Get followers count (people following this user)
      const { count: followers } = await supabase
        .from('follows')
        .select('*', { count: 'exact', head: true })
        .eq('following_id', targetUserId)
        .or('status.eq.accepted,status.is.null');

      // Get following count (people this user follows)
      const { count: following } = await supabase
        .from('follows')
        .select('*', { count: 'exact', head: true })
        .eq('follower_id', targetUserId)
        .or('status.eq.accepted,status.is.null');

      setFollowersCount(followers || 0);
      setFollowingCount(following || 0);
    } catch (error) {
      console.error('Error fetching follow counts:', error);
    }
  }, [targetUserId]);

  useEffect(() => {
    checkFollowStatus();
    fetchCounts();
  }, [checkFollowStatus, fetchCounts]);

  const toggleFollow = async () => {
    if (!user?.id || !targetUserId || isLoading) return;

    setIsLoading(true);
    try {
      if (isFollowing || isRequested) {
        // Unfollow / Cancel Request
        await supabase
          .from('follows')
          .delete()
          .eq('follower_id', user.id)
          .eq('following_id', targetUserId);

        if (isFollowing) {
          // Record unfollow history only if they were actually following
          await recordUnfollow(targetUserId);
          setFollowersCount(prev => Math.max(0, prev - 1));
        }

        setIsFollowing(false);
        setIsRequested(false);
      } else {
        // Check if target is private
        const { data: targetProfile } = await supabase
          .from('profiles')
          .select('is_private')
          .eq('id', targetUserId)
          .single();
          
        const isPrivate = targetProfile?.is_private ?? false;
        const newStatus = isPrivate ? 'pending' : 'accepted';

        // Follow / Send Request
        await supabase
          .from('follows')
          .insert({
            follower_id: user.id,
            following_id: targetUserId,
            status: newStatus
          });

        if (newStatus === 'pending') {
          setIsRequested(true);
          // notification for follow request
          await supabase.from('notifications').insert({
            user_id: targetUserId,
            actor_id: user.id,
            type: 'follow_request',
          });
        } else {
          setIsFollowing(true);
          setFollowersCount(prev => prev + 1);
          // Create notification for the followed user
          await supabase.from('notifications').insert({
            user_id: targetUserId,
            actor_id: user.id,
            type: 'follow',
          });
        }
      }
    } catch (error) {
      console.error('Error toggling follow:', error);
      // Revert state on error
      checkFollowStatus();
      fetchCounts();
    } finally {
      setIsLoading(false);
    }
  };

  return {
    isFollowing,
    isRequested,
    isLoading,
    followersCount,
    followingCount,
    toggleFollow,
    refetch: () => {
      checkFollowStatus();
      fetchCounts();
    }
  };
};
