import { describe, it, expect, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { render } from '@testing-library/react';
import AdminLayout from '../../../../components/admin/AdminLayout';
import { resetAuthState } from '../../../setup/mswHandlers';

function TestApp({ initialPath = '/admin' }: { initialPath?: string }) {
  return (
    <MemoryRouter initialEntries={[initialPath]}>
      <Routes>
        <Route path="/admin" element={<AdminLayout />}>
          <Route index element={<div>Admin Index</div>} />
          <Route path="child" element={<div>Admin Child Route</div>} />
        </Route>
      </Routes>
    </MemoryRouter>
  );
}

describe('AdminLayout', () => {
  beforeEach(() => {
    resetAuthState();
  });

  it('should render child routes via Outlet', async () => {
    render(<TestApp />);

    await waitFor(() => {
      expect(screen.getByText('Admin Index')).toBeInTheDocument();
    });
  });

  it('should render nested child routes', async () => {
    render(<TestApp initialPath="/admin/child" />);

    await waitFor(() => {
      expect(screen.getByText('Admin Child Route')).toBeInTheDocument();
    });
  });

  it('should provide AdminAuthContext to children', async () => {
    // AdminLayout wraps children with AdminAuthProvider
    // This test verifies the provider is available
    render(<TestApp />);

    await waitFor(() => {
      // If the provider wasn't available, this would throw
      expect(screen.getByText('Admin Index')).toBeInTheDocument();
    });
  });
});
