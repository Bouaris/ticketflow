/**
 * DependencyGraph - Lazy-loaded wrapper for the dependency graph view.
 *
 * Uses React.lazy + Suspense to ensure the ~200KB React Flow bundle
 * only loads when the user switches to graph view mode.
 *
 * @module components/relations/DependencyGraph
 */

import { lazy, Suspense } from 'react';
import { Spinner } from '../ui/Spinner';
import type { BacklogItem } from '../../types/backlog';

const DependencyGraphInner = lazy(() => import('./DependencyGraphInner'));

export interface DependencyGraphProps {
  projectPath: string;
  projectId: number;
  items: BacklogItem[];
  onSelectItem?: (item: BacklogItem) => void;
  relationsVersion?: number;
}

export function DependencyGraph(props: DependencyGraphProps) {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center h-full">
        <Spinner />
        <span className="ml-2 text-zinc-400">Chargement du graphe...</span>
      </div>
    }>
      <DependencyGraphInner {...props} />
    </Suspense>
  );
}
