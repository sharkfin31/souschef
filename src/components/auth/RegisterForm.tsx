import { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useNotification } from '../../context/NotificationContext';
import { Eye, EyeOff, HelpCircle, Loader2 } from 'lucide-react';
import WhatsAppHelpModal from './WhatsAppHelpModal';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

interface RegisterFormProps {
  onSwitchToLogin: () => void;
}

const RegisterForm = ({ onSwitchToLogin }: RegisterFormProps) => {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [whatsappApiKey, setWhatsappApiKey] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showWhatsAppHelp, setShowWhatsAppHelp] = useState(false);

  const { signUp } = useAuth();
  const { addNotification } = useNotification();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!fullName || !email || !phoneNumber || !whatsappApiKey || !password || !confirmPassword) {
      addNotification('error', 'Please fill in all fields');
      return;
    }

    if (password !== confirmPassword) {
      addNotification('error', 'Passwords do not match');
      return;
    }

    if (password.length < 6) {
      addNotification('error', 'Password must be at least 6 characters');
      return;
    }

    if (!phoneNumber.match(/^\+?[1-9]\d{1,14}$/)) {
      addNotification(
        'error',
        'Please enter a valid phone number in international format (e.g., +12345678901)'
      );
      return;
    }

    setIsSubmitting(true);

    try {
      const { success, error } = await signUp(email, password, fullName, phoneNumber, whatsappApiKey);

      if (success) {
        if (error) {
          addNotification('success', error);
          setTimeout(() => {
            onSwitchToLogin();
          }, 3000);
        } else {
          addNotification('success', 'Registration successful! Welcome to souschef!');
        }
      } else {
        addNotification('error', error || 'Failed to register');
      }
    } catch {
      addNotification('error', 'An unexpected error occurred');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <form onSubmit={handleSubmit} className="space-y-5">
        <h2 className="text-center text-xl font-semibold tracking-tight text-foreground">Create account</h2>

        <div>
          <Label htmlFor="register-fullName" className="text-muted-foreground">
            Full name
          </Label>
          <Input
            id="register-fullName"
            type="text"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            className="mt-1.5"
            placeholder="Jane Doe"
            autoComplete="name"
            required
          />
        </div>

        <div>
          <Label htmlFor="register-email" className="text-muted-foreground">
            Email
          </Label>
          <Input
            id="register-email"
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
          <Label htmlFor="register-phone" className="text-muted-foreground">
            Phone number
          </Label>
          <Input
            id="register-phone"
            type="tel"
            value={phoneNumber}
            onChange={(e) => setPhoneNumber(e.target.value)}
            className="mt-1.5"
            placeholder="+12345678901"
            autoComplete="tel"
            required
          />
        </div>

        <div>
          <div className="mb-2 flex items-center justify-between gap-2">
            <Label htmlFor="register-whatsapp" className="text-muted-foreground">
              WhatsApp API key
            </Label>
            <button
              type="button"
              onClick={() => setShowWhatsAppHelp(true)}
              className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:text-primary/90"
            >
              <HelpCircle className="size-3.5 shrink-0" aria-hidden />
            </button>
          </div>
          <Input
            id="register-whatsapp"
            type="text"
            value={whatsappApiKey}
            onChange={(e) => setWhatsappApiKey(e.target.value)}
            className="mt-0"
            placeholder="••••••••"
            autoComplete="off"
            required
          />
        </div>

        <div>
          <Label htmlFor="register-password" className="text-muted-foreground">
            Password
          </Label>
          <div className="relative mt-1.5">
            <Input
              id="register-password"
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="pr-10"
              placeholder="••••••••"
              autoComplete="new-password"
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

        <div>
          <Label htmlFor="register-confirm" className="text-muted-foreground">
            Confirm password
          </Label>
          <div className="relative mt-1.5">
            <Input
              id="register-confirm"
              type={showConfirmPassword ? 'text' : 'password'}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="pr-10"
              placeholder="••••••••"
              autoComplete="new-password"
              required
            />
            <button
              type="button"
              onClick={() => setShowConfirmPassword(!showConfirmPassword)}
              className="icon-hit absolute right-0 top-1/2 size-9 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
            >
              {showConfirmPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
            </button>
          </div>
        </div>

        <Button type="submit" className={cn('w-full')} disabled={isSubmitting}>
          {isSubmitting ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
          {isSubmitting ? 'Creating account…' : 'Create account'}
        </Button>
      </form>

      <WhatsAppHelpModal isOpen={showWhatsAppHelp} onClose={() => setShowWhatsAppHelp(false)} />
    </>
  );
};

export default RegisterForm;
