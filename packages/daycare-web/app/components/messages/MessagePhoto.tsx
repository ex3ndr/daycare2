import { useState, useMemo, useEffect, useCallback } from "react";
import { thumbHashToDataURL } from "thumbhash";

type MessagePhotoProps = {
  url: string;
  width: number;
  height: number;
  thumbhash: string;
  fileName?: string | null;
  onClick?: () => void;
};

const MAX_WIDTH = 320;
const MAX_HEIGHT = 256;

function thumbhashToUrl(thumbhash: string): string | null {
  try {
    const binary = atob(thumbhash);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return thumbHashToDataURL(bytes);
  } catch {
    return null;
  }
}

export function MessagePhoto({ url, width, height, thumbhash, fileName, onClick }: MessagePhotoProps) {
  const [loaded, setLoaded] = useState(false);
  const placeholderUrl = useMemo(() => thumbhashToUrl(thumbhash), [thumbhash]);

  useEffect(() => {
    setLoaded(false);
  }, [url]);

  const onLoad = useCallback(() => setLoaded(true), []);

  // Compute display dimensions that fit within MAX_WIDTH x MAX_HEIGHT while preserving aspect ratio
  const scale = Math.min(MAX_WIDTH / width, MAX_HEIGHT / height, 1);
  const displayWidth = Math.round(width * scale);
  const displayHeight = Math.round(height * scale);

  return (
    <button
      type="button"
      onClick={onClick}
      className="mt-1 inline-block text-left cursor-pointer"
    >
      <div
        className="relative rounded-md border overflow-hidden"
        style={{ width: displayWidth, height: displayHeight }}
      >
        {/* Thumbhash placeholder — always present, sits behind the real image */}
        {placeholderUrl && (
          <img
            aria-hidden
            src={placeholderUrl}
            alt=""
            className="absolute inset-0 w-full h-full object-cover"
          />
        )}

        {/* Real image — fades in on top of the placeholder */}
        <img
          src={url}
          alt={fileName ?? "Image"}
          className="relative w-full h-full object-cover"
          loading="lazy"
          onLoad={onLoad}
          style={{ opacity: loaded ? 1 : 0, transition: "opacity 200ms ease" }}
        />
      </div>
      {fileName && (
        <span className="mt-0.5 block text-xs text-muted-foreground truncate" style={{ maxWidth: displayWidth }}>
          {fileName}
        </span>
      )}
    </button>
  );
}
