/**
 * KanbanBoard Component Tests
 *
 * 15 tests covering:
 * - Basic rendering (4 tests)
 * - Column visibility (3 tests)
 * - Card rendering (4 tests)
 * - Width toggle (2 tests)
 * - Empty states (2 tests)
 */

import { describe, test, expect, vi, beforeEach } from 'vitest';
import { renderWithProviders as render, screen, fireEvent } from '../test-utils/test-wrapper';
import { KanbanBoard } from '../components/kanban/KanbanBoard';
import type { BacklogItem } from '../types/backlog';
import type { TypeDefinition } from '../types/typeConfig';

// ============================================================
// MOCKS
// ============================================================

// Mock @dnd-kit/core
vi.mock('@dnd-kit/core', () => ({
  DndContext: ({ children }: { children: React.ReactNode }) => <div data-testid="dnd-context">{children}</div>,
  closestCenter: vi.fn(),
  pointerWithin: vi.fn(),
  KeyboardSensor: class {},
  PointerSensor: class {},
  useSensor: vi.fn(() => ({})),
  useSensors: vi.fn(() => []),
  useDroppable: vi.fn(() => ({
    setNodeRef: vi.fn(),
    isOver: false,
  })),
  useDraggable: vi.fn(() => ({
    attributes: {},
    listeners: {},
    setNodeRef: vi.fn(),
    transform: null,
    isDragging: false,
  })),
  DragOverlay: ({ children }: { children: React.ReactNode }) => <div data-testid="drag-overlay">{children}</div>,
}));

// Mock @dnd-kit/sortable
vi.mock('@dnd-kit/sortable', () => ({
  SortableContext: ({ children }: { children: React.ReactNode }) => <div data-testid="sortable-context">{children}</div>,
  sortableKeyboardCoordinates: vi.fn(),
  horizontalListSortingStrategy: vi.fn(),
  useSortable: vi.fn(() => ({
    attributes: {},
    listeners: {},
    setNodeRef: vi.fn(),
    transform: null,
    transition: undefined,
    isDragging: false,
  })),
}));

// Mock @dnd-kit/utilities
vi.mock('@dnd-kit/utilities', () => ({
  CSS: {
    Transform: { toString: vi.fn(() => '') },
    Translate: { toString: vi.fn(() => '') },
  },
}));

// Mock @tanstack/react-virtual
vi.mock('@tanstack/react-virtual', () => ({
  useVirtualizer: vi.fn(() => ({
    getTotalSize: vi.fn(() => 500),
    getVirtualItems: vi.fn(() => []),
  })),
}));

// Mock useKanbanColumnWidths hook
vi.mock('../hooks/useKanbanColumnWidths', () => ({
  useKanbanColumnWidths: vi.fn(() => ({
    getMultiplier: vi.fn(() => 1),
    getWidth: vi.fn(() => 320),
    toggleWidth: vi.fn(),
  })),
  KANBAN_BASE_WIDTH: 320,
}));

// ============================================================
// TEST FIXTURES
// ============================================================

const createMockItem = (id: string, type: string): BacklogItem => ({
  id,
  type,
  title: `Test ${id}`,
  rawMarkdown: `### ${id} | Test\n---\n`,
  sectionIndex: 0,
} as BacklogItem);

const createMockType = (id: string, label: string, visible = true): TypeDefinition => ({
  id,
  label,
  color: '#3b82f6',
  order: 0,
  visible,
});

const mockTypes: TypeDefinition[] = [
  createMockType('BUG', 'Bugs'),
  createMockType('CT', 'Court Terme'),
  createMockType('LT', 'Long Terme'),
];

const mockItemsByType: Record<string, BacklogItem[]> = {
  BUG: [createMockItem('BUG-001', 'BUG'), createMockItem('BUG-002', 'BUG')],
  CT: [createMockItem('CT-001', 'CT')],
  LT: [],
};

const mockOnItemClick = vi.fn();

// ============================================================
// BASIC RENDERING TESTS (1-4)
// ============================================================

describe('KanbanBoard - Basic Rendering', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('1. renders DndContext wrapper', () => {
    render(
      <KanbanBoard
        itemsByType={mockItemsByType}
        types={mockTypes}
        onItemClick={mockOnItemClick}
      />
    );

    expect(screen.getByTestId('dnd-context')).toBeInTheDocument();
  });

  test('2. renders SortableContext wrapper', () => {
    render(
      <KanbanBoard
        itemsByType={mockItemsByType}
        types={mockTypes}
        onItemClick={mockOnItemClick}
      />
    );

    expect(screen.getByTestId('sortable-context')).toBeInTheDocument();
  });

  test('3. renders column headers with type labels', () => {
    render(
      <KanbanBoard
        itemsByType={mockItemsByType}
        types={mockTypes}
        onItemClick={mockOnItemClick}
      />
    );

    expect(screen.getByText('Bugs')).toBeInTheDocument();
    expect(screen.getByText('Court Terme')).toBeInTheDocument();
    expect(screen.getByText('Long Terme')).toBeInTheDocument();
  });

  test('4. renders item counts per column', () => {
    render(
      <KanbanBoard
        itemsByType={mockItemsByType}
        types={mockTypes}
        onItemClick={mockOnItemClick}
      />
    );

    // BUG has 2 items, CT has 1, LT has 0
    expect(screen.getByText('2')).toBeInTheDocument();
    expect(screen.getByText('1')).toBeInTheDocument();
    expect(screen.getByText('0')).toBeInTheDocument();
  });
});

