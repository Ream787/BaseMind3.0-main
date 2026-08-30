import { useEffect, useState } from "react";
import { Printer } from "lucide-react";

import { boxUrl } from "@/lib/boxes";
import { Button } from "@/components/ui/button";

/**
 * The sticker for a box.
 *
 * The QR encodes a full URL, so an ordinary phone camera opens the box
 * without anyone installing or signing into anything first — that is what
 * makes a sticker on a box worth putting there.
 *
 * The code is printed underneath in plain text on purpose. Stickers live in
 * damp stores and get scuffed, and a human-readable code means a scuffed one
 * can still be typed in rather than reprinted.
 */
export function StorageQrCode({ code, name }: { code: string; name: string }) {
  const [dataUrl, setDataUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    // Loaded on demand: printing stickers is a once-per-box job and this has
    // no business in the bundle everyone downloads.
    import("qrcode")
      .then((QRCode) =>
        QRCode.toDataURL(boxUrl(code, window.location.origin), {
          width: 512,
          margin: 1,
          // High correction, because these get scuffed and rained on.
          errorCorrectionLevel: "H",
          color: { dark: "#000000", light: "#ffffff" },
        }),
      )
      .then((url) => {
        if (active) setDataUrl(url);
      })
      .catch((err: Error) => {
        if (active) setError(err.message);
      });
    return () => {
      active = false;
    };
  }, [code]);

  function print() {
    const win = window.open("", "_blank", "width=420,height=560");
    if (!win || !dataUrl) return;
    // A self-contained document: the sticker has to print the same from any
    // browser, and pulling in the app's stylesheet would make it depend on
    // whatever the app looks like this month.
    win.document.write(
      `<!DOCTYPE html><html><head><title>${escapeHtml(name)} — ${escapeHtml(code)}</title>` +
        `<style>
           body { font-family: system-ui, sans-serif; text-align: center; margin: 24px; }
           img { width: 260px; height: 260px; }
           h1 { font-size: 18px; margin: 12px 0 4px; }
           p { font-family: ui-monospace, monospace; font-size: 20px; letter-spacing: 2px; margin: 0; }
         </style></head><body>` +
        `<img src="${dataUrl}" alt="" />` +
        `<h1>${escapeHtml(name)}</h1><p>${escapeHtml(code)}</p>` +
        `</body></html>`,
    );
    win.document.close();
    win.focus();
    win.print();
  }

  return (
    <div className="flex flex-col items-center gap-3 rounded-lg border bg-card p-4">
      {error ? (
        <p className="text-sm text-muted-foreground">Couldn&apos;t draw the code: {error}</p>
      ) : dataUrl ? (
        <>
          {/* White plate behind it: a QR inverted by dark mode does not scan. */}
          <div className="rounded-md bg-white p-3">
            <img src={dataUrl} alt={`QR code for ${name}`} className="size-40" />
          </div>
          <p className="font-mono text-lg tracking-widest">{code}</p>
          <Button variant="outline" size="sm" onClick={print}>
            <Printer className="size-4" />
            Print sticker
          </Button>
        </>
      ) : (
        <p className="text-sm text-muted-foreground">Drawing the code…</p>
      )}
    </div>
  );
}

function escapeHtml(value: string): string {
  return value.replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] ?? c,
  );
}
