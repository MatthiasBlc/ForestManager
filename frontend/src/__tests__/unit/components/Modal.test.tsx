import { describe, it, expect, vi } from 'vitest';
import { screen, render, fireEvent } from '@testing-library/react';
import Modal from '../../../components/Modal';

describe('Modal', () => {
  it('should render children content', () => {
    const onClose = vi.fn();
    render(
      <Modal onClose={onClose}>
        <div>Modal Content</div>
      </Modal>
    );

    expect(screen.getByText('Modal Content')).toBeInTheDocument();
  });

  it('should have modal-open class', () => {
    const onClose = vi.fn();
    render(
      <Modal onClose={onClose}>
        <div>Content</div>
      </Modal>
    );

    const modal = document.querySelector('.modal');
    expect(modal).toHaveClass('modal-open');
  });

  it('should call onClose when clicking outside by default', () => {
    const onClose = vi.fn();
    render(
      <Modal onClose={onClose}>
        <div>Content</div>
      </Modal>
    );

    // Click outside the modal-box (on the modal backdrop)
    const modal = document.querySelector('.modal');
    if (modal) {
      fireEvent.mouseDown(modal);
    }

    expect(onClose).toHaveBeenCalled();
  });

  it('should not call onClose when disableClickOutside is true', () => {
    const onClose = vi.fn();
    render(
      <Modal onClose={onClose} disableClickOutside>
        <div>Content</div>
      </Modal>
    );

    // Click outside the modal-box
    const modal = document.querySelector('.modal');
    if (modal) {
      fireEvent.mouseDown(modal);
    }

    expect(onClose).not.toHaveBeenCalled();
  });
});
