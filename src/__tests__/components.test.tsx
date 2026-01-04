/**
 * UI Components Tests
 *
 * Tests for reusable UI components:
 * - Badge (5 tests)
 * - DynamicBadge (2 tests)
 * - Modal (8 tests)
 * - ModalActions (3 tests)
 */

import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Badge, DynamicBadge } from '../components/ui/Badge';
import { Modal, ModalActions } from '../components/ui/Modal';

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
