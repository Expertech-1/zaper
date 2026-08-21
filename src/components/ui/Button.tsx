import type { ButtonHTMLAttributes } from "react";

type Variant = "primary" | "secondary" | "ghost";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
}

const VARIANTS: Record<Variant, string> = {
  primary: "bg-brand-600 text-white hover:bg-brand-500 disabled:hover:bg-brand-600",
  secondary:
    "bg-zinc-200 text-zinc-800 hover:bg-zinc-300 dark:bg-zinc-800 dark:text-zinc-100 dark:hover:bg-zinc-700",
  ghost: "text-zinc-600 hover:bg-zinc-200/60 dark:text-zinc-300 dark:hover:bg-zinc-800",
};

export function Button({ variant = "secondary", className = "", ...props }: ButtonProps) {
  const classes = [
    "inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors",
    "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500",
    "disabled:cursor-not-allowed disabled:opacity-50",
    VARIANTS[variant],
    className,
  ].join(" ");

  return <button type="button" className={classes} {...props} />;
}
