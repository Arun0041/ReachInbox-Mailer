import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode } from "react";

export function cx(...classes: (string | false | null | undefined)[]) {
  return classes.filter(Boolean).join(" ");
}

type ButtonVariant = "primary" | "outline-green" | "soft-green" | "ghost";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
}

const buttonStyles: Record<ButtonVariant, string> = {
  primary:
    "bg-brand text-white hover:bg-brand-dark rounded-lg px-4 h-10 text-sm font-medium",
  "outline-green":
    "border border-brand text-brand bg-white hover:bg-brand-soft rounded-full px-5 h-9 text-sm font-medium",
  "soft-green":
    "bg-brand-soft text-gray-800 hover:brightness-95 rounded-lg px-4 h-10 text-sm font-medium",
  ghost: "text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg px-3 h-9 text-sm",
};

export function Button({ variant = "primary", className, ...props }: ButtonProps) {
  return (
    <button
      className={cx(
        "inline-flex items-center justify-center gap-2 transition-colors cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed",
        buttonStyles[variant],
        className,
      )}
      {...props}
    />
  );
}

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cx(
        "h-10 w-full rounded-lg border border-gray-200 bg-gray-50 px-3 text-sm text-gray-900 placeholder:text-gray-400 outline-none focus:border-brand focus:ring-2 focus:ring-brand/20 transition",
        className,
      )}
      {...props}
    />
  );
}

export function LetterAvatar({
  name,
  className,
}: {
  name: string;
  className?: string;
}) {
  const letter = (name || "?").trim().charAt(0).toUpperCase();
  return (
    <div
      className={cx(
        "flex items-center justify-center rounded-full bg-brand text-white font-semibold select-none",
        "h-9 w-9 text-sm",
        className,
      )}
    >
      {letter}
    </div>
  );
}

export function Pill({
  icon,
  children,
  tone,
}: {
  icon?: ReactNode;
  children: ReactNode;
  tone: "orange" | "green" | "red";
}) {
  const tones = {
    orange: "bg-pill-orange text-pill-orange-text",
    green: "bg-pill-green text-pill-green-text",
    red: "bg-pill-red text-pill-red-text",
  } as const;
  return (
    <span
      className={cx(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium whitespace-nowrap",
        tones[tone],
      )}
    >
      {icon}
      {children}
    </span>
  );
}

export function Spinner({ className }: { className?: string }) {
  return (
    <div
      className={cx(
        "h-5 w-5 animate-spin rounded-full border-2 border-gray-200 border-t-brand",
        className,
      )}
      role="status"
      aria-label="Loading"
    />
  );
}
