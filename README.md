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

## Voice backend URL

Configured via the **repo-root** [`.env`](../.env) (synced automatically on `npm start` / `npm run ios`). No code edits needed.

| Where you run the app | `.env` |
|-----------------------|--------|
| iOS Simulator + local server | `DONNA_VOICE_TARGET=local` (default) |
| Android Emulator + local server | `DONNA_VOICE_TARGET=local` (uses `10.0.2.2`) |
| Physical iPhone on LAN | `DONNA_VOICE_HOST_OVERRIDE=<Mac IP>` |
| Dev build → production | `DONNA_VOICE_TARGET=production` |

Find your Mac's IP: `ipconfig getifaddr en0`

Restart Metro after changing `.env`. Release builds always use production.

## How it works

1. Tap mic → WebSocket session + 16 kHz PCM streaming
2. Client VAD (~500 ms silence) → `turn.end`
3. Server STT → LLM → TTS → `audio.out` chunks
4. App plays reply; mic stays on for the next utterance
5. Tap again to end the session
