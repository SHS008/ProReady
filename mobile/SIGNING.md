# Create a Play Store signing key (run ONCE, from proready-coach/mobile/)

You need **JDK 17 or newer**. This produces the upload key that proves future updates to your app come from you.
**Back up the .jks file and the passwords somewhere safe (password manager). If you lose them you cannot update your app under the same listing.**

```bash
keytool -genkeypair -v \
  -keystore android/proready-release.jks \
  -alias proready \
  -keyalg RSA -keysize 2048 -validity 10000 \
  -dname "CN=ProReady Coach, OU=Mobile, O=ProReady Coach, L=Escanaba, ST=Michigan, C=US"
```

It will ask for a keystore password (twice) and a key password. Then create `android/keystore.properties`
(**never commit this file**) with:

```properties
storeFile=../proready-release.jks
storePassword=YOUR_STORE_PASSWORD
keyAlias=proready
keyPassword=YOUR_KEY_PASSWORD
```

`android/app/build.gradle` already reads that file automatically when it exists, so:

```bash
cd android
./gradlew bundleRelease      # -> app/build/outputs/bundle/release/app-release.aab
```

Upload **app-release.aab** to Play Console (Google re-signs it for distribution via Play App Signing).

If you skip signing, `./gradlew bundleRelease` still produces an unsigned bundle, but Play Console will reject it.
