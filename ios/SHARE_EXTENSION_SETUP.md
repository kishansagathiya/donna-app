# iOS Share Extension setup

The Donna app includes share-handling code (`react-native-share-menu`) and extension plist files under `ios/DonnaShare/`.

To appear in the system share sheet (Safari → Share → Donna), add the Share Extension target once in Xcode:

1. Open `ios/Donna.xcworkspace`
2. File → New → Target → **Share Extension** → name it `DonnaShare`
3. Delete the generated `ShareViewController.swift` in the extension folder
4. Add `node_modules/react-native-share-menu/ios/ShareViewController.swift` to the DonnaShare target (do not copy)
5. Replace the extension `Info.plist` with `ios/DonnaShare/Info.plist`
6. Set extension entitlements to `ios/DonnaShare/DonnaShare.entitlements`
7. Enable App Group `group.com.kishansagathiya.donna` on both Donna and DonnaShare targets
8. Run `pod install` (Podfile already includes the `DonnaShare` target)

In-app **+ Add to memory** works without the extension (link paste, file picker, photo picker).
