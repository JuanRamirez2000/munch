"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { ScreenCenter, ScreenContainer } from "@/components/ScreenContainer";
import { Button } from "@/components/ui/Button";
import { getSessionByShortCode } from "@/lib/session/api";

export default function SharePage() {
  const params = useParams<{ code: string }>();
  const router = useRouter();
  const code = params.code.toUpperCase();

  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [link, setLink] = useState("");
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [copyLabel, setCopyLabel] = useState("Copy");

  useEffect(() => {
    let cancelled = false;

    getSessionByShortCode(code)
      .then((session) => {
        if (cancelled) return;
        if (!session) {
          setNotFound(true);
          setLoading(false);
          return;
        }
        const url = `${window.location.origin}/s/${code}`;
        setLink(url);
        setLoading(false);
        QRCode.toDataURL(url, { width: 300, margin: 1, color: { dark: "#292521", light: "#FFFFFF" } }).then(
          (dataUrl) => !cancelled && setQrDataUrl(dataUrl)
        );
      })
      .catch(() => !cancelled && setLoading(false));

    return () => {
      cancelled = true;
    };
  }, [code]);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(link);
      setCopyLabel("Copied!");
      setTimeout(() => setCopyLabel("Copy"), 1500);
    } catch {
      // clipboard API unavailable — user can still select the link text manually
    }
  }

  async function handleShare() {
    if (navigator.share) {
      try {
        await navigator.share({ title: "Join my Munch session", url: link });
      } catch {
        // share sheet dismissed — nothing to do
      }
    } else {
      handleCopy();
    }
  }

  if (loading) return <ScreenCenter><span className="text-ink-muted">Loading…</span></ScreenCenter>;
  if (notFound) {
    return (
      <ScreenCenter>
        <div className="text-[19px] font-bold text-ink">Session not found</div>
        <div className="text-[14.5px] text-ink-muted">This link may be wrong or the session has expired.</div>
      </ScreenCenter>
    );
  }

  return (
    <ScreenContainer>
      <div className="px-6 pb-1 pt-8">
        <h1 className="text-[26px] font-bold text-ink">You&apos;re hosting!</h1>
        <div className="mt-0.5 text-[13.5px] text-ink-muted">Send this link to your friends</div>
      </div>

      <div className="flex flex-1 flex-col items-center gap-5 px-6 py-6">
        <div className="flex w-full items-center justify-between gap-2.5 rounded-card bg-surface px-4 py-3.5 shadow-elevation-sm">
          <span className="truncate text-[15px] font-semibold text-ink">{link.replace(/^https?:\/\//, "")}</span>
          <button
            type="button"
            onClick={handleCopy}
            className="shrink-0 rounded-[10px] bg-accent-tint px-3.5 py-2 text-[13px] font-bold text-accent"
          >
            {copyLabel}
          </button>
        </div>

        <Button variant="tonal" onClick={handleShare}>
          Share via…
        </Button>

        {qrDataUrl && (
          // eslint-disable-next-line @next/next/no-img-element -- client-generated data: URI
          <img
            src={qrDataUrl}
            alt="QR code to join session"
            className="mt-2 h-[150px] w-[150px] rounded-card shadow-elevation-sm"
          />
        )}
        <div className="text-[12.5px] text-ink-faint">Scan to join instantly</div>
      </div>

      <div className="px-6 pb-[calc(env(safe-area-inset-bottom)+14px)] pt-3.5">
        <Button onClick={() => router.push(`/s/${code}`)}>Go to lobby</Button>
      </div>
    </ScreenContainer>
  );
}
