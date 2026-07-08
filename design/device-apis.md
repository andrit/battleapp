# BattleApp — Device API Inventory

**Phase 0 deliverable · written 2026-07-04**

Every native device capability V1 requires, with its library, permission strings, and workflow
implication. This document discharges the Phase 0 advance criteria "every required native device
API listed…" and "Expo workflow decision documented." Vocabulary from `glossary.md`; platform
decision from `tech-stack.md`. V1 scope.

## Summary — the workflow decision

**V1 needs exactly one native capability: push notifications.** `expo-notifications` is supported
in the **Expo managed workflow**, so **no bare-workflow ejection is required.** Managed workflow
is **confirmed** (see `tech-stack.md`). If any future feature demands a native module Expo can't
provide, that is a `npx expo prebuild` decision revisited then — not now.

## Required device APIs (V1)

### 1. Push notifications — **required**
- **Purpose:** the core async loop depends on it — "your turn," fill-in warning, invite,
  reaction (batched), story complete. Without push, an async turn-based game is dead.
- **Library:** `expo-notifications` (+ `expo-device` for the physical-device check; Expo push
  tokens via `getExpoPushTokenAsync`). Server side: **Expo Push** service (see `event-storm.md`
  external systems).
- **Permission:** requested **after the first Turn is submitted**, not on launch (higher opt-in;
  see `bounded-contexts.md` Notification). Deep-link routing on tap is a Notification-context
  invariant.
- **iOS:** remote-notification entitlement via EAS; the system permission prompt uses the OS
  string (no custom `Info.plist` usage-description string is required for notifications, unlike
  camera/location). APNs configured through EAS credentials.
- **Android:** `POST_NOTIFICATIONS` runtime permission (Android 13+); a notification channel is
  created at first registration. FCM configured through EAS credentials.
- **Workflow implication:** **none** — fully supported in managed workflow.

## Secure storage (not a device *API*, noted for completeness)
- **Auth token** is stored in **`expo-secure-store`** (Keychain / Keystore), **never**
  `AsyncStorage` (see `tech-stack.md`). Managed-workflow supported; no permission prompt.
- **`AsyncStorage`** holds non-secret cached data (story list, draft autosave) — no permission.

## Explicitly NOT required in V1 (so managed workflow holds)

| Capability | Needed? | Note |
|------------|---------|------|
| Camera / photo library | **No** | Avatars in V1 are not photo-upload; if added later, `expo-image-picker` is still managed-workflow-safe. |
| Location | **No** | The game has no geo feature. |
| Bluetooth / BLE | **No** | — |
| NFC | **No** | — |
| Contacts | **No** | Invites are by username or share link, not contact-book scraping. |
| Microphone / audio | **No** | Text-only game. |
| Biometrics | **No** | Email/password auth in V1; token in secure-store. |

**None of the above forces bare workflow.** The single required API (push) is managed-safe, so the
`tech-stack.md` "managed workflow confirmed" decision stands with no caveat.
