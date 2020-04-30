# pair new devices to your local wifi

EmonCMS devices create wifi hotspots when not connected. Once connected to these hotspots you can configure the device to connect to your local wifi connection.

This app will discover these hotspots and connect your device to your wifi without manual configuration.

> _You still need to supply the wifi passkey for the device to connect_

[<img src="screenshot.png?raw=true" width="350"/>](screenshot.png?raw=true)


# quick run
```bash
$ git clone [this repo]
$ cd [this repo directory]
$ cordova platform add android
$ cordova run android --device
```

# cordova requirements
```bash
$ cordova plugin add cordova-plugin-zeroconf
$ cordova plugin add https://github.com/tripflex/wifiwizard2
```

# problems
if you have problems compiling try to remove then add the platform
```bash
$ cordova platform remove android
$ cordova platform add android
```
or `$ rm -rf [repo dir]/platforms && cordova platform add android`y



# todo
- store discovered devices as local storage
- add to discovered devices instead of clearing list each time. the zeroconf scan doesn't always return the same results - some devices ar lost until the next scan?
- `onOffline()` and `onOnline()` are not called correctly. need to improve the "I'm offline" event handling to store the `currentSSID` and `currentIP` correctly
