import type { ReactNode } from 'react';
import { Button as BaseButton } from '@base-ui/react/button';

export type ButtonVariant = 'primary' | 'secondary';

export type ButtonProps = {
  children: ReactNode;
  variant?: ButtonVariant;
  type?: 'button' | 'submit';
  /** Cannot be activated and is skipped by keyboard focus. */
  disabled?: boolean;
  /** Cannot be activated but keeps focus, so a changing label is announced. */
  pending?: boolean;
  /** Decoration rendered after the label. Hidden from the accessible name. */
  icon?: ReactNode;
  onClick?: () => void;
};

const BASE_CLASSES =
  'inline-flex min-h-11 items-center justify-center gap-2 rounded-control px-4 font-sans font-bold uppercase tracking-wide [font-stretch:112%] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent data-disabled:cursor-not-allowed data-disabled:opacity-50';

const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  primary: 'bg-accent text-accent-fg',
  secondary: 'border-2 border-fg bg-bg text-fg',
};

export function Button({
  children,
  variant = 'secondary',
  type = 'button',
  disabled = false,
  pending = false,
  icon,
  onClick,
}: ButtonProps) {
  return (
    <BaseButton
      type={type}
      disabled={disabled || pending}
      focusableWhenDisabled={pending}
      onClick={onClick}
      className={`${BASE_CLASSES} ${VARIANT_CLASSES[variant]}`}
    >
      {children}
      {icon ? <span aria-hidden>{icon}</span> : null}
    </BaseButton>
  );
}
