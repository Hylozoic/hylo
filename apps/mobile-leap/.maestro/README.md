# Maestro E2E (mobile-leap)

Local smoke tests — no Maestro Cloud account required.

## Prerequisites

1. Install [Maestro CLI](https://maestro.mobile.dev/docs/getting-started/installing-maestro):
   ```bash
   brew install maestro
   ```
2. Backend + web running locally (`yarn backend:dev`, `yarn web:dev`).
3. Dev client built and installed on simulator/emulator (`yarn ios` or `yarn android`).
4. Metro running (`yarn start:clear` in `apps/mobile-leap`).

## Credentials

Export test user credentials (same pattern as web E2E):

```bash
export MAESTRO_TEST_EMAIL='your-test-user@example.com'
export MAESTRO_TEST_PASSWORD='your-password'
```

## Run

From `apps/mobile-leap`:

```bash
# Login screen loads (no credentials needed)
yarn e2e:maestro:login-screen

# Full login → leaves login screen (needs credentials + running API)
yarn e2e:maestro:login

# All flows
yarn e2e:maestro
```

### Android

Pass the Android application id:

```bash
APP_ID=com.hylo.hyloandroid yarn e2e:maestro:login-screen
```

## Notes

- Flows use `testID` props on the login screen (`login-screen`, `login-email-input`, etc.).
- Login smoke asserts the login screen disappears after submit; it does not inspect WebView content yet.
- Maestro Cloud is optional for CI device farms — not configured here.
