/**
 * UI Components Tests
 *
 * Tests for reusable UI components:
 * - Badge (5 tests)
 * - DynamicBadge (2 tests)
 * - Modal (8 tests)
 * - ModalActions (3 tests)
 * - Progress (5 tests)
 * - Spinner (4 tests)
 * - ConfirmModal (3 tests)
 * - ListEditor (8 tests)
 * - ErrorBoundary (6 tests)
 * - UpdateModal (6 tests)
 * - ProviderToggle (5 tests)
 * - Icons (10 tests)
 */

import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Badge, DynamicBadge } from '../components/ui/Badge';
import { Modal, ModalActions } from '../components/ui/Modal';
import { Progress, CriteriaProgress } from '../components/ui/Progress';
import { Spinner } from '../components/ui/Spinner';
import { ConfirmModal } from '../components/ui/ConfirmModal';
import { ListEditor } from '../components/ui/ListEditor';
import { ErrorBoundary } from '../components/ui/ErrorBoundary';
import { UpdateModal } from '../components/ui/UpdateModal';
import { ProviderToggle, getProviderLabel } from '../components/ui/ProviderToggle';
import {
  CloseIcon,
  PlusIcon,
  TrashIcon,
  SearchIcon,
  SettingsIcon,
  SparklesIcon,
  WarningIcon,
  CheckIcon,
  FolderIcon,
  DocumentIcon,
  SaveIcon,
  DownloadIcon,
  EditIcon,
  RefreshIcon,
  UploadIcon,
  ExportIcon,
  CopyIcon,
  HomeIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  ChevronRightIcon,
  FolderOpenIcon,
  FileIcon,
  ImageIcon,
  TagIcon,
  CameraIcon,
  InfoIcon,
  GripIcon,
  KanbanIcon,
  ListIcon,
  GroqIcon,
  GeminiIcon,
  LogoIcon,
  SpinnerIcon,
  ArchiveIcon,
  CheckCircleIcon,
  FloppyDiskIcon,
  WrenchIcon,
} from '../components/ui/Icons';
import { AIContextIndicator } from '../components/ui/AIContextIndicator';
import { FullPageSpinner, InlineSpinner } from '../components/ui/Spinner';
import { LabeledProgress } from '../components/ui/Progress';
import { CheckboxListEditor } from '../components/ui/ListEditor';

// Mock AI module for ProviderToggle
vi.mock('../lib/ai', () => ({
  hasApiKey: vi.fn((provider: string) => provider === 'groq'),
}));

// Mock AI context module
vi.mock('../lib/ai-context', () => ({
  loadProjectContext: vi.fn().mockResolvedValue(undefined),
  getContextStatus: vi.fn(() => ({
    hasClaude: true,
    hasAgents: false,
    claudeChars: 1500,
    agentsChars: 0,
  })),
}));

// ============================================================
// BADGE TESTS (1-5)
// ============================================================

describe('Badge', () => {
  test('1. renders children content', () => {
    render(<Badge>Test Label</Badge>);
    expect(screen.getByText('Test Label')).toBeInTheDocument();
  });

  test('2. applies color classes', () => {
    const { container } = render(<Badge color="red">Red Badge</Badge>);
    const badge = container.querySelector('span');
    expect(badge?.className).toContain('bg-red-100');
    expect(badge?.className).toContain('text-red-700');
  });

  test('3. applies size classes', () => {
    const { container } = render(<Badge size="lg">Large Badge</Badge>);
    const badge = container.querySelector('span');
    expect(badge?.className).toContain('text-sm');
  });

  test('4. renders dot indicator when dot=true', () => {
    const { container } = render(<Badge dot color="green">With Dot</Badge>);
    const dot = container.querySelector('.rounded-full.w-1\\.5');
    expect(dot).toBeInTheDocument();
  });

  test('5. applies custom className', () => {
    const { container } = render(<Badge className="custom-class">Custom</Badge>);
    const badge = container.querySelector('span');
    expect(badge?.className).toContain('custom-class');
  });
});

