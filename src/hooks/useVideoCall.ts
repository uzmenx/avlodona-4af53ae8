import { useState, useEffect, useCallback, useRef } from 'react';
import DailyIframe, { DailyCall, DailyParticipant, DailyEventObject } from '@daily-co/daily-js';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { clearLocalCallNotification } from '@/lib/pushNotifications';
import { ForegroundService } from '@capawesome-team/capacitor-android-foreground-service';

interface Call {
  id: string;
  caller_id: string;
  receiver_id: string;
  room_url: string;
  room_name: string;
  status: string;
  created_at: string;
}

export const useVideoCall = (otherUserId: string | null) => {
  const { user } = useAuth();
  const [callObject, setCallObject] = useState<DailyCall | null>(null);
  const [isInCall, setIsInCall] = useState(false);
  const [wasInCall, setWasInCall] = useState(false);
  const [partnerLeft, setPartnerLeft] = useState(false);
  const [isCreatingRoom, setIsCreatingRoom] = useState(false);
  const [incomingCall, setIncomingCall] = useState<Call | null>(null);
  const [currentCall, setCurrentCall] = useState<Call | null>(null);
  const [cameraOn, setCameraOn] = useState(true);
  const [micOn, setMicOn] = useState(true);
  const [remoteParticipant, setRemoteParticipant] = useState<DailyParticipant | null>(null);
  const callHistorySavedRef = useRef(false);
  const callObjectRef = useRef<DailyCall | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const maxReconnectAttempts = 3;

  const [lastRoomUrl, setLastRoomUrl] = useState<string | null>(null);

  // Keep ref in sync
  useEffect(() => {
    callObjectRef.current = callObject;
  }, [callObject]);

  // Subscribe to incoming calls
  useEffect(() => {
    if (!user?.id) return;

    const channel = supabase
      .channel('incoming-calls')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'calls',
          filter: `receiver_id=eq.${user.id}`,
        },
        (payload) => {
          const call = payload.new as Call;
          if (call.status === 'pending') {
            setIncomingCall(call);
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'calls',
        },
        (payload) => {
          const call = payload.new as Call;
          
          if (call.status === 'ended') {
            if (currentCall?.id === call.id || incomingCall?.id === call.id) {
              // Don't call leaveCall() directly to avoid clearing everything if we want to show "Call Ended" UI
              // But for now, let's keep it simple
              if (callObjectRef.current) {
                callObjectRef.current.leave().catch(() => undefined);
              }
              setIsInCall(false);
              setRemoteParticipant(null);
              toast.info("Qo'ng'iroq tugadi");
            }
            if (incomingCall?.id === call.id) {
              clearLocalCallNotification(call.caller_id);
            }
            setIncomingCall(null);
          }
          
          if (call.status === 'active' && currentCall?.id === call.id) {
            setCurrentCall(call);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id, currentCall?.id, incomingCall?.id]);

  // Cleanup on unmount
  useEffect(() => {
    // Listen for foreground service button clicks (e.g. "Tugatish" button)
    const setupForegroundListener = async () => {
      try {
        await ForegroundService.removeAllListeners();
        await ForegroundService.addListener('buttonTapped', (event) => {
          if (event.buttonId === 1) {
            // "Tugatish" was clicked
            leaveCall();
          }
        });
      } catch (e) {
        // usually fails on web/iOS, ignore listener setup error
      }
    };
    
    setupForegroundListener();

    return () => {
      try { ForegroundService.removeAllListeners(); } catch (e) {
        // Ignore removal error
      }
      const co = callObjectRef.current;
      if (co) {
        try {
          co.leave();
          co.destroy();
        } catch {
          // ignore leave/destroy error
        }
      }
    };
  }, []);

  const startCall = useCallback(async () => {
    if (!otherUserId || !user?.id || isCreatingRoom) return;

    setIsCreatingRoom(true);
    
    try {
      const { data, error } = await supabase.functions.invoke('create-daily-room', {
        body: { receiver_id: otherUserId },
      });

      if (error) throw error;
      
      setCurrentCall(data.call);
      setLastRoomUrl(data.room_url);
      callHistorySavedRef.current = false;
      
      await joinRoom(data.room_url);
      
    } catch (error) {
      console.error('Error starting call:', error);
      toast.error("Qo'ng'iroqni boshlashda xatolik");
    } finally {
      setIsCreatingRoom(false);
    }
  }, [otherUserId, user?.id, isCreatingRoom]);

  const answerCall = useCallback(async () => {
    if (!incomingCall) return;

    try {
      await supabase
        .from('calls')
        .update({ status: 'active' })
        .eq('id', incomingCall.id);

      setCurrentCall(incomingCall);
      setLastRoomUrl(incomingCall.room_url);
      callHistorySavedRef.current = false;
      await joinRoom(incomingCall.room_url);
      clearLocalCallNotification(incomingCall.caller_id);
      setIncomingCall(null);
      
    } catch (error) {
      console.error('Error answering call:', error);
      toast.error("Qo'ng'iroqqa javob berishda xatolik");
    }
  }, [incomingCall]);

  const rejoinCall = useCallback(async () => {
    if (!lastRoomUrl) return;
    await joinRoom(lastRoomUrl);
  }, [lastRoomUrl]);

  const declineCall = useCallback(async () => {
    if (!incomingCall) return;

    try {
      await supabase.functions.invoke('end-call', {
        body: { 
          call_id: incomingCall.id,
          room_name: incomingCall.room_name 
        },
      });
      
      clearLocalCallNotification(incomingCall.caller_id);
      setIncomingCall(null);
    } catch (error) {
      console.error('Error declining call:', error);
    }
  }, [incomingCall]);

  const joinRoom = async (roomUrl: string) => {
    try {
      // Destroy existing call object if any
      if (callObjectRef.current) {
        try {
          await callObjectRef.current.leave();
          callObjectRef.current.destroy();
        } catch {
          // ignore previous call cleanup
        }
        setCallObject(null);
        callObjectRef.current = null;
      }

      reconnectAttemptsRef.current = 0;

      const newCallObject = DailyIframe.createCallObject({
        audioSource: true,
        videoSource: true,
      });

      newCallObject.on('joined-meeting', async () => {
        setIsInCall(true);
        setWasInCall(true);
        setPartnerLeft(false);
        reconnectAttemptsRef.current = 0;

        // Start Foreground Service so call doesn't drop when app is backgrounded
        try {
          await ForegroundService.startForegroundService({
            id: 2,
            title: "Avlodona Video Qo'ng'iroq",
            body: "Suhbat davom etmoqda... Qaytish uchun bosing",
            smallIcon: 'ic_stat_icon_config_sample',
            buttons: [
              { title: 'Tugatish', id: 1 }
            ],
            silent: true,
          });
        } catch (e) {
          console.error('Failed to start foreground service:', e);
        }
      });

      newCallObject.on('left-meeting', () => {
        setIsInCall(false);
        setRemoteParticipant(null);
        setPartnerLeft(false);
        
        try {
          ForegroundService.stopForegroundService();
        } catch (e) {
          // Ignore service stop error
        }
      });

      newCallObject.on('participant-joined', (event: DailyEventObject) => {
        if (event?.participant && !event.participant.local) {
          setRemoteParticipant(event.participant);
          setPartnerLeft(false);
        }
      });

      newCallObject.on('participant-updated', (event: DailyEventObject) => {
        if (event?.participant && !event.participant.local) {
          setRemoteParticipant(event.participant);
          setPartnerLeft(false);
        }
      });

      newCallObject.on('participant-left', (event: DailyEventObject) => {
        if (event?.participant && !event.participant.local) {
          setRemoteParticipant(null);
          setPartnerLeft(true);
          toast.info("Suhbatdosh chiqib ketdi");
        }
      });

      // Handle network quality and reconnection
      newCallObject.on('network-quality-change', (event: DailyEventObject) => {
        const quality = (event as unknown as { quality?: string } | null)?.quality;
        if (quality === 'very-low') {
          toast.warning("Internet aloqasi yomon", { duration: 2000 });
        }
      });

      newCallObject.on('network-connection', (event: DailyEventObject) => {
        const evt = (event as unknown as { event?: string } | null)?.event;
        if (evt === 'interrupted') {
          toast.warning("Internet uzildi, qayta ulanmoqda...", { duration: 3000 });
        }
        if (evt === 'connected') {
          if (reconnectAttemptsRef.current > 0) {
            toast.success("Qayta ulandi!", { duration: 2000 });
          }
          reconnectAttemptsRef.current = 0;
        }
      });

      newCallObject.on('error', (event: DailyEventObject) => {
        console.error('Daily error:', event);
        const errorType = String(
          (event as unknown as { errorMsg?: unknown; error?: { type?: unknown } } | null)?.errorMsg ??
            (event as unknown as { error?: { type?: unknown } } | null)?.error?.type ??
            ''
        );
        
        // Camera/mic permission errors
        if (errorType.includes('not-allowed') || errorType.includes('NotAllowed')) {
          toast.error("Kamera yoki mikrofonga ruxsat bering");
          return;
        }
        
        // Device not found
        if (errorType.includes('not-found') || errorType.includes('NotFound')) {
          toast.error("Kamera yoki mikrofon topilmadi");
          // Continue call with available devices
          try {
            newCallObject.setLocalVideo(false);
            setCameraOn(false);
          } catch {
            // ignore video toggle error
          }
          return;
        }

        // Network/connection errors - try reconnect
        if (reconnectAttemptsRef.current < maxReconnectAttempts) {
          reconnectAttemptsRef.current++;
          toast.error(`Xatolik yuz berdi, qayta urinish... (${reconnectAttemptsRef.current}/${maxReconnectAttempts})`);
          return;
        }

        toast.error("Video qo'ng'iroqda xatolik yuz berdi");
      });

      // Camera access error handling
      newCallObject.on('camera-error', (event: DailyEventObject) => {
        console.error('Camera error:', event);
        const errType = String((event as unknown as { error?: { type?: unknown } } | null)?.error?.type ?? '');
        if (errType === 'cam-in-use') {
          toast.error("Kamera boshqa ilova tomonidan ishlatilmoqda");
        } else if (errType === 'not-found') {
          toast.error("Kamera topilmadi");
        } else if (errType === 'permissions') {
          toast.error("Kameraga ruxsat berilmagan");
        } else {
          toast.error("Kamera xatosi");
        }
        setCameraOn(false);
      });

      setCallObject(newCallObject);
      callObjectRef.current = newCallObject;

      await newCallObject.join({ url: roomUrl });
      
    } catch (error: unknown) {
      console.error('Error joining room:', error);
      const msg = String((error as { message?: unknown } | null)?.message ?? '');
      
      // Specific error messages
      if (msg.includes('permission')) {
        toast.error("Kamera va mikrofonga ruxsat bering");
      } else if (msg.includes('network') || msg.includes('fetch')) {
        toast.error("Internet aloqasi yo'q");
      } else {
        toast.error("Xonaga qo'shilishda xatolik");
      }
    }
  };

  const leaveCall = useCallback(async () => {
    try {
      if (callObject) {
        try {
          await callObject.leave();
        } catch {
          // ignore leave
        }
        try {
          callObject.destroy();
        } catch {
          // ignore destroy
        }
        setCallObject(null);
        callObjectRef.current = null;
      }
      
      try {
        await ForegroundService.stopForegroundService();
      } catch (e) {
        // Ignore service stop error
      }

      if (currentCall) {
        try {
          await supabase.functions.invoke('end-call', {
            body: { 
              call_id: currentCall.id,
              room_name: currentCall.room_name 
            },
          });
        } catch (err) {
          console.error('Error ending call on server:', err);
        }

        // Save call history ONLY ONCE
        if (!callHistorySavedRef.current && user?.id) {
          callHistorySavedRef.current = true;
          try {
            const otherUserToSaveId = currentCall.caller_id === user.id 
              ? currentCall.receiver_id 
              : currentCall.caller_id;
            
            const { data: existing } = await supabase
              .from('conversations')
              .select('id')
              .or(`and(participant1_id.eq.${user.id},participant2_id.eq.${otherUserToSaveId}),and(participant1_id.eq.${otherUserToSaveId},participant2_id.eq.${user.id})`)
              .maybeSingle();

            let convId = existing?.id;
            if (!convId) {
              const { data: newConv } = await supabase
                .from('conversations')
                .insert({ participant1_id: user.id, participant2_id: otherUserToSaveId })
                .select('id')
                .single();
              convId = newConv?.id;
            }

            if (convId) {
              const startTime = new Date(currentCall.created_at);
              const endTime = new Date();
              const durationSec = Math.round((endTime.getTime() - startTime.getTime()) / 1000);
              const mins = Math.floor(durationSec / 60);
              const secs = durationSec % 60;
              const durationText = mins > 0 ? `${mins} daqiqa ${secs} soniya` : `${secs} soniya`;

              await supabase.from('messages').insert({
                conversation_id: convId,
                sender_id: user.id,
                content: `📹 Video qo'ng'iroq — ${durationText}`,
                status: 'sent',
              });
            }
          } catch (historyErr) {
            console.error('Error saving call history:', historyErr);
          }
        }
      }

      setIsInCall(false);
      // Don't clear currentCall or lastRoomUrl immediately so we can show Rejoin UI
      setRemoteParticipant(null);
      setPartnerLeft(false);
      setCameraOn(true);
      setMicOn(true);
      
    } catch (error) {
      console.error('Error leaving call:', error);
    }
  }, [callObject, currentCall, user?.id]);

  const endCallPermanently = useCallback(() => {
    leaveCall();
    setCurrentCall(null);
    setLastRoomUrl(null);
  }, [leaveCall]);

  const toggleCamera = useCallback(async () => {
    if (!callObject) return;
    try {
      const newState = !cameraOn;
      await callObject.setLocalVideo(newState);
      setCameraOn(newState);
    } catch (err) {
      console.error('Toggle camera error:', err);
      toast.error("Kamerani almashtirish imkonsiz");
    }
  }, [callObject, cameraOn]);

  const toggleMic = useCallback(async () => {
    if (!callObject) return;
    try {
      const newState = !micOn;
      await callObject.setLocalAudio(newState);
      setMicOn(newState);
    } catch (err) {
      console.error('Toggle mic error:', err);
      toast.error("Mikrofonni almashtirish imkonsiz");
    }
  }, [callObject, micOn]);

  return {
    isInCall,
    wasInCall,
    partnerLeft,
    isCreatingRoom,
    incomingCall,
    currentCall,
    cameraOn,
    micOn,
    callObject,
    remoteParticipant,
    lastRoomUrl,
    startCall,
    answerCall,
    rejoinCall,
    declineCall,
    leaveCall,
    endCallPermanently,
    toggleCamera,
    toggleMic,
  };
};
