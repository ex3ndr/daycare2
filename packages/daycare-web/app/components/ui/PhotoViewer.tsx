import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { X, Download, ZoomIn, ZoomOut, ChevronLeft, ChevronRight } from "lucide-react";
import { useUiStore } from "@/app/stores/uiStoreContext";
import { useApp } from "@/app/sync/AppContext";

function useResolvedFileUrl(url: string | undefined) {
  const app = useApp();
  const [resolved, setResolved] = useState(url ?? "");

  useEffect(() => {
    if (!url) {
      setResolved("");
      return;
    }
    setResolved(url);

    let disposed = false;
    try {
      const parsed = new URL(url, window.location.origin);
      const match = parsed.pathname.match(/^\/api\/org\/([^/]+)\/files\/([^/?#]+)$/);
      if (!match) return;
      const [, orgId, fileId] = match;

      app.api
        .fileGet(app.token, orgId, fileId)
        .then((response) => {
          if (disposed) return;
          if (response.ok) {
            setResolved(response.url || url);
          }
        })
        .catch(() => {});
    } catch {
      // Not a valid URL, keep as-is
    }

    return () => {
      disposed = true;
    };
  }, [url, app]);

  return resolved;
}

export function PhotoViewer() {
  const photoViewer = useUiStore((s) => s.photoViewer);
  const close = useUiStore((s) => s.photoViewerClose);
  const next = useUiStore((s) => s.photoViewerNext);
  const prev = useUiStore((s) => s.photoViewerPrev);

  const [zoomed, setZoomed] = useState(false);

  const current = photoViewer ? photoViewer.images[photoViewer.currentIndex] : undefined;
  const resolvedUrl = useResolvedFileUrl(current?.url);

  // Reset zoom when image changes or viewer closes
  useEffect(() => {
    setZoomed(false);
  }, [photoViewer?.currentIndex, photoViewer === null]);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (!photoViewer) return;
      if (e.key === "Escape") {
        close();
      } else if (e.key === "ArrowLeft") {
        prev();
      } else if (e.key === "ArrowRight") {
        next();
      }
    },
    [photoViewer, close, prev, next],
  );

  useEffect(() => {
    if (!photoViewer) return;
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [photoViewer, handleKeyDown]);

  if (!photoViewer || !current) return null;

  const { images, currentIndex } = photoViewer;
  const hasMultiple = images.length > 1;

  function handleBackdropClick(e: React.MouseEvent) {
    if (e.target === e.currentTarget) {
      close();
    }
  }

  function handleDownload() {
    const a = document.createElement("a");
    a.href = resolvedUrl;
    a.download = current!.fileName ?? "image";
    a.target = "_blank";
    a.rel = "noopener noreferrer";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex flex-col bg-black/90"
      onClick={handleBackdropClick}
    >
      {/* Top bar */}
      <div className="flex items-center justify-between px-4 py-3 text-white/80">
        <div className="flex items-center gap-2 min-w-0">
          {current.fileName && (
            <span className="text-sm truncate max-w-xs">
              {current.fileName}
            </span>
          )}
          {hasMultiple && (
            <span className="text-xs text-white/50">
              {currentIndex + 1} / {images.length}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setZoomed((z) => !z)}
            className="rounded p-2 hover:bg-white/10 transition-colors"
            title={zoomed ? "Fit to screen" : "Actual size"}
          >
            {zoomed ? (
              <ZoomOut className="h-5 w-5" />
            ) : (
              <ZoomIn className="h-5 w-5" />
            )}
          </button>
          <button
            onClick={handleDownload}
            className="rounded p-2 hover:bg-white/10 transition-colors"
            title="Download"
          >
            <Download className="h-5 w-5" />
          </button>
          <button
            onClick={close}
            className="rounded p-2 hover:bg-white/10 transition-colors"
            title="Close (Esc)"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
      </div>

      {/* Image area */}
      <div
        className="flex-1 flex items-center justify-center overflow-auto min-h-0 px-12"
        onClick={handleBackdropClick}
      >
        <img
          src={resolvedUrl}
          alt={current.fileName ?? "Image"}
          className={
            zoomed
              ? "max-w-none cursor-zoom-out"
              : "max-h-full max-w-full object-contain cursor-zoom-in"
          }
          onClick={(e) => {
            e.stopPropagation();
            setZoomed((z) => !z);
          }}
          draggable={false}
        />
      </div>

      {/* Navigation arrows */}
      {hasMultiple && (
        <>
          <button
            onClick={(e) => {
              e.stopPropagation();
              prev();
            }}
            className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full bg-black/50 p-2 text-white/80 hover:bg-black/70 hover:text-white transition-colors"
            title="Previous image"
          >
            <ChevronLeft className="h-6 w-6" />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              next();
            }}
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-black/50 p-2 text-white/80 hover:bg-black/70 hover:text-white transition-colors"
            title="Next image"
          >
            <ChevronRight className="h-6 w-6" />
          </button>
        </>
      )}
    </div>,
    document.body,
  );
}
