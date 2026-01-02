/**
 * ScreenshotGallery - Display screenshots in the detail panel
 *
 * Features:
 * - Thumbnail grid (2 columns)
 * - Click to view full size (lightbox)
 * - Lazy loading
 */

import { useState, useCallback, useEffect } from 'react';
import type { Screenshot } from '../../types/backlog';

// ============================================================
// TYPES
// ============================================================

interface ScreenshotGalleryProps {
  screenshots: Screenshot[];
  getUrl: (filename: string) => Promise<string | null>;
}

// ============================================================
// COMPONENT
// ============================================================

export function ScreenshotGallery({ screenshots, getUrl }: ScreenshotGalleryProps) {
  const [thumbnails, setThumbnails] = useState<Map<string, string>>(new Map());
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
  const [lightboxAlt, setLightboxAlt] = useState<string>('');

  // Load thumbnails
  useEffect(() => {
    let mounted = true;

    async function load() {
      const newThumbnails = new Map<string, string>();

      for (const screenshot of screenshots) {
        // Check if already loaded
        if (thumbnails.has(screenshot.filename)) {
          newThumbnails.set(screenshot.filename, thumbnails.get(screenshot.filename)!);
          continue;
        }

        const url = await getUrl(screenshot.filename);
        if (url && mounted) {
          newThumbnails.set(screenshot.filename, url);
        }
      }

      if (mounted) {
        setThumbnails(newThumbnails);
      }
    }

    if (screenshots.length > 0) {
      load();
    }

    return () => {
      mounted = false;
    };
  }, [screenshots, getUrl]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      thumbnails.forEach((url) => URL.revokeObjectURL(url));
    };
  }, []);

  const openLightbox = useCallback((url: string, alt: string) => {
    setLightboxUrl(url);
    setLightboxAlt(alt);
  }, []);

  const closeLightbox = useCallback(() => {
    setLightboxUrl(null);
    setLightboxAlt('');
  }, []);

  // Handle keyboard navigation in lightbox
  useEffect(() => {
    if (!lightboxUrl) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        closeLightbox();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [lightboxUrl, closeLightbox]);

  if (screenshots.length === 0) {
    return null;
  }

  return (
    <>
      {/* Section header */}
      <div className="mb-3">
        <h4 className="text-sm font-medium text-gray-700 flex items-center gap-2">
          <ImageIcon className="w-4 h-4 text-gray-500" />
          Captures d'écran
          <span className="text-xs text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">
            {screenshots.length}
          </span>
        </h4>
      </div>

      {/* Thumbnail grid */}
      <div className="grid grid-cols-2 gap-2">
        {screenshots.map((screenshot) => {
          const url = thumbnails.get(screenshot.filename);
          return (
            <button
              key={screenshot.filename}
              onClick={() => url && openLightbox(url, screenshot.alt || screenshot.filename)}
              disabled={!url}
              className="aspect-video bg-gray-100 rounded-lg overflow-hidden border border-gray-200 hover:border-blue-400 hover:shadow-md transition-all focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:cursor-wait"
            >
              {url ? (
                <img
                  src={url}
                  alt={screenshot.alt || screenshot.filename}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <LoadingSpinner />
                </div>
              )}
            </button>
          );
        })}
      </div>

      {/* Lightbox */}
      {lightboxUrl && (
        <div
          className="fixed inset-0 bg-black/90 z-[100] flex items-center justify-center p-4"
          onClick={closeLightbox}
        >
          {/* Close button */}
          <button
            onClick={closeLightbox}
            className="absolute top-4 right-4 p-2 bg-white/10 hover:bg-white/20 rounded-full text-white transition-colors"
          >
            <CloseIcon className="w-6 h-6" />
          </button>

          {/* Image */}
          <img
            src={lightboxUrl}
            alt={lightboxAlt}
            className="max-w-full max-h-full object-contain rounded-lg shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          />

          {/* Caption */}
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 px-4 py-2 bg-black/50 rounded-lg">
            <p className="text-sm text-white">{lightboxAlt}</p>
          </div>

          {/* Instructions */}
          <div className="absolute bottom-4 right-4 text-xs text-white/50">
            Appuyez sur Échap pour fermer
          </div>
        </div>
      )}
    </>
  );
}

// ============================================================
// ICONS
// ============================================================

function ImageIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className || 'w-5 h-5'}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
      />
    </svg>
  );
}

function CloseIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className || 'w-5 h-5'}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M6 18L18 6M6 6l12 12"
      />
    </svg>
  );
}

function LoadingSpinner() {
  return (
    <div className="w-5 h-5 border-2 border-gray-300 border-t-blue-600 rounded-full animate-spin" />
  );
}
