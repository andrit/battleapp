# battleapp — app (Expo / React Native)

The mobile client. Expo managed workflow, SDK 57, TypeScript strict. This is a **mobile app, not a
web site** — you run it on an iOS/Android simulator or a phone via **Expo Go**, from your **host
machine** (the dev container has no simulator or Expo tooling).

## Running the app

### 1. Start the backend (the app needs it for data)

From the workspace root:

```bash
docker compose up --build game-server
```

Verify it's up:

```bash
curl -s localhost:4000/health      # → {"status":"ok","service":"battleapp-server",...}
```

### 2. Point the app at the server

The base URL lives in `app/.env` (copy `app/.env.example` if it's missing):

```
EXPO_PUBLIC_API_URL=http://localhost:4000
```

- **iOS simulator / Android emulator** on the same machine as the server → `localhost:4000` works
  as-is.
- **Physical phone via Expo Go** → the phone can't reach `localhost`; use the dev machine's **LAN
  IP**, e.g. `http://192.168.1.20:4000` (find it with `ipconfig getifaddr en0` on macOS).

> `EXPO_PUBLIC_*` vars are read at bundle time — **restart `expo start` after editing `.env`**.

### 3. Start Expo

```bash
cd app
npx expo start
```

In the Expo CLI that opens:

- press **`i`** → iOS simulator (needs Xcode)
- press **`a`** → Android emulator (needs Android Studio)
- or **scan the QR code** with the **Expo Go** app on your phone (same Wi-Fi as the dev machine)

Shortcuts: `npm run ios` / `npm run android` auto-launch the sim; `npx expo start -c` clears the
Metro cache (use it if you hit a stale-bundle error).

### Notes

- **Web is not a supported target.** `npx expo start --web` exists, but the app leans on native
  modules (SecureStore, Reanimated, keyboard handling) that don't fully work in a browser — use a
  simulator or Expo Go for a real test.
- **Expo Go works by design** — no custom dev client needed. Keyboard avoidance deliberately uses
  the built-in `KeyboardAvoidingView` (not `react-native-keyboard-controller`) to stay Expo
  Go–compatible; Reanimated, FlashList, the Lora fonts, and splash are all in the SDK 57 Expo Go
  runtime. See `docs/engineering/decision-keyboard-avoidance.md`.
- **Auth is Phase 5**, so identity is still a `'me'` placeholder — "whose turn" won't light up
  correctly yet. The reading loop, Compose (500-char counter + director hint + coral ack), and the
  Aa reading controls are all live to try.

## Quality gates

```bash
cd app && npm run typecheck && npm test      # tsc --noEmit + Jest (jest-expo)
```

CI runs this on every push/PR (`.github/workflows/ci.yml`); `main` is protected and requires it.
