# NourishExtend

NourishExtend is a food donation and community app for a school project. Individuals and organisations can share surplus food, find available donations, arrange collection privately, and post local requests or updates.

Built with **Expo SDK 58, React Native, React Native Web, and Supabase**, it targets a **web app** and a **standalone Android demo APK**. Both use the same configured backend and need internet for shared data.

## Features

- Food listings with photos, quantity, allergens, storage guidance, approximate pickup area, and a collection deadline.
- Search and area/category filters, listing details, and atomic reservations to prevent competing claims.
- Private pickup instructions/messages, cancellation, collection confirmation by both participants, and donation history.
- Community requests/updates, reporting, blocking, profile editing, and in-app notifications.
- Email/password signup with an in-app email verification code, password recovery, logout, and account deletion.
- Persistent Light, Dark, and System appearance settings with a beige light palette.
- Libre Franklin on Android and as a web fallback; locally installed Franklin Gothic Medium is preferred on web. No Franklin Gothic font files are bundled.

Organisation accounts are labelled unverified. Automatic organisation verification, device push notifications, a full moderation dashboard, and native password-recovery deep links are outside this pilot. Reports require manual review in the restricted Supabase dashboard.

## Requirements

- Node.js **24 or newer** and npm.
- A Supabase project with access to its database, Auth, Storage, and Edge Functions.
- A browser for the web app.
- For the Windows APK helper: JDK 17 and Android SDK Command-line Tools, available through Android Studio or an existing Unity Android module. Allow several GB for SDK packages and builds.
- Python 3 only for ZIP packaging; Docker Desktop only for the optional local Supabase stack.

Commands below use `npm.cmd` and `npx.cmd` for Windows PowerShell without changing its script execution policy. On macOS/Linux use `npm` and `npx`; the included APK helper is Windows-specific.

## Installation and local web development

Open a terminal in your checkout. On this computer:

```powershell
cd C:\Unity\NourishExtend
npm.cmd ci
npm.cmd run configure
```

The helper asks for the Supabase **Project URL** and **publishable key**, then creates a local `.env`. It refuses to overwrite an existing file. If this checkout is already configured, skip `configure` and edit `.env` only when needed.

Alternatively, if `.env` does not already exist, copy `.env.example` to `.env` and fill in the values yourself.

| Environment variable | Purpose |
| --- | --- |
| `EXPO_PUBLIC_SUPABASE_URL` | Your Supabase HTTPS project URL. |
| `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Public client key, restricted by database policies and server validation. |
| `EXPO_PUBLIC_WEB_URL` | Web URL for email verification/reset redirects; use `http://localhost:8081` locally. |
| `EXPO_PUBLIC_PRIVACY_OPERATOR` | Operator name in the privacy notice. |
| `EXPO_PUBLIC_PRIVACY_EMAIL` | Privacy contact email shown in the app. |
| `EXPO_PUBLIC_RETENTION_ENABLED` | Leave `false` until scheduled cleanup is configured and verified. |

All `EXPO_PUBLIC_` values are embedded in the client bundle. Never put database passwords, access tokens, service-role keys, or maintenance secrets there. Keep `.env` out of Git.

Configure the backend below for a fresh project, then run:

```powershell
npm.cmd run web
```

Open the address printed by Expo, normally `http://localhost:8081`. Stop with `Ctrl+C`. Restart after editing environment values; re-export/rebuild to embed them in distributed versions. Without configuration, the app displays a setup screen and live operations are unavailable.

## Supabase backend setup

The project configured during development already has its core migration and three functions deployed. **Do not reapply its initial migration.** A fresh checkout still needs local configuration because environment values are not committed.

There is no separate Express/Node API server: Supabase provides Auth, PostgreSQL, Storage, and server functions. Starting Expo serves the app; it does not create or deploy the backend.

### 1. Create or select a project

