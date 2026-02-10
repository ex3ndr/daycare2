import type { ReactNode } from "react";

type ModalProps = {
  open: boolean;
  title: string;
  subtitle?: string;
  children: ReactNode;
  footer?: ReactNode;
  onClose: () => void;
};

export function Modal({ open, title, subtitle, children, footer, onClose }: ModalProps): JSX.Element | null {
  if (!open) {
    return null;
  }

  return (
    <div className="ui-modal-backdrop" onClick={onClose} role="presentation">
      <div
        className="ui-modal"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(event) => event.stopPropagation()}
      >
        <header className="ui-modal-head">
          <div>
            <h3>{title}</h3>
            {subtitle ? <p className="ui-modal-subtitle">{subtitle}</p> : null}
          </div>
          <button className="ui-modal-close" onClick={onClose} aria-label="Close modal">
            x
          </button>
        </header>
        <div className="ui-modal-body">{children}</div>
        {footer ? <footer className="ui-modal-foot">{footer}</footer> : null}
      </div>
    </div>
  );
}
