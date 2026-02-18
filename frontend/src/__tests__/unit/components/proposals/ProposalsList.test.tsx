import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { render } from '@testing-library/react';
import ProposalsList from '../../../../components/proposals/ProposalsList';
import { setUserAuthenticated, resetAuthState } from '../../../setup/mswHandlers';
import { RecipeIngredient } from '../../../../models/recipe';
import { Toaster } from 'react-hot-toast';

const currentIngredients: RecipeIngredient[] = [
  { id: 'ri-1', name: 'sugar', ingredientId: 'ing-1', quantity: 100, unitId: 'unit-1', unit: { id: 'unit-1', name: 'gramme', abbreviation: 'g' }, order: 0 },
  { id: 'ri-2', name: 'flour', ingredientId: 'ing-2', quantity: 200, unitId: null, unit: null, order: 1 },
];

function TestWrapper({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
      <Toaster />
    </>
  );
}

describe('ProposalsList', () => {
  const defaultProps = {
    recipeId: 'test-recipe-id',
    currentIngredients,
    onProposalDecided: vi.fn(),
  };

  beforeEach(() => {
    resetAuthState();
    setUserAuthenticated(true);
    vi.clearAllMocks();
  });

  it('should display pending proposals', async () => {
    render(
      <TestWrapper>
        <ProposalsList {...defaultProps} />
      </TestWrapper>
    );

    await waitFor(() => {
      expect(screen.getByText('Pending Proposals (1)')).toBeInTheDocument();
    });

    expect(screen.getByText('Updated Recipe Title')).toBeInTheDocument();
    expect(screen.getByText('alice')).toBeInTheDocument();
  });

  it('should show accept and reject buttons', async () => {
    render(
      <TestWrapper>
        <ProposalsList {...defaultProps} />
      </TestWrapper>
    );

    await waitFor(() => {
      expect(screen.getByText('Accept')).toBeInTheDocument();
      expect(screen.getByText('Reject')).toBeInTheDocument();
    });
  });

  it('should expand to show proposed changes with ingredients diff', async () => {
    const user = userEvent.setup();
    render(
      <TestWrapper>
        <ProposalsList {...defaultProps} />
      </TestWrapper>
    );

    await waitFor(() => {
      expect(screen.getByText('Show changes')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Show changes'));

    expect(screen.getByText('Proposed title:')).toBeInTheDocument();
    expect(screen.getByText('Proposed content:')).toBeInTheDocument();
    expect(screen.getByText('Proposed ingredients:')).toBeInTheDocument();
  });

  it('should show ingredient diff with added and removed', async () => {
    const user = userEvent.setup();
    render(
      <TestWrapper>
        <ProposalsList {...defaultProps} />
      </TestWrapper>
    );

    await waitFor(() => {
      expect(screen.getByText('Show changes')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Show changes'));

    // vanilla extract is added (not in current ingredients)
    expect(screen.getByText('+ Added:')).toBeInTheDocument();
    expect(screen.getByText(/vanilla extract/)).toBeInTheDocument();

    // flour is removed (in current but not in proposal)
    expect(screen.getByText('- Removed:')).toBeInTheDocument();
    expect(screen.getByText(/flour/)).toBeInTheDocument();
  });

  it('should accept a proposal and call onProposalDecided', async () => {
    const user = userEvent.setup();
    const onDecided = vi.fn();
    render(
      <TestWrapper>
        <ProposalsList {...defaultProps} onProposalDecided={onDecided} />
      </TestWrapper>
    );

    await waitFor(() => {
      expect(screen.getByText('Accept')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Accept'));

    await waitFor(() => {
      expect(screen.getByText('Proposal accepted')).toBeInTheDocument();
    });
    expect(onDecided).toHaveBeenCalled();
  });

  it('should reject a proposal and call onProposalDecided', async () => {
    const user = userEvent.setup();
    const onDecided = vi.fn();
    render(
      <TestWrapper>
        <ProposalsList {...defaultProps} onProposalDecided={onDecided} />
      </TestWrapper>
    );

    await waitFor(() => {
      expect(screen.getByText('Reject')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Reject'));

    await waitFor(() => {
      expect(screen.getByText('Proposal rejected - variant created')).toBeInTheDocument();
    });
    expect(onDecided).toHaveBeenCalled();
  });
});
