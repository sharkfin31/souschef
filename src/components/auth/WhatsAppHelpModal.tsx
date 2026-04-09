import { ExternalLink, KeyRound, MessageCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';

interface WhatsAppHelpModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function WhatsAppHelpModal({ isOpen, onClose }: WhatsAppHelpModalProps) {
  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent
        className={cn(
          'flex max-h-[min(90vh,720px)] max-w-[calc(100%-2rem)] flex-col gap-0 overflow-hidden p-0 sm:max-w-2xl'
        )}
        showCloseButton={false}
      >
        <DialogHeader className="shrink-0 space-y-0 px-6 py-4">
          <DialogTitle className="flex items-center gap-2 text-left text-lg font-semibold">
            <MessageCircle className="size-5 shrink-0 text-primary" aria-hidden />
            What is this?
          </DialogTitle>
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
          <div className="mb-6 rounded-lg border border-border bg-muted/40 p-4">
            <div className="flex gap-3">
              <KeyRound className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
              <p className="text-sm text-foreground">
                <span className="font-semibold">The WhatsApp API key lets souschef send grocery lists to your WhatsApp. </span> <br />
              </p>
            </div>
          </div>

          <h4 className="mb-4 font-semibold text-foreground">Step-by-step</h4>
          <ol className="space-y-4">
            {[
              <>
                <strong>Add CallMeBot on WhatsApp:</strong> Message{' '}
                <strong className="tabular-nums">+34 644 33 66 63</strong> with:{' '}
                <code className="rounded-md bg-muted px-1.5 py-0.5 text-xs">
                  I allow callmebot to send me messages
                </code>
              </>,
              <>
                <strong>Wait for confirmation:</strong> You’ll get a reply with your API key within a few
                minutes.
              </>,
              <>
                <strong>Copy your API key:</strong> Use the long string from the message.
              </>,
              <>
                <strong>Paste it here:</strong> Enter the key in the registration field to finish setup.
              </>,
            ].map((content, i) => (
              <li key={i} className="flex gap-3">
                <span
                  className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground"
                  aria-hidden
                >
                  {i + 1}
                </span>
                <p className="pt-0.5 text-sm text-muted-foreground [&_strong]:text-foreground">{content}</p>
              </li>
            ))}
          </ol>

          <div className="mt-6 rounded-lg border border-amber-500/30 bg-amber-500/10 p-4">
            <p className="text-sm text-foreground">
              <span className="font-semibold">Important:</span> Treat your API key like a password, don’t
              share it.
            </p>
          </div>

          <div className="mt-6 rounded-lg border border-border bg-muted/30 p-4">
            <a
              href="https://www.callmebot.com/blog/free-api-whatsapp-messages/"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:text-primary/90"
            >
              More information on CallMeBot API
              <ExternalLink className="size-3.5 shrink-0" aria-hidden />
            </a>
          </div>
        </div>

        <DialogFooter className="mx-0 mb-0 shrink-0 justify-center border-t-0 bg-muted/30 px-6 pt-4 pb-4 sm:justify-center">
          <Button type="button" onClick={onClose}>
            Got it
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
