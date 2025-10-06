# E2E Authentication Tests

## Overview

This directory contains end-to-end (E2E) authentication tests for the ConstructHub application using Vitest and React Testing Library. These tests validate the complete authentication flow against a **real backend API** without mocking.

## Test Files

- `auth.e2e.test.tsx` - Complete authentication flow tests (register → logout → sign-in)

## Prerequisites

### Backend Server

The tests require the backend server to be running at `http://localhost:3000`. 

**Start the backend:**
```bash
cd /app/backend
npm start
```

The backend must have:
- PostgreSQL database initialized with schema from `db.sql`
- API endpoints available at `/api/auth/*`

### Environment Configuration

Ensure `.env.test` exists in the project root with:
```
VITE_API_BASE_URL=http://localhost:3000
```

## Test Architecture

### Real API Integration

These tests use the **actual backend API** with the following approach:

1. **No Mocking**: All HTTP requests go to the real backend server
2. **Unique Test Data**: Each test run generates unique email addresses using timestamps to avoid collisions
3. **Store Validation**: Tests validate auth state by inspecting the Zustand store directly
4. **Cleanup**: localStorage and store state are cleared before each test

### Test Flow

The main E2E test validates this complete flow:

```
1. Register new user
   ↓
2. Verify authenticated state in store
   ↓
3. Logout
   ↓
4. Verify unauthenticated state
   ↓
5. Sign in with same credentials
   ↓
6. Verify authenticated state again
```

## Running Tests

### Run All Tests

```bash
npm test
```

### Run E2E Tests Only

```bash
npm test auth.e2e
```

### Run with UI

```bash
npm test -- --ui
```

### Run in Watch Mode

```bash
npm test -- --watch
```

## Test Coverage

The test suite covers:

1. **Complete Auth Flow**: Register → Logout → Sign-in
2. **Buyer Registration**: Creating a buyer account with minimal fields
3. **Seller Registration**: Creating a seller account with required phone number
4. **Invalid Credentials**: Login failure handling
5. **Duplicate Email Prevention**: Registration validation

## Key Test Patterns

### 1. Store State Assertions

Tests validate authentication by checking the Zustand store:

```typescript
await waitFor(() => {
  const state = useAppStore.getState();
  expect(state.authentication_state.authentication_status.is_authenticated).toBe(true);
  expect(state.authentication_state.auth_token).toBeTruthy();
  expect(state.authentication_state.current_user).toBeTruthy();
}, { timeout: 20000 });
```

### 2. Unique Test Data

Each test generates unique emails to avoid database collisions:

```typescript
const uniqueEmail = `user${Date.now()}@example.com`;
```

### 3. Resilient Selectors

Tests use flexible selectors that work with label/button text variants:

```typescript
const emailInput = screen.getByLabelText(/Email Address/i);
const signInButton = screen.getByRole('button', { name: /Sign In/i });
```

### 4. Router Wrapper

All components are wrapped with BrowserRouter for navigation support:

```typescript
const Wrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <BrowserRouter>{children}</BrowserRouter>
);

render(<UV_UserLogin />, { wrapper: Wrapper });
```

## Configuration

### Vitest Config

The `vitest.config.ts` includes:

- **Environment**: jsdom for DOM simulation
- **Globals**: true (no need to import test functions)
- **Setup Files**: `./src/test/setup.ts` for @testing-library/jest-dom
- **Timeout**: 30000ms default (tests can override)
- **Alias Resolution**: Resolves `@/` imports to `./src/`

### Setup File

`src/test/setup.ts` imports `@testing-library/jest-dom` for extended matchers like:
- `toBeInTheDocument()`
- `toBeDisabled()`
- `toHaveValue()`

## Backend API Endpoints Used

Tests interact with these backend endpoints:

- `POST /api/auth/register` - Create new user account
  - Body: `{ email, password, name, user_type, phone?, location_lat?, location_lng?, address? }`
  - Returns: `{ user, token }`

- `POST /api/auth/login` - Authenticate user
  - Body: `{ email, password }`
  - Returns: `{ user, token }`

- `POST /api/auth/logout` - End user session
  - Headers: `Authorization: Bearer <token>`
  - Returns: `{ message }`

## Database Schema

Tests rely on the `users` table schema (from `/app/backend/db.sql`):

```sql
CREATE TABLE users (
    id VARCHAR(255) PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,  -- Enforces unique constraint
    phone VARCHAR(255) UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    name VARCHAR(255) NOT NULL,
    user_type VARCHAR(50) NOT NULL DEFAULT 'buyer',
    location_lat NUMERIC,
    location_lng NUMERIC,
    address TEXT,
    preferences JSONB DEFAULT '{}',
    is_verified BOOLEAN NOT NULL DEFAULT false,
    ...
);
```

## Troubleshooting

### Backend Not Running

**Error**: Network request failures or timeouts

**Solution**: Start the backend server:
```bash
cd /app/backend
npm start
```

### Database Connection Issues

**Error**: Tests fail with database errors

**Solution**: Ensure PostgreSQL is running and database is initialized:
```bash
cd /app/backend
npm run init-db  # or appropriate init script
```

### Unique Constraint Violations

**Error**: "User with this email already exists"

**Solution**: Tests use timestamped emails to avoid collisions. If this persists, clear test data:
```sql
DELETE FROM users WHERE email LIKE '%@example.com';
```

### Timeout Errors

**Error**: Tests timeout waiting for auth state

**Solution**: 
- Increase test timeout: `it('test', async () => { ... }, 60000)`
- Check backend response times
- Verify network connectivity to localhost:3000

### Store State Not Updating

**Error**: Auth state assertions fail even though UI works

**Solution**: 
- Ensure `beforeEach` properly resets store state
- Check that components properly update store on auth success
- Verify Zustand persist middleware isn't interfering

## Best Practices

1. **Always Reset State**: Clear localStorage and reset store in `beforeEach`
2. **Use Unique Data**: Generate unique emails/usernames per test run
3. **Wait for Loading States**: Use `waitFor` with appropriate timeouts
4. **Test Store State**: Validate auth by checking store, not just UI
5. **Handle Async Operations**: Always await user interactions and API calls
6. **Clean Error Messages**: Provide descriptive test names and clear assertions

## Future Enhancements

Potential improvements to the test suite:

1. **Token Expiration Tests**: Validate expired token handling
2. **Concurrent Login Tests**: Test multiple simultaneous logins
3. **Session Persistence**: Test auth state across page reloads
4. **Password Reset Flow**: Add forgot/reset password E2E tests
5. **OAuth Flow**: Test social authentication providers
6. **Role-Based Access**: Validate buyer vs seller permissions

## References

- [Vitest Documentation](https://vitest.dev/)
- [React Testing Library](https://testing-library.com/react)
- [Testing Library User Event](https://testing-library.com/docs/user-event/intro)
- [Zustand Testing](https://docs.pmnd.rs/zustand/guides/testing)
