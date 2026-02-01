interface ButtonProps {
  /** Button label text */
  label: string;
  /** Click handler */
  onClick: () => void;
  /** Optional disabled state */
  disabled?: boolean;
  /** Optional variant style */
  variant?: 'primary' | 'secondary';
}

export function Button({
  label,
  onClick,
  disabled = false,
  variant = 'primary',
}: ButtonProps): React.ReactElement {
  return (
    <button
      className={`button button--${variant}`}
      onClick={onClick}
      disabled={disabled}
    >
      {label}
    </button>
  );
}
