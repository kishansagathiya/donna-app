# iOS Share Extension

Donna appears in the system share sheet via the `DonnaShare` app extension
(`ios/DonnaShare`). Shared text, URLs, images, and files are copied into the
App Group and opened in the host app, which creates a note.

## What is already in the project

- Share Extension target `DonnaShare` in `Donna.xcodeproj`
- App Group `group.com.kishansagathiya.donna` on both Donna and DonnaShare
- Host URL scheme `donna://share`

## First install / signing

The extension bundle ID is `com.kishansagathiya.donna.share`. Both App IDs
need the App Group capability:

1. Apple Developer → Identifiers → App Groups → `group.com.kishansagathiya.donna`
2. Enable that group on `com.kishansagathiya.donna` and `com.kishansagathiya.donna.share`
3. Rebuild (EAS will try to provision this automatically)

After installing a new build, open Safari (or Photos) → Share → look for
**Donna**. New destinations sometimes sit under the share sheet's **More** /
edit list until used once.
