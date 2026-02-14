import { useRef, useState, useCallback, useEffect } from 'react';
import { STORAGE_KEYS } from '../constants/storage';

/**
 * Hook pour gerer le redimensionnement vertical des textareas avec:
 * - Auto-resize selon le contenu
 * - Persistence localStorage (global, pas par projet)
 * - Resize manuel toujours possible
 */

export type TextareaFieldId = 'description' | 'userStory' | 'aiPrompt';

interface TextareaHeights {
  description?: number;
  userStory?: number;
  aiPrompt?: number;
}

interface UseTextareaHeightOptions {
  fieldId: TextareaFieldId;
  minHeight?: number;        // Defaut: 72px (3 lignes)
  maxHeight?: number;        // Defaut: 400px
}

interface UseTextareaHeightReturn {
  style: React.CSSProperties;
  onMouseUp: () => void;
  onInput: () => void;       // Auto-resize on input
  ref: React.RefObject<HTMLTextAreaElement | null>;
}

// Hauteurs par defaut (en pixels)
const DEFAULT_HEIGHTS: Record<TextareaFieldId, number> = {
  description: 96,   // ~4 lignes
  userStory: 72,     // ~3 lignes
  aiPrompt: 144,     // ~6 lignes
};

const MIN_HEIGHT_DEFAULT = 72;  // 3 lignes minimum
const MAX_HEIGHT_DEFAULT = 400; // Maximum raisonnable

/**
 * Charge les hauteurs depuis localStorage
 */
function loadHeights(): TextareaHeights {
  try {
    const stored = localStorage.getItem(STORAGE_KEYS.TEXTAREA_HEIGHTS);
    if (stored) {
      return JSON.parse(stored) as TextareaHeights;
    }
  } catch (error) {
    console.warn('Failed to load textarea heights:', error);
  }
  return {};
}

/**
 * Sauvegarde les hauteurs dans localStorage
 */
function saveHeights(heights: TextareaHeights): void {
  try {
    localStorage.setItem(STORAGE_KEYS.TEXTAREA_HEIGHTS, JSON.stringify(heights));
  } catch (error) {
    console.warn('Failed to save textarea heights:', error);
  }
}

/**
 * Hook pour un textarea redimensionnable avec auto-resize et persistence
 */
export function useTextareaHeight(options: UseTextareaHeightOptions): UseTextareaHeightReturn {
  const {
    fieldId,
    minHeight = MIN_HEIGHT_DEFAULT,
    maxHeight = MAX_HEIGHT_DEFAULT
  } = options;

  const ref = useRef<HTMLTextAreaElement | null>(null);

  // Charger la hauteur initiale depuis localStorage ou utiliser le defaut
  const [height, setHeight] = useState<number>(() => {
    const stored = loadHeights();
    return stored[fieldId] ?? DEFAULT_HEIGHTS[fieldId];
  });

  // Track si l'utilisateur a manuellement resize (pour ne pas override)
  const hasManualResizeRef = useRef(false);

  // Synchroniser avec localStorage si la valeur change ailleurs
  useEffect(() => {
    const handleStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEYS.TEXTAREA_HEIGHTS && e.newValue) {
        try {
          const newHeights = JSON.parse(e.newValue) as TextareaHeights;
          if (newHeights[fieldId] !== undefined) {
            setHeight(newHeights[fieldId]!);
          }
        } catch {
          // Ignore parse errors
        }
      }
    };

    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, [fieldId]);

  // Auto-resize initial quand le contenu change (mount)
  useEffect(() => {
    if (ref.current && !hasManualResizeRef.current) {
      const scrollHeight = ref.current.scrollHeight;
      if (scrollHeight > minHeight) {
        const newHeight = Math.min(scrollHeight, maxHeight);
        setHeight(newHeight);
      }
    }
  }, [minHeight, maxHeight]);

  // Auto-resize on input - ajuste la hauteur selon le contenu
  const onInput = useCallback(() => {
    if (ref.current) {
      // Reset height to auto to get accurate scrollHeight
      ref.current.style.height = 'auto';
      const scrollHeight = ref.current.scrollHeight;

      // Clamp between min and max
      const newHeight = Math.max(minHeight, Math.min(maxHeight, scrollHeight));

      // Apply immediately for smooth UX
      ref.current.style.height = `${newHeight}px`;
      setHeight(newHeight);

      // Don't save on every keystroke - only on blur/mouseup
    }
  }, [minHeight, maxHeight]);

  // Sauvegarder la hauteur apres un resize manuel (onMouseUp)
  const onMouseUp = useCallback(() => {
    if (ref.current) {
      const newHeight = ref.current.offsetHeight;

      // Appliquer les contraintes min/max
      const clampedHeight = Math.max(minHeight, Math.min(maxHeight, newHeight));

      // Mark as manually resized
      hasManualResizeRef.current = true;

      if (clampedHeight !== height) {
        setHeight(clampedHeight);

        // Sauvegarder immediatement dans localStorage
        const currentHeights = loadHeights();
        saveHeights({
          ...currentHeights,
          [fieldId]: clampedHeight,
        });
      }
    }
  }, [fieldId, height, minHeight, maxHeight]);

  // Style a appliquer au textarea
  const style: React.CSSProperties = {
    height: `${height}px`,
    minHeight: `${minHeight}px`,
    maxHeight: `${maxHeight}px`,
  };

  return { style, onMouseUp, onInput, ref };
}
