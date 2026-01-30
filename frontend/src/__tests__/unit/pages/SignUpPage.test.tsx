import { describe, it, expect, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { render } from '@testing-library/react';
import { AuthProvider } from '../../../contexts/AuthContext';
import SignUpPage from '../../../pages/SignUpPage';
import { setUserAuthenticated, resetAuthState } from '../../setup/mswHandlers';

function TestApp() {
  return (
    <MemoryRouter initialEntries={['/signup']}>
      <AuthProvider>
        <Routes>
          <Route path="/signup" element={<SignUpPage />} />
          <Route path="/" element={<div>Home Page</div>} />
        </Routes>
      </AuthProvider>
    </MemoryRouter>
  );
}

describe('SignUpPage', () => {
  beforeEach(() => {
    resetAuthState();
  });

  it('should render signup form', async () => {
    render(<TestApp />);

    await waitFor(() => {
      expect(screen.getByText('Create an Account')).toBeInTheDocument();
    });

    expect(screen.getByPlaceholderText('Enter your username')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Enter your email')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Enter your password')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Confirm your password')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Sign Up' })).toBeInTheDocument();
  });

  it('should redirect to home if already authenticated', async () => {
    setUserAuthenticated(true);
    render(<TestApp />);

    await waitFor(() => {
      expect(screen.getByText('Home Page')).toBeInTheDocument();
    });
  });

  it('should show password strength indicator', async () => {
    const user = userEvent.setup();
    render(<TestApp />);

    await waitFor(() => {
      expect(screen.getByPlaceholderText('Enter your password')).toBeInTheDocument();
    });

    // Type a weak password
    await user.type(screen.getByPlaceholderText('Enter your password'), 'weak');

    await waitFor(() => {
      expect(screen.getByText('Weak')).toBeInTheDocument();
    });

    // Clear and type a strong password
    await user.clear(screen.getByPlaceholderText('Enter your password'));
    await user.type(screen.getByPlaceholderText('Enter your password'), 'StrongPassword123!');

    await waitFor(() => {
      expect(screen.getByText('Strong')).toBeInTheDocument();
    });
  });

  it('should have required fields with validation', async () => {
    render(<TestApp />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Sign Up' })).toBeInTheDocument();
    });

    // Check that required inputs exist with required attribute
    const usernameInput = screen.getByPlaceholderText('Enter your username');
    const emailInput = screen.getByPlaceholderText('Enter your email');
    const passwordInput = screen.getByPlaceholderText('Enter your password');
    const confirmPasswordInput = screen.getByPlaceholderText('Confirm your password');

    expect(usernameInput).toBeRequired();
    expect(emailInput).toBeRequired();
    expect(passwordInput).toBeRequired();
    expect(confirmPasswordInput).toBeRequired();
  });

  it('should not submit when passwords do not match', async () => {
    const user = userEvent.setup();
    render(<TestApp />);

    await waitFor(() => {
      expect(screen.getByPlaceholderText('Enter your password')).toBeInTheDocument();
    });

    await user.type(screen.getByPlaceholderText('Enter your username'), 'testuser');
    await user.type(screen.getByPlaceholderText('Enter your email'), 'test@example.com');
    await user.type(screen.getByPlaceholderText('Enter your password'), 'Password123!');
    await user.type(screen.getByPlaceholderText('Confirm your password'), 'DifferentPassword!');
    await user.click(screen.getByRole('button', { name: 'Sign Up' }));

    // Should stay on signup page (not redirect to home)
    await waitFor(() => {
      expect(screen.getByText('Create an Account')).toBeInTheDocument();
    });
  });

  it('should signup successfully and redirect to home', async () => {
    const user = userEvent.setup();
    render(<TestApp />);

    await waitFor(() => {
      expect(screen.getByPlaceholderText('Enter your username')).toBeInTheDocument();
    });

    await user.type(screen.getByPlaceholderText('Enter your username'), 'newuser');
    await user.type(screen.getByPlaceholderText('Enter your email'), 'new@example.com');
    await user.type(screen.getByPlaceholderText('Enter your password'), 'Password123!');
    await user.type(screen.getByPlaceholderText('Confirm your password'), 'Password123!');
    await user.click(screen.getByRole('button', { name: 'Sign Up' }));

    await waitFor(() => {
      expect(screen.getByText('Home Page')).toBeInTheDocument();
    });
  });

  it('should have link to login', async () => {
    render(<TestApp />);

    await waitFor(() => {
      expect(screen.getByText('Log in')).toBeInTheDocument();
    });
  });
});