// ============================================================
// COLUMN VISIBILITY TESTS (5-7)
// ============================================================

describe('KanbanBoard - Column Visibility', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('5. hides columns with visible=false', () => {
    const typesWithHidden = [
      createMockType('BUG', 'Bugs', true),
      createMockType('CT', 'Court Terme', false),  // Hidden
      createMockType('LT', 'Long Terme', true),
    ];

    render(
      <KanbanBoard
        itemsByType={mockItemsByType}
        types={typesWithHidden}
        onItemClick={mockOnItemClick}
      />
    );

    expect(screen.getByText('Bugs')).toBeInTheDocument();
    expect(screen.queryByText('Court Terme')).not.toBeInTheDocument();
    expect(screen.getByText('Long Terme')).toBeInTheDocument();
  });

  test('6. shows all columns when all visible=true', () => {
    render(
      <KanbanBoard
        itemsByType={mockItemsByType}
        types={mockTypes}
        onItemClick={mockOnItemClick}
      />
    );

    expect(screen.getByText('Bugs')).toBeInTheDocument();
    expect(screen.getByText('Court Terme')).toBeInTheDocument();
    expect(screen.getByText('Long Terme')).toBeInTheDocument();
  });

  test('7. renders empty state when no visible columns and no items', () => {
    const allHiddenTypes = mockTypes.map(t => ({ ...t, visible: false }));

    render(
      <KanbanBoard
        itemsByType={{}}
        types={allHiddenTypes}
        onItemClick={mockOnItemClick}
      />
    );

    expect(screen.getByText('Aucun item')).toBeInTheDocument();
  });
});

// ============================================================
// CARD RENDERING TESTS (8-11)
// ============================================================

describe('KanbanBoard - Card Rendering', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('8. renders card IDs', () => {
    render(
      <KanbanBoard
        itemsByType={mockItemsByType}
        types={mockTypes}
        onItemClick={mockOnItemClick}
      />
    );

    expect(screen.getByText('BUG-001')).toBeInTheDocument();
    expect(screen.getByText('BUG-002')).toBeInTheDocument();
    expect(screen.getByText('CT-001')).toBeInTheDocument();
  });

  test('9. renders card titles', () => {
    render(
      <KanbanBoard
        itemsByType={mockItemsByType}
        types={mockTypes}
        onItemClick={mockOnItemClick}
      />
    );

    expect(screen.getByText('Test BUG-001')).toBeInTheDocument();
    expect(screen.getByText('Test BUG-002')).toBeInTheDocument();
    expect(screen.getByText('Test CT-001')).toBeInTheDocument();
  });

  test('10. calls onItemClick when card is clicked', () => {
    render(
      <KanbanBoard
        itemsByType={mockItemsByType}
        types={mockTypes}
        onItemClick={mockOnItemClick}
      />
    );

    // Find and click the first card (bg-surface class used in current component)
    const card = screen.getByText('Test BUG-001').closest('div[class*="bg-surface"]');
    if (card) fireEvent.click(card);

    expect(mockOnItemClick).toHaveBeenCalled();
  });

  test('11. renders "Aucun item" when column has no items', () => {
    render(
      <KanbanBoard
        itemsByType={mockItemsByType}
        types={mockTypes}
        onItemClick={mockOnItemClick}
      />
    );

    // LT column has 0 items
    expect(screen.getByText('Aucun item')).toBeInTheDocument();
  });
});

// ============================================================
// WIDTH TOGGLE TESTS (12-13)
// ============================================================

describe('KanbanBoard - Width Toggle', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('12. renders width toggle buttons', () => {
    render(
      <KanbanBoard
        itemsByType={mockItemsByType}
        types={mockTypes}
        onItemClick={mockOnItemClick}
      />
    );

    // Each column should have a 1x button (default)
    const toggleButtons = screen.getAllByText('1x');
    expect(toggleButtons.length).toBeGreaterThan(0);
  });

  test('13. has accessible aria-label on toggle buttons', () => {
    render(
      <KanbanBoard
        itemsByType={mockItemsByType}
        types={mockTypes}
        onItemClick={mockOnItemClick}
      />
    );

    const buttons = screen.getAllByLabelText(/colonne/i);
    expect(buttons.length).toBeGreaterThan(0);
  });
});

// ============================================================
// EMPTY STATES TESTS (14-15)
// ============================================================

describe('KanbanBoard - Empty States', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('14. shows empty message when totalItems is 0 and no visible types', () => {
    render(
      <KanbanBoard
        itemsByType={{}}
        types={mockTypes.map(t => ({ ...t, visible: false }))}
        onItemClick={mockOnItemClick}
      />
    );

    expect(screen.getByText('Aucun item')).toBeInTheDocument();
  });

  test('15. renders columns even with empty itemsByType when types are visible', () => {
    render(
      <KanbanBoard
        itemsByType={{}}
        types={mockTypes}
        onItemClick={mockOnItemClick}
      />
    );

    // Columns are still shown, just empty
    expect(screen.getByText('Bugs')).toBeInTheDocument();
    expect(screen.getAllByText('Aucun item').length).toBe(3);
  });
});
