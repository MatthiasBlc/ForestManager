import { describe, it, expect, vi } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { render } from '../../../setup/testUtils';
import TagBadge from '../../../../components/recipes/TagBadge';
import { Tag } from '../../../../models/recipe';

describe('TagBadge', () => {
  it('should render approved tag with primary style', () => {
    const tag: Tag = { id: 'tag-1', name: 'dessert', scope: 'GLOBAL', status: 'APPROVED' };
    render(<TagBadge tag={tag} />);

    const badge = screen.getByText('dessert');
    expect(badge).toBeInTheDocument();
    expect(badge.className).toContain('badge-primary');
    expect(badge.className).not.toContain('badge-warning');
  });

  it('should render tag without status as approved (primary style)', () => {
    const tag: Tag = { id: 'tag-1', name: 'dessert' };
    render(<TagBadge tag={tag} />);

    const badge = screen.getByText('dessert');
    expect(badge.className).toContain('badge-primary');
  });

  it('should render pending tag with warning outline style', () => {
    const tag: Tag = { id: 'tag-1', name: 'newtag', scope: 'COMMUNITY', status: 'PENDING' };
    render(<TagBadge tag={tag} />);

    const badge = screen.getByText('newtag', { exact: false });
    expect(badge.className).toContain('badge-outline');
    expect(badge.className).toContain('badge-warning');
    expect(badge.className).toContain('border-dashed');
  });

  it('should show "(pending)" text for pending tags', () => {
    const tag: Tag = { id: 'tag-1', name: 'newtag', status: 'PENDING' };
    render(<TagBadge tag={tag} />);

    expect(screen.getByText('(pending)')).toBeInTheDocument();
  });

  it('should not show "(pending)" text for approved tags', () => {
    const tag: Tag = { id: 'tag-1', name: 'dessert', status: 'APPROVED' };
    render(<TagBadge tag={tag} />);

    expect(screen.queryByText('(pending)')).not.toBeInTheDocument();
  });

  it('should render with sm size by default', () => {
    const tag: Tag = { id: 'tag-1', name: 'dessert' };
    render(<TagBadge tag={tag} />);

    const badge = screen.getByText('dessert');
    expect(badge.className).toContain('badge-sm');
  });

  it('should render with lg size when specified', () => {
    const tag: Tag = { id: 'tag-1', name: 'dessert' };
    render(<TagBadge tag={tag} size="lg" />);

    const badge = screen.getByText('dessert');
    expect(badge.className).toContain('badge-lg');
  });

  it('should call onClick when clicked', async () => {
    const user = userEvent.setup();
    const handleClick = vi.fn();
    const tag: Tag = { id: 'tag-1', name: 'dessert' };
    render(<TagBadge tag={tag} onClick={handleClick} />);

    await user.click(screen.getByText('dessert'));
    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  it('should have cursor-pointer class when onClick is provided', () => {
    const tag: Tag = { id: 'tag-1', name: 'dessert' };
    render(<TagBadge tag={tag} onClick={() => {}} />);

    const badge = screen.getByText('dessert');
    expect(badge.className).toContain('cursor-pointer');
  });

  it('should have title "Pending approval" for pending tags', () => {
    const tag: Tag = { id: 'tag-1', name: 'newtag', status: 'PENDING' };
    render(<TagBadge tag={tag} />);

    const badge = screen.getByText('newtag', { exact: false });
    expect(badge).toHaveAttribute('title', 'Pending approval');
  });
});
