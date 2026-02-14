/**
 * DependencyGraphInner - React Flow + dagre graph rendering.
 *
 * Displays backlog items as nodes and "blocks" relations as directed edges,
 * automatically laid out as a top-to-bottom DAG using dagre.
 *
 * Only items with at least one relation are shown; isolated items are hidden.
 *
 * @module components/relations/DependencyGraphInner
 */

import { useEffect, useState, useCallback, useMemo } from 'react';
import {
  ReactFlow,
  Controls,
  Background,
  MiniMap,
  Handle,
  Position,
  MarkerType,
  useNodesState,
  useEdgesState,
  type Node,
  type Edge,
  type NodeProps,
  type NodeMouseHandler,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import dagre from 'dagre';

import { getAllRelationsForProject } from '../../db/queries/relations';
import type { ItemRelation } from '../../types/relations';
import type { BacklogItem } from '../../types/backlog';
import type { DependencyGraphProps } from './DependencyGraph';
import { useTheme } from '../../theme';
import { useTranslation } from '../../i18n';

// ============================================================
// CONSTANTS
// ============================================================

const NODE_WIDTH = 220;
const NODE_HEIGHT = 80;

// ============================================================
// CUSTOM NODE
// ============================================================

interface TicketNodeData extends Record<string, unknown> {
  itemId: string;
  title: string;
  type: string;
}

type TicketNode = Node<TicketNodeData, 'ticket'>;

function TicketNodeComponent({ data }: NodeProps<TicketNode>) {
  const truncatedTitle = data.title.length > 40
    ? data.title.slice(0, 37) + '...'
    : data.title;

  return (
    <div className="bg-surface border-2 border-zinc-300 rounded-lg shadow-sm px-3 py-2 w-[220px] cursor-pointer hover:border-blue-400 hover:shadow-md transition-all">
      <Handle type="target" position={Position.Top} className="!bg-zinc-400 !w-2 !h-2" />
      <div className="text-xs font-bold text-accent-text mb-1">{data.itemId}</div>
      <div className="text-xs text-zinc-600 leading-tight">{truncatedTitle}</div>
      <Handle type="source" position={Position.Bottom} className="!bg-zinc-400 !w-2 !h-2" />
    </div>
  );
}

const nodeTypes = { ticket: TicketNodeComponent };

// ============================================================
// DAGRE LAYOUT
// ============================================================

function getLayoutedElements(
  nodes: TicketNode[],
  edges: Edge[]
): { nodes: TicketNode[]; edges: Edge[] } {
  const g = new dagre.graphlib.Graph();
  g.setDefaultEdgeLabel(() => ({}));
  g.setGraph({
    rankdir: 'TB',
    nodesep: 60,
    ranksep: 100,
  });

  for (const node of nodes) {
    g.setNode(node.id, { width: NODE_WIDTH, height: NODE_HEIGHT });
  }

  for (const edge of edges) {
    g.setEdge(edge.source, edge.target);
  }

  dagre.layout(g);

  const layoutedNodes = nodes.map((node) => {
    const nodeWithPosition = g.node(node.id);
    return {
      ...node,
      position: {
        x: nodeWithPosition.x - NODE_WIDTH / 2,
        y: nodeWithPosition.y - NODE_HEIGHT / 2,
      },
    };
  });

  return { nodes: layoutedNodes, edges };
}

// ============================================================
// GRAPH BUILDER
// ============================================================

function buildGraph(
  items: BacklogItem[],
  relations: ItemRelation[]
): { nodes: TicketNode[]; edges: Edge[] } {
  // Collect all item IDs that participate in any relation
  const connectedIds = new Set<string>();
  for (const rel of relations) {
    connectedIds.add(rel.sourceId);
    connectedIds.add(rel.targetId);
  }

  // Create an item lookup for quick access
  const itemMap = new Map<string, BacklogItem>();
  for (const item of items) {
    itemMap.set(item.id, item);
  }

  // Build nodes only for items that have relations and exist in the backlog
  const nodes: TicketNode[] = [];
  for (const id of connectedIds) {
    const item = itemMap.get(id);
    if (!item) continue;

    nodes.push({
      id: item.id,
      type: 'ticket',
      position: { x: 0, y: 0 }, // Will be overridden by dagre
      data: {
        itemId: item.id,
        title: item.title,
        type: item.type,
      },
    });
  }

  // Build edges from relations
  // Normalize: blocks -> source to target, blocked-by -> target to source
  // Deduplicate edges by tracking source-target pairs
  const edgeSet = new Set<string>();
  const edges: Edge[] = [];

  for (const rel of relations) {
    let source: string;
    let target: string;
    let animated = true;
    let style: React.CSSProperties = {};

    if (rel.relationType === 'blocks') {
      source = rel.sourceId;
      target = rel.targetId;
    } else if (rel.relationType === 'blocked-by') {
      // Normalize: if A is blocked-by B, then B blocks A
      source = rel.targetId;
      target = rel.sourceId;
    } else {
      // related-to: show as dashed, non-directional
      source = rel.sourceId;
      target = rel.targetId;
      animated = false;
      style = { strokeDasharray: '5 5', stroke: '#94a3b8' };
    }

    // Only add if both nodes exist
    if (!connectedIds.has(source) || !connectedIds.has(target)) continue;
    if (!itemMap.has(source) || !itemMap.has(target)) continue;

    // Deduplicate
    const edgeKey = `${source}->${target}`;
    if (edgeSet.has(edgeKey)) continue;
    edgeSet.add(edgeKey);

    edges.push({
      id: `e-${rel.id}`,
      source,
      target,
      animated,
      style: {
        stroke: rel.relationType === 'related-to' ? '#94a3b8' : '#3b82f6',
        strokeWidth: 2,
        ...style,
      },
      markerEnd: {
        type: MarkerType.ArrowClosed,
        color: rel.relationType === 'related-to' ? '#94a3b8' : '#3b82f6',
      },
    });
  }

  return { nodes, edges };
}

// ============================================================
// COMPONENT
// ============================================================

export default function DependencyGraphInner({
  projectPath,
  projectId,
  items,
  onSelectItem,
  relationsVersion,
}: DependencyGraphProps) {
  const { resolved } = useTheme();
  const isDark = resolved === 'dark';
  const { t } = useTranslation();

  const [relations, setRelations] = useState<ItemRelation[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const [nodes, setNodes, onNodesChange] = useNodesState<TicketNode>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);

  // Fetch relations
  useEffect(() => {
    let cancelled = false;

    async function loadRelations() {
      setIsLoading(true);
      try {
        const rels = await getAllRelationsForProject(projectPath, projectId);
        if (!cancelled) {
          setRelations(rels);
        }
      } catch (error) {
        console.error('[DependencyGraph] Error loading relations:', error);
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    loadRelations();
    return () => { cancelled = true; };
  }, [projectPath, projectId, relationsVersion]);

  // Build and layout graph when relations or items change
  useEffect(() => {
    if (isLoading) return;

    const { nodes: rawNodes, edges: rawEdges } = buildGraph(items, relations);

    if (rawNodes.length === 0) {
      setNodes([]);
      setEdges([]);
      return;
    }

    const { nodes: layoutedNodes, edges: layoutedEdges } = getLayoutedElements(rawNodes, rawEdges);
    setNodes(layoutedNodes);
    setEdges(layoutedEdges);
  }, [items, relations, isLoading, setNodes, setEdges]);

  // Handle node click -> select item
  const handleNodeClick: NodeMouseHandler<TicketNode> = useCallback((_event, node) => {
    if (!onSelectItem) return;
    const item = items.find(i => i.id === node.id);
    if (item) {
      onSelectItem(item);
    }
  }, [items, onSelectItem]);

  // Empty state check
  const isEmpty = useMemo(() => !isLoading && nodes.length === 0, [isLoading, nodes.length]);

  if (isLoading) {
    return (
      <div className="h-[calc(100vh-130px)] flex items-center justify-center text-zinc-400">
        {t.relations.loading}
      </div>
    );
  }

  if (isEmpty) {
    return (
      <div className="h-[calc(100vh-130px)] flex items-center justify-center">
        <div className="text-center max-w-md">
          <div className="text-4xl mb-3">&#x1f310;</div>
          <h3 className="text-lg font-semibold text-zinc-700 mb-2">{t.empty.noRelations}</h3>
        </div>
      </div>
    );
  }

  return (
    <div className="h-[calc(100vh-130px)]">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeClick={handleNodeClick}
        nodeTypes={nodeTypes}
        fitView
        nodesDraggable
        nodesConnectable={false}
        elementsSelectable
        proOptions={{ hideAttribution: true }}
      >
        <Controls position="bottom-left" />
        <Background gap={16} size={1} color={isDark ? '#374151' : '#e5e7eb'} />
        <MiniMap
          nodeStrokeWidth={3}
          pannable
          zoomable
          style={{ height: 100, width: 150 }}
          maskColor={isDark ? 'rgba(0,0,0,0.6)' : 'rgba(240,240,240,0.7)'}
        />
      </ReactFlow>
    </div>
  );
}
