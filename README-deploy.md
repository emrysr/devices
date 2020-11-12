# Build steps

> This page is part of the [EmonCMS Devices README][parent-page]

Use these instructions to build the EmonCMS Devices App using Apache Cordova 

```sequence
Title: How Web App is deployed to Android Device
HTML->JAVA: cordova builds apk
JAVA->PLAY_STORE: java signs app
PLAY_STORE->ANDROID: app installed
```

Before building a new release you must update the release numbers:

1. change documentation comment in `www/js/index.js` (line 9) to `@version 0.2.3`
2. change version value in `www/js/index.js` (line 13) to `const APP_VERSION = "0.2.3";`
3. change version value in `config.xml` (line 3) to `version="0.2.3";`
4. increase counter value in `config.xml` (line 4) `android-versionCode="6";` (avoids clashes)

## Documentation

Build the documentation to reflect the code changes. 
See [README][jsdoc] for more info

## Android

Android now have `Android App Bundles`. These instructions are for the older `.apk` style releases. Follow these steps to build, package the upload the app to the play store.

Open the terminal and ensure you're in the correct directory.

```bash
$ cd [project directory]
```

### Build using Cordova

```bash
$ cordova build --release android
```

should return something like this:

```
BUILD SUCCESSFUL in 34s
43 actionable tasks: 11 executed, 32 up-to-date
Built the following apk(s): 
        ~/src/devices/platforms/android/app/build/outputs/apk/release/app-release-unsigned.apk
```

### Move to /releases

This step allows simplify the next steps by setting the filename as a variable

> change the number below to match the current number...

```bash
$ newname=emon-devices.0.2.3.signed.apk
$ cp platforms/android/app/build/outputs/apk/release/app-release-unsigned.apk releases
```

### Sign

You should be able to use the android studio to sign the apk. Didn't work for me so I used this method with jarsigner found on: [android - How to Sign an Already Compiled Apk - Stack Overflow][sign-apk-tips]

```bash
$ jarsigner -verbose \ 
  -sigalg SHA1withRSA \
  -digestalg SHA1 \
  -keystore [keystore location] \
  releases/app-release-unsigned.apk \
  [keystore alias]
```

should return something like this:

```
jar signed.

Warning: 
The signer's certificate is self-signed.
```

### Compress

Compress or "align" via `zipaligned` . Unsure if this step is required. Seems to work anyway..?

```bash
zipalign -f -v 4 releases/app-release-unsigned.apk releases/$newname
```

### Upload

Login to your developer account and upload the signed `*.apk` as the release package. 

[Google Play Developer Console][play-console]

### Done.

once google approve the app it should show up in the app store.

---

[play-console]: <https://play.google.com/console/developers>
[sign-apk-tips]: <https://stackoverflow.com/questions/10930331/how-to-sign-an-already-compiled-apk>
[parent-page]: <https://github.com/emoncms/cordova-emon-devices/README.md>
[jsdoc]: <https://github.com/emoncms/cordova-emon-devices/README-jsdoc.md>