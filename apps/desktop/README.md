# Hylo Desktop App

The Desktop version of Hylo built with Electron.

## Development

### Prerequisites

- Node.js ^20
- Yarn ^4.5.0

### Setup

1. Install dependencies from the root of the monorepo:
   ```bash
   yarn install
   ```

2. Start the desktop app in development mode:
   ```bash
   yarn desktop
   ```

### Building

The desktop app uses shared packages from the monorepo. The build process automatically:

1. **Builds** shared packages using `yarn build-packages` from the root
2. **Copies** packages to `shared-packages/` directory for Electron builds
3. **Fixes** workspace references in copied packages to use file references
4. **Restores** workspace references in package.json after the build

This ensures:
- New developers can run `yarn install` without issues (uses workspace references)
- Electron builds work correctly (uses file references during build)
- Package.json stays clean for git commits (workspace references restored)

#### Build Commands

- **Development**: `yarn desktop` - Starts the app in development mode
- **Package**: `yarn desktop:package` - Creates a packaged app
- **Make**: `yarn desktop:build` - Creates distributable packages

### Shared Packages

The desktop app uses these shared packages:
- `@hylo/navigation` - Navigation utilities
- `@hylo/presenters` - Notification presenters (depends on navigation)

These are automatically copied from the monorepo packages before each build.

### Troubleshooting

If you encounter issues with shared packages:

1. Clean and rebuild:
   ```bash
   yarn reset
   yarn desktop
   ```

2. Manually copy shared packages:
   ```bash
   cd apps/desktop
   yarn copy-shared-packages
   ```

3. If yarn install fails with missing shared-packages:
   - This is expected for new developers
   - Run `yarn desktop` which will create the needed directories
