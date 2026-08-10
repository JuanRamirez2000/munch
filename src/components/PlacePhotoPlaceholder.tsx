interface PlacePhotoPlaceholderProps {
  className?: string;
}

// Matches the handoff's placeholder exactly — a 45deg diagonal stripe with a monospace
// caption — until real restaurant photography (or a provider that returns photoUrl) lands.
export function PlacePhotoPlaceholder({ className = "" }: PlacePhotoPlaceholderProps) {
  return (
    <div
      className={`flex items-center justify-center text-[13px] text-ink-faint ${className}`}
      style={{
        backgroundImage: "repeating-linear-gradient(45deg, #EFE9E0, #EFE9E0 14px, #F8F5EF 14px, #F8F5EF 28px)",
        fontFamily: "'Courier New', monospace",
      }}
    >
      food photo — place shot
    </div>
  );
}
