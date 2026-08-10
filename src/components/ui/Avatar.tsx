import { getInitials } from "@/lib/initials";

interface AvatarProps {
  name: string;
  /** Not wired up anywhere yet — real profile photos land later; falls back to initials until then. */
  photoUrl?: string | null;
  size?: number;
}

export function Avatar({ name, photoUrl, size = 36 }: AvatarProps) {
  const style = { width: size, height: size, fontSize: Math.round(size * 0.4) };

  if (photoUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- avatar source is arbitrary user content
      <img src={photoUrl} alt={name} style={style} className="shrink-0 rounded-full object-cover" />
    );
  }

  return (
    <div
      style={style}
      className="flex shrink-0 items-center justify-center rounded-full bg-accent-tint font-bold text-accent"
    >
      {getInitials(name)}
    </div>
  );
}