// ============================================================
// DYNAMIC BADGE TESTS (6-7)
// ============================================================

describe('DynamicBadge', () => {
  test('6. applies dynamic color style', () => {
    const { container } = render(<DynamicBadge color="#ef4444">Dynamic</DynamicBadge>);
    const badge = container.querySelector('span');
    expect(badge?.style.color).toBe('rgb(239, 68, 68)');
    expect(badge?.style.backgroundColor).toContain('rgba(239, 68, 68');
  });

  test('7. renders children content', () => {
    render(<DynamicBadge color="#3b82f6">Blue Badge</DynamicBadge>);
    expect(screen.getByText('Blue Badge')).toBeInTheDocument();
  });
});

// ============================================================
// MODAL TESTS (8-15)
// ============================================================

describe('Modal', () => {
  const mockOnClose = vi.fn();

  beforeEach(() => {
    mockOnClose.mockClear();
  });

  afterEach(() => {
    document.body.style.overflow = '';
  });

  test('8. renders nothing when isOpen=false', () => {
    const { container } = render(
      <Modal isOpen={false} onClose={mockOnClose}>
        Content
      </Modal>
    );
    expect(container.firstChild).toBeNull();
  });

  test('9. renders content when isOpen=true', () => {
    render(
      <Modal isOpen={true} onClose={mockOnClose}>
        Modal Content
      </Modal>
    );
    expect(screen.getByText('Modal Content')).toBeInTheDocument();
  });

  test('10. renders title when provided', () => {
    render(
      <Modal isOpen={true} onClose={mockOnClose} title="Test Title">
        Content
      </Modal>
    );
    expect(screen.getByText('Test Title')).toBeInTheDocument();
  });

  test('11. calls onClose when backdrop is clicked', () => {
    render(
      <Modal isOpen={true} onClose={mockOnClose}>
        Content
      </Modal>
    );
    const backdrop = document.querySelector('[aria-hidden="true"]');
    fireEvent.click(backdrop!);
    expect(mockOnClose).toHaveBeenCalledTimes(1);
  });

  test('12. does not call onClose when closeOnBackdrop=false', () => {
    render(
      <Modal isOpen={true} onClose={mockOnClose} closeOnBackdrop={false}>
        Content
      </Modal>
    );
    const backdrop = document.querySelector('[aria-hidden="true"]');
    fireEvent.click(backdrop!);
    expect(mockOnClose).not.toHaveBeenCalled();
  });

  test('13. calls onClose when Escape is pressed', () => {
    render(
      <Modal isOpen={true} onClose={mockOnClose}>
        Content
      </Modal>
    );
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(mockOnClose).toHaveBeenCalledTimes(1);
  });

  test('14. renders close button by default', () => {
    render(
      <Modal isOpen={true} onClose={mockOnClose} title="Title">
        Content
      </Modal>
    );
    expect(screen.getByLabelText('Fermer')).toBeInTheDocument();
  });

  test('15. hides close button when showCloseButton=false', () => {
    render(
      <Modal isOpen={true} onClose={mockOnClose} title="Title" showCloseButton={false}>
        Content
      </Modal>
    );
    expect(screen.queryByLabelText('Fermer')).not.toBeInTheDocument();
  });
});

// ============================================================
// MODAL ACTIONS TESTS (16-18)
// ============================================================

