import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Phone, PhoneOff } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { playRingtone, stopRingtone, showLocalCallNotification } from '@/lib/pushNotifications';
import { useVideoCall } from '@/hooks/useVideoCall';

export const IncomingCallOverlay = () => {
  const navigate = useNavigate();
  // Pass null to useVideoCall to just listen to our incoming calls globally
  const { incomingCall, declineCall } = useVideoCall(null);
  
  const [callerProfile, setCallerProfile] = useState<{
    name: string | null;
    avatar_url: string | null;
  } | null>(null);

  useEffect(() => {
    if (!incomingCall) {
      setCallerProfile(null);
      stopRingtone();
      return;
    }

    const fetchCallerProfile = async () => {
      const { data } = await supabase
        .from('profiles')
        .select('name, avatar_url')
        .eq('id', incomingCall.caller_id)
        .maybeSingle();
      
      setCallerProfile(data);
      
      // Play ringtone and show push notification (if local)
      playRingtone();
      if (data?.name) {
        showLocalCallNotification(data.name, incomingCall.caller_id);
      }
    };

    fetchCallerProfile();

    return () => {
      stopRingtone();
    };
  }, [incomingCall]);

  const getInitials = (name: string | null) => {
    if (!name) return 'U';
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  const handleAnswer = () => {
    stopRingtone();
    if (incomingCall) {
      // Navigate to chat and instruct it to answer immediately
      navigate(`/chat/${incomingCall.caller_id}?answerCall=true`);
    }
  };

  const handleDecline = () => {
    stopRingtone();
    declineCall();
  };

  if (!incomingCall) return null;

  return (
    <div className="fixed inset-0 z-[9999] bg-black/90 backdrop-blur-xl flex flex-col items-center justify-center animate-in fade-in duration-300">
      
      {/* WhatsApp / Telegram style full screen blur background */}
      {callerProfile?.avatar_url && (
        <div 
          className="absolute inset-0 opacity-20 bg-cover bg-center"
          style={{ backgroundImage: `url(${callerProfile.avatar_url})`, filter: 'blur(40px)' }}
        />
      )}
      
      <div className="relative z-10 flex flex-col items-center justify-center w-full max-w-sm px-6 text-white text-center">
        
        {/* Title */}
        <p className="text-white/70 text-sm tracking-widest uppercase font-semibold mb-12 animate-pulse">
          Kiruvchi qo'ng'iroq
        </p>

        {/* Pulsating Avatar */}
        <div className="relative mx-auto mb-8 w-36 h-36 flex items-center justify-center">
          <div className="absolute inset-0 rounded-full bg-green-500/20 animate-ping" style={{ animationDuration: '2s' }} />
          <div className="absolute inset-4 rounded-full bg-green-500/30 animate-ping" style={{ animationDuration: '2s', animationDelay: '0.5s' }} />
          
          <Avatar className="h-32 w-32 ring-4 ring-green-500/50 shadow-2xl relative z-10">
            <AvatarImage src={callerProfile?.avatar_url || undefined} />
            <AvatarFallback className="text-4xl bg-white/10 text-white">
              {getInitials(callerProfile?.name)}
            </AvatarFallback>
          </Avatar>
        </div>
        
        <h2 className="text-3xl font-bold mb-2 tracking-tight">
          {callerProfile?.name || 'Foydalanuvchi'}
        </h2>
        <p className="text-white/60 mb-16 text-lg">
          Video suhbat
        </p>

        {/* Action Buttons */}
        <div className="flex items-center justify-between w-full max-w-[280px]">
          <div className="flex flex-col items-center gap-3">
            <Button
              variant="destructive"
              size="lg"
              className="h-16 w-16 rounded-full shadow-lg shadow-red-500/20 hover:scale-105 active:scale-95 transition-all"
              onClick={handleDecline}
            >
              <PhoneOff className="h-7 w-7" />
            </Button>
            <span className="text-white/70 text-xs font-semibold">Rad etish</span>
          </div>

          <div className="flex flex-col items-center gap-3">
            <Button
              size="lg"
              className="h-16 w-16 rounded-full bg-green-500 hover:bg-green-600 shadow-lg shadow-green-500/20 hover:scale-105 active:scale-95 transition-all"
              onClick={handleAnswer}
            >
              <Phone className="h-7 w-7 animate-bounce" style={{ animationDuration: '2s' }} />
            </Button>
            <span className="text-white/70 text-xs font-semibold">Javob berish</span>
          </div>
        </div>

      </div>
    </div>
  );
};
