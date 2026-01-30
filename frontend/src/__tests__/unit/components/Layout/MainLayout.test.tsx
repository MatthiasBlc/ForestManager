import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { screen, waitFor, fireEvent } from '@testing-library/react';
import { render } from '../../../setup/testUtils';
import MainLayout from '../../../../components/Layout/MainLayout';

describe('MainLayout', () => {
  // Store original innerWidth
  const originalInnerWidth = window.innerWidth;

  beforeEach(() => {
    // Reset to a large window
    Object.defineProperty(window, 'innerWidth', {
      writable: true,
      configurable: true,
      value: 1024,
    });
  });

  afterEach(() => {
    // Restore original
    Object.defineProperty(window, 'innerWidth', {
      writable: true,
      configurable: true,
      value: originalInnerWidth,
    });
  });

  it('should render children content', () => {
    render(
      <MainLayout>
        <div>Page Content</div>
      </MainLayout>
    );

    expect(screen.getByText('Page Content')).toBeInTheDocument();
  });

  it('should render sidebar', () => {
    render(
      <MainLayout>
        <div>Content</div>
      </MainLayout>
    );

    // Check for sidebar elements
    expect(screen.getByText('My Recipes')).toBeInTheDocument();
  });

  it('should render menu button for mobile', () => {
    render(
      <MainLayout>
        <div>Content</div>
      </MainLayout>
    );

    // Menu button should exist (may appear multiple times)
    expect(screen.getAllByText('Menu').length).toBeGreaterThan(0);
  });

  it('should have drawer toggle checkbox', () => {
    render(
      <MainLayout>
        <div>Content</div>
      </MainLayout>
    );

    const checkbox = document.querySelector('#main-drawer');
    expect(checkbox).toBeInTheDocument();
    expect(checkbox).toHaveAttribute('type', 'checkbox');
  });

  it('should toggle sidebar when checkbox changes', () => {
    render(
      <MainLayout>
        <div>Content</div>
      </MainLayout>
    );

    const checkbox = document.querySelector('#main-drawer') as HTMLInputElement;
    expect(checkbox.checked).toBe(false);

    fireEvent.click(checkbox);
    expect(checkbox.checked).toBe(true);

    fireEvent.click(checkbox);
    expect(checkbox.checked).toBe(false);
  });

  it('should render main content area', () => {
    render(
      <MainLayout>
        <div>Main Content</div>
      </MainLayout>
    );

    const mainElement = document.querySelector('main');
    expect(mainElement).toBeInTheDocument();
    expect(mainElement).toHaveTextContent('Main Content');
  });
});
