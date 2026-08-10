import type { ButtonHTMLAttributes } from "react";

type Variant = "primary" | "tonal";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
}

const VARIANT_CLASSES: Record<Variant, string> = {
  primary: "bg-accent text-white font-bold shadow-accent-glow",
  tonal: "bg-surface-alt text-ink font-semibold",
};

export function Button({ variant = "primary", className = "", ...props }: ButtonProps) {
  return (
    <button
      className={`w-full rounded-button px-4 py-4 text-[15px] transition-opacity disabled:opacity-40 ${VARIANT_CLASSES[variant]} ${className}`}
      {...props}
    />
  );
}
