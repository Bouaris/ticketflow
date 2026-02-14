/**
 * ProjectCard - Individual project card for recent projects list
 */

import { useState, useEffect } from 'react';
import type { Project } from '../../types/project';
import { FolderIcon, CloseIcon } from '../ui/Icons';
import { useTranslation } from '../../i18n';

interface ProjectCardProps {
  project: Project;
  onSelect: (project: Project) => void;
  onRemove: (id: string) => void;
  onValidate?: (project: Project) => Promise<boolean>;
  onToggleFavorite?: (id: string) => void;
}

export function ProjectCard({ project, onSelect, onRemove, onValidate, onToggleFavorite }: ProjectCardProps) {
  const { t } = useTranslation();
  const [isValid, setIsValid] = useState(true);
  const [isHovered, setIsHovered] = useState(false);

  // Validate project path on mount
  useEffect(() => {
    if (onValidate) {
      onValidate(project).then(setIsValid);
    }
  }, [project, onValidate]);

  // Format relative time
  const formatRelativeTime = (timestamp: number): string => {
    const now = Date.now();
    const diff = now - timestamp;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return "À l'instant";
    if (minutes < 60) return `Il y a ${minutes} min`;
    if (hours < 24) return `Il y a ${hours}h`;
    if (days < 7) return `Il y a ${days}j`;
    return new Date(timestamp).toLocaleDateString('fr-FR');
  };

  // Truncate path for display
  const truncatePath = (path: string, maxLength: number = 40): string => {
    if (path.length <= maxLength) return path;
    const parts = path.split(/[/\\]/);
    if (parts.length <= 3) return path;
    return `${parts[0]}\\...\\${parts[parts.length - 2]}\\${parts[parts.length - 1]}`;
  };

  const handleClick = () => {
    if (isValid) {
      onSelect(project);
    }
  };

  const handleRemove = (e: React.MouseEvent) => {
    e.stopPropagation();
    onRemove(project.id);
  };

  const handleToggleFavorite = (e: React.MouseEvent) => {
    e.stopPropagation();
    onToggleFavorite?.(project.id);
  };

  return (
    <div
      onClick={handleClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className={`
        relative flex items-center justify-between p-4 rounded-lg border-2 transition-all duration-200
        shadow-sm hover:shadow-md
        ${isValid
          ? 'border-outline hover:border-blue-400 hover:bg-accent-soft/50 cursor-pointer'
          : 'border-outline bg-surface-alt opacity-60 cursor-not-allowed'
        }
      `}
    >
      {/* Project Info */}
      <div className="flex items-center gap-3 min-w-0 flex-1">
        {/* Folder Icon */}
        <div className={`
          flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center
          ${isValid ? 'bg-accent-soft text-accent-text' : 'bg-outline text-on-surface-faint'}
        `}>
          <FolderIcon />
        </div>

        {/* Text Content */}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h3 className={`font-semibold truncate ${isValid ? 'text-on-surface' : 'text-on-surface-muted'}`}>
              {project.name}
            </h3>
            {!isValid && (
              <span className="flex-shrink-0 text-xs text-danger-text bg-danger-soft px-2 py-0.5 rounded">
                Introuvable
              </span>
            )}
          </div>
          <p className="text-sm text-on-surface-muted truncate" title={project.path}>
            {truncatePath(project.path)}
          </p>
          <div className="flex items-center gap-3 mt-1 text-xs text-on-surface-faint">
            <span>{project.backlogFile}</span>
            <span>•</span>
            <span>{formatRelativeTime(project.lastOpened)}</span>
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex items-center gap-1 flex-shrink-0">
        {/* Favorite Toggle */}
        {onToggleFavorite && (
          <button
            onClick={handleToggleFavorite}
            className={`
              p-2 rounded-lg transition-colors
              ${project.isFavorite
                ? 'opacity-100 text-amber-400 hover:text-amber-500'
                : isHovered
                  ? 'opacity-100 text-on-surface-faint hover:text-amber-400'
                  : 'opacity-0'
              }
            `}
            title={project.isFavorite ? t.welcome.removeFromFavorites : t.welcome.addToFavorites}
          >
            {project.isFavorite
              ? <StarFilledIcon className="w-4 h-4" />
              : <StarIcon className="w-4 h-4" />
            }
          </button>
        )}

        {/* Remove Button */}
        <button
          onClick={handleRemove}
          className={`
            p-2 rounded-lg transition-all
            ${isHovered || !isValid
              ? 'opacity-100 bg-surface-alt hover:bg-danger-soft text-on-surface-muted hover:text-danger-text'
              : 'opacity-0'
            }
          `}
          title="Retirer de la liste"
        >
          <CloseIcon className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

// ============================================================
// ICONS
// ============================================================

function StarIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
    </svg>
  );
}

function StarFilledIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
    </svg>
  );
}
