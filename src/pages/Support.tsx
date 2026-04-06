import { useState } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Loader2, ArrowLeft, Send } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const Support = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!subject.trim() || !message.trim()) {
      toast.error('Iltimos, barcha maydonlarni toldiring');
      return;
    }

    setIsSubmitting(true);

    try {
      const { data, error } = await supabase.functions.invoke('send-support-email', {
        body: {
          subject: subject.trim(),
          message: message.trim(),
          userEmail: user?.email || '',
        },
      });

      if (error) {
        throw error;
      }

      toast.success('Murojaatingiz muvaffaqiyatli yuborildi!');
      setSubject('');
      setMessage('');
      navigate(-1); // or go to home navigate('/')
    } catch (err: any) {
      console.error('Error submitting support ticket:', err);
      toast.error('Xatolik yuz berdi. Iltimos keyinroq urinib koring.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AppLayout showNav={false}>
      <div className="max-w-md mx-auto p-4 min-h-screen">
        <div className="flex items-center gap-3 mb-6 sticky top-0 bg-background/80 backdrop-blur-md pb-4 pt-2 z-10">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-xl font-bold">Qo'llab-quvvatlash</h1>
        </div>

        <div className="space-y-6">
          <div className="text-muted-foreground text-sm space-y-2">
            <p>Biz bilan bog'laning. Fikr-muloxazalar, takliflar yoki muammolar bo'lsa darhol yordam berishga tayyormiz.</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="subject">Mavzu</Label>
              <Input
                id="subject"
                placeholder="Nima haqida ekanligini qisqacha yozing..."
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                maxLength={100}
                className="bg-background"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="message">Xabar</Label>
              <Textarea
                id="message"
                placeholder="Muammo yoki taklifingizni batafsil yozing..."
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={6}
                className="resize-none bg-background"
              />
            </div>

            <Button 
              type="submit" 
              className="w-full h-12 rounded-xl text-md font-bold mt-4" 
              disabled={isSubmitting || !subject.trim() || !message.trim()}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  Yuborilmoqda...
                </>
              ) : (
                <>
                  <Send className="mr-2 h-5 w-5" />
                  Yuborish
                </>
              )}
            </Button>
          </form>
        </div>
      </div>
    </AppLayout>
  );
};

export default Support;
