# Shipping Threshold

`npm run build` bundles `src/` (with three.js) into `www/`, which both the web version and the iPhone app use.

## Web
Every push to `main` builds and publishes the game to https://fgbab.github.io/threshold/ (`.github/workflows/pages.yml`).

## iPhone → TestFlight (EAS, no Xcode needed)
Threshold is a Capacitor app that builds on EAS in the **gazum-corp** Expo org (project `@gazum-corp/threshold`)
and signs with the GAZUM Corp. Apple team. Bundle ID: `org.gazum.threshold`. It uses the same custom EAS build as MONO:
`.eas/build/ios-capacitor.yml` (the comments there explain why `ios/App.xcodeproj` is a symlink).

`npm run build` makes `www/`: the web files plus `native.js`, which bundles the Capacitor plugins (haptics, share sheet,
local notification, saved progress) for `game.js`.

**First build (Terminal.app, needs an Apple ID that is Admin or Account Holder on the GAZUM Corp. team):**
```bash
cd ~/Projects/threshold
npx eas-cli@latest build -p ios --profile testflight-ios --auto-submit
```
- Log in to Apple when asked and pick the GAZUM Corp. team.
- Reuse the existing distribution certificate; let EAS create the provisioning profile for `org.gazum.threshold`.
- Push notifications: **No** (the reminder is a local notification).
- `--auto-submit` uploads to App Store Connect when the build finishes. If the app record doesn't exist yet, EAS creates
  "Threshold: Five Doors" (SKU `threshold`). App Store names are unique: if it's taken, change `appName` in `eas.json`.

**Later builds (no logins needed now):**
```bash
npx eas-cli@latest build -p ios --profile testflight-ios --non-interactive --auto-submit
```
The credentials and an App Store Connect API key are stored on EAS, and `eas.json` names the App Store Connect app
(`ascAppId` 6820795116), so builds and uploads run unattended. Build numbers increase automatically (stored on EAS).
TestFlight "What to Test" notes can't be sent from the command line on our EAS plan; add them in App Store Connect.
The App Store name is still "Threshold: Five Doors" from the first upload; rename it in App Store Connect > App Information.

**TestFlight:** after processing (about 10 to 15 minutes), App Store Connect → Threshold → TestFlight → Internal Testing →
add yourself and the build, then open the invite in the TestFlight app.

## App Store Connect answers
- **App Privacy:** Data Not Collected. The camera is processed on the phone; nothing is uploaded, and there are no accounts,
  analytics or ads.
- **Camera and microphone:** the permission texts are in `ios/App/App/Info.plist` (`NSCameraUsageDescription`, `NSMicrophoneUsageDescription`). The microphone is only opened during the doors that listen.
- **Age rating:** mild horror/fear themes; no violence, gambling or user-generated content.

## Changing native settings
After `npx cap sync ios`, re-check `Info.plist` (camera text, portrait only, hidden status bar) and that
`PrivacyInfo.xcprivacy` is still in the App target. Icons and launch images: `npm run assets` from `assets/`.