Use the [Supabase dashboard](https://supabase.com/dashboard). Enable **Data API**, disable **Automatically expose new tables**, and enable **automatic Row Level Security (RLS)**. Copy the project URL and publishable key into the local configuration; keep the database password private.

### 2. Apply the database migration once

For a **new, empty project**, run the complete `supabase/migrations/202610310001_core.sql` in Supabase SQL Editor. It creates tables, database functions, RLS policies, the private photo bucket, and the Auth profile trigger. Apply it before registering users.

Alternatively, use the pinned CLI for a fresh project's tracked migration history:

```powershell
npx.cmd supabase@2.122.0 login
npx.cmd supabase@2.122.0 link --project-ref YOUR_PROJECT_REF
npx.cmd supabase@2.122.0 db push
```

Replace `YOUR_PROJECT_REF` with your actual reference ID. Choose one initial migration method. SQL Editor does not record the CLI migration history automatically; reconcile that history before subsequently using `db push` on a manually configured project.

### 3. Configure authentication and email

Enable email/password signup, require email confirmation, and set the minimum password length to **12**. Set the Auth Site URL and allowed redirects to the web app URL. Include `http://localhost:8081` for development and the exact deployed HTTPS URL for hosting.

Configure custom SMTP before inviting classmates/public users. New free projects using Supabase's built-in mail service cannot customise their templates, so custom SMTP is required for this app's code-based confirmation. Keep email confirmation enabled. See [Supabase's template restriction](https://supabase.com/changelog/46599-changes-to-email-template-customisation-on-free-tier) and [SMTP guidance](https://supabase.com/docs/guides/auth/auth-smtp).

For a small school pilot, Brevo's Free plan currently includes 300 email sends per day. Create a free account with accurate project details, verify an email address you control as a sender, and enable transactional sending if account activation is required. In Brevo Settings → SMTP & API, use the displayed SMTP Login and create an SMTP key. The SMTP key is not your Brevo account password or an API key. [Brevo plans](https://help.brevo.com/hc/en-us/articles/208589409-About-Brevo-s-pricing-plans), [SMTP troubleshooting](https://help.brevo.com/hc/en-us/articles/115000188150-Troubleshooting-Issues-with-Brevo-SMTP).

In Supabase Authentication → Emails → SMTP Settings, enable custom SMTP and enter:

| Field | Value |
| --- | --- |
| Sender email | The sender address you verified in Brevo. |
| Sender name | NourishExtend |
| Host | `smtp-relay.brevo.com` |
| Port | `587` |
| Username | Your displayed Brevo SMTP Login. |
| Password | Your private Brevo SMTP key. |

Enter credentials directly in the provider/Supabase dashboards, never in chat, app environment variables, or source control. Brevo may rewrite a free Gmail sender to a managed sender address; using your own authenticated domain is preferable for a public release. [Sender-address guidance](https://help.brevo.com/hc/en-us/articles/14925263522578-Comply-with-Gmail-Yahoo-and-Microsoft-s-requirements-for-email-senders).

After SMTP is saved, open Supabase Emails → Confirm sign up. Set the subject to `Your NourishExtend verification code`, and paste the complete source from `supabase/templates/confirmation.html` into the email body. Keep `{{ .Token }}` intact; Supabase replaces it with the real code. Save. In the Email provider settings, keep **OTP length 8** and **expiration 3600 seconds**, matching the app and local config. `config.toml` and the HTML file configure local development; they do not automatically update a hosted project's template.

After signup, enter the emailed 8-digit code inside the app. Existing unconfirmed accounts can choose **Verify my email → Send new code**. Only Supabase verifies a code; invalid/expired codes cannot unlock an account. Resending has a 60-second UI cooldown plus server mail limits. Do not share real verification codes with anyone.

On 3 November 2026, custom Brevo SMTP was observed enabled in the hosted pilot and the code-based Confirm sign up template was saved and checked after reloading. SMTP credentials were entered by the user directly in Supabase. Real code delivery and successful account verification/sign-in remain unverified. Request a fresh code from the updated app; older emails still contain the previous links. Password-reset emails still open the configured website, so their redirect must be a reachable web URL; `localhost` on a phone refers to the phone, not your development computer.

Display names may repeat; account identity uses a unique user ID and email. The current app requires passwords of at least 12 characters without forcing uppercase/digit/symbol combinations. The field label stays simply `Password`. Use a long unique passphrase or a password manager. Hosted leaked-password protection is currently off.

### 4. Deploy server functions

After logging in and linking the CLI above:

```powershell
npx.cmd supabase@2.122.0 functions deploy upload-photo
npx.cmd supabase@2.122.0 functions deploy delete-account
npx.cmd supabase@2.122.0 functions deploy maintenance
npm.cmd run check:backend
```

Keep `supabase/config.toml` and the `_shared` helpers. The config disables the gateway's legacy JWT check because upload/delete functions verify the caller with Supabase Auth themselves. Maintenance requires a separate server-only secret. Keep `SUPABASE_SERVICE_ROLE_KEY` inside the server environment.

Inspect the backend check's output: Auth should return `200`, anonymous donation reads should be denied, and unauthenticated calls to all three functions should return `401`. This checks connectivity and rejection boundaries, not signed-in donation operations.

### 5. Activate retention before using real personal data

Retention is **not active in the currently configured pilot**. Keep `EXPO_PUBLIC_RETENTION_ENABLED=false` and use fictional pickup details until verified.

Configure a long random `MAINTENANCE_SECRET` in Edge Function secrets. Enable `pg_cron` and `pg_net`; store the project URL as `nourish_project_url` and the same secret as `nourish_maintenance_secret` in Supabase Vault. Run `supabase/maintenance-schedule.sql` once. Never put secret values in tracked files.

Cleanup is scheduled daily at **03:15 Philippines time**. Inspect Edge Function execution, `cron.job_run_details`, and `net._http_response` to verify a successful cleanup response; dispatch alone does not prove deletion. Only then set the public retention flag to `true` and rebuild.

The approved policy removes pickup details/messages 30 days after an exchange closes and completed donation records after 90 days. Additional cleanup handles older posts/reports/notifications, expired reservations, action counters, and orphaned images; review the migration and maintenance function before changing policy.

### Optional local Supabase

With Docker Desktop installed and running:

```powershell
npx.cmd supabase@2.122.0 start
npx.cmd supabase@2.122.0 functions serve
```

Edit `.env` directly with the local URL/public key; the interactive helper accepts hosted project URLs and publishable keys. Use the local email inbox for verification. To recreate a disposable local database from migrations, `npx.cmd supabase@2.122.0 db reset` deletes existing local data. The full Docker stack has not been verified on the inspected computer.

## How to use the app

1. Sign up and enter the code from your confirmation email in the app. For an existing unconfirmed account, choose **Verify my email** on the sign-in screen and request a new code. A verified code opens your account.
2. Edit your profile in Settings. Organisation profiles remain visibly unverified.
3. Use **Share** to publish food with all required details and private pickup instructions. Pickup times are entered in Philippines time.
4. Use **Home** to browse/filter food, open details, and reserve an available listing. Users cannot reserve their own donations.
5. Open **Activity** to coordinate pickup privately. Both donor and recipient confirm collection to complete the exchange and update history.
6. Use **Community** for requests/updates, with reporting and blocking controls.
7. Use **Settings** for appearance, notification preferences, profile details, blocked members, logout, or account deletion.

For classroom demonstrations, create two verified test accounts and clearly label listings `DEMO ONLY`. Use fictional details. No hosted demo users or passwords are bundled.

## Export and host the website

Set `EXPO_PUBLIC_WEB_URL` to the final HTTPS URL and allow that exact URL in Supabase Auth redirects. Then:

```powershell
npm.cmd run export:web
npm.cmd run preview
```

The static output is in `dist`. The preview listens on port 8081; stop another server on that port first. Use `http://localhost:8081` to match local Auth redirects. The export includes font licences, the startup theme script, security headers, and SPA routing.

For Cloudflare Pages Direct Upload, upload the **contents** of `dist`, including `_headers` and `_redirects`. For a Git-connected build, use Node 24, dependency installation with `npm ci`, build command `npm run export:web`, output directory `dist`, and the public environment variables from `.env.example`. Supabase remains the backend. Hosting, storage, and mail quotas must be checked before wider use.

## Build the Android demo APK

On Windows, install JDK 17 and Android SDK Command-line Tools, or reuse a detected Unity Android module. Set `JAVA_HOME` and `ANDROID_HOME` to their actual roots if needed, then reopen the terminal. Without an SDK environment override, packages are installed in `.tools/android-sdk`, separate from Unity's SDK.

```powershell
npm.cmd run android:setup
npm.cmd run build:apk
```

Review SDK licence prompts yourself and accept only if you agree. The helper does not automatically accept them. The current toolchain uses compile SDK 37, target SDK 36, Build Tools 37.0.0, NDK 27.1.12297006, CMake 3.22.1, and Gradle 9.4.1.

Successful output: **`exports/NourishExtend-demo.apk`**. Copy it to an Android device and use Android's normal installation flow. The demo supports Android 7.0/API 24 or newer, is named **NourishExtend Demo**, and uses package `com.nourishextend.app.demo`. JavaScript/assets are bundled, so Metro and Expo Go are not required. Backend features still need internet.

The helper creates matching private signing files in `.local` if absent. Back them up privately to keep future updates compatible; never commit them. Production signing is intentionally unconfigured and needs a separately managed key.

Keep the maintained `android` source and Gradle wrapper in Git. A clean Expo prebuild can overwrite the demo variant/native changes. Preserve `expo.android.cmakeObjectPathMax=250` in `android/gradle.properties` to avoid Windows Ninja's 260-character object-path error. Expo Doctor's EAS-specific native-config synchronisation check is intentionally disabled for this maintained native workflow; other checks remain enabled.

## Useful commands

| Command | Purpose |
| --- | --- |
| `npm.cmd start` | Start Expo development. |
| `npm.cmd run web` | Start web development. |
| `npm.cmd run android:development` | Build/run an Android development variant with a device/emulator. |
| `npm.cmd run export:web` | Export the static site to `dist`. |
| `npm.cmd run preview` | Serve an existing export with its generated security headers. |
| `npm.cmd run export:android` | Export Android JavaScript/Hermes; this is not an APK. |
| `npm.cmd run android:setup` | Install required SDK packages, with licence prompts. |
| `npm.cmd run build:apk` | Build the signed standalone demo APK locally. |
| `npm.cmd run check:backend` | Check backend health and unauthenticated rejection boundaries. |
| `npm.cmd test` | Run SQL, image-validation, and configuration tests. |
| `npm.cmd run test:server` | Run the actual Deno image-processor tests. |
| `npm.cmd run package` | Create source/web ZIPs; requires Python 3 and an existing web export. |

The ZIP packager uses its own exclusions rather than `.gitignore`; local notes/prototypes can remain in its source archive. Private environment/signing files, tool caches, and dependencies are excluded. Repository uploads follow the Git rules below.

## Security, privacy, and current verification

The implementation uses server validation/authorisation, database RLS and restricted mutations, atomic reservations, private photos, upload size/type restrictions and image re-encoding, protected native session storage, account deletion, and mutation limits. Exact pickup details/messages are restricted to exchange participants. These controls are not a legal-compliance certification or complete security audit.

Verification recorded through **3 November 2026**:

- 22 Node tests passed after the email-code revision. Earlier checks also passed: 3 Deno image tests, Edge Function type checks, both platform bundles, and 19 applicable Expo Doctor checks.
- The hosted core migration/functions were deployed, with Auth health and unauthenticated/private access rejection checked.
- Inspected small browser layouts and light/dark persistence passed. Native keyboard/accessibility and all signed-in layouts remain unverified.
- The updated standalone APK is version `1.0.1-demo`, Android version code `2`, built using the existing private signing key. Signature, ZIP integrity, four architectures, bundled app, and 16 KB ZIP alignment passed. Login/signup/code-entry screens were checked at 390px on the web with no horizontal overflow or browser errors. Device installation/runtime behaviour and live code delivery remain untested.
- The last application dependency audit had 12 moderate findings and no high/critical findings. Use `npm.cmd audit` for a current assessment; do not force incompatible framework downgrades.

Live email verification/reset, a complete two-account exchange, truly simultaneous hosted reservations, signed-in uploads/deletion, physical-device tests, public web deployment, and scheduled retention still need end-to-end verification. SQL tests use isolated PostgreSQL/PGlite with synthetic Auth/Storage schemas, not the full hosted services or multiple simultaneous connections. Restricted Windows sandboxes can prevent PGlite checkpoint renames; use a normal authorised terminal for those tests.

The pilot privacy contact is `nourishextend@gmail.com`; operator text is configurable. Use fictional details until mail, moderation, retention, and remaining privacy setup are ready.
