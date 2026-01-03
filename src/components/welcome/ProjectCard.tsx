/**
 * ProjectCard - Individual project card for recent projects list
 */

import { useState, useEffect } from 'react';
import type { Project } from '../../types/project';
import { FolderIcon, CloseIcon } from '../ui/Icons';

interface ProjectCardProps {
  project: Project;
  onSelect: (project: Project) => void;
  onRemove: (id: string) => void;
  onValidate?: (project: Project) => Promise<boolean>;
}

export function ProjectCard({ project, onSelect, onRemove, onValidate }: ProjectCardProps) {
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

  return (
    <div
      onClick={handleClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className={`
        relative flex items-center justify-between p-4 rounded-lg border-2 transition-all
        ${isValid
          ? 'border-gray-200 hover:border-blue-400 hover:bg-blue-50/50 cursor-pointer'
          : 'border-gray-200 bg-gray-50 opacity-60 cursor-not-allowed'
        }
      `}
    >
      {/* Project Info */}
      <div className="flex items-center gap-3 min-w-0 flex-1">
        {/* Folder Icon */}
        <div className={`
          flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center
          ${isValid ? 'bg-blue-100 text-blue-600' : 'bg-gray-200 text-gray-400'}
        `}>
          <FolderIcon />
        </div>

        {/* Text Content */}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h3 className={`font-semibold truncate ${isValid ? 'text-gray-900' : 'text-gray-500'}`}>
              {project.name}
            </h3>
            {!isValid && (
              <span className="flex-shrink-0 text-xs text-red-500 bg-red-50 px-2 py-0.5 rounded">
                Introuvable
              </span>
            )}
          </div>
          <p className="text-sm text-gray-500 truncate" title={project.path}>
            {truncatePath(project.path)}
          </p>
          <div className="flex items-center gap-3 mt-1 text-xs text-gray-400">
            <span>{project.backlogFile}</span>
            <span>•</span>
            <span>{formatRelativeTime(project.lastOpened)}</span>
          </div>
        </div>
      </div>

      {/* Remove Button */}
      <button
        onClick={handleRemove}
        className={`
          flex-shrink-0 p-2 rounded-lg transition-all
          ${isHovered || !isValid
            ? 'opacity-100 bg-gray-100 hover:bg-red-100 text-gray-500 hover:text-red-600'
            : 'opacity-0'
          }
        `}
        title="Retirer de la liste"
      >
        <CloseIcon className="w-4 h-4" />
      </button>
    </div>
  );
}
