# NourishExtend

NourishExtend is a food donation and community app for a school project. Individuals and organisations can share surplus food, find available donations, arrange collection privately, and post local requests or updates.

Built with **Expo SDK 58, React Native, React Native Web, and Supabase**, it targets a **web app** and a **standalone Android demo APK**. Both use the same configured backend and need internet for shared data.

## Features

- Food listings with photos, quantity, allergens, storage guidance, approximate pickup area, and a collection deadline.
- Search and area/category filters, listing details, and atomic reservations to prevent competing claims.
- Searchable PSA cities and municipalities: multiple areas for discovery/community posts, one pickup location per donation. Calendar and time controls use Philippines time.
- A separate Messages tab for private inquiries before reservation, unread indicators, and linked in-app notifications. Inquiries do not hold food or reveal pickup instructions.
- Private pickup instructions/messages, cancellation, collection confirmation by both participants, and donation history.
- Separate Current, Completed, Cancelled, and Expired activity sections. Settings and notifications are accessible from header icons; headers have no Back button.
- Community requests/updates with reversible likes, visible like/comment counts, named comments, upper-right three-dot Report/Block menus, editable profile photos and short bios, and readable in-app notifications that open the exact pickup, inquiry or post.
- Email/password signup and password recovery using in-app emailed codes, current-password-verified password changes in Settings, logout, and account deletion.
- Persistent Light, Dark, and System appearance settings with a beige light palette, plus 80%, 90%, 100%, 110% and 120% text/control sizing. The 100% default is now compact; controls retain a 44px minimum touch target and text a 12px minimum before device accessibility scaling.
- Libre Franklin on Android and as a web fallback; locally installed Franklin Gothic Medium is preferred on web. No Franklin Gothic font files are bundled.

Organisation accounts are labelled unverified. Automatic organisation verification, device push notifications, a full moderation dashboard, and native password-recovery deep links are outside this pilot. Reports require manual review in the restricted Supabase dashboard.

## Community interaction update: 1.2.1

The app icon, Android adaptive/round launcher icons, splash screen and web favicon now use the same basket logo shown on Home. Native splash images have transparent padding for the existing light/dark background colours. Adaptive artwork stays inside the central safe area to avoid launcher-mask clipping.

The beige palette and existing typography remain. Feed cards now put the author/photo and date first, with a compact Like/Comment action row. Full-width Read post and Report or block buttons have been removed from posts and comments. The post title opens details; longer previews also show a small Read more link. A three-dot dropdown groups Report and Block. Familiar magnifying-glass, pencil, photo, filter and send icons accompany search, composition, photo selection and comment actions. Text labels remain so icons are understandable without guessing or colour alone. No third-party social-network logos or new icon fonts are bundled.

Reference observations and our application of them:

