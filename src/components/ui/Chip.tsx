import type { CuisineState } from "@/lib/session/types";

const STATE_CLASSES: Record<CuisineState, string> = {
  none: "bg-surface-alt text-ink-muted border border-transparent font-medium",
  include: "bg-accent-tint text-accent border border-accent font-semibold",
  exclude: "bg-pass-tint text-pass border border-pass font-semibold line-through",
};

interface ChipProps {
  label: string;
  state: CuisineState;
  onClick: () => void;
}

export function Chip({ label, state, onClick }: ChipProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`cursor-pointer rounded-full px-3.5 py-2 text-[13.5px] ${STATE_CLASSES[state]}`}
    >
      {label}
    </button>
  );
}
