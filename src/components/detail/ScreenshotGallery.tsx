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
import { ImageIcon, CloseIcon } from '../ui/Icons';
import { Spinner } from '../ui/Spinner';

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
        <h4 className="text-sm font-medium text-on-surface-secondary flex items-center gap-2">
          <ImageIcon className="w-4 h-4 text-on-surface-muted" />
          Captures d'écran
          <span className="text-xs text-on-surface-faint bg-surface-alt px-1.5 py-0.5 rounded">
            {screenshots.length}
          </span>
        </h4>
      </div>

      {/* Thumbnail grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {screenshots.map((screenshot) => {
          const url = thumbnails.get(screenshot.filename);
          return (
            <button
              key={screenshot.filename}
              onClick={() => url && openLightbox(url, screenshot.alt || screenshot.filename)}
              disabled={!url}
              className="aspect-video bg-surface-alt rounded-lg overflow-hidden border border-outline hover:border-accent hover:shadow-md transition-all focus:outline-none focus:ring-2 focus:ring-accent disabled:cursor-wait"
            >
              {url ? (
                <img
                  src={url}
                  alt={screenshot.alt || screenshot.filename}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <Spinner size="sm" />
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

