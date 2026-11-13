# Mobile Development

Free to Prompt shares its interface and prompting logic across the browser, iOS, and Android.
The installed apps bundle all assets and do not need a server connection to prompt.
The browser version still opens directly from `index.html` without installing dependencies or building.

## Requirements

- Node.js 22 or later.
- iOS: macOS and Xcode 26 or later, including an iOS simulator runtime.
- Android: JDK 21, Android SDK Platform 36, SDK build tools, and a device or emulator.

Install locked dependencies with `npm ci`.
Set `JAVA_HOME` to your JDK 21 installation and `ANDROID_HOME` to your Android SDK directory before using Gradle from a terminal.
Android Studio can manage these installations instead.

## Build and Run

```sh
npm run check
npm run sync
npm run open:ios
# or
npm run open:android
```

`npm run sync` rebuilds `dist/` from an explicit asset allowlist and updates both native projects.
Run it after changing web files or native dependencies.
Do not run sync while a native build is running.
Generated web copies, credentials, and build outputs are ignored by Git.

Build Android artifacts from the `android/` directory:

```sh
./gradlew :app:assembleDebug :app:bundleRelease :app:lintDebug
```

The debug APK is at `android/app/build/outputs/apk/debug/app-debug.apk`.
The release bundle is at `android/app/build/outputs/bundle/release/app-release.aab`.
Without upload signing credentials, the release bundle is unsigned and cannot be submitted.

For an unsigned iOS simulator build:

```sh
xcodebuild -project ios/App/App.xcodeproj -scheme App \
  -configuration Debug -sdk iphonesimulator \
  -destination 'generic/platform=iOS Simulator' \
  -derivedDataPath ios/DerivedData CODE_SIGNING_ALLOWED=NO build
```

## Identity and Signing

The bundle/application ID is `com.freetoprompt.app` for both platforms.
The initial version is `1.0.0`, build `1`.
The intended publisher is Waldough, Inc.
Confirm the ID in both consoles before the first upload; keep it stable afterward.

Select Waldough, Inc.'s development team in Xcode for device builds and archives.
No Apple Team ID or signing certificate is embedded in this repository.

For a signed Android release, supply all four environment variables using your secret manager:

- `FREETOPROMPT_UPLOAD_STORE_FILE`: absolute path to the upload keystore.
- `FREETOPROMPT_UPLOAD_STORE_PASSWORD`: keystore password.
- `FREETOPROMPT_UPLOAD_KEY_ALIAS`: upload key alias.
- `FREETOPROMPT_UPLOAD_KEY_PASSWORD`: key password.

Keep the upload keystore and its recovery information outside this repository.
Use Play App Signing for distribution.
Never use the debug signing certificate for a store release.

## Hosted Builds

The Check workflow compiles iOS on GitHub's `macos-26` runner and Android on Ubuntu.
This allows iOS build validation without updating the development Mac.
The iOS CI build targets the simulator and does not use signing credentials or submit to a store.
Use a compatible Mac or a configured hosted signing workflow for TestFlight archives after the organization account is ready.

## Native Behavior

`mobile/bridge.mjs` adapts Capacitor APIs to the shared app.
The native bundle is injected only into `dist/index.html`.
The web entry point does not load Capacitor.

Native scripts and settings are saved as a single versioned JSON value using Preferences.
Writes are serialized, pending edits are coalesced, and stale completions cannot overwrite the latest save status.
If a native draft cannot be read, the editor offers Retry without overwriting storage.
The app is designed for one current script; file import is limited to 2 MB.

Export writes a UTF-8 file in the private cache's `exports/` directory and opens the system share sheet.
The Android file provider grants access only to that export directory.
The cached export remains until replaced or the operating system clears it so receiving apps can finish reading it.
File import uses the system file picker through the web view's file input.

Prompting holds the screen awake, including while paused.
Editing and backgrounding release the wake lock.
Returning from the background leaves playback paused.
Android Back dismisses a dialog, returns from prompting to editing, or minimizes the app from the editor.

The app includes an Apple privacy manifest for Preferences and Filesystem API use.
The final archive's aggregated privacy report still needs review before submission.

## Acceptance Checks

Run the browser checks in CONTRIBUTING.md and these checks on both iOS and Android:

1. Launch in airplane mode and edit, play, pause, mirror, flip, and restart.
2. Change text and settings, close the app, and relaunch to confirm persistence.
3. Rapidly edit and reset, then relaunch to confirm the cleared script stays cleared.
4. Background during playback and confirm it resumes paused.
5. Verify screen wake behavior and release when editing or backgrounded.
6. Import a UTF-8 text file and export it through the system share sheet.
7. Cancel the file picker and share sheet without losing the current draft.
8. Test portrait, landscape, phone, and tablet layouts, including safe areas and keyboard visibility.
9. Open Privacy and Support, then return without losing the draft.
10. Test Android Back in the editor, prompting view, and dialogs.

Automated native adapter tests exercise contracts with stubs; they do not replace device acceptance.
Android instrumentation tests additionally run the installed app in a real WebView and verify native persistence, reset, background pause, and Back navigation.
With a dedicated test emulator connected, run `./gradlew :app:connectedDebugAndroidTest` from `android/`.
These tests clear the app's draft on the test device before each test; never run them against a device containing a script you want to keep.
