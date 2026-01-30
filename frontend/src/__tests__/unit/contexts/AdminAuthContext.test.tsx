import { describe, it, expect, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithAdminAuth } from '../../setup/testUtils';
import { useAdminAuth } from '../../../contexts/AdminAuthContext';
import { setAdminAuthenticated, resetAuthState } from '../../setup/mswHandlers';

// Composant de test pour acceder au contexte
function TestComponent() {
  const { admin, isLoading, authStep, qrCode, error, loginStep1, loginStep2, logout, clearError } = useAdminAuth();

  const handleLoginStep1 = async (email: string, password: string) => {
    try {
      await loginStep1(email, password);
    } catch {
      // Error is handled by context
    }
  };

  const handleLoginStep2 = async (code: string) => {
    try {
      await loginStep2(code);
    } catch {
      // Error is handled by context
    }
  };

  return (
    <div>
      <div data-testid="loading">{isLoading ? 'loading' : 'ready'}</div>
      <div data-testid="step">{authStep}</div>
      <div data-testid="admin">{admin ? admin.email : 'no admin'}</div>
      <div data-testid="qrcode">{qrCode || 'no qrcode'}</div>
      <div data-testid="error">{error || 'no error'}</div>
      <button onClick={() => handleLoginStep1('admin@example.com', 'AdminTest123!')}>
        Login Step1
      </button>
      <button onClick={() => handleLoginStep1('newadmin@example.com', 'AdminTest123!')}>
        Login New Admin
      </button>
      <button onClick={() => handleLoginStep1('wrong@example.com', 'wrong')}>
        Login Invalid
      </button>
      <button onClick={() => handleLoginStep2('123456')}>Verify TOTP</button>
      <button onClick={() => handleLoginStep2('000000')}>Verify Invalid TOTP</button>
      <button onClick={() => logout()}>Logout</button>
      <button onClick={() => clearError()}>Clear Error</button>
    </div>
  );
}

describe('AdminAuthContext', () => {
  beforeEach(() => {
    resetAuthState();
  });

  it('should start with loading then idle state', async () => {
    renderWithAdminAuth(<TestComponent />);

    // Initialement loading
    expect(screen.getByTestId('loading')).toHaveTextContent('loading');

    // Puis ready avec step idle
    await waitFor(() => {
      expect(screen.getByTestId('loading')).toHaveTextContent('ready');
      expect(screen.getByTestId('step')).toHaveTextContent('idle');
    });
  });

  it('should restore admin session on mount if authenticated', async () => {
    setAdminAuthenticated(true);
    renderWithAdminAuth(<TestComponent />);

    await waitFor(() => {
      expect(screen.getByTestId('admin')).toHaveTextContent('admin@example.com');
      expect(screen.getByTestId('step')).toHaveTextContent('authenticated');
    });
  });

  it('should complete 2-step login flow', async () => {
    const user = userEvent.setup();
    renderWithAdminAuth(<TestComponent />);

    await waitFor(() => {
      expect(screen.getByTestId('loading')).toHaveTextContent('ready');
    });

    // Step 1: credentials
    await user.click(screen.getByText('Login Step1'));

    await waitFor(() => {
      expect(screen.getByTestId('step')).toHaveTextContent('totp');
    });

    // Step 2: TOTP
    await user.click(screen.getByText('Verify TOTP'));

    await waitFor(() => {
      expect(screen.getByTestId('step')).toHaveTextContent('authenticated');
      expect(screen.getByTestId('admin')).toHaveTextContent('admin@example.com');
    });
  });

  it('should show QR code for new admin (requiresTotpSetup)', async () => {
    const user = userEvent.setup();
    renderWithAdminAuth(<TestComponent />);

    await waitFor(() => {
      expect(screen.getByTestId('loading')).toHaveTextContent('ready');
    });

    await user.click(screen.getByText('Login New Admin'));

    await waitFor(() => {
      expect(screen.getByTestId('qrcode')).toHaveTextContent('data:image');
    });
  });

  it('should show error on invalid credentials', async () => {
    const user = userEvent.setup();
    renderWithAdminAuth(<TestComponent />);

    await waitFor(() => {
      expect(screen.getByTestId('loading')).toHaveTextContent('ready');
    });

    await user.click(screen.getByText('Login Invalid'));

    await waitFor(() => {
      expect(screen.getByTestId('error')).not.toHaveTextContent('no error');
    });
  });

  it('should logout admin', async () => {
    const user = userEvent.setup();
    setAdminAuthenticated(true);
    renderWithAdminAuth(<TestComponent />);

    await waitFor(() => {
      expect(screen.getByTestId('admin')).toHaveTextContent('admin@example.com');
    });

    await user.click(screen.getByText('Logout'));

    await waitFor(() => {
      expect(screen.getByTestId('admin')).toHaveTextContent('no admin');
      expect(screen.getByTestId('step')).toHaveTextContent('idle');
    });
  });

  it('should clear error', async () => {
    const user = userEvent.setup();
    renderWithAdminAuth(<TestComponent />);

    await waitFor(() => {
      expect(screen.getByTestId('loading')).toHaveTextContent('ready');
    });

    // Provoquer une erreur
    await user.click(screen.getByText('Login Invalid'));

    await waitFor(() => {
      expect(screen.getByTestId('error')).not.toHaveTextContent('no error');
    });

    // Clear l'erreur
    await user.click(screen.getByText('Clear Error'));

    await waitFor(() => {
      expect(screen.getByTestId('error')).toHaveTextContent('no error');
    });
  });
});
