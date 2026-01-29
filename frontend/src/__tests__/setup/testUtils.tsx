import { ReactNode } from 'react';
import { render, RenderOptions } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { AuthProvider } from '../../contexts/AuthContext';
import { AdminAuthProvider } from '../../contexts/AdminAuthContext';

// Wrapper avec tous les providers necessaires
interface WrapperProps {
  children: ReactNode;
}

function AllProviders({ children }: WrapperProps) {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AdminAuthProvider>
          {children}
        </AdminAuthProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}

// Wrapper uniquement pour les routes user
function UserProviders({ children }: WrapperProps) {
  return (
    <BrowserRouter>
      <AuthProvider>
        {children}
      </AuthProvider>
    </BrowserRouter>
  );
}

// Wrapper uniquement pour les routes admin
function AdminProviders({ children }: WrapperProps) {
  return (
    <BrowserRouter>
      <AdminAuthProvider>
        {children}
      </AdminAuthProvider>
    </BrowserRouter>
  );
}

// Custom render avec tous les providers
function customRender(
  ui: React.ReactElement,
  options?: Omit<RenderOptions, 'wrapper'>
) {
  return render(ui, { wrapper: AllProviders, ...options });
}

// Custom render pour les composants user uniquement
function renderWithUserAuth(
  ui: React.ReactElement,
  options?: Omit<RenderOptions, 'wrapper'>
) {
  return render(ui, { wrapper: UserProviders, ...options });
}

// Custom render pour les composants admin uniquement
function renderWithAdminAuth(
  ui: React.ReactElement,
  options?: Omit<RenderOptions, 'wrapper'>
) {
  return render(ui, { wrapper: AdminProviders, ...options });
}

// Re-export everything from testing-library
export * from '@testing-library/react';

// Override render with our custom render
export {
  customRender as render,
  renderWithUserAuth,
  renderWithAdminAuth,
};
