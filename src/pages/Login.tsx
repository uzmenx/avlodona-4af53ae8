import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';

// Redirect to new auth system
const Login = () => {
  const navigate = useNavigate();
  const { isAuthenticated, isLoading } = useAuth();

  useEffect(() => {
    if (!isLoading) {
      if (isAuthenticated) {
        navigate('/');
      } else {
        navigate('/auth');
      }
    }
  }, [isAuthenticated, isLoading, navigate]);

  return null;
};

export default Login;
