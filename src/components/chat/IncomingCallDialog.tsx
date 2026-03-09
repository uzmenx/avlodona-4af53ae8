import { useEffect, useState } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Phone, PhoneOff } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { playRingtone, stopRingtone, showLocalCallNotification } from '@/lib/pushNotifications';

interface IncomingCallDialogProps {
  callerId: string;
  onAnswer: () => void;
  onDecline: () => void;
}

export const IncomingCallDialog = ({
  callerId,
  onAnswer,
  onDecline,
}: IncomingCallDialogProps) => {
  const [callerProfile, setCallerProfile] = useState<{
    name: string | null;
    avatar_url: string | null;
  } | null>(null);

  useEffect(() => {
    const fetchCallerProfile = async () => {
      const { data } = await supabase
        .from('profiles')
        .select('name, avatar_url')
        .eq('id', callerId)
        .maybeSingle();
      
      setCallerProfile(data);
      
      // Play ringtone and show notification
      playRingtone();
      if (data?.name) {
        showLocalCallNotification(data.name, callerId);
      }
    };

    fetchCallerProfile();

    return () => {
      stopRingtone();
    };
  }, [callerId]);

  const getInitials = (name: string | null) => {
    if (!name) return 'U';
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  const handleAnswer = () => {
    stopRingtone();
    onAnswer();
  };

  const handleDecline = () => {
    stopRingtone();
    onDecline();
  };

  return (
    <Dialog open onOpenChange={() => {}}>
      <DialogContent className="max-w-sm [&>button]:hidden">
        <div className="text-center py-6">
          {/* Pulsating ring animation */}
          <div className="relative mx-auto mb-6 w-28 h-28 flex items-center justify-center">
            <div className="absolute inset-0 rounded-full bg-primary/20 animate-ping" style={{ animationDuration: '1.5s' }} />
            <div className="absolute inset-2 rounded-full bg-primary/10 animate-ping" style={{ animationDuration: '2s', animationDelay: '0.3s' }} />
            <Avatar className="h-24 w-24 ring-4 ring-primary/30 relative z-10">
              <AvatarImage src={callerProfile?.avatar_url || undefined} />
              <AvatarFallback className="text-2xl">
                {getInitials(callerProfile?.name)}
              </AvatarFallback>
            </Avatar>
          </div>
          
          <h2 className="text-xl font-semibold mb-1">
            {callerProfile?.name || 'Foydalanuvchi'}
          </h2>
          <p className="text-muted-foreground mb-8">
            📹 Video qo'ng'iroq qilmoqda...
          </p>

          <div className="flex items-center justify-center gap-6">
            <Button
              variant="destructive"
              size="lg"
              className="h-16 w-16 rounded-full"
              onClick={handleDecline}
            >
              <PhoneOff className="h-7 w-7" />
            </Button>

            <Button
              size="lg"
              className="h-16 w-16 rounded-full bg-green-500 hover:bg-green-600"
              onClick={handleAnswer}
            >
              <Phone className="h-7 w-7" />
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
