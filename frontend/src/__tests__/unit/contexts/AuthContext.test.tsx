import { describe, it, expect, beforeEach } from 'vitest';
import { screen, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithUserAuth } from '../../setup/testUtils';
import { useAuth } from '../../../contexts/AuthContext';
import { setUserAuthenticated, resetAuthState } from '../../setup/mswHandlers';

// Composant de test pour acceder au contexte
function TestComponent() {
  const { user, isLoading, error, login, logout, signUp } = useAuth();

  return (
    <div>
      <div data-testid="loading">{isLoading ? 'loading' : 'ready'}</div>
      <div data-testid="user">{user ? user.username : 'no-user'}</div>
      <div data-testid="error">{error || 'no-error'}</div>
      <button onClick={() => login('testuser', 'Test123!')}>Login</button>
      <button onClick={() => logout()}>Logout</button>
      <button onClick={() => signUp('newuser', 'new@example.com', 'Password123!')}>
        Signup
      </button>
    </div>
  );
}

describe('AuthContext', () => {
  beforeEach(() => {
    resetAuthState();
  });

  it('should start with loading state then show no user', async () => {
    renderWithUserAuth(<TestComponent />);

    // Attendre que le loading soit termine
    await waitFor(() => {
      expect(screen.getByTestId('loading')).toHaveTextContent('ready');
    });

    expect(screen.getByTestId('user')).toHaveTextContent('no-user');
  });

  it('should restore user session on mount if authenticated', async () => {
    // Simuler un utilisateur deja connecte
    setUserAuthenticated(true);

    renderWithUserAuth(<TestComponent />);

    await waitFor(() => {
      expect(screen.getByTestId('loading')).toHaveTextContent('ready');
    });

    expect(screen.getByTestId('user')).toHaveTextContent('testuser');
  });

  it('should login user with valid credentials', async () => {
    const user = userEvent.setup();

    renderWithUserAuth(<TestComponent />);

    await waitFor(() => {
      expect(screen.getByTestId('loading')).toHaveTextContent('ready');
    });

    await act(async () => {
      await user.click(screen.getByText('Login'));
    });

    await waitFor(() => {
      expect(screen.getByTestId('user')).toHaveTextContent('testuser');
    });
  });

  it('should show error on login with invalid credentials', async () => {
    const user = userEvent.setup();

    // Composant avec mauvais credentials
    function BadLoginComponent() {
      const { error, login } = useAuth();
      return (
        <div>
          <div data-testid="error">{error || 'no-error'}</div>
          <button onClick={() => login('testuser', 'wrongpassword').catch(() => {})}>
            Login
          </button>
        </div>
      );
    }

    renderWithUserAuth(<BadLoginComponent />);

    await act(async () => {
      await user.click(screen.getByText('Login'));
    });

    await waitFor(() => {
      expect(screen.getByTestId('error')).not.toHaveTextContent('no-error');
    });
  });

  it('should signup new user', async () => {
    const user = userEvent.setup();

    renderWithUserAuth(<TestComponent />);

    await waitFor(() => {
      expect(screen.getByTestId('loading')).toHaveTextContent('ready');
    });

    await act(async () => {
      await user.click(screen.getByText('Signup'));
    });

    await waitFor(() => {
      expect(screen.getByTestId('user')).not.toHaveTextContent('no-user');
    });
  });

  it('should logout user', async () => {
    const user = userEvent.setup();

    // Commencer avec un utilisateur connecte
    setUserAuthenticated(true);

    renderWithUserAuth(<TestComponent />);

    await waitFor(() => {
      expect(screen.getByTestId('user')).toHaveTextContent('testuser');
    });

    await act(async () => {
      await user.click(screen.getByText('Logout'));
    });

    await waitFor(() => {
      expect(screen.getByTestId('user')).toHaveTextContent('no-user');
    });
  });
});
