import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { LanguageProvider } from "@/contexts/LanguageContext";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { PushNotification } from "@/components/notifications/PushNotification";
import { PlanOverlay } from "@/components/subscription/PlanOverlay";
import { ErrorBoundary } from "react-error-boundary";
import { ErrorFallback } from "@/components/ui/ErrorFallback";


import Home from "./pages/Home";
import AuthLogin from "./pages/AuthLogin";
import Signup from "./pages/Signup";
import VerifyOtp from "./pages/VerifyOtp";
import PhoneAuth from "./pages/PhoneAuth";
import Profile from "./pages/Profile";
import EditProfile from "./pages/EditProfile";
import Settings from "./pages/Settings";
import Relatives from "./pages/Relatives";
import CreateStory from "./pages/CreateStory";
import CreateContent from "./pages/CreateContent";
import Notifications from "./pages/Notifications";
import UserProfile from "./pages/UserProfile";
import Messages from "./pages/Messages";
import Chat from "./pages/Chat";
import AIChat from "./pages/AIChat";
import GroupChat from "./pages/GroupChat";
import JoinGroup from "./pages/JoinGroup";
import NotFound from "./pages/NotFound";
import AuthCallback from "./pages/AuthCallback";
import PrivacyPolicy from "./pages/PrivacyPolicy";
import Terms from "./pages/Terms";
import InviteAccept from "./pages/InviteAccept";

const queryClient = new QueryClient();
const FIRST_VISIT_KEY = 'avlodona:first-visit:v1';

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { isAuthenticated, isLoading } = useAuth();
  
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }
  
  if (!isAuthenticated) {
    return <Navigate to="/auth" replace />;
  }
  
  return <>{children}</>;
};

const PublicRoute = ({ children }: { children: React.ReactNode }) => {
  const { isAuthenticated, isLoading } = useAuth();
  const location = useLocation();
  
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }
  
  if (isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  if (location.pathname === '/auth') {
    try {
      const isFirstVisit = localStorage.getItem(FIRST_VISIT_KEY) === null;
      if (isFirstVisit) {
        localStorage.setItem(FIRST_VISIT_KEY, '1');
        return <Navigate to="/signup" replace />;
      }
    } catch {
      // ignore
    }
  }
  
  return <>{children}</>;
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <ThemeProvider>
        <LanguageProvider>
        <AuthProvider>
          <Toaster />
          <Sonner />
          <PlanOverlay />
          <BrowserRouter>
            <PushNotification />
            <ErrorBoundary 
              FallbackComponent={ErrorFallback}
              onReset={() => {
                window.location.reload();
              }}
            >
              <Routes>
                <Route path="/auth" element={<PublicRoute><AuthLogin /></PublicRoute>} />
                <Route path="/signup" element={<PublicRoute><Signup /></PublicRoute>} />
                <Route path="/verify-otp" element={<PublicRoute><VerifyOtp /></PublicRoute>} />
                <Route path="/phone-auth" element={<PublicRoute><PhoneAuth /></PublicRoute>} />
                <Route path="/auth/callback" element={<AuthCallback />} />
                <Route path="/privacy-policy" element={<PrivacyPolicy />} />
                <Route path="/terms" element={<Terms />} />
                <Route path="/" element={<ProtectedRoute><Home /></ProtectedRoute>} />
                <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
                <Route path="/edit-profile" element={<ProtectedRoute><EditProfile /></ProtectedRoute>} />
                <Route path="/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
                <Route path="/relatives" element={<ProtectedRoute><Relatives /></ProtectedRoute>} />
                <Route path="/create" element={<ProtectedRoute><CreateContent /></ProtectedRoute>} />
                <Route path="/create-post" element={<Navigate to="/create" replace />} />
                <Route path="/create-story" element={<ProtectedRoute><CreateStory /></ProtectedRoute>} />
                <Route path="/notifications" element={<ProtectedRoute><Notifications /></ProtectedRoute>} />
                <Route path="/user/:userId" element={<ProtectedRoute><UserProfile /></ProtectedRoute>} />
                <Route path="/messages" element={<ProtectedRoute><Messages /></ProtectedRoute>} />
                <Route path="/chat/:userId" element={<ProtectedRoute><Chat /></ProtectedRoute>} />
                <Route path="/ai-chat" element={<ProtectedRoute><AIChat /></ProtectedRoute>} />
                <Route path="/group-chat/:groupId" element={<ProtectedRoute><GroupChat /></ProtectedRoute>} />
                <Route path="/join/:inviteLink" element={<ProtectedRoute><JoinGroup /></ProtectedRoute>} />
                <Route path="/invite/:token" element={<InviteAccept />} />
                <Route path="*" element={<NotFound />} />
              </Routes>
            </ErrorBoundary>
          </BrowserRouter>
        </AuthProvider>
        </LanguageProvider>
      </ThemeProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
