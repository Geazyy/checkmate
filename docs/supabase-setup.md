# CheckMate Accounts and Cloud Setup

## Status and scope

The app now contains Supabase authentication, protected routes, profiles, and an
offline sync implementation. No Supabase project URL or publishable key was
available during implementation. No remote migration was applied and no real
account, verification email, password reset, cloud upload, or RLS request was
tested. Do not treat the local test adapters as a production authentication test.

Expo remains 57.0.9. The only new runtime dependency is expo-crypto (~57.0.2),
installed with the SDK-aware Expo installer. No service-role key is used.
Expo's current compatibility check recommends newer patches for 23 packages;
those existing versions were not bulk-upgraded. npm also reports existing
dependency vulnerabilities; audit and remediation are a separate release task.

## Supabase Dashboard setup

1. Create or select your own Supabase project. Back up any existing database.
2. Inspect the public schema first. The migration creates public.profiles and
   seven new checkmate_* tables. If any names already exist, STOP and reconcile
   their schema/policies before applying it. The script deliberately fails on
   table-name conflicts rather than replacing existing data.
3. In SQL Editor, run supabase/migrations/202609090001_checkmate_accounts.sql.
   It is a transaction. It creates profiles for existing Auth users and an
   automatic profile trigger for future registrations.
4. Auth > Providers: enable Email, Confirm email, and secure email change
   (confirmation at both old and new addresses). Set minimum password length 12.
   Configure a production SMTP provider and review rate limits before release.
5. Auth > URL Configuration: set Site URL to your HTTPS web app. Add exact
   redirect URLs used by this deployment, for example:
   - http://localhost:8081/auth/callback
   - http://localhost:8081/auth/callback?recovery=1
   - checkmate://auth/callback
   - checkmate://auth/callback?recovery=1
   Add corresponding production HTTPS callbacks, too. Avoid broad wildcards.
6. Email templates must retain Supabase's ConfirmationURL link, so its PKCE
   code returns to the configured callback. Open verification/reset links on
   the device/browser that requested them. A different device has no verifier.
7. Storage: confirm checkmate-avatars is PRIVATE with a 2 MB limit and only
   JPEG/PNG allowed. Audit other storage.objects policies: PostgreSQL permissive
   policies combine with OR, so a preexisting broad policy can defeat isolation.
8. API: expose only the intended schemas (public), never checkmate_rollback.
   Audit preexisting tables separately; this migration cannot verify tables in
   a remote project it has never inspected.

For reliable native auth callback testing, use a development/production build
with the existing checkmate URL scheme. Expo Go uses an exp://.../--/ callback;
if testing it, allowlist that exact generated URL and keep the host stable.

## Local environment

Create .env.local in the project root; it is ignored by Git. Use .env.example as
the field reference. Supply:

- EXPO_PUBLIC_SUPABASE_URL: Project URL from the Supabase Connect dialog.
- EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY: the sb_publishable_... client key.
- EXPO_PUBLIC_TERMS_URL: your real HTTPS Terms page.
- EXPO_PUBLIC_PRIVACY_URL: your real HTTPS Privacy Policy page.
- EXPO_PUBLIC_AUTH_REDIRECT_URL: one of the exact callbacks above, appropriate
  to this deployment. Omit to use expo-linking's device/web callback.

Do not put a service-role key, secret key, database password, or private token in
EXPO_PUBLIC_* variables. Those values are bundled into the client. Publishable
keys are not a substitute for RLS. Registration stays disabled until legal URLs
are supplied; CheckMate does not invent legal consent text.

Restart the development server after changing environment variables:

~~~powershell
cd "C:\Codin\buildApp\checkmate"
npm start -- --go --lan --port 8081
~~~

Open http://localhost:8081 on the laptop. In Expo Go, scan the terminal QR.
Initial sign-in requires connectivity. Without configuration, the app shows
a sign-in setup notice rather than exposing the old shared demo workspace.

## Data model and security

- profiles: Auth user UUID, name, school, teacher ID, phone, avatar path, role,
  created/updated timestamps. Trigger-created roles default to teacher.
  Client column grants prevent changing role or timestamps.
- checkmate_exams, checkmate_classes: individual entity documents.
- checkmate_answer_keys: one document per exam containing its numbered keys.
- checkmate_rosters: one document per class containing its students.
- checkmate_scans: one document per scan, including item answers. Image files
  and local image URIs are NOT uploaded.
- checkmate_templates: saved PDF sheet configurations per exam/default.
- checkmate_preferences: scan-review preferences.
- Analytics are derived from exams/scans, not separately copied.

Every application document has a stable remote UUID, owner_id referencing
auth.users, stable local_id, JSON data, version, mutation_id, updated_at, and
deleted_at. Keys/students/item answers inherit the enclosing row's ownership.
This preserves existing local legacy IDs and relationships without rewriting
printed test codes. New exams/classes/students/scans use UUIDs.

