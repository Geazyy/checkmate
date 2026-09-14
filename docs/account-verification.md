# Account integration verification - 2026-09-14

## Follow-up connection check

The user supplied a project URL and publishable key. They are configured in
Git-ignored .env.local. Auth settings returned HTTP 200 with email enabled and
email confirmation required. Read-only probes for profiles and checkmate_exams
returned PGRST205 (table missing from the API schema cache). No migration was
applied and no account was created. The earlier no-configuration tests below
remain historical results, not proof of live login, sync, or RLS behavior.

## Executed successfully

- TypeScript: `node node_modules/typescript/bin/tsc --noEmit`.
- Targeted ESLint over new auth/sync/storage code and touched UI: no errors or warnings.
  The scanner screen retains its existing effect-cleanup warning; the scanner engine was not changed.
- `node scripts/test-account-sync.cjs`: real client queue/store code tested with
  explicit fake disk, Auth and HTTP adapters. Covers account A/B isolation,
  sign-out clearing, listener cleanup, legacy preservation/single-owner import,
  duplicate retry prevention, delete tombstones, conflicts, invalid links,
  private-image exclusion, validation and disk-error feedback.
- `node scripts/test-auth-ui.cjs`: headless Edge, isolated context. Eleven
  protected paths redirect signed-out users to Login. Login, Registration and
  Forgot Password fit 320, 390, 768 and 1280 pixels without page overflow.
  Password visibility works, legacy storage stays intact, no browser runtime
  errors. Screenshots: .expo/auth-verification/.
- `node scripts/test-omr-color.cjs`: red-photo plus synthetic blue/green/black
  variants; all 25 answers match in each case. Q12 A+B remains invalid and
  scores zero. No fresh phone capture was performed.
- Android Expo manifest and JS bundle returned HTTP 200 with auth code included.
- Source scan found no service-role references or secret-key literals. Android
  bundle contained no sb_secret_ key pattern. Only placeholder .env.example exists.
- `git diff --check`: passed.

## Not passed / not executed

- Expo compatibility check reports 23 recommended SDK 57 patch updates, including
  existing React Native/SVG differences. Expo stays 57.0.9 as requested.
- npm reported 24 dependency vulnerabilities (16 moderate, 8 high) at installation.
  No force-fix or unrelated dependency upgrades were performed.
- No Supabase credentials/project were available. Live registration, verification,
  login, token refresh, reset emails/deep links, profile/avatar uploads, RLS and
  device-to-device sync have NOT been verified.
- The SQL migration, rollback and transactional RLS test are supplied but were
  NOT executed. PostgreSQL/Supabase CLI was not available locally.
- Native SQLite, Android recovery links and on-device logout remain to be tested.
- Full authenticated UI flows cannot be verified against real data until setup.

## Files and scope

- Auth routes: src/app/auth/*; src/app/_layout.tsx.
- Profile/help/settings and menu: src/app/profile.tsx, help.tsx, settings.tsx;
  src/components/auth/*; common/AppShell.tsx and Header.tsx.
- Auth lifecycle: src/services/auth/*; src/store/useAuthStore.ts.
- Cloud client/types/network: src/services/supabase/*.
- Offline queue/conflicts: src/services/sync/*; src/store/storage.ts.
- Per-account persisted exams/scans/settings/rosters/templates: src/store/*.
- Existing exam/roster/scanner screens now use UUIDs for new records.
  Answer-sheet export saves its configuration per account/exam.
- src/services/database/localDb.ts retains the old database archive and routes
  new scan writes through the authenticated queue instead of a fake sync stub.
- SQL: supabase/migrations/202609090001_checkmate_accounts.sql;
  supabase/rollback/202609090001_checkmate_accounts.sql;
  supabase/tests/account-rls.sql.
- Setup: docs/supabase-setup.md, .env.example, .gitignore.
- Tests: scripts/test-account-sync.cjs, scripts/test-auth-ui.cjs.
- Dependency: package.json/package-lock.json add only expo-crypto (~57.0.2).

Nothing was committed, pushed, or deployed to Supabase.
The local server uses --max-workers 2 after Windows Metro hit an EMFILE limit.
