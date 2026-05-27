import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Loader2, Users, AlertCircle, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';

interface InviteDetails {
  id: string;
  invited_by: string;
  tree_node_id: string;
  relation_type: string;
  status: string;
  sender_name?: string;
  sender_avatar?: string;
}

export default function InviteAccept() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const { user, isAuthenticated, isLoading: isAuthLoading } = useAuth();
  
  const [invite, setInvite] = useState<InviteDetails | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isAccepting, setIsAccepting] = useState(false);

  useEffect(() => {
    const fetchInvite = async () => {
      if (!token) {
        setError("Havola yaroqsiz.");
        setIsLoading(false);
        return;
      }

      try {
        const { data, error: fetchError } = await (supabase as any)
          .from('family_invites')
          .select('*, profiles!invited_by(name, avatar_url)')
          .eq('token', token)
          .single();

        if (fetchError || !data) {
          throw new Error("Taklifnoma topilmadi yoki muddati o'tgan.");
        }

        if (data.status !== 'pending') {
          throw new Error("Taklifnoma allaqachon qabul qilingan yoki bekor qilingan.");
        }

        setInvite({
          id: data.id,
          invited_by: data.invited_by,
          tree_node_id: data.tree_node_id,
          relation_type: data.relation_type,
          status: data.status,
          sender_name: data.profiles?.name || "Noma'lum foydalanuvchi",
          sender_avatar: data.profiles?.avatar_url,
        });

      } catch (err) {
        if (err instanceof Error) {
          setError(err.message || "Xatolik yuz berdi");
        } else {
          setError("Xatolik yuz berdi");
        }
      } finally {
        setIsLoading(false);
      }
    };

    fetchInvite();
  }, [token]);

  // If the user accepts, update the DB and link the profile
  const handleAccept = async () => {
    if (!user || !invite || isAccepting) return;
    
    setIsAccepting(true);
    try {
      // 1. Update invite status to accepted
      const { error: updateError } = await (supabase as any)
        .from('family_invites')
        .update({ status: 'accepted' })
        .eq('id', invite.id);
        
      if (updateError) throw updateError;

      const { error: memberError } = await (supabase as any)
        .from('family_members')
        .update({ linked_user_id: user.id })
        .eq('id', invite.tree_node_id);

      if (memberError) {
        console.error("Link member error:", memberError);
        // It might fail if RLS prevents editing other users' members. 
        // In a real app, you might need an edge function or bypassed policy for this specific action.
        throw new Error("Daraxtga ulanishda xatolik yuz berdi.");
      }

      toast.success("Oila daraxtiga muvaffaqiyatli qo'shildingiz!");
      navigate('/relatives');

    } catch (err) {
      if (err instanceof Error) {
        toast.error(err.message || "Xatolik ro'y berdi.");
        setError(err.message || "Xatolik ro'y berdi.");
      } else {
        toast.error("Xatolik ro'y berdi.");
        setError("Xatolik ro'y berdi.");
      }
    } finally {
      setIsAccepting(false);
    }
  };

  const handleRegisterLogin = () => {
    // Store token in localStorage or sessionStorage to redirect back after auth
    sessionStorage.setItem('pending_invite_token', token || '');
    navigate('/auth');
  };

  if (isAuthLoading || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-background">
        <div className="max-w-md w-full text-center space-y-6">
          <div className="w-16 h-16 bg-destructive/10 rounded-full flex items-center justify-center mx-auto">
            <AlertCircle className="h-8 w-8 text-destructive" />
          </div>
          <h1 className="text-2xl font-bold">Xatolik</h1>
          <p className="text-muted-foreground">{error}</p>
          <Button onClick={() => navigate('/')} className="w-full h-12 rounded-xl">
            Bosh sahifaga qaytish
          </Button>
        </div>
      </div>
    );
  }

  if (!invite) return null;

  return (
    <div className="min-h-[100dvh] flex flex-col items-center justify-center p-4 bg-muted/20">
      <div className="w-full max-w-md bg-background rounded-3xl p-6 shadow-xl border border-border/50 text-center space-y-6">
        <div className="mx-auto w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center border-4 border-background shadow-inner">
          {invite.sender_avatar ? (
            <img 
              src={invite.sender_avatar} 
              alt={invite.sender_name} 
              className="w-full h-full rounded-full object-cover"
            />
          ) : (
            <Users className="h-10 w-10 text-primary" />
          )}
        </div>
        
        <div className="space-y-2">
          <h1 className="text-2xl font-bold tracking-tight">Oila daraxtiga taklif</h1>
          <p className="text-muted-foreground">
            <span className="font-semibold text-foreground">{invite.sender_name}</span> sizni o'zining oila daraxtiga {invite.relation_type && invite.relation_type !== "family_member" && invite.relation_type !== "oila a'zosi" ? <span className="font-semibold text-foreground">"{invite.relation_type}" sifatida</span> : "qo'shilishga"} taklif qilmoqda.
          </p>
        </div>

        <div className="bg-muted rounded-2xl p-4 text-sm flex items-start gap-3">
          <CheckCircle2 className="h-5 w-5 text-emerald-500 shrink-0 mt-0.5" />
          <p className="text-left text-muted-foreground">
            Ushbu taklifni qabul qilsangiz, sizning profilingiz ularning oila daraxtiga biriktiriladi va qarindoshlik rishtalaringiz saqlanadi.
          </p>
        </div>

        <div className="pt-4 space-y-3">
          {isAuthenticated ? (
            <>
              <Button 
                onClick={handleAccept} 
                className="w-full h-12 rounded-xl text-md font-bold"
                disabled={isAccepting}
              >
                {isAccepting ? <Loader2 className="h-5 w-5 animate-spin mx-auto"/> : "Taklifni qabul qilish"}
              </Button>
              <Button 
                variant="ghost" 
                onClick={() => navigate('/')} 
                className="w-full h-12 rounded-xl text-muted-foreground"
                disabled={isAccepting}
              >
                Rad etish
              </Button>
            </>
          ) : (
            <>
              <Button 
                onClick={handleRegisterLogin} 
                className="w-full h-12 rounded-xl text-md font-bold"
              >
                Kirish / Ro'yxatdan o'tish
              </Button>
              <p className="text-xs text-muted-foreground px-4">
                Taklifni qabul qilish uchun avlodona.app ilovasiga kirishingiz kerak
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