Every new public table has RLS and separate authenticated SELECT, INSERT,
UPDATE, DELETE policies. Ownership must match auth.uid(), which must be non-null.
The write RPC is SECURITY INVOKER, whitelists table names, obtains owner only
from auth.uid(), and runs with RLS. Profiles allow self access only. Avatars
require a user-ID path prefix, and display uses temporary signed URLs.

Local caches are partitioned by Auth user UUID. Native persistence uses the
existing Expo SQLite key/value database; web uses localStorage. Auth uses the
official Expo SQLite localStorage adapter. These stores are not encrypted
against someone with OS/browser-profile access. Use a protected device; an
encrypted database/keychain threat model is a separate hardening project.
Remember-session OFF uses process memory on native and sessionStorage on web.
The temporary PKCE verifier is persisted independently to allow callback startup.

## Sync and preservation

Existing global checkmate-exams-v1, checkmate-scans-v1 and settings keys are not
deleted or automatically assigned to the first new account. Settings offers an
explicit, single-owner import into an empty account. The original copies remain.
The legacy checkmate_offline.db file is retained; any historical pending_scans
table is not deleted. Records that only existed in screen memory cannot be
recovered after that screen/application has closed.

Each account's persisted document includes store snapshots AND the outbox in
one SQLite/localStorage write. Local mutation data is saved before sync.
The queue survives restarts. Requests run at sign-in, every 30 seconds while
active, on foreground, on browser reconnect, and via Settings > Sync now.
Network failures leave pending changes for retry. Expired sessions lock the
workspace until authentication/refresh succeeds online.

A retry uses the same mutation UUID. The server detects already-applied writes.
Version compare-and-swap detects concurrent changes; conflicts retain BOTH
local and remote copies. Settings lets the teacher explicitly select cloud or
device versions. Deletes are tombstones, not physical removal. Review conflicts
before using a second device. Conflict choice currently applies to all conflicts.

Logout attempts Supabase global signOut, stops sync, clears in-memory stores,
ungraded captures, profile/avatar display, and React Query cache. It retains
account-partitioned saved records/photos and does not delete cloud data.
If the server cannot revoke the session, logout reports an error and retains
the session for retry; do not hand off a shared device until logout succeeds.

## Rollback

supabase/rollback/202609090001_checkmate_accounts.sql moves the new data tables
into an unexposed checkmate_rollback schema, removes the auth trigger/write RPC,
and removes these avatar policies. It never drops records or avatar objects.
Deploy the previous app alongside rollback. Keep the archive unexposed.
Restoration requires moving archived tables back and recreating functions/
triggers/policies from the forward migration, or restoring your database backup.
Do not blindly rerun CREATE TABLE over archived/restored data.

## Verification

Local commands:

~~~powershell
node node_modules/typescript/bin/tsc --noEmit
node scripts/test-account-sync.cjs
node scripts/test-auth-ui.cjs
node node_modules/expo/bin/cli install --check
~~~

The browser test requires Playwright and Edge. Set CHECKMATE_TOOLS to the
installed tools directory if Playwright is not a project dependency.
Account/sync regression tests use explicit fake Auth, network, and disk
adapters; they verify client logic, NOT Supabase/Postgres behavior.

Before production, use a separate Supabase test project:
1. Apply the migration and run supabase/tests/account-rls.sql in SQL Editor.
   This is an unexecuted transactional SQL test, not evidence RLS already passed.
2. Register two teachers, verify emails, and log into both separately.
3. Check remembered vs nonremembered sessions after restart.
4. Edit profile/photo; change email and confirm both emails.
5. Request reset and open link on the same native device/browser; test expired,
   replayed, missing and wrong-device links.
6. Create exams, keys, rosters, scans and templates in account A; reconnect after
   offline edits and verify them on a second device.
7. Edit one record on both devices offline; confirm a conflict, not a silent
   overwrite. Test local/cloud resolution and tombstone propagation.
8. Logout, use Back/direct protected URLs, log into B, and verify no A records,
   pending results, photos or profile are visible. Confirm RLS via direct API
   requests using B's normal access token (never a service role).
9. Test network loss during profile save/logout/sync and actual SQLite writes
   and avatar uploads on Android. Review server logs without exposing tokens.

Live email/Auth/RLS/device tests remain necessary before release.

## Documentation consulted

- https://docs.expo.dev/versions/v57.0.0/
- https://docs.expo.dev/guides/using-supabase/
- https://supabase.com/docs/guides/auth/quickstarts/react-native
- https://supabase.com/docs/guides/getting-started/tutorials/with-expo-react-native
