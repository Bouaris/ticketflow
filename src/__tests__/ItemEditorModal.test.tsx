/**
 * ItemEditorModal Component Tests
 *
 * 18 tests covering:
 * - Modal visibility (2 tests)
 * - New vs Edit mode (3 tests)
 * - Tab navigation (3 tests)
 * - Form validation (4 tests)
 * - ID generation (3 tests)
 * - Close behavior (3 tests)
 */

import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ItemEditorModal } from '../components/editor/ItemEditorModal';
import type { BacklogItem } from '../types/backlog';
import type { TypeDefinition } from '../types/typeConfig';

// ============================================================
// MOCKS
// ============================================================

// Mock AI module
vi.mock('../lib/ai', () => ({
  hasApiKey: vi.fn(() => false),
  refineItem: vi.fn(),
  generateItemFromDescription: vi.fn(),
  getProvider: vi.fn(() => 'gemini'),
}));

// Mock screenshots module
vi.mock('../lib/screenshots', () => ({
  extractImageFromClipboard: vi.fn(() => null),
}));

// Mock sub-components to simplify tests
vi.mock('../components/editor/ScreenshotEditor', () => ({
  ScreenshotEditor: () => <div data-testid="screenshot-editor">Screenshot Editor Mock</div>,
}));

vi.mock('../components/editor/AIGenerationMode', () => ({
  AIGenerationMode: ({ onSwitchToManual }: { onSwitchToManual: () => void }) => (
    <div data-testid="ai-mode">
      <button onClick={onSwitchToManual}>Mode manuel</button>
    </div>
  ),
}));

// ============================================================
// TEST FIXTURES
// ============================================================

const mockTypes: TypeDefinition[] = [
  { id: 'BUG', label: 'Bugs', color: '#ef4444', order: 0, visible: true },
  { id: 'CT', label: 'Court Terme', color: '#3b82f6', order: 1, visible: true },
  { id: 'LT', label: 'Long Terme', color: '#10b981', order: 2, visible: true },
];

const createMockItem = (overrides: Partial<BacklogItem> = {}): BacklogItem => ({
  id: 'BUG-001',
  type: 'BUG',
  title: 'Existing Bug Title',
  rawMarkdown: '### BUG-001 | Existing Bug Title\n---\n',
  sectionIndex: 0,
  description: 'Bug description',
  ...overrides,
} as BacklogItem);

const defaultProps = {
  isOpen: true,
  onClose: vi.fn(),
  onSave: vi.fn(),
  existingIds: ['BUG-001', 'CT-001'],
  types: mockTypes,
};

// ============================================================
// MODAL VISIBILITY TESTS (1-2)
// ============================================================

describe('ItemEditorModal - Visibility', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('1. renders nothing when isOpen=false', () => {
    const { container } = render(
      <ItemEditorModal {...defaultProps} isOpen={false} />
    );

    expect(container.firstChild).toBeNull();
  });

  test('2. renders modal when isOpen=true', () => {
    render(<ItemEditorModal {...defaultProps} />);

    // Modal should be visible with title
    expect(screen.getByRole('heading', { level: 2 })).toBeInTheDocument();
  });
});

// ============================================================
// NEW VS EDIT MODE TESTS (3-5)
// ============================================================

describe('ItemEditorModal - New vs Edit Mode', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('3. shows AI mode by default for new items', () => {
    render(<ItemEditorModal {...defaultProps} item={null} />);

    // New item starts in AI mode
    expect(screen.getByTestId('ai-mode')).toBeInTheDocument();
    expect(screen.getByText("Créer avec l'IA")).toBeInTheDocument();
  });

  test('4. shows form mode for existing items', () => {
    const existingItem = createMockItem();
    render(<ItemEditorModal {...defaultProps} item={existingItem} />);

    // Existing item shows form, not AI mode
    expect(screen.queryByTestId('ai-mode')).not.toBeInTheDocument();
    expect(screen.getByText('Éditer BUG-001')).toBeInTheDocument();
  });

  test('5. can switch from AI mode to manual mode', () => {
    render(<ItemEditorModal {...defaultProps} item={null} />);

    // Click the switch button in AI mode
    fireEvent.click(screen.getByText('Mode manuel'));

    // Should now show form mode
    expect(screen.queryByTestId('ai-mode')).not.toBeInTheDocument();
    expect(screen.getByText('Nouvel item')).toBeInTheDocument();
  });
});

// ============================================================
// TAB NAVIGATION TESTS (6-8)
// ============================================================

describe('ItemEditorModal - Tab Navigation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('6. shows tabs in form mode', () => {
    const existingItem = createMockItem();
    render(<ItemEditorModal {...defaultProps} item={existingItem} />);

    expect(screen.getByText('Général')).toBeInTheDocument();
    expect(screen.getByText('Détails')).toBeInTheDocument();
    expect(screen.getByText('Critères')).toBeInTheDocument();
    expect(screen.getByText('Captures')).toBeInTheDocument();
  });

  test('7. switches to Details tab when clicked', () => {
    const existingItem = createMockItem();
    render(<ItemEditorModal {...defaultProps} item={existingItem} />);

    fireEvent.click(screen.getByText('Détails'));

    // Details tab content should be visible (ListEditor labels)
    expect(screen.getByText('Spécifications')).toBeInTheDocument();
    expect(screen.getByText('Dépendances')).toBeInTheDocument();
  });

  test('8. switches to Criteria tab when clicked', () => {
    const existingItem = createMockItem();
    render(<ItemEditorModal {...defaultProps} item={existingItem} />);

    fireEvent.click(screen.getByText('Critères'));

    // Criteria tab content should be visible
    expect(screen.getByText("Critères d'acceptation")).toBeInTheDocument();
  });
});

