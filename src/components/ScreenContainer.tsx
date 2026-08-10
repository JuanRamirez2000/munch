import type { ReactNode } from "react";

// No fake status bar / phone-shell chrome here — those were the design mockup's presentation
// frame for previewing screens outside a device. A real mobile browser already draws its own
// status bar, so this is just the actual screen content, full viewport, safe-area aware.
export function ScreenContainer({ children }: { children: ReactNode }) {
  return <div className="mx-auto flex min-h-dvh w-full max-w-[480px] flex-col bg-bg">{children}</div>;
}

export function ScreenCenter({ children }: { children: ReactNode }) {
  return (
    <ScreenContainer>
      <div className="flex flex-1 flex-col items-center justify-center gap-2 px-6 text-center">{children}</div>
    </ScreenContainer>
  );
}
