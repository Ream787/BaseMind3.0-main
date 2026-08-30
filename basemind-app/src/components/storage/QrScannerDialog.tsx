import { useEffect, useRef, useState } from "react";
import { CameraOff, Keyboard } from "lucide-react";

import { isBoxCode, canonical, parseScannedCode } from "@/lib/boxes";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

/**
 * Reads a storage sticker with the phone's camera.
 *
 * Two decoders. Chrome on Android has BarcodeDetector built in, which is
 * faster and kinder to the battery than decoding frames in JavaScript;
 * everywhere else — iOS Safari, notably — falls back to jsQR. Both are
 * loaded on demand, because most visits to this app never scan anything.
 *
 * Typing the code stays on screen the whole time rather than hiding behind
 * a "camera not working?" link. Store rooms are dark, stickers get scuffed,
 * and a phone that won't focus shouldn't be the end of the stock check.
 */
export function QrScannerDialog({
  open,
  onOpenChange,
  onFound,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onFound: (code: string) => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [typed, setTyped] = useState("");
  const [rejected, setRejected] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      setCameraError(null);
      setRejected(null);
      setTyped("");
      return;
    }

    let stream: MediaStream | null = null;
    let frame = 0;
    let stopped = false;

    /** Hands the code back once, and makes sure the camera really stops. */
    const finish = (code: string) => {
      if (stopped) return;
      stopped = true;
      onFound(code);
    };

    async function start() {
      try {
        // facingMode "environment" is a request, not a guarantee — a laptop
        // simply gives its only camera, which is fine.
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: "environment" } },
          audio: false,
        });
        if (stopped) return;

        const video = videoRef.current;
        if (!video) return;
        video.srcObject = stream;
        // iOS refuses to play inline without both of these.
        video.setAttribute("playsinline", "true");
        video.muted = true;
        await video.play();

        const detector = await nativeDetector();
        const canvas = document.createElement("canvas");
        const context = canvas.getContext("2d", { willReadFrequently: true });
        let jsQR: typeof import("jsqr").default | null = null;

        const tick = async () => {
          if (stopped || !videoRef.current) return;
          const v = videoRef.current;

          if (v.readyState === v.HAVE_ENOUGH_DATA) {
            let text: string | null = null;

            if (detector) {
              try {
                const found = await detector.detect(v);
                text = found[0]?.rawValue ?? null;
              } catch {
                // A detector that throws mid-stream is not worth retrying;
                // the jsQR path below picks it up on the next frame.
              }
            }

            if (!text && context) {
              if (!jsQR) jsQR = (await import("jsqr")).default;
              canvas.width = v.videoWidth;
              canvas.height = v.videoHeight;
              context.drawImage(v, 0, 0, canvas.width, canvas.height);
              const image = context.getImageData(0, 0, canvas.width, canvas.height);
              text = jsQR(image.data, image.width, image.height)?.data ?? null;
            }

            if (text) {
              const code = parseScannedCode(text);
              if (code) {
                finish(code);
                return;
              }
              // Something scanned, but not ours. Say so rather than looking
              // broken while the camera stares at a cereal packet.
              setRejected(text.slice(0, 60));
            }
          }
          frame = requestAnimationFrame(() => void tick());
        };

        void tick();
      } catch (err) {
        setCameraError(
          err instanceof DOMException && err.name === "NotAllowedError"
            ? "The camera was blocked. Allow camera access for this site, or type the code below."
            : "No camera available here. Type the code from the sticker instead.",
        );
      }
    }

    void start();

    return () => {
      stopped = true;
      cancelAnimationFrame(frame);
      // Without this the camera light stays on after the dialog closes.
      stream?.getTracks().forEach((track) => track.stop());
    };
  }, [open, onFound]);

  const typedIsValid = isBoxCode(typed);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {/* Nothing takes focus when this opens. The dialog would otherwise
          hand it to the code field, and a phone answers a focused text box
          by throwing up the keyboard — over the camera you came here to
          look through. Tapping the field still opens it, which is the only
          time anybody wants it. */}
      <DialogContent onOpenAutoFocus={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle>Scan a sticker</DialogTitle>
          <DialogDescription>
            Point the camera at the sticker on the box, shelf or cupboard.
          </DialogDescription>
        </DialogHeader>

        {cameraError ? (
          <p className="flex items-start gap-2 rounded-lg border border-dashed p-3 text-sm text-muted-foreground">
            <CameraOff className="mt-0.5 size-4 shrink-0" />
            {cameraError}
          </p>
        ) : (
          <div className="relative overflow-hidden rounded-lg bg-black">
            <video ref={videoRef} className="aspect-square w-full object-cover" />
            {/* A frame to aim with. Nothing reads the sticker better than
                holding it still in the middle. */}
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
              <div className="size-2/3 rounded-lg border-2 border-white/80" />
            </div>
          </div>
        )}

        {rejected && !cameraError && (
          <p className="text-xs text-muted-foreground">
            That code isn&apos;t a BaseMind sticker ({rejected}). Keep looking, or type
            the code below.
          </p>
        )}

        <form
          className="flex flex-col gap-1.5"
          onSubmit={(e) => {
            e.preventDefault();
            if (typedIsValid) onFound(canonical(typed));
          }}
        >
          <Label htmlFor="box-code" className="flex items-center gap-2">
            <Keyboard className="size-4" />
            Or type the code
          </Label>
          <div className="flex gap-2">
            <Input
              id="box-code"
              placeholder="BM-7K3QX2"
              autoCapitalize="characters"
              autoComplete="off"
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
            />
            <Button type="submit" disabled={!typedIsValid}>
              Open
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** The browser's own QR reader, when it has one. */
async function nativeDetector(): Promise<{
  detect: (source: CanvasImageSource) => Promise<{ rawValue: string }[]>;
} | null> {
  const Detector = (
    window as unknown as {
      BarcodeDetector?: new (options: { formats: string[] }) => {
        detect: (source: CanvasImageSource) => Promise<{ rawValue: string }[]>;
      };
    }
  ).BarcodeDetector;
  if (!Detector) return null;
  try {
    return new Detector({ formats: ["qr_code"] });
  } catch {
    return null;
  }
}
