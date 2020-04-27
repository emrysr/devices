# pair new devices to your local wifi

EmonCMS devices create wifi hotspots when not connected. Once connected to these hotspots you can configure the device to connect to your local wifi connection.

This app will discover these hotspots and connect your device to your wifi without manual configuration.

_You still need to supply the wifi passkey for the device to connect_


# cordova plugins
```bash
$ cordova plugin add cordova-plugin-zeroconf
$ cordova plugin add https://github.com/tripflex/wifiwizard2
```

# todo
- standardize the icons to match EmonCMS
- select an accent colour
- connect to device's hotspot
- send ssid and psk to device via api
- revert back to current ssid