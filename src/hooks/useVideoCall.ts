import { useState, useEffect, useCallback, useRef } from 'react';
import DailyIframe, { DailyCall, DailyParticipant, DailyEventObject } from '@daily-co/daily-js';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

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
  const [isCreatingRoom, setIsCreatingRoom] = useState(false);
  const [incomingCall, setIncomingCall] = useState<Call | null>(null);
  const [currentCall, setCurrentCall] = useState<Call | null>(null);
  const [cameraOn, setCameraOn] = useState(true);
  const [micOn, setMicOn] = useState(true);
  const [remoteParticipant, setRemoteParticipant] = useState<DailyParticipant | null>(null);
  const callHistorySavedRef = useRef(false);

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
          console.log('Incoming call:', payload);
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
          console.log('Call updated:', call);
          
          // If call ended
          if (call.status === 'ended') {
            if (currentCall?.id === call.id || incomingCall?.id === call.id) {
              leaveCall();
              toast.info("Qo'ng'iroq tugadi");
            }
            setIncomingCall(null);
          }
          
          // If call accepted
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

  const startCall = useCallback(async () => {
    if (!otherUserId || !user?.id || isCreatingRoom) return;

    setIsCreatingRoom(true);
    
    try {
      console.log('Creating room for call to:', otherUserId);
      
      const { data, error } = await supabase.functions.invoke('create-daily-room', {
        body: { receiver_id: otherUserId },
      });

      if (error) throw error;
      
      console.log('Room created:', data);
      setCurrentCall(data.call);
      callHistorySavedRef.current = false;
      
      // Join the room
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
      // Update call status
      await supabase
        .from('calls')
        .update({ status: 'active' })
        .eq('id', incomingCall.id);

      setCurrentCall(incomingCall);
      callHistorySavedRef.current = false;
      await joinRoom(incomingCall.room_url);
      setIncomingCall(null);
      
    } catch (error) {
      console.error('Error answering call:', error);
      toast.error("Qo'ng'iroqqa javob berishda xatolik");
    }
  }, [incomingCall]);

  const declineCall = useCallback(async () => {
    if (!incomingCall) return;

    try {
      await supabase.functions.invoke('end-call', {
        body: { 
          call_id: incomingCall.id,
          room_name: incomingCall.room_name 
        },
      });
      
      setIncomingCall(null);
    } catch (error) {
      console.error('Error declining call:', error);
    }
  }, [incomingCall]);

  const joinRoom = async (roomUrl: string) => {
    try {
      console.log('Joining room:', roomUrl);
      
      const newCallObject = DailyIframe.createCallObject({
        audioSource: true,
        videoSource: true,
      });

      newCallObject.on('joined-meeting', () => {
        console.log('Joined meeting');
        setIsInCall(true);
      });

      newCallObject.on('left-meeting', () => {
        console.log('Left meeting');
        setIsInCall(false);
        setRemoteParticipant(null);
      });

      newCallObject.on('participant-joined', (event: DailyEventObject) => {
        console.log('Participant joined:', event);
        if (event?.participant && !event.participant.local) {
          setRemoteParticipant(event.participant);
        }
      });

      newCallObject.on('participant-updated', (event: DailyEventObject) => {
        if (event?.participant && !event.participant.local) {
          setRemoteParticipant(event.participant);
        }
      });

      newCallObject.on('participant-left', (event: DailyEventObject) => {
        console.log('Participant left:', event);
        if (event?.participant && !event.participant.local) {
          setRemoteParticipant(null);
        }
      });

      newCallObject.on('error', (event) => {
        console.error('Daily error:', event);
        toast.error("Video qo'ng'iroqda xatolik");
      });

      setCallObject(newCallObject);
      await newCallObject.join({ url: roomUrl });
      
    } catch (error) {
      console.error('Error joining room:', error);
      toast.error("Xonaga qo'shilishda xatolik");
    }
  };

  const leaveCall = useCallback(async () => {
    try {
      if (callObject) {
        await callObject.leave();
        callObject.destroy();
        setCallObject(null);
      }

      if (currentCall) {
        await supabase.functions.invoke('end-call', {
          body: { 
            call_id: currentCall.id,
            room_name: currentCall.room_name 
          },
        });

        // Save call history ONLY ONCE
        if (!callHistorySavedRef.current && user?.id) {
          callHistorySavedRef.current = true;
          try {
            const otherUserId = currentCall.caller_id === user.id 
              ? currentCall.receiver_id 
              : currentCall.caller_id;
            
            const { data: existing } = await supabase
              .from('conversations')
              .select('id')
              .or(`and(participant1_id.eq.${user.id},participant2_id.eq.${otherUserId}),and(participant1_id.eq.${otherUserId},participant2_id.eq.${user.id})`)
              .maybeSingle();

            let convId = existing?.id;
            if (!convId) {
              const { data: newConv } = await supabase
                .from('conversations')
                .insert({ participant1_id: user.id, participant2_id: otherUserId })
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
      setCurrentCall(null);
      setRemoteParticipant(null);
      setCameraOn(true);
      setMicOn(true);
      
    } catch (error) {
      console.error('Error leaving call:', error);
    }
  }, [callObject, currentCall, user?.id]);

  const toggleCamera = useCallback(async () => {
    if (!callObject) return;
    
    const newState = !cameraOn;
    await callObject.setLocalVideo(newState);
    setCameraOn(newState);
  }, [callObject, cameraOn]);

  const toggleMic = useCallback(async () => {
    if (!callObject) return;
    
    const newState = !micOn;
    await callObject.setLocalAudio(newState);
    setMicOn(newState);
  }, [callObject, micOn]);

  return {
    isInCall,
    isCreatingRoom,
    incomingCall,
    currentCall,
    cameraOn,
    micOn,
    callObject,
    remoteParticipant,
    startCall,
    answerCall,
    declineCall,
    leaveCall,
    toggleCamera,
    toggleMic,
  };
};
