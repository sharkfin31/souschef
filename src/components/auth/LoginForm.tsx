import { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useNotification } from '../../context/NotificationContext';
import { Eye, EyeOff, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

const LoginForm = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { signIn } = useAuth();
  const { addNotification } = useNotification();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!email || !password) {
      addNotification('error', 'Please fill in all fields');
      return;
    }

    setIsSubmitting(true);

    try {
      const { success, error } = await signIn(email, password);

      if (success) {
        addNotification('success', 'Successfully logged in! Redirecting...');
      } else {
        addNotification('error', error || 'Failed to log in');
      }
    } catch {
      addNotification('error', 'An unexpected error occurred');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <h2 className="text-center text-xl font-semibold tracking-tight text-foreground">Sign in</h2>

      <div>
        <Label htmlFor="login-email" className="text-muted-foreground">
          Email
        </Label>
        <Input
          id="login-email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="mt-1.5"
          placeholder="you@example.com"
          autoComplete="email"
          required
        />
      </div>

      <div>
        <Label htmlFor="login-password" className="text-muted-foreground">
          Password
        </Label>
        <div className="relative mt-1.5">
          <Input
            id="login-password"
            type={showPassword ? 'text' : 'password'}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="pr-10"
            placeholder="••••••••"
            autoComplete="current-password"
            required
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="icon-hit absolute right-0 top-1/2 size-9 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            aria-label={showPassword ? 'Hide password' : 'Show password'}
          >
            {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
          </button>
        </div>
      </div>

      <Button type="submit" className={cn('w-full')} disabled={isSubmitting}>
        {isSubmitting ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
        {isSubmitting ? 'Signing in…' : 'Sign in'}
      </Button>
    </form>
  );
};

export default LoginForm;
