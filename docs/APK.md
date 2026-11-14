# Kadhali APK

`kadhali.apk` is a real signed Android app. The web UI is bundled in
`assets/web`, so it launches instantly; AI requests go to your Kadhali server
over Wi-Fi.

## Build

```bash
./build-apk.sh
```

Output: `./kadhali.apk` (signed with your debug keystore, ~80 KB).

Requirements: JDK 17, Android SDK platform 34 and build-tools 34
(`aapt2`, `d8`, `zipalign`, `apksigner`). Paths can be overridden with
`JAVA_HOME` and `ANDROID_SDK_ROOT`.

## Manual pipeline

```bash
aapt2 compile --dir android/res -o res.zip
aapt2 link -o base.apk -I android.jar --manifest android/AndroidManifest.xml \
  --java gen --min-sdk-version 24 --target-sdk-version 34 -A android/assets res.zip
javac -source 8 -target 8 -bootclasspath android.jar -d classes R.java MainActivity.java
d8 --lib android.jar --min-api 24 --output dex classes/**/*.class
zip base.apk classes.dex
zipalign -f 4 base.apk aligned.apk
apksigner sign --ks ~/.android/debug.keystore --out kadhali.apk aligned.apk
```

## Install

```bash
adb install -r kadhali.apk
```

On first launch, enter `http://<your-ip>:8765` shown by `./run.sh --lan`.
For PC control, start with `--control` and paste the pairing token from the
server terminal into the 🖥 panel.

## Phone features

Voice input (RecognizerIntent), female TTS, torch, vibrate, clipboard,
share sheet, battery/device info, Android settings shortcuts, and the PC panel.

## Notes

- The APK needs `INTERNET`, `RECORD_AUDIO`, `ACCESS_NETWORK_STATE`, `VIBRATE`.
- Cleartext HTTP is allowed because the server is your own LAN machine.
- The release APK is signed with a debug key; create your own keystore before
  publishing to a store.
