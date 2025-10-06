import React from 'react';
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import UV_UserRegistration from '@/components/views/UV_UserRegistration';
import UV_UserLogin from '@/components/views/UV_UserLogin';
import { useAppStore } from '@/store/main';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
    },
    mutations: {
      retry: false,
    },
  },
});

const Wrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <QueryClientProvider client={queryClient}>
    <BrowserRouter>{children}</BrowserRouter>
  </QueryClientProvider>
);

describe('Auth E2E Flow (Vitest, real API)', () => {
  beforeEach(() => {
    localStorage.clear();
    queryClient.clear();
    useAppStore.setState((state) => ({
      authentication_state: {
        ...state.authentication_state,
        auth_token: null,
        current_user: null,
        authentication_status: {
          is_authenticated: false,
          is_loading: false,
        },
        error_message: null,
      },
      current_bom: {
        id: null,
        title: null,
        items: [],
        total_cost: 0,
        item_count: 0,
        last_updated: null,
      },
    }));
  });

  it('completes full auth flow: register -> logout -> sign-in', async () => {
    const uniqueEmail = `user${Date.now()}@example.com`;
    const testPassword = 'testpass123';
    const testName = 'Test User';
    
    const user = userEvent.setup();

    const { unmount: unmountRegistration } = render(<UV_UserRegistration />, { wrapper: Wrapper });

    await waitFor(() => {
      expect(screen.getByText(/Choose Your Account Type/i)).toBeInTheDocument();
    });

    const buyerButton = screen.getByRole('button', { name: /Buyer/i });
    await user.click(buyerButton);

    await waitFor(() => {
      const continueButton = screen.getByRole('button', { name: /Continue/i });
      expect(continueButton).not.toBeDisabled();
    });
    await user.click(screen.getByRole('button', { name: /Continue/i }));

    await waitFor(() => {
      expect(screen.getByText(/Basic Information/i)).toBeInTheDocument();
    });

    const nameInput = screen.getByLabelText(/Full Name/i);
    const emailInput = screen.getByLabelText(/Email Address/i);
    const passwordInput = screen.getAllByLabelText(/Password/i)[0];

    await user.type(nameInput, testName);
    await user.type(emailInput, uniqueEmail);
    await user.type(passwordInput, testPassword);

    await waitFor(() => {
      const continueButton = screen.getByRole('button', { name: /Continue/i });
      expect(continueButton).not.toBeDisabled();
    });
    await user.click(screen.getByRole('button', { name: /Continue/i }));

    await waitFor(() => {
      expect(screen.getByText(/Location Setup/i)).toBeInTheDocument();
    });

    const locationContinueButtons = screen.getAllByRole('button', { name: /Continue/i });
    await user.click(locationContinueButtons[0]);

    await waitFor(() => {
      expect(screen.getByText(/Review & Complete/i)).toBeInTheDocument();
    });

    const createAccountButton = screen.getByRole('button', { name: /Create Account/i });
    await user.click(createAccountButton);

    await waitFor(
      () => {
        const state = useAppStore.getState();
        expect(state.authentication_state.authentication_status.is_authenticated).toBe(true);
        expect(state.authentication_state.auth_token).toBeTruthy();
        expect(state.authentication_state.current_user).toBeTruthy();
        expect(state.authentication_state.current_user?.email).toBe(uniqueEmail.toLowerCase().trim());
        expect(state.authentication_state.current_user?.name).toBe(testName.trim());
      },
      { timeout: 20000 }
    );

    unmountRegistration();

    await useAppStore.getState().logout_user();

    await waitFor(() => {
      const loggedOutState = useAppStore.getState();
      expect(loggedOutState.authentication_state.authentication_status.is_authenticated).toBe(false);
      expect(loggedOutState.authentication_state.auth_token).toBeNull();
      expect(loggedOutState.authentication_state.current_user).toBeNull();
    });

    const { unmount: unmountLogin } = render(<UV_UserLogin />, { wrapper: Wrapper });

    await waitFor(() => {
      expect(screen.getByText(/Welcome Back/i)).toBeInTheDocument();
    });

    const loginEmailInput = screen.getByLabelText(/Email Address/i);
    const loginPasswordInput = screen.getByLabelText(/Password/i);

    await user.type(loginEmailInput, uniqueEmail);
    await user.type(loginPasswordInput, testPassword);

    const signInButton = screen.getByRole('button', { name: /Sign In/i });
    await waitFor(() => expect(signInButton).not.toBeDisabled());
    await user.click(signInButton);

    await waitFor(
      () => {
        const state = useAppStore.getState();
        expect(state.authentication_state.authentication_status.is_authenticated).toBe(true);
        expect(state.authentication_state.auth_token).toBeTruthy();
        expect(state.authentication_state.current_user).toBeTruthy();
        expect(state.authentication_state.current_user?.email).toBe(uniqueEmail.toLowerCase().trim());
      },
      { timeout: 20000 }
    );

    const finalState = useAppStore.getState();
    expect(finalState.authentication_state.current_user?.name).toBe(testName.trim());
    expect(finalState.authentication_state.authentication_status.is_loading).toBe(false);

    unmountLogin();
  }, 60000);

  it('registers a new seller account successfully', async () => {
    const sellerEmail = `seller${Date.now()}@example.com`;
    const testPassword = 'testpass123';
    const sellerPhone = '+971501234567';
    
    const user = userEvent.setup();

    const { unmount } = render(<UV_UserRegistration />, { wrapper: Wrapper });

    await waitFor(() => {
      expect(screen.getByText(/Choose Your Account Type/i)).toBeInTheDocument();
    });

    const sellerButton = screen.getByRole('button', { name: /Shop Owner/i });
    await user.click(sellerButton);

    await waitFor(() => {
      const continueButton = screen.getByRole('button', { name: /Continue/i });
      expect(continueButton).not.toBeDisabled();
    });
    await user.click(screen.getByRole('button', { name: /Continue/i }));

    await waitFor(() => {
      expect(screen.getByText(/Basic Information/i)).toBeInTheDocument();
    });

    await user.type(screen.getByLabelText(/Full Name/i), 'Seller Test');
    await user.type(screen.getByLabelText(/Email Address/i), sellerEmail);
    await user.type(screen.getAllByLabelText(/Password/i)[0], testPassword);
    await user.type(screen.getByLabelText(/Phone Number/i), sellerPhone);

    await waitFor(() => {
      const continueButton = screen.getByRole('button', { name: /Continue/i });
      expect(continueButton).not.toBeDisabled();
    });
    await user.click(screen.getByRole('button', { name: /Continue/i }));

    await waitFor(() => {
      expect(screen.getByText(/Location Setup/i)).toBeInTheDocument();
    });
    await user.click(screen.getAllByRole('button', { name: /Continue/i })[0]);

    await waitFor(() => {
      expect(screen.getByText(/Review & Complete/i)).toBeInTheDocument();
    });

    await user.click(screen.getByRole('button', { name: /Create Account/i }));

    await waitFor(
      () => {
        const state = useAppStore.getState();
        expect(state.authentication_state.authentication_status.is_authenticated).toBe(true);
        expect(state.authentication_state.auth_token).toBeTruthy();
        expect(state.authentication_state.current_user?.user_type).toBe('seller');
        expect(state.authentication_state.current_user?.email).toBe(sellerEmail.toLowerCase().trim());
      },
      { timeout: 20000 }
    );

    unmount();
  }, 60000);

  it('handles login with invalid credentials', async () => {
    const user = userEvent.setup();

    const { unmount } = render(<UV_UserLogin />, { wrapper: Wrapper });

    await waitFor(() => {
      expect(screen.getByText(/Welcome Back/i)).toBeInTheDocument();
    });

    const emailInput = screen.getByLabelText(/Email Address/i);
    const passwordInput = screen.getByLabelText(/Password/i);

    await user.type(emailInput, 'nonexistent@example.com');
    await user.type(passwordInput, 'wrongpassword');

    const signInButton = screen.getByRole('button', { name: /Sign In/i });
    await waitFor(() => expect(signInButton).not.toBeDisabled());
    await user.click(signInButton);

    await waitFor(
      () => {
        const state = useAppStore.getState();
        expect(state.authentication_state.authentication_status.is_authenticated).toBe(false);
        expect(state.authentication_state.auth_token).toBeNull();
      },
      { timeout: 10000 }
    );

    unmount();
  }, 30000);
});
