import { ScreenCenter } from "@/components/ScreenContainer";

// Placeholder — the real swipe screen lands in Phase 4. This just gives the lobby's
// "Start swiping" / late-joiner redirect somewhere to land instead of a dead link.
export default function SwipePlaceholderPage() {
  return (
    <ScreenCenter>
      <div className="text-[19px] font-bold text-ink">Session started</div>
      <div className="text-[14.5px] text-ink-muted">The swipe screen is coming in Phase 4.</div>
    </ScreenCenter>
  );
}
