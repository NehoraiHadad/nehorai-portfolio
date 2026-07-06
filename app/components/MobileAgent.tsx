'use client';

import React, { useState, useRef, useId } from 'react';
import { createPortal } from 'react-dom';
import { m, AnimatePresence } from 'motion/react';
import { MessageSquare } from 'lucide-react';
import { InteractiveAgent } from './InteractiveAgent';
import { useDictionary } from '@/lib/i18n/provider';
import { useFocusTrap } from '@/lib/useFocusTrap';

export const MobileAgent = () => {
  const [isOpen, setIsOpen] = useState(false);
  const { a11y } = useDictionary();
  const fabRef = useRef<HTMLButtonElement>(null);
  const chatInputRef = useRef<HTMLInputElement>(null);
  const dialogTitleId = useId();

  // 4.1: focus trap inside MobileAgent dialog. Initial focus goes to the chat
  // input (the terminal prompt), not the first focusable element (the X button).
  const trapRef = useFocusTrap<HTMLDivElement>({
    active: isOpen,
    restoreRef: fabRef,
    initialFocusRef: chatInputRef,
  });

  // 4.1: set inert on main content while dialog is open
  React.useEffect(() => {
    const main = document.getElementById('main-content');
    if (!main) return;
    if (isOpen) {
      main.setAttribute('inert', '');
    } else {
      main.removeAttribute('inert');
    }
    return () => main.removeAttribute('inert');
  }, [isOpen]);

  return (
    <div className="lg:hidden">
      {/* Floating Action Button — 4.2: aria-label; already 56px = ✓ 4.6 */}
      <AnimatePresence>
        {!isOpen && (
          <m.button
            ref={fabRef}
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            onClick={() => setIsOpen(true)}
            aria-label={a11y.openChat}
            className="fixed bottom-6 z-40 w-14 h-14 corner-chip bg-accent text-[var(--fg-on-accent)] rounded-full hover:scale-105 transition-transform focus-visible:[box-shadow:var(--shadow-focus-ring)] outline-none"
            style={{ insetInlineEnd: '1.5rem' }}
          >
            <MessageSquare className="w-6 h-6" aria-hidden="true" />
          </m.button>
        )}
      </AnimatePresence>

      {/* Modal Overlay for Chat — 4.1: dialog role, aria-modal, focus trap, Escape */}
      {typeof document !== 'undefined' && createPortal(
        <AnimatePresence>
          {isOpen && (
            <div
              role="dialog"
              aria-modal="true"
              aria-labelledby={dialogTitleId}
              ref={trapRef}
              className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-4 sm:p-6"
              onKeyDown={(e) => { if (e.key === 'Escape') setIsOpen(false); }}
            >
              {/* Hidden title for dialog label */}
              <span id={dialogTitleId} className="sr-only">Chat assistant</span>
              <m.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setIsOpen(false)}
                className="absolute inset-0 bg-page/80 backdrop-blur-sm"
              />
              <m.div
                initial={{ opacity: 0, y: 100, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 100, scale: 0.95 }}
                className="relative w-full max-w-lg"
              >
                <InteractiveAgent onClose={() => setIsOpen(false)} inputRef={chatInputRef} />
              </m.div>
            </div>
          )}
        </AnimatePresence>,
        document.body
      )}
    </div>
  );
};
