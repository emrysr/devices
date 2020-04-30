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


# debugging API responses
If you're vs code to [live-preview your code in a browser][1] there are a few "external" api calls that require JSON responses.
These are the examples I've been using to test with:

## ZeroConf.watch()
This requires a specific JSON object with known properties:
> eg: `{"action":"resolved","service":{"domain":"local.","type":"_workstation._tcp.","name":"emonpi [b8:27:b8:27:b8:27]","port":9,"hostname":"","ipv4Addresses":["192.168.1.186"],"ipv6Addresses":["fe80::b03c:1111:1111:1111"],"txtRecord":{}}}`

5 more different example responses:-
```JSON
{"action":"added","service":{"domain":"local.","type":"_http._tcp.","name":"smartplug5339","port":0,"hostname":"smartplug5339._http._tcp.local.","ipv4Addresses":[],"ipv6Addresses":[],"txtRecord":{"smartplug5339._http._tcp.local.":"true"}}}
{"action":"resolved","service":{"domain":"local.","type":"_http._tcp.","name":"smartplug5339","port":80,"hostname":"","ipv4Addresses":["192.168.1.78"],"ipv6Addresses":[],"txtRecord":{}}}
{"action":"added","service":{"domain":"local.","type":"_http._tcp.","name":"openevse-8970","port":0,"hostname":"openevse-8970._http._tcp.local.","ipv4Addresses":[],"ipv6Addresses":[],"txtRecord":{"openevse-8970._http._tcp.local.":"true"}}}
{"action":"resolved","service":{"domain":"local.","type":"_http._tcp.","name":"openevse-8970","port":80,"hostname":"","ipv4Addresses":["192.168.1.81"],"ipv6Addresses":[],"txtRecord":{}}}
{"action":"added","service":{"domain":"local.","type":"_workstation._tcp.","name":"emonpi [b8:27:b8:27:b8:27]","port":0,"hostname":"emonpi [b8:27:b8:27:b8:27]._workstation._tcp.local.","ipv4Addresses":[],"ipv6Addresses":[],"txtRecord":{"emonpi [b8:27:b8:27:b8:27]._workstation._tcp.local.":"true"}}}
```
> you could also use the `avahi-discover` terminal command to see your actual results and change the above examples to match

## ZeroConf.close()
This just requires a success or fail response to test. Value is not important.

## ZeroConf.reInit()
This just requires a success or fail response to test. Value is not important.

## WifiWizard2.isWifiEnabled()
This just requires a success or fail response to test. I tested with both to see the result on the application.
> eg: true

## WifiWizard2.getConnectedSSID()
You can respond with any `String`, however if you use your actual wifi connection name the "current connection" will be correctly hightlighted in the access point list
> eg: "BTHub5-AAAA"

## WifiWizard2.getWifiIp()
You can respond with any `String`, however try entering in a similar IP address to your local network
> eg: "192.168.1.222"

## WifiWizard2.scan()
This will simulate a wifi scan to see all available accesspoints (one device and one standard ap)
```JSON
[
  {
    "level": -32,
    "SSID": "smartplug5339",
    "BSSID": "86:f3:eb:00:00:00",
    "frequency": 2412,
    "capabilities": "[ESS]",
    "timestamp": 1893205094332,
    "channelWidth": 0,
    "centerFreq0": 0,
    "centerFreq1": 0
  },
  {
    "level": -62,
    "SSID": "BTHub5-AAAA",
    "BSSID": "08:36:c9:00:00:00",
    "frequency": 2427,
    "capabilities": "[WPA2-PSK-CCMP][ESS][WPS]",
    "timestamp": 1893205094360,
    "channelWidth": 0,
    "centerFreq0": 0,
    "centerFreq1": 0
  }
]
```
> there is a larger example in the [wifi-scan](https://github.com/emrysr/wifiscan) repo I based this work on  - RAW: [WifiWizard2.scan.response.example.json](https://raw.githubusercontent.com/emrysr/wifiscan/master/WifiWizard2.scan.response.example.json)

# Scripts to scan local network devices

## Avahi Utils
> "...service discovery on a local network via the mDNS/DNS-SD protocol suite..."

This is used to find devices on the network

### Install it with:
```bash
$ sudo apt install avahi-utils
```

### Scan your network:
```bash
$ avahi-browse -a
```

### Simulate a device on the network.
the paramerters are:
`name`, `type`, `port`, `TXT`
```bash
$ avahi-publish-service "Dev Laptop" _http._tcp. 80 v=10.2.0 platform=emoncms path=/emoncms
```





# todo
- store discovered devices as local storage
- give each device a `last seen` property to aid in caching
- add to discovered devices instead of clearing list each time. the zeroconf scan doesn't always return the same results - some devices ar lost until the next scan?
- `onOffline()` and `onOnline()` are not called correctly. need to improve the "I'm offline" event handling to store the `currentSSID` and `currentIP` correctly
- tidy up code





[1]: <https://docs.microsoft.com/en-us/visualstudio/cross-platform/tools-for-cordova/run-your-app/simulate-in-browser?view=toolsforcordova-2017>