- [LinkedIn's official Like guidance](https://www.linkedin.com/help/linkedin/answer/a522684) describes liking and undoing a like. NourishExtend applies a single reversible Like/Liked action; it does not copy reaction palettes or claim donor trust from likes.
- [Reddit's official reporting guidance](https://support.reddithelp.com/hc/en-us/articles/360058309512-How-do-I-report-a-post-or-comment) places Report in a post/comment overflow menu. NourishExtend places separate Report and Block choices in an upper-right dropdown, retaining the existing reporting and block-confirmation flows.
- [Reddit's official search guidance](https://support.reddithelp.com/hc/en-us/articles/19696541895316-Available-search-features) uses magnifying-glass controls for search. NourishExtend pairs its existing food/location searches with this icon and keeps readable labels. A pencil marks writing, a speech bubble marks comments, and a paper plane marks sending; these are our design choices.

Facebook's help pages redirected to login during research, so their current implementation was not independently inspected. The supplied Facebook-like layout request guided the action-row arrangement; the observations above come from accessible official guidance.

Likes require a confirmed-email account and use the existing server mutation limits. A database key permits only one like per account/post; explicit like/unlike requests are idempotent. Counts exclude hidden comments and blocked members. Other members receive counts, not a list of liker identities. Likes are deleted when undone or their account/post is deleted. Community-post retention remains 90 days once scheduled maintenance is active; maintenance is still inactive. Likes do not send additional notifications or establish that a donor is legitimate. Counts refresh on screen focus and after local likes/comments; they are not a live stream of every other member's actions.

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

The project configured during development already has the migration set and four Edge Functions deployed (upload-photo, upload-avatar, delete-account and maintenance). **Do not reapply its initial migration.** A fresh checkout still needs local configuration because environment values are not committed.

There is no separate Express/Node API server: Supabase provides Auth, PostgreSQL, Storage, and server functions. Starting Expo serves the app; it does not create or deploy the backend.

### 1. Create or select a project

Use the [Supabase dashboard](https://supabase.com/dashboard). Enable **Data API**, disable **Automatically expose new tables**, and enable **automatic Row Level Security (RLS)**. Copy the project URL and publishable key into the local configuration; keep the database password private.

### 2. Apply the database migration once

For a **new, empty project**, run all SQL files in `supabase/migrations` in filename order. The core migration creates tables, database functions, RLS policies, the private photo bucket, and the Auth profile trigger. Apply it before registering users.

The configured school project had these two migrations applied and checked on **3 November 2026**. **Do not reapply them there.** For another project that already has only the core migration, apply these additions in order before using version 1.1.0:

1. `202611030001_locations_inquiries.sql`: adds structured areas and private inquiry threads/messages with participant-only access, notification links, and retention rules.
2. `202611030002_psgc_catalogue.sql`: imports the official 30 September 2026 PSA location catalogue (149 cities, 1,493 municipalities).

Version **1.2.0** also applies these additive files, in order after the two above. They are already applied to the configured school project; do not reapply them there:

3. `202611030003_notifications_comments.sql`: specific notification text/destinations, unread pickup messages, protected named comments, and comment reporting/removal.
4. `202611030004_profile_photos.sql`: short bios and a private profile-photo bucket, with owner-only profile changes and file-ownership validation.
5. `202611040001_notification_history.sql`: older alerts link to the reservation that existed when they were created, and old inquiry alerts identify the food.

Version **1.2.1** adds `202611040002_community_likes.sql`. This was applied to the configured school project on **4 November 2026**; do not reapply it there. Other projects already on 1.2.0 need only this new migration. It adds private per-member like records and protected aggregate activity/read and like/unlike functions.

Neither file rewrites existing area text. Older records remain visible with area filters cleared; they do not match a structured area filter until their location is explicitly assigned. Do not infer codes from ambiguous free text.

The bundled `src/locations.json` and catalogue migration are generated from the same official workbook. Attribution and its SHA256 are in `licenses/PSGC.txt`. To reproduce them, run `python scripts/import-psgc.py PATH_TO_OFFICIAL_WORKBOOK`; the importer reads values only and does not evaluate spreadsheet formulas or external links. It deliberately validates the September 2026 counts. Review administrative changes before adapting it for a later release. [Official PSA source](https://psa.gov.ph/classification/psgc).

Community coverage helps filter posts; it does not restrict who can read them. All signed-in members can read eligible posts. No GPS, radius search, or neighbourhood boundary enforcement is implemented.

Inquiry messages are private to their two participants, limited to 1,500 characters, blocked by member blocking, and use the existing server mutation rate limits. Threads are deduplicated per inquirer/listing. New messages stop when the listing is reserved, cancelled, or expired; successful recipients coordinate collection in Activity. The unread indicators refresh every five seconds while the app is open and after local message/read actions. The Messages dot includes both inquiry and pickup messages, independently of optional notification alerts. These are not Android push/email notifications. Notifications respect the existing in-app notification preference.

Inquiry threads are removed after 30 days of inactivity or 30 days after their listing closes/expires, whichever comes first, once maintenance is active. The existing account/donation deletion cascades also remove associated inquiry records. **This migration does not enable the maintenance schedule.**

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

After signup, enter the emailed 8-digit code inside the app. The login page has no separate verification button. If Supabase rejects sign-in because the email is unconfirmed, the app opens code verification automatically, where **Send new code** remains available. Already-confirmed users sign in normally. Only Supabase verifies a code; invalid/expired codes cannot unlock an account. Resending has a 60-second UI cooldown plus server mail limits. Do not share real verification codes with anyone.

On 3 November 2026, custom Brevo SMTP was observed enabled in the hosted pilot and the code-based Confirm sign up template was saved and checked after reloading. SMTP credentials were entered by the user directly in Supabase. Real code delivery and successful account verification/sign-in remain unverified. Request a fresh code from the updated app; older emails still contain the previous links. Version 1.2.0 saves a code-only Reset password template (`supabase/templates/recovery.html`) and verifies its token with `type: recovery` in the app. Request a new code through Forgot password in the updated app, enter it there, then choose and confirm a new password. A localhost URL on a phone refers to the phone, so the new recovery flow avoids that redirect. On 4 November 2026, the project owner reported receiving a reset code and successfully resetting the password in the Android app. This is owner-reported verification of the recovery flow; new-signup confirmation delivery remains a separate unverified flow.

The subsequent sign-up failure was traced to **Brevo SMTP 535: 5.7.8 Authentication failed**, returned as HTTP 500 by Supabase. For this error, the SMTP Login/key must be corrected directly in Supabase using Brevo’s SMTP Login and an SMTP key, not an account password or API key. The owner subsequently reported successful recovery-code delivery and an Android password reset on 4 November 2026. SMTP being enabled does not establish successful authentication or delivery. An existing account's confirmed-email status and successful password sign-in were separately observed; that does not verify the new code-email flow.

Display names may repeat; account identity uses a unique user ID and email. The current app requires passwords of at least 12 characters without forcing uppercase/digit/symbol combinations. The field label stays simply `Password`. Use a long unique passphrase or a password manager. Hosted leaked-password protection is currently off.

### 4. Deploy server functions

After logging in and linking the CLI above:

```powershell
npx.cmd supabase@2.122.0 functions deploy upload-photo
npx.cmd supabase@2.122.0 functions deploy upload-avatar
npx.cmd supabase@2.122.0 functions deploy delete-account
npx.cmd supabase@2.122.0 functions deploy maintenance
npm.cmd run check:backend
```

Keep `supabase/config.toml` and the `_shared` helpers. The config disables the gateway's legacy JWT check because upload/delete functions verify the caller with Supabase Auth themselves. Maintenance requires a separate server-only secret. Keep `SUPABASE_SERVICE_ROLE_KEY` inside the server environment.

Inspect the backend check's output: Auth should return `200`, anonymous donation reads should be denied, and unauthenticated calls to all four functions should return `401`. This checks connectivity and rejection boundaries, not signed-in donation operations.

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

1. Sign up and enter the code from your confirmation email in the app. A sign-in rejected specifically for an unconfirmed email opens the verification screen automatically. Already-confirmed accounts can sign in normally. A verified code opens your account.
2. Edit your display name, profile photo and optional 240-character bio in Settings. These fields are visible to signed-in members. Organisation profiles remain visibly unverified.
3. Use **Share** to publish food with all required details and private pickup instructions. Pickup times are entered in Philippines time.
4. Use **Home** to browse/filter food, open details, and reserve an available listing. Users cannot reserve their own donations.
5. Open **Activity** to coordinate pickup privately. Both donor and recipient confirm collection to complete the exchange and update history.
6. Use **Community** for requests/updates. Tap **Write a post** to compose, the post title to read the full post, **Like/Liked** to like or undo your like, and **Comment** to open that post and focus the comment field. Tap the upper-right **three dots** on another member's post or comment for **Report** or **Block**. Block opens an explanation and confirmation; choosing the menu option does not immediately block someone. Your own comment menu offers removal.
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

## Reproduce the Home logo assets

Committed image assets and Android resources are ready to build; no rendering tool is needed to run the app. If the static `BasketArt` vector in `src/brand.js` changes, regenerate its derived assets with this optional pinned build tool:

```powershell
npm.cmd install --prefix .tools/logo-renderer --no-save --ignore-scripts --no-audit --no-fund sharp@0.35.5
npm.cmd run assets:brand
```

This extracts the existing vector, writes `Images/home-logo.svg`, the app/adaptive/splash/favicon PNGs, and all five Android resource densities. It does not install a runtime dependency or redesign the logo. Rebuild web/APK after changing assets. Android splash sizing matches `imageWidth: 160` in the Expo splash configuration. [Android adaptive icon guidance](https://developer.android.com/develop/ui/compose/system/icon_design_adaptive), [Sharp SVG rendering](https://sharp.pixelplumbing.com/api-constructor/).

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

The ZIP packager uses its own explicit exclusions, including research notes, screenshots, archived prototypes, unused starter assets, Markdown files other than the root README, and isolated visual-review fixtures. Required source, configuration, migrations, tests, lockfiles and licences are included. Private environment/signing files, tool caches, and dependencies are excluded. Repository uploads follow the Git rules below.

## Security, privacy, and current verification

The implementation uses server validation/authorisation, database RLS and restricted mutations, atomic reservations, private photos, upload size/type restrictions and image re-encoding, protected native session storage, account deletion, and mutation limits. Exact pickup details and pickup messages are restricted to exchange participants; inquiry messages are restricted to their two conversation participants. These controls are not a legal-compliance certification or complete security audit.

To reduce scams, keep communication inside the app, never charge/pay for free food or supposed delivery fees, report/block suspicious accounts, and begin with invited or reviewed pilot members. Email confirmation demonstrates control of an email address; a display name, photo or bio is not identity verification. The pilot does not perform KYC, promise donor legitimacy, or automatically review organisations. Before a wider launch, agree on a manual organisation-review process and who will handle reports. [Olio’s official scam guidance](https://help.olioapp.com/en/articles/12258916-how-can-i-avoid-scams-when-using-olio) informs this recommendation.

Profile uploads require a confirmed-email session, have a 3 MB input limit, are decoded/re-encoded to remove metadata, and are bounded to 512px. Their private bucket allows only PNG output up to 1.5 MB. Only a member’s own uploaded photo can be assigned to their profile. Photo links expire after 10 minutes; a copied link may remain usable until expiry. Removed/replaced photos are queued for orphan cleanup after one day when maintenance is active; account deletion removes both photo buckets’ files. Profile names/photos/bios and community comments are shared with eligible signed-in members; avoid private contact/location details there.

Password changes reauthenticate the current password before calling Supabase’s password-update endpoint with `current_password`. Recovery codes are checked by Supabase, not generated or stored by the app. Passwords and codes are not logged. [Supabase password security](https://supabase.com/docs/guides/auth/password-security), [email templates](https://supabase.com/docs/guides/auth/auth-email-templates).

Verification for **version 1.2.0** (historical checks retained below):

- All **33 Node tests** passed, including location validation, successful location-based publishing/filtering, inquiry privacy, deduplication, blocking, notification opt-out, retention, the existing reservation flow, notification routing, comments/author permissions, profile-photo ownership, password request validation, size options, and database restart persistence. These tests use actual migrations in isolated PostgreSQL/PGlite with synthetic Auth/Storage schemas.
- The hosted additive migrations were applied. Hosted SQL confirmed 149 cities, 1,493 municipalities, row-level security on all three new tables, denied anonymous reads, and denied direct client writes to inquiry messages. Anonymous REST requests to the new tables returned HTTP 401 / PostgreSQL 42501. Auth health returned 200; all four unauthenticated Edge Function checks returned 401, including avatar uploads; anonymous community-comment reads were also rejected.
- Signed-in interface layouts were inspected in an isolated, clearly labelled design fixture with synthetic data and no live account requests. Checked 390px layouts, city/municipality selection, distinct Completed/Cancelled sections, inbox/conversation navigation, notification links, date/time summaries, profile editing, comments with member names, the size dropdown and size persistence after reload. A handover alert opened the exact pickup in the visual fixture. A second fixture doubled app text sizes to check wrapping and scrolling; this is a layout simulation, not an Android accessibility certification. Native keyboard, screen reader and device font-size behaviour still need physical-device testing.
- The standalone APK is version `1.2.0-demo`, Android version code `5`, built using the existing private signing key. Web and Android builds passed; APK signature, archive integrity, bundled JavaScript, four architectures, 16 KB ZIP alignment, and 16 KB ELF load alignment for 64-bit libraries were checked. No physical-device installation or two-account inquiry exchange has been performed by the agent.
- All 4 Deno image/avatar processor tests and type checks for the changed functions and deployment bundle passed. Earlier verification includes 19 applicable Expo Doctor checks. The last production dependency audit reported 12 moderate findings and no high/critical findings; this does not mean the app is vulnerability-free. Do not force incompatible framework changes.
- The owner reported successful reset-code delivery and a completed Android password reset on 4 November 2026. New-signup email confirmation has not been separately retested. The standalone login verification button remains removed; unconfirmed email/password sign-in routes to code entry. No email, code or password was sent by the agent during this redesign.

New-signup email verification, password changes through Settings, a complete two-account exchange, truly simultaneous hosted reservations, signed-in uploads/deletion, physical-device tests, public web deployment, and scheduled retention still need end-to-end verification. SQL tests use isolated PostgreSQL/PGlite with synthetic Auth/Storage schemas, not the full hosted services or multiple simultaneous connections. Restricted Windows sandboxes can prevent PGlite checkpoint renames; use a normal authorised terminal for those tests.

The pilot privacy contact is `nourishextend@gmail.com`; operator text is configurable. Use fictional details until mail, moderation, retention, and remaining privacy setup are ready.

## Verification for 1.2.1 � 4 November 2026

- All **36 Node tests passed**, including three new database cases for reversible/idempotent likes, duplicate requests, authorisation, private liker identities, blocked/hidden content, visible comment counts, mutation limits, and deletion cascades. The first sandboxed run failed at the database restart/checkpoint boundary; the normal authorised Windows run passed all tests, including restart persistence.
- The new migration was applied to the configured hosted project. SQL checks confirmed likes RLS, denied anonymous table reads, denied direct client writes, and denied anonymous execution of both new RPCs. The API check returned Auth 200; anonymous reads of the likes table and calls to both new RPCs returned 401 / PostgreSQL 42501. All four unauthenticated Edge Function checks returned 401.
- A labelled synthetic visual fixture was checked at 390px width in light/dark palettes and at 100%/120% sizing. Like/unlike updated its fixture count, Comment opened the correct detail/composer, and menu Report/Block actions remained separate. Arrow keys, Escape dismissal and focus restoration were checked on web. These fixture checks do not establish a live two-account hosted interaction or native screen-reader/keyboard behaviour.
- No real user's post was liked, reported, blocked or commented on during verification. The owner-reported successful Android password reset on 4 November remains recorded above. The Home basket vector was rendered into the app icon, adaptive/round launcher resources in all five densities, transparent splash images and favicon; the generated assets were visually inspected and their sizes/alpha checked. Production web export and its login startup passed without browser console errors. Android installation and launcher/splash appearance on a physical phone remain untested.

- Final standalone Android build **1.2.1-demo**, version code **6**, passed. APK signature v2, ZIP integrity, bundled JavaScript, four architectures, all 15 packaged launcher resources and all five splash images were checked; AAPT optimises PNG bytes, so splash images were compared by decoded pixels. The refreshed source/web ZIPs passed CRC/content checks, include this README and the new migration/assets, and exclude private environments, signing files, tools and dependencies. The local production web preview is available on port 8081 while its server is running.
