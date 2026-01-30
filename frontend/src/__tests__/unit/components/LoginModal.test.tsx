import { describe, it, expect, beforeEach, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithUserAuth } from '../../setup/testUtils';
import LoginModal from '../../../components/LoginModal';
import { useAuth } from '../../../contexts/AuthContext';
import { resetAuthState } from '../../setup/mswHandlers';

// Test component that controls the modal visibility
function TestLoginModal() {
  const { openLoginModal, showLoginModal, user } = useAuth();

  return (
    <div>
      <button onClick={openLoginModal}>Open Login</button>
      <div data-testid="modal-visible">{showLoginModal ? 'visible' : 'hidden'}</div>
      <div data-testid="user">{user ? user.username : 'no user'}</div>
      <LoginModal />
    </div>
  );
}

describe('LoginModal', () => {
  beforeEach(() => {
    resetAuthState();
  });

  it('should not render when showLoginModal is false', () => {
    renderWithUserAuth(<TestLoginModal />);

    expect(screen.getByTestId('modal-visible')).toHaveTextContent('hidden');
    expect(screen.queryByText('Log In')).not.toBeInTheDocument();
  });

  it('should render login form when modal is opened', async () => {
    const user = userEvent.setup();
    renderWithUserAuth(<TestLoginModal />);

    await user.click(screen.getByText('Open Login'));

    expect(screen.getByTestId('modal-visible')).toHaveTextContent('visible');
    // Use getByRole for heading to avoid multiple matches with the button
    expect(screen.getByRole('heading', { name: 'Log In' })).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Username')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Password')).toBeInTheDocument();
  });

  it('should close modal when X button is clicked', async () => {
    const user = userEvent.setup();
    renderWithUserAuth(<TestLoginModal />);

    await user.click(screen.getByText('Open Login'));
    expect(screen.getByTestId('modal-visible')).toHaveTextContent('visible');

    await user.click(screen.getByRole('button', { name: 'X' }));

    await waitFor(() => {
      expect(screen.getByTestId('modal-visible')).toHaveTextContent('hidden');
    });
  });

  it('should login successfully with valid credentials', async () => {
    const user = userEvent.setup();
    renderWithUserAuth(<TestLoginModal />);

    await user.click(screen.getByText('Open Login'));

    await user.type(screen.getByPlaceholderText('Username'), 'testuser');
    await user.type(screen.getByPlaceholderText('Password'), 'Test123!');
    await user.click(screen.getByRole('button', { name: 'Log In' }));

    await waitFor(() => {
      expect(screen.getByTestId('user')).toHaveTextContent('testuser');
      expect(screen.getByTestId('modal-visible')).toHaveTextContent('hidden');
    });
  });

  it('should show error with invalid credentials', async () => {
    const user = userEvent.setup();
    renderWithUserAuth(<TestLoginModal />);

    await user.click(screen.getByText('Open Login'));

    await user.type(screen.getByPlaceholderText('Username'), 'wronguser');
    await user.type(screen.getByPlaceholderText('Password'), 'wrongpassword');
    await user.click(screen.getByRole('button', { name: 'Log In' }));

    await waitFor(() => {
      // Error is displayed in an alert div with class "alert-error"
      expect(document.querySelector('.alert-error')).toBeInTheDocument();
    });
  });

  it('should have link to signup page', async () => {
    const user = userEvent.setup();
    renderWithUserAuth(<TestLoginModal />);

    await user.click(screen.getByText('Open Login'));

    expect(screen.getByText('Create one')).toBeInTheDocument();
    expect(screen.getByText('Create one').closest('a')).toHaveAttribute('href', '/signup');
  });
});
