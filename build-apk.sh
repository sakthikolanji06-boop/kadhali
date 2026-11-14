#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"
JAVA_HOME="${JAVA_HOME:-$HOME/android-tools/jdk}"
SDK="${ANDROID_SDK_ROOT:-$HOME/android-tools/sdk}"
BT="$SDK/build-tools/34.0.0"
AJ="$SDK/platforms/android-34/android.jar"
B="${TMPDIR:-/tmp}/kadhali-apkbuild"
export JAVA_HOME PATH="$JAVA_HOME/bin:$PATH"

rm -rf "$B"; mkdir -p "$B/gen" "$B/classes" "$B/dex" android/assets
rm -rf android/assets/web; mkdir -p android/assets
cp -r web android/assets/web

"$BT/aapt2" compile --dir android/res -o "$B/res.zip"
"$BT/aapt2" link -o "$B/base.apk" -I "$AJ" --manifest android/AndroidManifest.xml \
  --java "$B/gen" --min-sdk-version 24 --target-sdk-version 34 -A android/assets "$B/res.zip"
"$JAVA_HOME/bin/javac" -source 8 -target 8 -nowarn -bootclasspath "$AJ" -classpath "$AJ" \
  -d "$B/classes" $(find "$B/gen" android/java -name '*.java')
"$BT/d8" --lib "$AJ" --min-api 24 --output "$B/dex" $(find "$B/classes" -name '*.class')

cp "$B/base.apk" "$B/unsigned.apk"
(cd "$B/dex" && zip -q "$B/unsigned.apk" classes.dex)
"$BT/zipalign" -f 4 "$B/unsigned.apk" "$B/aligned.apk"
if [ ! -f "$HOME/.android/debug.keystore" ]; then
  mkdir -p "$HOME/.android"
  "$JAVA_HOME/bin/keytool" -genkeypair -keystore "$HOME/.android/debug.keystore" \
    -storepass android -keypass android -alias androiddebugkey \
    -dname "CN=Kadhali Debug,O=Kadhali,C=IN" -keyalg RSA -keysize 2048 -validity 10950
fi
"$BT/apksigner" sign --ks "$HOME/.android/debug.keystore" --ks-pass pass:android \
  --key-pass pass:android --ks-key-alias androiddebugkey --out kadhali.apk "$B/aligned.apk"
"$BT/apksigner" verify kadhali.apk
echo "built: $(pwd)/kadhali.apk ($(du -h kadhali.apk | cut -f1))"
