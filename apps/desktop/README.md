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

The desktop app uses shared packages from the monorepo. Before building, the shared packages are automatically:

1. Built using `yarn build-packages` from the root
2. Copied to `shared-packages/` directory for Electron builds

This ensures the packages are available as regular npm packages during the Electron build process.

#### Build Commands

- **Development**: `yarn desktop` - Starts the app in development mode
- **Package**: `yarn desktop:package` - Creates a packaged app
- **Make**: `yarn desktop:build` - Creates distributable packages

### Shared Packages

The desktop app uses these shared packages:
- `@hylo/navigation` - Navigation utilities
- `@hylo/presenters` - Notification presenters

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
