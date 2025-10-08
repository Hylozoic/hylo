# Hylo Desktop App

The Desktop version of Hylo built with Electron.

### Prerequisites

- Node.js ^20
- Yarn ^4.9.2

### Setup

1. Install dependencies from the root of the monorepo:
   ```bash
   yarn install
   ```

2. Build the shared packages and copy them into node_modules
   ```bash
   yarn copy-shared-packages
   ```

### Development

1. Start the desktop app in development mode:
   ```bash
   yarn desktop
   ```

### Building

The desktop app uses shared packages from the monorepo. The build process automatically:

1. **Builds** shared packages using `yarn build-packages` from the root
2. **Copies** packages to `node_modules/@hylo/` for Electron builds
3. **Fixes** workspace references in copied packages to use file references

This ensures:
- New developers can run `yarn install` without issues (uses workspace references)
- Electron builds work correctly (uses copied packages in node_modules)
- Development and builds work seamlessly

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