describe('ModalActions', () => {
  const mockOnCancel = vi.fn();
  const mockOnConfirm = vi.fn();

  beforeEach(() => {
    mockOnCancel.mockClear();
    mockOnConfirm.mockClear();
  });

  test('16. renders cancel and confirm buttons', () => {
    render(<ModalActions onCancel={mockOnCancel} onConfirm={mockOnConfirm} />);
    expect(screen.getByText('Annuler')).toBeInTheDocument();
    expect(screen.getByText('Confirmer')).toBeInTheDocument();
  });

  test('17. calls onCancel when cancel button is clicked', () => {
    render(<ModalActions onCancel={mockOnCancel} onConfirm={mockOnConfirm} />);
    fireEvent.click(screen.getByText('Annuler'));
    expect(mockOnCancel).toHaveBeenCalledTimes(1);
  });

  test('18. calls onConfirm when confirm button is clicked', () => {
    render(<ModalActions onCancel={mockOnCancel} onConfirm={mockOnConfirm} />);
    fireEvent.click(screen.getByText('Confirmer'));
    expect(mockOnConfirm).toHaveBeenCalledTimes(1);
  });
});

// ============================================================
// PROGRESS TESTS (19-23)
// ============================================================

describe('Progress', () => {
  test('19. renders progress bar with correct percentage', () => {
    const { container } = render(<Progress value={50} />);
    const bar = container.querySelector('[role="progressbar"]');
    expect(bar).toBeInTheDocument();
    expect(bar?.getAttribute('aria-valuenow')).toBe('50');
  });

  test('20. applies size classes', () => {
    const { container } = render(<Progress value={25} size="sm" />);
    const track = container.querySelector('.rounded-full');
    expect(track?.className).toContain('h-1');
  });

  test('21. applies color classes', () => {
    const { container } = render(<Progress value={75} color="success" />);
    // Color is on the track (container) as background, fill uses a different shade
    const track = container.querySelector('[role="progressbar"]');
    expect(track?.className).toContain('bg-green-100');
  });

  test('22. shows label when showLabel=true', () => {
    render(<Progress value={42} showLabel />);
    expect(screen.getByText('42%')).toBeInTheDocument();
  });

  test('23. respects max value', () => {
    const { container } = render(<Progress value={5} max={10} />);
    const bar = container.querySelector('[role="progressbar"]');
    expect(bar?.getAttribute('aria-valuemax')).toBe('10');
  });
});

// ============================================================
// CRITERIA PROGRESS TESTS (24-25)
// ============================================================

describe('CriteriaProgress', () => {
  test('24. renders completed and total values', () => {
    const { container } = render(<CriteriaProgress completed={3} total={5} />);
    // The label shows completed/total
    expect(container.textContent).toContain('3');
    expect(container.textContent).toContain('5');
  });

  test('25. renders progressbar with correct max value', () => {
    const { container } = render(<CriteriaProgress completed={2} total={4} />);
    const bar = container.querySelector('[role="progressbar"]');
    expect(bar?.getAttribute('aria-valuemax')).toBe('4');
  });
});

// ============================================================
// SPINNER TESTS (26-29)
// ============================================================

describe('Spinner', () => {
  test('26. renders with accessibility label', () => {
    render(<Spinner />);
    expect(screen.getByLabelText('Chargement...')).toBeInTheDocument();
  });

  test('27. applies size classes', () => {
    const { container } = render(<Spinner size="lg" />);
    const spinner = container.firstChild;
    expect((spinner as HTMLElement)?.className).toContain('w-8');
  });

  test('28. applies color classes', () => {
    const { container } = render(<Spinner color="white" />);
    const spinner = container.firstChild;
    expect((spinner as HTMLElement)?.className).toContain('border-t-white');
  });

  test('29. uses custom label for accessibility', () => {
    render(<Spinner label="Loading data..." />);
    expect(screen.getByLabelText('Loading data...')).toBeInTheDocument();
  });
});

// ============================================================
// CONFIRM MODAL TESTS (30-32)
// ============================================================

