import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';

export interface ReportModalProps {
  targetType: 'post' | 'user' | 'comment';
  targetId: string;
  onClose: () => void;
}

const REPORT_REASONS = [
  "Spam",
  "Noto'g'ri ma'lumot",
  "Bezorilik yoki tahdid",
  "Mualliflik huquqi buzilishi",
  "Boshqa sabab"
];

export const ReportModal = ({ targetType, targetId, onClose }: ReportModalProps) => {
  const { user } = useAuth();
  const [selectedReason, setSelectedReason] = useState<string>('');
  const [otherReasonText, setOtherReasonText] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!user) return;
    
    if (!selectedReason) {
      toast.error("Iltimos, sababni tanlang");
      return;
    }

    const finalReason = selectedReason === 'Boshqa sabab' 
      ? `Boshqa: ${otherReasonText}` 
      : selectedReason;

    if (selectedReason === 'Boshqa sabab' && !otherReasonText.trim()) {
      toast.error("Iltimos, sababni kiriting");
      return;
    }

    setIsSubmitting(true);
    
    try {
      const { error } = await supabase
        .from('reports' as any) // Type asserted as 'any' to temporarily bypass compiler issue before types gen
        .insert({
          reporter_id: user.id,
          target_type: targetType,
          target_id: targetId,
          reason: finalReason
        });

      if (error) throw error;

      toast.success("Shikoyatingiz qabul qilindi. Tez orada ko'rib chiqamiz.");
      onClose();
    } catch (error) {
      console.error('Error submitting report:', error);
      toast.error("Xatolik yuz berdi. Iltimos keyinroq urinib ko'ring.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open onOpenChange={() => onClose()}>
      <DialogContent className="sm:max-w-md bg-background border-border">
        <DialogHeader>
          <DialogTitle>Shikoyat qilish</DialogTitle>
          <DialogDescription>
            Ushbu kontent bo'yicha nima muammo borligini ko'rsating.
          </DialogDescription>
        </DialogHeader>

        <div className="py-4">
          <RadioGroup value={selectedReason} onValueChange={setSelectedReason} className="space-y-3">
            {REPORT_REASONS.map((reason) => (
              <div key={reason} className="flex items-center space-x-2">
                <RadioGroupItem value={reason} id={`reason-${reason}`} />
                <Label htmlFor={`reason-${reason}`} className="cursor-pointer">{reason}</Label>
              </div>
            ))}
          </RadioGroup>

          {selectedReason === 'Boshqa sabab' && (
            <div className="mt-4">
              <Textarea 
                placeholder="Sababni batafsil yozib qoldiring..."
                value={otherReasonText}
                onChange={(e) => setOtherReasonText(e.target.value)}
                className="resize-none"
                rows={3}
              />
            </div>
          )}
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button variant="outline" onClick={onClose} disabled={isSubmitting} className="w-full sm:w-auto">
            Bekor qilish
          </Button>
          <Button onClick={handleSubmit} disabled={isSubmitting || !selectedReason} className="w-full sm:w-auto">
            {isSubmitting ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : null}
            {!isSubmitting ? 'Yuborish' : 'Yuborilmoqda...'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
