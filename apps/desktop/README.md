# hylo-electron

The Electron based desktop app for Hylo

## Development

1. Before you start, make sure you have yalc installed globally: `yarn global add yalc`
2. Build shared packages because they have to be included via yalc for the desktop app to build. You will have to do this every time you make changes to the shared packages. From the root of the repository, run:
- `yarn build-packages`
- `cd packages/presenters`
- `yalc publish`
- `cd ../navigation`
- `yalc publish`
- `cd ../../desktop`
- `yalc add @hylo/navigation`
- `yalc add @hylo/presenters`
3. Run the desktop app. From the root of the repository: `yarn desktop`

## Building to publish

Make sure you do the build steps in the development section above.
From the root of the repository, run: `yarn desktop:build`
