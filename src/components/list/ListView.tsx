/**
 * ListView component - Table view of backlog items.
 */

import { useState } from 'react';
import type { BacklogItem } from '../../types/backlog';
import { PRIORITY_LABELS } from '../../constants/labels';
import { ItemBadge } from '../shared/ItemBadge';
import { CriteriaProgress } from '../ui/Progress';
import { CameraIcon } from '../ui/Icons';

interface ListViewProps {
  items: BacklogItem[];
  onItemClick: (item: BacklogItem) => void;
}

type SortField = 'id' | 'type' | 'title' | 'priority' | 'effort' | 'severity';
type SortDirection = 'asc' | 'desc';

export function ListView({ items, onItemClick }: ListViewProps) {
  const [sortField, setSortField] = useState<SortField>('id');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');

  const sortedItems = [...items].sort((a, b) => {
    let comparison = 0;

    switch (sortField) {
      case 'id':
        comparison = a.id.localeCompare(b.id);
        break;
      case 'type':
        comparison = a.type.localeCompare(b.type);
        break;
      case 'title':
        comparison = a.title.localeCompare(b.title);
        break;
      case 'priority':
        const priorityOrder = { Haute: 0, Moyenne: 1, Faible: 2 };
        const aPriority = a.priority ? priorityOrder[a.priority] : 3;
        const bPriority = b.priority ? priorityOrder[b.priority] : 3;
        comparison = aPriority - bPriority;
        break;
      case 'effort':
        const effortOrder = { XS: 0, S: 1, M: 2, L: 3, XL: 4 };
        const aEffort = a.effort ? effortOrder[a.effort] : 5;
        const bEffort = b.effort ? effortOrder[b.effort] : 5;
        comparison = aEffort - bEffort;
        break;
      case 'severity':
        const severityOrder = { P0: 0, P1: 1, P2: 2, P3: 3, P4: 4 };
        const aSeverity = a.severity ? severityOrder[a.severity] : 5;
        const bSeverity = b.severity ? severityOrder[b.severity] : 5;
        comparison = aSeverity - bSeverity;
        break;
    }

    return sortDirection === 'asc' ? comparison : -comparison;
  });

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const SortHeader = ({ field, children }: { field: SortField; children: React.ReactNode }) => (
    <th
      onClick={() => handleSort(field)}
      className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 select-none"
    >
      <span className="flex items-center gap-1">
        {children}
        {sortField === field && (
          <span className="text-blue-600">
            {sortDirection === 'asc' ? '↑' : '↓'}
          </span>
        )}
      </span>
    </th>
  );

  if (items.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center text-gray-500">
        Aucun item à afficher
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-auto">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50 sticky top-0">
          <tr>
            <SortHeader field="id">ID</SortHeader>
            <SortHeader field="type">Type</SortHeader>
            <SortHeader field="title">Titre</SortHeader>
            <SortHeader field="priority">Priorité</SortHeader>
            <SortHeader field="effort">Effort</SortHeader>
            <SortHeader field="severity">Sévérité</SortHeader>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Critères
            </th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {sortedItems.map(item => (
            <tr
              key={item.id}
              onClick={() => onItemClick(item)}
              className="hover:bg-gray-50 cursor-pointer transition-colors"
            >
              <td className="px-4 py-3 whitespace-nowrap">
                <span className="text-sm font-mono text-gray-900">{item.id}</span>
              </td>
              <td className="px-4 py-3 whitespace-nowrap">
                <ItemBadge type={item.type} />
              </td>
              <td className="px-4 py-3">
                <div className="flex items-center gap-2">
                  {item.emoji && <span>{item.emoji}</span>}
                  <span className="text-sm text-gray-900 line-clamp-1">{item.title}</span>
                  {item.screenshots && item.screenshots.length > 0 && (
                    <span className="text-gray-400 flex-shrink-0" title={`${item.screenshots.length} capture(s)`}>
                      <CameraIcon />
                    </span>
                  )}
                </div>
              </td>
              <td className="px-4 py-3 whitespace-nowrap">
                {item.priority && (
                  <span className={`text-xs font-medium px-2 py-1 rounded ${
                    item.priority === 'Haute' ? 'bg-red-100 text-red-700' :
                    item.priority === 'Moyenne' ? 'bg-amber-100 text-amber-700' :
                    'bg-gray-100 text-gray-700'
                  }`}>
                    {PRIORITY_LABELS[item.priority]}
                  </span>
                )}
              </td>
              <td className="px-4 py-3 whitespace-nowrap">
                {item.effort && (
                  <span className={`text-xs font-medium px-2 py-1 rounded ${
                    item.effort === 'XS' || item.effort === 'S' ? 'bg-green-100 text-green-700' :
                    item.effort === 'M' ? 'bg-amber-100 text-amber-700' :
                    'bg-red-100 text-red-700'
                  }`}>
                    {item.effort}
                  </span>
                )}
              </td>
              <td className="px-4 py-3 whitespace-nowrap">
                {item.severity && (
                  <span className={`text-xs font-medium px-2 py-1 rounded ${
                    item.severity === 'P0' ? 'bg-red-100 text-red-700' :
                    item.severity === 'P1' ? 'bg-orange-100 text-orange-700' :
                    item.severity === 'P2' ? 'bg-amber-100 text-amber-700' :
                    'bg-gray-100 text-gray-700'
                  }`}>
                    {item.severity}
                  </span>
                )}
              </td>
              <td className="px-4 py-3 whitespace-nowrap">
                {item.criteria && item.criteria.length > 0 && (
                  <CriteriaProgress
                    completed={item.criteria.filter(c => c.checked).length}
                    total={item.criteria.length}
                    size="sm"
                  />
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
