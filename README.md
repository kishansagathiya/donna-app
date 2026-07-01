# donna-app

React Native iOS app for Donna — tap the mic to talk with the voice backend.

## Setup

```bash
npm install
cd ios && pod install && cd ..
```

### Supabase + Sign in with Apple

1. Create a [Supabase](https://supabase.com) project.
2. In Supabase → **Authentication → Providers → Apple**, enable Apple and set Client ID to `com.kishansagathiya.donna`.
3. In Apple Developer → Identifiers → `com.kishansagathiya.donna`, enable **Sign in with Apple**.
4. Copy your Supabase URL and publishable key into [`src/config.ts`](src/config.ts).

Optional dev sign-in (simulator): create an email/password user in Supabase Auth and set `DEV_EMAIL` / `DEV_PASSWORD` in `src/config.ts`.

From the repo root, add `SUPABASE_URL` to `.env` so the voice server validates JWTs (see [../README.md](../README.md)):

```bash
npm run dev:server
```

## Run (iOS)

```bash
npm start
# separate terminal:
npm run ios
```

Requires Xcode and the [React Native environment](https://reactnative.dev/docs/set-up-your-environment) for iOS.

Bundle ID: `com.kishansagathiya.donna`

## App Store release

iOS builds and uploads use [EAS Build](https://docs.expo.dev/build/introduction/) and [EAS Submit](https://docs.expo.dev/submit/introduction/). Apple credentials should be configured in the [Expo project dashboard](https://expo.dev) (project ID in `app.json`).

### One-time setup

1. Install EAS CLI: `npm install -g eas-cli`
2. Log in: `eas login`
3. Confirm iOS credentials in Expo: `eas credentials --platform ios`
4. Add GitHub repo secret **`EXPO_TOKEN`** ([Expo access token](https://expo.dev/settings/access-tokens)) for CI releases

### Release from your Mac

```bash
cd donna-app
npm ci
DONNA_VOICE_TARGET=production node scripts/sync-env.mjs
eas build --platform ios --profile production
eas submit --platform ios --profile production --latest
```

Or use npm scripts after logging in:

```bash
npm run release:ios
npm run submit:ios
```

Bump `app.json` → `expo.version` / `expo.ios.buildNumber` and matching `ios/Donna.xcodeproj` values before each store upload.

### Release from GitHub Actions

1. Ensure `EXPO_TOKEN` is set in repo secrets
2. Actions → **iOS App Store Release** → **Run workflow**
3. Leave **Submit to App Store Connect** checked to upload after the build finishes

After upload, open [App Store Connect](https://appstoreconnect.apple.com) to add release notes and submit for review.

## Voice backend URL

Configured via the **repo-root** [`.env`](../.env) (synced automatically on `npm start` / `npm run ios`). No code edits needed.

| Where you run the app | `.env` |
|-----------------------|--------|
| iOS Simulator + local server | `DONNA_VOICE_TARGET=local` (default) |
| Android Emulator + local server | `DONNA_VOICE_TARGET=local` (uses `10.0.2.2`) |
| Physical iPhone on LAN | `DONNA_VOICE_TARGET=local` (Mac Bonjour host auto-detected on `npm start`) |
| Dev build → production | `DONNA_VOICE_TARGET=production` |

Restart Metro after changing `.env`. Release builds always use production.

## How it works

1. Tap mic → WebSocket session + 16 kHz PCM streaming
2. Client VAD (~500 ms silence) → `turn.end`
3. Server STT → LLM → TTS → `audio.out` chunks
4. App plays reply; mic stays on for the next utterance
5. Tap again to end the session
