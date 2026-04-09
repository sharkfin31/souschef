import { useState, useEffect } from 'react';
import { AlertCircle, Check, ListChecks, Loader2, Share2, Smartphone } from 'lucide-react';
import { GroceryList as GroceryListType } from '../types/recipe';
import { supabase } from '../lib/supabase';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';

interface ShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  lists: GroceryListType[];
  onShare: (listIds: string[], phoneNumber?: string) => Promise<void>;
  /** When the modal opens, pre-check these list ids (e.g. from sidebar share selection). */
  initialSelectedListIds?: string[];
}

const ShareListsModal = ({
  isOpen,
  onClose,
  lists,
  onShare,
  initialSelectedListIds = [],
}: ShareModalProps) => {
  const [selectedLists, setSelectedLists] = useState<string[]>([]);
  const [userPhoneNumber, setUserPhoneNumber] = useState<string>('');
  const [loadingPhone, setLoadingPhone] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    fetchUserPhoneNumber();
    setSelectedLists([...initialSelectedListIds]);
    setError(null);
    // Preselection is applied when the dialog opens; list ids come from parent state at open time.
  }, [isOpen, initialSelectedListIds]);

  const fetchUserPhoneNumber = async () => {
    setLoadingPhone(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) {
        const { data, error: profileError } = await supabase
          .from('profiles')
          .select('phone_number')
          .eq('id', user.id)
          .single();

        if (data && !profileError) {
          setUserPhoneNumber(data.phone_number || '');
        }
      }
    } catch (err) {
      console.error('Error fetching user phone number:', err);
      setError('Failed to load your phone number from profile');
    } finally {
      setLoadingPhone(false);
    }
  };

  const handleClose = () => {
    setSelectedLists([]);
    setUserPhoneNumber('');
    setError(null);
    onClose();
  };

  const handleOpenChange = (open: boolean) => {
    if (!open) handleClose();
  };

  const handleSelectList = (listId: string) => {
    setSelectedLists((prev) =>
      prev.includes(listId) ? prev.filter((id) => id !== listId) : [...prev, listId]
    );
  };

  const handleShare = async () => {
    if (selectedLists.length === 0) {
      setError('Please select at least one list to share');
      return;
    }

    if (!userPhoneNumber) {
      setError(
        'No phone number found in your profile. Please update your profile with a phone number first.'
      );
      return;
    }

    setError(null);
    setSharing(true);

    try {
      await onShare(selectedLists, userPhoneNumber);
      handleClose();
    } catch (err) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('Failed to share lists');
      }
    } finally {
      setSharing(false);
    }
  };

  const canShare =
    selectedLists.length > 0 && !!userPhoneNumber && !loadingPhone && !sharing;

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogContent className="gap-0 overflow-hidden pb-2 pt-4 sm:max-w-md" showCloseButton>
        <DialogHeader className="space-y-1 pb-2 pr-10 text-left">
          <DialogTitle className="text-lg">Share grocery lists</DialogTitle>
          <DialogDescription className="text-xs">
            Select lists, then share to your phone.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 px-1 pb-0 pt-0">
          {error ? (
            <div
              role="alert"
              className="flex gap-2 rounded-md border border-destructive/25 bg-destructive/10 px-3 py-2 text-sm text-destructive"
            >
              <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden />
              <span>{error}</span>
            </div>
          ) : null}

          <div
            className={cn(
              'flex items-center justify-center gap-3 rounded-xl border border-border bg-muted/30 px-4 py-4',
              loadingPhone && 'border-muted bg-muted/50',
              !loadingPhone && !userPhoneNumber && 'border-amber-200/80 bg-amber-50/80 text-amber-950'
            )}
          >
            {loadingPhone ? (
              <Loader2 className="size-5 shrink-0 animate-spin text-muted-foreground" />
            ) : (
              <Smartphone className="size-5 shrink-0 text-primary" aria-hidden />
            )}
            {loadingPhone ? (
              <span className="text-sm text-muted-foreground">Loading…</span>
            ) : userPhoneNumber ? (
              <p className="font-mono text-base font-medium tracking-wide">{userPhoneNumber}</p>
            ) : (
              <p className="text-center text-sm leading-snug">Add a phone number in your profile first.</p>
            )}
          </div>

          <div>
            <div className="mb-2 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
              <ListChecks className="size-3.5" aria-hidden />
              Lists
            </div>
            {lists.length === 0 ? (
              <p className="rounded-md border border-dashed border-border bg-muted/20 px-3 py-4 text-center text-sm text-muted-foreground">
                No lists to share.
              </p>
            ) : (
              <ul className="max-h-48 space-y-1.5 overflow-y-auto pr-0.5">
                {lists.map((list) => {
                  const selected = selectedLists.includes(list.id);
                  return (
                    <li key={list.id}>
                      <button
                        type="button"
                        onClick={() => handleSelectList(list.id)}
                        className={cn(
                          'flex w-full items-center gap-2.5 rounded-md border px-2.5 py-2 text-left text-sm transition-colors',
                          selected
                            ? 'border-primary/50 bg-primary/5'
                            : 'border-border bg-background hover:bg-muted/60'
                        )}
                      >
                        <span
                          className={cn(
                            'flex size-4 shrink-0 items-center justify-center rounded border',
                            selected
                              ? 'border-primary bg-primary text-primary-foreground'
                              : 'border-input bg-background'
                          )}
                          aria-hidden
                        >
                          {selected ? <Check className="size-2.5" strokeWidth={3} /> : null}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate font-medium leading-tight">{list.name}</span>
                          <span className="text-xs text-muted-foreground">
                            {list.items.length} item{list.items.length === 1 ? '' : 's'}
                          </span>
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          <div className="flex justify-center border-t border-border/60 pt-3 pb-0">
            <button
              type="button"
              className={cn(
                'icon-hit min-h-11 min-w-11 text-primary',
                (!canShare || lists.length === 0) && 'pointer-events-none opacity-40'
              )}
              onClick={handleShare}
              disabled={!canShare || lists.length === 0}
              aria-label="Share selected lists"
              title="Share"
            >
              {sharing ? (
                <Loader2 className="size-5 animate-spin" aria-hidden />
              ) : (
                <Share2 className="size-5" aria-hidden />
              )}
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ShareListsModal;
