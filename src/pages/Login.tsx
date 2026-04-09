import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import LoginForm from '../components/auth/LoginForm';
import RegisterForm from '../components/auth/RegisterForm';
import { LogIn, UserPlus } from 'lucide-react';
import { cn } from '@/lib/utils';

const Login = () => {
  const [activeTab, setActiveTab] = useState<'login' | 'register'>('login');
  const { user, loading } = useAuth();

  if (user && !loading) {
    return <Navigate to="/" replace />;
  }

  return (
    <div className="mx-auto w-full max-w-xs sm:max-w-sm">
      <div className="mb-8 text-center">
        <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">Let's get cooking!</h1>
      </div>

      <div className="mb-6 flex justify-center">
        <div
          className="inline-flex rounded-full border border-border bg-muted/40 p-1 shadow-sm"
          role="tablist"
          aria-label="Authentication"
        >
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'login'}
            onClick={() => setActiveTab('login')}
            className={cn(
              'inline-flex items-center gap-2 rounded-full px-5 py-2 text-sm font-medium transition-colors',
              activeTab === 'login'
                ? 'bg-primary text-primary-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            <LogIn className="size-4 shrink-0" aria-hidden />
            Sign in
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'register'}
            onClick={() => setActiveTab('register')}
            className={cn(
              'inline-flex items-center gap-2 rounded-full px-5 py-2 text-sm font-medium transition-colors',
              activeTab === 'register'
                ? 'bg-primary text-primary-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            <UserPlus className="size-4 shrink-0" aria-hidden />
            Register
          </button>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-border bg-card shadow-md">
        <div className="px-5 py-6 sm:px-6 sm:py-7">
          {activeTab === 'login' ? <LoginForm /> : <RegisterForm onSwitchToLogin={() => setActiveTab('login')} />}
        </div>
      </div>
    </div>
  );
};

export default Login;
