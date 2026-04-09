import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import { Check, KeyRound, Loader2, LogOut, Pencil, User, X } from 'lucide-react';
import { format } from 'date-fns';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { TooltipTrigger } from '@/components/ui/tooltip';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface ProfileData {
  id: string;
  full_name: string;
  phone_number: string;
  avatar_url: string | null;
  created_at: string;
}

const Profile = () => {
  const { user, signOut } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [fullName, setFullName] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [isEditingProfile, setIsEditingProfile] = useState(false);

  const [newPassword, setNewPassword] = useState('');
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [passwordModalOpen, setPasswordModalOpen] = useState(false);

  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const closePasswordModal = () => {
    setPasswordModalOpen(false);
    setNewPassword('');
  };

  useEffect(() => {
    if (message) {
      const timer = setTimeout(() => {
        setMessage(null);
      }, 5000);

      return () => clearTimeout(timer);
    }
  }, [message]);

  useEffect(() => {
    const fetchProfile = async () => {
      if (!user) {
        setLoading(false);
        return;
      }

      try {
        const { data, error } = await supabase.from('profiles').select('*').eq('id', user.id).single();

        if (error) {
          console.error('Error fetching profile:', error);
          throw error;
        }

        setProfile(data);
        setFullName(data.full_name || '');
        setPhoneNumber(data.phone_number || '');
      } catch (error) {
        console.error('Error:', error);
        setMessage({ type: 'error', text: 'Failed to load profile data' });
      } finally {
        setLoading(false);
      }
    };

    fetchProfile();
  }, [user]);

  const startEditProfile = () => {
    setIsEditingProfile(true);
  };

  const cancelEditProfile = () => {
    if (profile) {
      setFullName(profile.full_name || '');
      setPhoneNumber(profile.phone_number || '');
    }
    setIsEditingProfile(false);
  };

  const saveProfile = async () => {
    if (!user?.id) return;

    if (!phoneNumber.match(/^\+?[1-9]\d{1,14}$/)) {
      setMessage({
        type: 'error',
        text: 'Please enter a valid phone number in international format (e.g., +12345678901)',
      });
      return;
    }

    setMessage(null);
    setSaving(true);

    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          full_name: fullName,
          phone_number: phoneNumber,
          updated_at: new Date().toISOString(),
        })
        .eq('id', user.id);

      if (error) {
        throw error;
      }

      setProfile((prev) =>
        prev ? { ...prev, full_name: fullName, phone_number: phoneNumber } : null
      );
      setIsEditingProfile(false);
      setMessage({ type: 'success', text: 'Profile updated successfully' });
    } catch (error) {
      console.error('Error updating profile:', error);
      setMessage({ type: 'error', text: 'Failed to update profile' });
    } finally {
      setSaving(false);
    }
  };

  const handleUpdatePassword = async () => {
    if (!newPassword) {
      setMessage({ type: 'error', text: 'Please enter a new password' });
      return;
    }

    if (newPassword.length < 6) {
      setMessage({ type: 'error', text: 'Password must be at least 6 characters' });
      return;
    }

    setMessage(null);
    setIsChangingPassword(true);

    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (error) {
        throw error;
      }

      closePasswordModal();
      setMessage({ type: 'success', text: 'Password updated successfully' });
    } catch (error) {
      console.error('Error updating password:', error);
      setMessage({ type: 'error', text: 'Failed to update password' });
    } finally {
      setIsChangingPassword(false);
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut();
    } catch (error) {
      console.error('Error signing out:', error);
      setMessage({ type: 'error', text: 'Failed to sign out' });
    }
  };

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="size-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="rounded-xl border border-dashed border-muted-foreground/25 bg-muted/30 p-10 text-center">
        <p className="text-muted-foreground">Please sign in to view your profile.</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl">
      <div className="overflow-hidden rounded-xl border border-border bg-card shadow-md">
        <div className="flex flex-col gap-4 border-b border-border bg-muted/30 px-6 py-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-center gap-4">
            <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-full bg-primary text-primary-foreground">
              {profile?.avatar_url ? (
                <img
                  src={profile.avatar_url}
                  alt={profile.full_name || 'User'}
                  className="h-16 w-16 object-cover"
                />
              ) : (
                <User className="size-8" />
              )}
            </div>
            <div className="min-w-0">
              <h1 className="text-2xl font-bold tracking-tight text-foreground">
                {profile?.full_name || user?.email}
              </h1>
              <p className="text-sm text-muted-foreground">
                Member since{' '}
                {user?.created_at ? format(new Date(user.created_at), 'MMMM yyyy') : 'recently'}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 sm:justify-end">
            {isEditingProfile ? (
              <>
                <TooltipTrigger label="Save changes">
                  <button
                    type="button"
                    onClick={saveProfile}
                    disabled={saving}
                    className="icon-hit text-primary"
                    aria-label="Save changes"
                  >
                    {saving ? <Loader2 className="size-5 animate-spin" /> : <Check className="size-5" />}
                  </button>
                </TooltipTrigger>
                <TooltipTrigger label="Cancel">
                  <button
                    type="button"
                    onClick={cancelEditProfile}
                    disabled={saving}
                    className="icon-hit text-muted-foreground"
                    aria-label="Cancel editing"
                  >
                    <X className="size-5" />
                  </button>
                </TooltipTrigger>
              </>
            ) : (
              <TooltipTrigger label="Edit profile">
                <button
                  type="button"
                  onClick={startEditProfile}
                  className="icon-hit text-muted-foreground hover:text-primary"
                  aria-label="Edit profile"
                >
                  <Pencil className="size-5" />
                </button>
              </TooltipTrigger>
            )}
            <TooltipTrigger label="Change password">
              <button
                type="button"
                onClick={() => setPasswordModalOpen(true)}
                className="icon-hit text-muted-foreground hover:text-primary"
                aria-label="Change password"
              >
                <KeyRound className="size-5" />
              </button>
            </TooltipTrigger>
            <TooltipTrigger label="Sign out">
              <button
                type="button"
                onClick={handleSignOut}
                className="icon-hit text-muted-foreground"
                aria-label="Sign out"
              >
                <LogOut className="size-5" />
              </button>
            </TooltipTrigger>
          </div>
        </div>

        {message ? (
          <div
            className={cn(
              'border-b border-border px-6 py-3 text-sm font-medium',
              message.type === 'success'
                ? 'bg-emerald-500/10 text-emerald-900 dark:text-emerald-100'
                : 'bg-destructive/10 text-destructive'
            )}
          >
            {message.text}
          </div>
        ) : null}

        <div className="p-6">
          <section>
            <h2 className="mb-4 border-b border-border pb-2 text-lg font-semibold text-foreground">
              Profile information
            </h2>

            <div className="space-y-4">
              <div>
                <Label htmlFor="profile-email" className="text-muted-foreground">
                  Email
                </Label>
                <Input
                  id="profile-email"
                  type="email"
                  value={user?.email || ''}
                  disabled
                  className="mt-1.5 bg-muted/50"
                />
              </div>

              <div>
                <Label htmlFor="profile-name" className="text-muted-foreground">
                  Full name
                </Label>
                <Input
                  id="profile-name"
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  disabled={!isEditingProfile}
                  className={cn('mt-1.5', !isEditingProfile && 'bg-muted/50')}
                  placeholder="Your name"
                />
              </div>

              <div>
                <Label htmlFor="profile-phone" className="text-muted-foreground">
                  Phone number
                </Label>
                <Input
                  id="profile-phone"
                  type="tel"
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                  disabled={!isEditingProfile}
                  className={cn('mt-1.5', !isEditingProfile && 'bg-muted/50')}
                  placeholder="+12345678901"
                />
                {isEditingProfile ? (
                  <p className="mt-1.5 text-xs text-muted-foreground">International format, e.g. +12345678901</p>
                ) : null}
              </div>
            </div>
          </section>
        </div>
      </div>

      <Dialog
        open={passwordModalOpen}
        onOpenChange={(open) => {
          if (open) {
            setPasswordModalOpen(true);
          } else if (!isChangingPassword) {
            closePasswordModal();
          }
        }}
      >
        <DialogContent
          overlayClassName="bg-black/20 backdrop-blur-sm supports-backdrop-filter:backdrop-blur-sm"
          className="sm:max-w-md"
          showCloseButton={false}
        >
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg">
              <KeyRound className="size-5 text-muted-foreground" aria-hidden />
              Change password
            </DialogTitle>
            <DialogDescription>
              New password must be at least 6 characters.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-1">
              <Input
                id="profile-modal-new-password"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="mt-1.5"
                placeholder="..."
                autoComplete="new-password"
                disabled={isChangingPassword}
              />
            </div>
          <div className="flex flex-row justify-center gap-4 border-t border-border pt-4">
            <TooltipTrigger label="Cancel">
              <button
                type="button"
                onClick={closePasswordModal}
                disabled={isChangingPassword}
                className="icon-hit text-muted-foreground"
                aria-label="Cancel"
              >
                <X className="size-5" />
              </button>
            </TooltipTrigger>
            <TooltipTrigger label="Save">
              <button
                type="button"
                onClick={handleUpdatePassword}
                disabled={isChangingPassword || !newPassword}
                className="icon-hit text-primary"
                aria-label="Save new password"
              >
                {isChangingPassword ? (
                  <Loader2 className="size-5 animate-spin" />
                ) : (
                  <Check className="size-5" />
                )}
              </button>
            </TooltipTrigger>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Profile;
