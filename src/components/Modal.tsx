import { useEffect, useRef, type ReactNode } from 'react';
import { X } from 'lucide-react';
import { useI18n } from '../i18n/react';
export function Modal({
  title,
  eyebrow,
  onClose,
  children,
  wide = false,
}: {
  title: string;
  eyebrow?: string;
  onClose: () => void;
  children: ReactNode;
  wide?: boolean;
}) {
  const { t } = useI18n();
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const old = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    ref.current?.focus();
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'Tab') {
        const nodes = Array.from(
          ref.current?.querySelectorAll<HTMLElement>(
            'button:not(:disabled),input,select,textarea,a[href],[tabindex="0"]',
          ) ?? [],
        ).filter((n) => n.offsetParent !== null);
        const first = nodes[0],
          last = nodes.at(-1);
        if (
          e.shiftKey &&
          (document.activeElement === first || document.activeElement === ref.current)
        ) {
          e.preventDefault();
          last?.focus();
        } else if (
          !e.shiftKey &&
          (document.activeElement === last || document.activeElement === ref.current)
        ) {
          e.preventDefault();
          first?.focus();
        }
      }
    };
    document.addEventListener('keydown', handler);
    return () => {
      document.removeEventListener('keydown', handler);
      document.body.style.overflow = old;
      previous?.focus();
    };
  }, [onClose]);
  return (
    <div
      className="modal-overlay"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        tabIndex={-1}
        className={`modal ${wide ? 'modal-wide' : ''}`}
      >
        <div className="modal-heading">
          <div>
            {eyebrow && <span className="eyebrow">{eyebrow}</span>}
            <h2 id="modal-title">{title}</h2>
          </div>
          <button className="icon-button" onClick={onClose} aria-label={t('关闭对话框')}>
            <X size={20} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