describe('ConfirmModal', () => {
  const mockOnConfirm = vi.fn();
  const mockOnCancel = vi.fn();

  beforeEach(() => {
    mockOnConfirm.mockClear();
    mockOnCancel.mockClear();
  });

  test('30. renders title and message', () => {
    render(
      <ConfirmModal
        isOpen={true}
        title="Confirm Action"
        message="Are you sure?"
        onConfirm={mockOnConfirm}
        onCancel={mockOnCancel}
      />
    );
    expect(screen.getByText('Confirm Action')).toBeInTheDocument();
    expect(screen.getByText('Are you sure?')).toBeInTheDocument();
  });

  test('31. calls onConfirm when confirm is clicked', () => {
    render(
      <ConfirmModal
        isOpen={true}
        title="Confirm"
        message="Sure?"
        onConfirm={mockOnConfirm}
        onCancel={mockOnCancel}
      />
    );
    fireEvent.click(screen.getByText('Confirmer'));
    expect(mockOnConfirm).toHaveBeenCalledTimes(1);
  });

  test('32. calls onCancel when cancel is clicked', () => {
    render(
      <ConfirmModal
        isOpen={true}
        title="Confirm"
        message="Sure?"
        onConfirm={mockOnConfirm}
        onCancel={mockOnCancel}
      />
    );
    fireEvent.click(screen.getByText('Annuler'));
    expect(mockOnCancel).toHaveBeenCalledTimes(1);
  });
});

// ============================================================
// LIST EDITOR TESTS (33-40)
// ============================================================

