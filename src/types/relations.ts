/**
 * Domain types for ticket relations.
 *
 * Relations express directional dependencies between backlog items:
 * - blocks: "A blocks B" (A must be done before B)
 * - blocked-by: inverse of blocks
 * - related-to: symmetric association
 *
 * @module types/relations
 */

export type RelationType = 'blocks' | 'blocked-by' | 'related-to';

export interface ItemRelation {
  id: number;
  projectId: number;
  sourceId: string;
  targetId: string;
  relationType: RelationType;
  /** null for manual relations, 0.0-1.0 for AI-suggested */
  confidence: number | null;
  reason: string | null;
  createdAt: string;
}

/** Invert a relation type for bidirectional display */
export function invertRelationType(type: RelationType): RelationType {
  switch (type) {
    case 'blocks': return 'blocked-by';
    case 'blocked-by': return 'blocks';
    case 'related-to': return 'related-to';
  }
}

/** Human-readable labels for relation types (French) */
export const RELATION_LABELS: Record<RelationType, string> = {
  'blocks': 'Bloque',
  'blocked-by': 'Bloqu\u00e9 par',
  'related-to': 'Li\u00e9 \u00e0',
};
