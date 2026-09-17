import { useCallback, useEffect, useRef, useState } from 'react';

export interface CastPerson { name: string; hint?: string; blob: Blob | null; url: string | null }

const MAX_EDGE = 1024;

/**
 * Add-yourself capture. Opens the browser camera (facingMode user), draws a frame to a canvas,
 * exports a JPEG <=1024px long edge. Retake supported. On permission denial, falls back to a
 * file upload input. Stops the camera track on unmount and after capture.
 */
export function CameraCapture({
  title, person, onChange, onRemove,
}: {
  title: string;
  person: CastPerson;
  onChange: (p: CastPerson) => void;
  onRemove?: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [live, setLive] = useState(false);
  const [denied, setDenied] = useState(false);

  const stop = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setLive(false);
  }, []);

  useEffect(() => () => stop(), [stop]);

  const start = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' }, audio: false });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => {});
      }
      setDenied(false);
      setLive(true);
    } catch {
      setDenied(true);
      setLive(false);
    }
  }, []);

  const capture = useCallback(() => {
    const video = videoRef.current;
    if (!video || !video.videoWidth) return;
    const scale = Math.min(1, MAX_EDGE / Math.max(video.videoWidth, video.videoHeight));
    const w = Math.round(video.videoWidth * scale);
    const h = Math.round(video.videoHeight * scale);
    const canvas = document.createElement('canvas');
    canvas.width = w; canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, w, h);
    canvas.toBlob((blob) => {
      if (!blob) return;
      if (person.url) URL.revokeObjectURL(person.url);
      onChange({ ...person, blob, url: URL.createObjectURL(blob) });
      stop();
    }, 'image/jpeg', 0.85);
  }, [onChange, person, stop]);

  const onFile = useCallback((file: File | undefined) => {
    if (!file) return;
    if (person.url) URL.revokeObjectURL(person.url);
    onChange({ ...person, blob: file, url: URL.createObjectURL(file) });
  }, [onChange, person]);

  return (
    <div className="rounded-lg border border-black/15 p-3" style={{ background: 'color-mix(in srgb, var(--paper) 92%, black)' }}>
      <div className="flex items-center justify-between mb-2">
        <span className="font-letter text-sm opacity-80">{title}</span>
        {onRemove && (
          <button type="button" onClick={() => { stop(); onRemove(); }} className="text-xs underline focus-ring opacity-70">Remove</button>
        )}
      </div>

      <div className="aspect-[4/3] w-full overflow-hidden rounded bg-black/70 relative flex items-center justify-center">
        {person.url ? (
          <img src={person.url} alt="Captured portrait preview" className="w-full h-full object-cover" />
        ) : (
          <video ref={videoRef} playsInline muted className="w-full h-full object-cover" style={{ transform: 'scaleX(-1)' }} />
        )}
        {!live && !person.url && !denied && (
          <span className="absolute text-white/60 text-xs">camera off</span>
        )}
      </div>

      <div className="mt-2 flex flex-wrap gap-2">
        {!person.url && !live && !denied && (
          <button type="button" onClick={start} className="focus-ring rounded bg-accent text-black px-3 py-1.5 text-sm font-medium">Open camera</button>
        )}
        {live && (
          <button type="button" onClick={capture} className="focus-ring rounded bg-accent text-black px-3 py-1.5 text-sm font-medium">Capture</button>
        )}
        {person.url && (
          <button type="button" onClick={() => { onChange({ ...person, blob: null, url: null }); void start(); }} className="focus-ring rounded border border-black/30 px-3 py-1.5 text-sm">Retake</button>
        )}
      </div>

      {denied && (
        <div className="mt-2 text-xs">
          <p className="opacity-80 mb-1">Camera unavailable. Upload a photo instead.</p>
          <input type="file" accept="image/*" onChange={(e) => onFile(e.target.files?.[0])} className="text-xs focus-ring" />
        </div>
      )}

      <label className="mt-2 block">
        <span className="sr-only">Name</span>
        <input
          value={person.name}
          onChange={(e) => onChange({ ...person, name: e.target.value.slice(0, 40) })}
          placeholder="Name in the story"
          className="w-full rounded border border-black/25 bg-transparent px-2 py-1 text-sm focus-ring"
        />
      </label>
    </div>
  );
}