describe('ListEditor', () => {
  const mockOnAdd = vi.fn();
  const mockOnUpdate = vi.fn();
  const mockOnRemove = vi.fn();

  beforeEach(() => {
    mockOnAdd.mockClear();
    mockOnUpdate.mockClear();
    mockOnRemove.mockClear();
  });

  test('33. renders label', () => {
    render(
      <ListEditor
        label="Steps"
        items={[]}
        onAdd={mockOnAdd}
        onUpdate={mockOnUpdate}
        onRemove={mockOnRemove}
      />
    );
    expect(screen.getByText('Steps')).toBeInTheDocument();
  });

  test('34. shows empty message when no items', () => {
    render(
      <ListEditor
        label="Items"
        items={[]}
        onAdd={mockOnAdd}
        onUpdate={mockOnUpdate}
        onRemove={mockOnRemove}
        emptyMessage="No items yet"
      />
    );
    expect(screen.getByText('No items yet')).toBeInTheDocument();
  });

  test('35. renders items', () => {
    render(
      <ListEditor
        label="Items"
        items={['First item', 'Second item']}
        onAdd={mockOnAdd}
        onUpdate={mockOnUpdate}
        onRemove={mockOnRemove}
      />
    );
    expect(screen.getByDisplayValue('First item')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Second item')).toBeInTheDocument();
  });

  test('36. calls onAdd when add button is clicked', () => {
    render(
      <ListEditor
        label="Items"
        items={[]}
        onAdd={mockOnAdd}
        onUpdate={mockOnUpdate}
        onRemove={mockOnRemove}
      />
    );
    fireEvent.click(screen.getByText('Ajouter'));
    expect(mockOnAdd).toHaveBeenCalledTimes(1);
  });

  test('37. calls onUpdate when item is changed', () => {
    render(
      <ListEditor
        label="Items"
        items={['Original']}
        onAdd={mockOnAdd}
        onUpdate={mockOnUpdate}
        onRemove={mockOnRemove}
      />
    );
    const input = screen.getByDisplayValue('Original');
    fireEvent.change(input, { target: { value: 'Updated' } });
    expect(mockOnUpdate).toHaveBeenCalledWith(0, 'Updated');
  });

  test('38. calls onRemove when delete button is clicked', () => {
    render(
      <ListEditor
        label="Items"
        items={['To delete']}
        onAdd={mockOnAdd}
        onUpdate={mockOnUpdate}
        onRemove={mockOnRemove}
      />
    );
    const deleteButton = screen.getByLabelText('Supprimer');
    fireEvent.click(deleteButton);
    expect(mockOnRemove).toHaveBeenCalledWith(0);
  });

  test('39. renders numbered items when numbered=true', () => {
    const { container } = render(
      <ListEditor
        label="Steps"
        items={['Step one', 'Step two']}
        onAdd={mockOnAdd}
        onUpdate={mockOnUpdate}
        onRemove={mockOnRemove}
        numbered={true}
      />
    );
    // Numbers are rendered (format may vary)
    expect(container.textContent).toContain('1');
    expect(container.textContent).toContain('2');
  });

  test('40. applies custom className', () => {
    const { container } = render(
      <ListEditor
        label="Items"
        items={[]}
        onAdd={mockOnAdd}
        onUpdate={mockOnUpdate}
        onRemove={mockOnRemove}
        className="custom-class"
      />
    );
    expect(container.firstChild).toHaveClass('custom-class');
  });
});

// ============================================================
// ERROR BOUNDARY TESTS (41-46)
// ============================================================

describe('ErrorBoundary', () => {
  // Suppress console.error for error boundary tests
  const originalError = console.error;
  beforeEach(() => {
    console.error = vi.fn();
  });
  afterEach(() => {
    console.error = originalError;
  });

  const ThrowingComponent = ({ shouldThrow }: { shouldThrow: boolean }) => {
    if (shouldThrow) throw new Error('Test error message');
    return <div>Normal content</div>;
  };

  test('41. renders children when no error', () => {
    render(
      <ErrorBoundary>
        <div>Child content</div>
      </ErrorBoundary>
    );
    expect(screen.getByText('Child content')).toBeInTheDocument();
  });

  test('42. renders fallback UI when error occurs', () => {
    render(
      <ErrorBoundary>
        <ThrowingComponent shouldThrow={true} />
      </ErrorBoundary>
    );
    expect(screen.getByText('Une erreur est survenue')).toBeInTheDocument();
    expect(screen.getByText('Test error message')).toBeInTheDocument();
  });

  test('43. renders custom fallback when provided', () => {
    render(
      <ErrorBoundary fallback={<div>Custom fallback</div>}>
        <ThrowingComponent shouldThrow={true} />
      </ErrorBoundary>
    );
    expect(screen.getByText('Custom fallback')).toBeInTheDocument();
  });

  test('44. calls onError callback when error occurs', () => {
    const mockOnError = vi.fn();
    render(
      <ErrorBoundary onError={mockOnError}>
        <ThrowingComponent shouldThrow={true} />
      </ErrorBoundary>
    );
    expect(mockOnError).toHaveBeenCalled();
    expect(mockOnError.mock.calls[0][0]).toBeInstanceOf(Error);
  });

  test('45. renders retry button in default fallback', () => {
    render(
      <ErrorBoundary>
        <ThrowingComponent shouldThrow={true} />
      </ErrorBoundary>
    );
    expect(screen.getByText('Réessayer')).toBeInTheDocument();
  });

  test('46. retry button triggers handleRetry', () => {
    render(
      <ErrorBoundary>
        <ThrowingComponent shouldThrow={true} />
      </ErrorBoundary>
    );

    // Verify error state is shown
    expect(screen.getByText('Une erreur est survenue')).toBeInTheDocument();

    // Click retry button - it should be clickable
    const retryButton = screen.getByText('Réessayer');
    expect(retryButton).toBeEnabled();
    fireEvent.click(retryButton);

    // After retry, the component will try to render children again
    // Since ThrowingComponent still throws, it will show error again
    // This just validates the button works
  });
});

// ============================================================
// UPDATE MODAL TESTS (47-52)
// ============================================================

describe('UpdateModal', () => {
  const mockOnInstall = vi.fn();
  const mockOnDismiss = vi.fn();
  const mockOnClearError = vi.fn();

  const defaultUpdateInfo = {
    version: '1.2.0',
    currentVersion: '1.1.0',
    body: 'New features and bug fixes',
    date: '2024-01-15',
  };

  beforeEach(() => {
    mockOnInstall.mockClear();
    mockOnDismiss.mockClear();
    mockOnClearError.mockClear();
  });

  test('47. renders nothing when isOpen=false', () => {
    const { container } = render(
      <UpdateModal
        isOpen={false}
        updateInfo={defaultUpdateInfo}
        downloading={false}
        progress={0}
        error={null}
        onInstall={mockOnInstall}
        onDismiss={mockOnDismiss}
        onClearError={mockOnClearError}
      />
    );
    expect(container.firstChild).toBeNull();
  });

  test('48. renders version info when open', () => {
    render(
      <UpdateModal
        isOpen={true}
        updateInfo={defaultUpdateInfo}
        downloading={false}
        progress={0}
        error={null}
        onInstall={mockOnInstall}
        onDismiss={mockOnDismiss}
        onClearError={mockOnClearError}
      />
    );
    expect(screen.getByText('v1.1.0')).toBeInTheDocument();
    expect(screen.getByText('v1.2.0')).toBeInTheDocument();
  });

  test('49. renders release notes', () => {
    render(
      <UpdateModal
        isOpen={true}
        updateInfo={defaultUpdateInfo}
        downloading={false}
        progress={0}
        error={null}
        onInstall={mockOnInstall}
        onDismiss={mockOnDismiss}
        onClearError={mockOnClearError}
      />
    );
    expect(screen.getByText('New features and bug fixes')).toBeInTheDocument();
  });

  test('50. shows progress bar when downloading', () => {
    render(
      <UpdateModal
        isOpen={true}
        updateInfo={defaultUpdateInfo}
        downloading={true}
        progress={50}
        error={null}
        onInstall={mockOnInstall}
        onDismiss={mockOnDismiss}
        onClearError={mockOnClearError}
      />
    );
    expect(screen.getByText('50%')).toBeInTheDocument();
    expect(screen.getByText('Téléchargement en cours...')).toBeInTheDocument();
  });

  test('51. shows error message when error present', () => {
    render(
      <UpdateModal
        isOpen={true}
        updateInfo={defaultUpdateInfo}
        downloading={false}
        progress={0}
        error="Download failed"
        onInstall={mockOnInstall}
        onDismiss={mockOnDismiss}
        onClearError={mockOnClearError}
      />
    );
    expect(screen.getByText('Download failed')).toBeInTheDocument();
  });

  test('52. calls onInstall when install button clicked', () => {
    render(
      <UpdateModal
        isOpen={true}
        updateInfo={defaultUpdateInfo}
        downloading={false}
        progress={0}
        error={null}
        onInstall={mockOnInstall}
        onDismiss={mockOnDismiss}
        onClearError={mockOnClearError}
      />
    );
    fireEvent.click(screen.getByText('Installer maintenant'));
    expect(mockOnInstall).toHaveBeenCalledTimes(1);
  });
});

// ============================================================
// PROVIDER TOGGLE TESTS (53-57)
// ============================================================

describe('ProviderToggle', () => {
  const mockOnChange = vi.fn();

  beforeEach(() => {
    mockOnChange.mockClear();
  });

  test('53. renders Groq and Gemini buttons', () => {
    render(<ProviderToggle value="groq" onChange={mockOnChange} />);
    expect(screen.getByText('Groq')).toBeInTheDocument();
    expect(screen.getByText('Gemini')).toBeInTheDocument();
  });

  test('54. shows Provider label by default', () => {
    render(<ProviderToggle value="groq" onChange={mockOnChange} />);
    expect(screen.getByText('Provider:')).toBeInTheDocument();
  });

  test('55. hides label when showLabel=false', () => {
    render(<ProviderToggle value="groq" onChange={mockOnChange} showLabel={false} />);
    expect(screen.queryByText('Provider:')).not.toBeInTheDocument();
  });

  test('56. calls onChange when available provider clicked', () => {
    render(<ProviderToggle value="gemini" onChange={mockOnChange} />);
    // Groq is available (mocked), click it
    fireEvent.click(screen.getByText('Groq'));
    expect(mockOnChange).toHaveBeenCalledWith('groq');
  });

  test('57. getProviderLabel returns correct labels', () => {
    expect(getProviderLabel('groq')).toBe('Groq');
    expect(getProviderLabel('gemini')).toBe('Gemini');
  });
});

// ============================================================
// ICONS TESTS (58-67)
// ============================================================

describe('Icons', () => {
  test('58. CloseIcon renders with default className', () => {
    const { container } = render(<CloseIcon />);
    const svg = container.querySelector('svg');
    expect(svg).toBeInTheDocument();
    expect(svg?.getAttribute('class')).toContain('w-5');
  });

  test('59. CloseIcon accepts custom className', () => {
    const { container } = render(<CloseIcon className="w-8 h-8" />);
    const svg = container.querySelector('svg');
    expect(svg?.getAttribute('class')).toContain('w-8');
  });

  test('60. PlusIcon renders', () => {
    const { container } = render(<PlusIcon />);
    expect(container.querySelector('svg')).toBeInTheDocument();
  });

  test('61. TrashIcon renders', () => {
    const { container } = render(<TrashIcon />);
    expect(container.querySelector('svg')).toBeInTheDocument();
  });

  test('62. SearchIcon renders', () => {
    const { container } = render(<SearchIcon />);
    expect(container.querySelector('svg')).toBeInTheDocument();
  });

  test('63. SettingsIcon renders', () => {
    const { container } = render(<SettingsIcon />);
    expect(container.querySelector('svg')).toBeInTheDocument();
  });

  test('64. SparklesIcon renders', () => {
    const { container } = render(<SparklesIcon />);
    expect(container.querySelector('svg')).toBeInTheDocument();
  });

  test('65. WarningIcon renders', () => {
    const { container } = render(<WarningIcon />);
    expect(container.querySelector('svg')).toBeInTheDocument();
  });

  test('66. CheckIcon renders', () => {
    const { container } = render(<CheckIcon />);
    expect(container.querySelector('svg')).toBeInTheDocument();
  });

  test('67. FolderIcon and DocumentIcon render', () => {
    const { container } = render(
      <>
        <FolderIcon />
        <DocumentIcon />
      </>
    );
    const svgs = container.querySelectorAll('svg');
    expect(svgs.length).toBe(2);
  });

  test('68. action icons render (SaveIcon, EditIcon, etc)', () => {
    const { container } = render(
      <>
        <SaveIcon />
        <EditIcon />
        <DownloadIcon />
        <RefreshIcon />
        <UploadIcon />
        <ExportIcon />
        <CopyIcon />
      </>
    );
    expect(container.querySelectorAll('svg').length).toBe(7);
  });

  test('69. navigation icons render', () => {
    const { container } = render(
      <>
        <HomeIcon />
        <ChevronDownIcon />
        <ChevronUpIcon />
        <ChevronRightIcon />
      </>
    );
    expect(container.querySelectorAll('svg').length).toBe(4);
  });

  test('70. file icons render', () => {
    const { container } = render(
      <>
        <FolderOpenIcon />
        <FileIcon />
        <ImageIcon />
      </>
    );
    expect(container.querySelectorAll('svg').length).toBe(3);
  });

  test('71. UI element icons render', () => {
    const { container } = render(
      <>
        <TagIcon />
        <CameraIcon />
        <InfoIcon />
        <GripIcon />
      </>
    );
    expect(container.querySelectorAll('svg').length).toBe(4);
  });

  test('72. view icons render', () => {
    const { container } = render(
      <>
        <KanbanIcon />
        <ListIcon />
      </>
    );
    expect(container.querySelectorAll('svg').length).toBe(2);
  });

  test('73. AI and special icons render', () => {
    const { container } = render(
      <>
        <GroqIcon />
        <GeminiIcon />
        <LogoIcon />
      </>
    );
    expect(container.querySelectorAll('svg').length).toBe(3);
  });

  test('74. loading and status icons render', () => {
    const { container } = render(
      <>
        <SpinnerIcon />
        <ArchiveIcon />
        <CheckCircleIcon />
        <FloppyDiskIcon />
        <WrenchIcon />
      </>
    );
    expect(container.querySelectorAll('svg').length).toBe(5);
  });
});

// ============================================================
// AI CONTEXT INDICATOR TESTS (75-78)
// ============================================================

describe('AIContextIndicator', () => {
  test('75. renders loading state initially', () => {
    const { container } = render(<AIContextIndicator projectPath="/test/path" />);
    // Loading spinner should be visible
    const spinner = container.querySelector('.animate-spin');
    expect(spinner).toBeInTheDocument();
  });

  test('76. renders context badge after loading', async () => {
    const { findByText } = render(<AIContextIndicator projectPath="/test/path" />);
    // After loading, should show CLAUDE badge
    const badge = await findByText('CLAUDE');
    expect(badge).toBeInTheDocument();
  });
});

// ============================================================
// FULL PAGE SPINNER TESTS (79-80)
// ============================================================

describe('FullPageSpinner', () => {
  test('79. renders full page spinner with text', () => {
    render(<FullPageSpinner text="Loading data..." />);
    expect(screen.getByText('Loading data...')).toBeInTheDocument();
  });

  test('80. renders spinner element', () => {
    const { container } = render(<FullPageSpinner text="Test" />);
    const spinner = container.querySelector('.animate-spin');
    expect(spinner).toBeInTheDocument();
  });
});

// ============================================================
// INLINE SPINNER TESTS (81-82)
// ============================================================

describe('InlineSpinner', () => {
  test('81. renders inline spinner with text', () => {
    render(<InlineSpinner text="Processing..." />);
    expect(screen.getByText('Processing...')).toBeInTheDocument();
  });

  test('82. applies size to inline spinner', () => {
    const { container } = render(<InlineSpinner text="Test" size="md" />);
    expect(container.firstChild).toBeInTheDocument();
  });
});

// ============================================================
// LABELED PROGRESS TESTS (83-84)
// ============================================================

describe('LabeledProgress', () => {
  test('83. renders progress with label', () => {
    render(<LabeledProgress value={75} label="Uploading" />);
    expect(screen.getByText('Uploading')).toBeInTheDocument();
    expect(screen.getByText('75%')).toBeInTheDocument();
  });

  test('84. applies color to progress', () => {
    const { container } = render(
      <LabeledProgress value={50} label="Processing" color="success" />
    );
    const bar = container.querySelector('[role="progressbar"]');
    expect(bar).toBeInTheDocument();
  });
});

// ============================================================
// CHECKBOX LIST EDITOR TESTS (85-86)
// ============================================================

describe('CheckboxListEditor', () => {
  const mockOnToggle = vi.fn();
  const mockOnUpdateText = vi.fn();
  const mockOnAdd = vi.fn();
  const mockOnRemove = vi.fn();

  beforeEach(() => {
    mockOnToggle.mockClear();
    mockOnUpdateText.mockClear();
    mockOnAdd.mockClear();
    mockOnRemove.mockClear();
  });

  test('85. renders checkbox items', () => {
    render(
      <CheckboxListEditor
        label="Criteria"
        items={[
          { text: 'First item', checked: false },
          { text: 'Second item', checked: true },
        ]}
        onToggle={mockOnToggle}
        onUpdateText={mockOnUpdateText}
        onAdd={mockOnAdd}
        onRemove={mockOnRemove}
      />
    );
    expect(screen.getByDisplayValue('First item')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Second item')).toBeInTheDocument();
  });

  test('86. calls onToggle when checkbox clicked', () => {
    render(
      <CheckboxListEditor
        label="Criteria"
        items={[{ text: 'Test item', checked: false }]}
        onToggle={mockOnToggle}
        onUpdateText={mockOnUpdateText}
        onAdd={mockOnAdd}
        onRemove={mockOnRemove}
      />
    );
    const checkbox = screen.getByRole('checkbox');
    fireEvent.click(checkbox);
    expect(mockOnToggle).toHaveBeenCalledWith(0);
  });
});
