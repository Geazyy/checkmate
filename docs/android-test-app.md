# Android test APK

The `preview` EAS profile builds a standalone APK, not an Expo Go project or
development client. Once installed, it does not need the laptop or Metro.
Initial sign-in and cloud synchronization still need internet access.

## First build

Run these from `C:\Codin\buildApp\checkmate` in PowerShell. Using
`npx eas-cli@latest` downloads Expo's build command-line tool into npm's cache;
it does not change the app's Expo SDK or install an app dependency.

1. Create an Expo account at https://expo.dev/signup if needed.
2. Run `npx eas-cli@latest login` and sign in privately in your terminal.
3. Run `npx eas-cli@latest whoami` to verify the account.
4. Run `npx eas-cli@latest init` to link/create the EAS project. Review the
   selected account and project before confirming. Do not use `--force`.
5. In that Expo project's environment-variable settings, add the following
   variables to the **preview** environment, using your local configuration:
   - `EXPO_PUBLIC_SUPABASE_URL`
   - `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
   - `EXPO_PUBLIC_TERMS_URL` and `EXPO_PUBLIC_PRIVACY_URL` when real pages exist.
   These are public client values embedded in the app, not server secrets.
   Never supply service-role keys or database passwords. Registration stays
   disabled without the legal URLs; an existing account can still sign in.
6. In Supabase Authentication > URL Configuration, allow the exact callbacks:
   `checkmate://auth/callback` and `checkmate://auth/callback?recovery=1`.
   Do not rerun the database migration just to build an APK.
7. Run `npx eas-cli@latest build --platform android --profile preview`.
   EAS may ask to generate an Android signing keystore. Keep its credentials
   under your Expo account for future upgrades. Review any quota/payment prompt.
8. Open the completed build's install link on your Android phone, download the
   APK, and permit that browser to install it when Android asks. Disable the
   browser's install permission again afterward. No Play Store account is needed.

The package remains `com.anonymous.checkmate` for this first test; decide on a
permanent package name before public release. Changing it later installs a
different app, with a different local-data sandbox.

## Test before sharing

- Launch with the laptop/Metro stopped and sign in using a CheckMate account.
- Allow camera access, capture a sheet, and compare every result with the key.
- Include blank, multiple, colored-pencil and uncertain answers.
- Test review edits, saving, PDF sharing, and light/dark mode after relaunch.
- Test offline work after sign-in, reconnect, and verify cloud sync.
- Verify password-reset callbacks and account separation using dummy data.

Local browser and Expo Go caches do not transfer to the APK. Verify your existing
work has synced before expecting to see it on the new installation.

`.easignore` excludes local env files and generated Android code. EAS generates
the native project from app.json and its plugins. Uncommitted source changes
are included in a normal local EAS upload; inspect them before sharing the build.