// ============================================================
// FORM VALIDATION TESTS (9-12)
// ============================================================

describe('ItemEditorModal - Form Validation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('9. shows required indicator on title field', () => {
    const existingItem = createMockItem();
    render(<ItemEditorModal {...defaultProps} item={existingItem} />);

    // Title label should have * indicator
    const titleLabel = screen.getByText('Titre');
    expect(titleLabel.parentElement?.textContent).toContain('*');
  });

  test('10. shows error when saving with empty title', async () => {
    render(<ItemEditorModal {...defaultProps} item={null} />);

    // Switch to manual mode
    fireEvent.click(screen.getByText('Mode manuel'));

    // Clear the title and try to save
    const titleInput = screen.getByPlaceholderText("Titre de l'item...");
    fireEvent.change(titleInput, { target: { value: '' } });

    // Click save
    fireEvent.click(screen.getByText('Créer'));

    // Should show error
    await waitFor(() => {
      expect(screen.getByText('Titre requis')).toBeInTheDocument();
    });
  });

  test('11. shows error when ID already exists', async () => {
    render(<ItemEditorModal {...defaultProps} item={null} />);

    // Switch to manual mode
    fireEvent.click(screen.getByText('Mode manuel'));

    // Change ID to an existing one
    const idInput = screen.getByDisplayValue(/BUG-\d{3}/);
    fireEvent.change(idInput, { target: { value: 'BUG-001' } });

    // Fill title
    const titleInput = screen.getByPlaceholderText("Titre de l'item...");
    fireEvent.change(titleInput, { target: { value: 'Some title' } });

    // Click save
    fireEvent.click(screen.getByText('Créer'));

    // Should show error
    await waitFor(() => {
      expect(screen.getByText('ID déjà existant')).toBeInTheDocument();
    });
  });

  test('12. calls onSave with valid data', async () => {
    render(<ItemEditorModal {...defaultProps} item={null} existingIds={[]} />);

    // Switch to manual mode
    fireEvent.click(screen.getByText('Mode manuel'));

    // Fill title
    const titleInput = screen.getByPlaceholderText("Titre de l'item...");
    fireEvent.change(titleInput, { target: { value: 'New Bug Title' } });

    // Click save
    fireEvent.click(screen.getByText('Créer'));

    // Should call onSave
    await waitFor(() => {
      expect(defaultProps.onSave).toHaveBeenCalled();
    });
  });
});

// ============================================================
// ID GENERATION TESTS (13-15)
// ============================================================

describe('ItemEditorModal - ID Generation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('13. auto-generates next ID for new items', () => {
    render(
      <ItemEditorModal
        {...defaultProps}
        item={null}
        existingIds={['BUG-001', 'BUG-002']}
      />
    );

    // Switch to manual mode to see the ID field
    fireEvent.click(screen.getByText('Mode manuel'));

    // Should auto-generate BUG-003 (next after BUG-002)
    expect(screen.getByDisplayValue('BUG-003')).toBeInTheDocument();
  });

  test('14. updates ID when type changes', () => {
    render(
      <ItemEditorModal
        {...defaultProps}
        item={null}
        existingIds={['BUG-001', 'CT-001', 'CT-002']}
      />
    );

    // Switch to manual mode
    fireEvent.click(screen.getByText('Mode manuel'));

    // Change type to CT
    const typeSelect = screen.getByDisplayValue('Bugs');
    fireEvent.change(typeSelect, { target: { value: 'CT' } });

    // ID should update to CT-003
    expect(screen.getByDisplayValue('CT-003')).toBeInTheDocument();
  });

  test('15. ID field is disabled when editing existing item', () => {
    const existingItem = createMockItem({ id: 'BUG-005' });
    render(<ItemEditorModal {...defaultProps} item={existingItem} />);

    const idInput = screen.getByDisplayValue('BUG-005');
    expect(idInput).toBeDisabled();
  });
});

// ============================================================
// CLOSE BEHAVIOR TESTS (16-18)
// ============================================================

describe('ItemEditorModal - Close Behavior', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('16. calls onClose when backdrop is clicked', () => {
    render(<ItemEditorModal {...defaultProps} item={createMockItem()} />);

    // Click the backdrop (the black overlay)
    const backdrop = document.querySelector('.bg-black\\/50');
    if (backdrop) fireEvent.click(backdrop);

    expect(defaultProps.onClose).toHaveBeenCalled();
  });

  test('17. calls onClose when close button is clicked', () => {
    render(<ItemEditorModal {...defaultProps} item={createMockItem()} />);

    // Find close button by its SVG or position
    const closeButtons = screen.getAllByRole('button');
    // The close button is typically near the header with an X icon
    const closeButton = closeButtons.find(btn =>
      btn.className.includes('text-gray-400')
    );
    if (closeButton) fireEvent.click(closeButton);

    expect(defaultProps.onClose).toHaveBeenCalled();
  });

  test('18. calls onClose when Annuler button is clicked', () => {
    render(<ItemEditorModal {...defaultProps} item={createMockItem()} />);

    fireEvent.click(screen.getByText('Annuler'));

    expect(defaultProps.onClose).toHaveBeenCalled();
  });
});
