import { Avatar } from "./Avatar";
import type { Liker } from "@/lib/deck/api";

interface AvatarStackProps {
  likers: Liker[];
  max?: number;
  size?: number;
  /** Ring color must match whatever this stack sits on top of, so avatars read as stacked
   * rather than just overlapping — "ring-bg" on the page background, "ring-surface" on a
   * white card. */
  ringClassName?: string;
}

// Overlapping initials avatars with a "+N" bubble for anything past `max` — used to show who
// liked a place without needing as much horizontal room as listing names would.
export function AvatarStack({ likers, max = 3, size = 20, ringClassName = "ring-bg" }: AvatarStackProps) {
  if (likers.length === 0) return null;

  const shown = likers.slice(0, max);
  const overflow = likers.length - shown.length;

  return (
    <div className="flex shrink-0 items-center">
      {shown.map((liker) => (
        <div key={liker.id} className={`-ml-1.5 rounded-full ring-2 first:ml-0 ${ringClassName}`}>
          <Avatar name={liker.name} size={size} />
        </div>
      ))}
      {overflow > 0 && (
        <div
          className={`-ml-1.5 flex shrink-0 items-center justify-center rounded-full bg-surface-alt font-bold text-ink-muted ring-2 ${ringClassName}`}
          style={{ width: size, height: size, fontSize: Math.round(size * 0.4) }}
        >
          +{overflow}
        </div>
      )}
    </div>
  );
}
