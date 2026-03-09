import { useNavigate } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Bell, Users } from 'lucide-react';
import { useFamilyTree } from '@/hooks/useFamilyTree';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { InvitationCard } from '@/components/family/InvitationCard';
import { NotificationsTab } from '@/components/notifications/NotificationsTab';
import { useEffect, useState } from 'react';
import { useNotifications } from '@/hooks/useNotifications';

const Notifications = () => {
  const { user } = useAuth();
  const { t } = useLanguage();
  const { invitations, respondToInvitation } = useFamilyTree();
  const [loadingInvitation, setLoadingInvitation] = useState<string | null>(null);
  const { unreadCount, markAllAsRead } = useNotifications();

  // Filter invitations received by current user
  const receivedInvitations = invitations.filter(inv => inv.receiver_id === user?.id);

  const handleAccept = async (invitationId: string) => {
    setLoadingInvitation(invitationId);
    await respondToInvitation(invitationId, true);
    setLoadingInvitation(null);
  };

  const handleReject = async (invitationId: string) => {
    setLoadingInvitation(invitationId);
    await respondToInvitation(invitationId, false);
    setLoadingInvitation(null);
  };

  useEffect(() => {
    if (unreadCount <= 0) return;
    void markAllAsRead();
  }, [unreadCount, markAllAsRead]);

  return (
    <AppLayout>
      <div className="max-w-lg mx-auto">
        <header className="sticky top-0 bg-background/80 backdrop-blur-sm border-b border-border p-4 z-40">
          <h1 className="text-xl font-bold">{t('notifications')}</h1>
        </header>
        
        <div className="space-y-0">
          {/* Family invitations section */}
          {receivedInvitations.length > 0 && (
            <div className="p-4 border-b border-border">
              <div className="flex items-center gap-2 mb-3">
                <Users className="h-5 w-5 text-primary" />
                <h2 className="font-semibold">{t('familyInvites')}</h2>
              </div>
              <div className="space-y-3">
                {receivedInvitations.map((inv) => (
                  <InvitationCard
                    key={inv.id}
                    invitation={inv}
                    onAccept={() => handleAccept(inv.id)}
                    onReject={() => handleReject(inv.id)}
                    isLoading={loadingInvitation === inv.id}
                  />
                ))}
              </div>
            </div>
          )}

          {/* General notifications */}
          <NotificationsTab />
        </div>
      </div>
    </AppLayout>
  );
};

export default Notifications;
