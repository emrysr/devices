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
$ cordova run android device
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

# todo
- connect to device's hotspot
- send ssid and psk to device via api
- revert back to current ssid
