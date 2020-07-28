## EmonCMS Devices App - Pair your new device

EmonCMS devices create wifi hotspots when not connected. Once connected to these hotspots you can configure the device to connect to your local wifi connection.

This app will discover these hotspots and connect your device to your wifi without manual configuration.

You can sign into your dashboard to allow your device to be controlled online as well as locally.



---------------------------------------------

 
## Screenshots
Screenshots of the web based Energy Local Dashboard and this App running on Android
<table>
    <tr>
        <td>
            <a href="dashboard-screenshot.png?raw=true" alt="Dashbaord Screenshot">
                <img src="dashboard-screenshot.png?raw=true" width="450" alt="Screenshot of Dashboard">
            </a>
            <br>
            <em>Dashboard showing device synced with the <a href="https://octopus.energy/agile/">Octopus Agile tariff</a> pricing</em>
        </td>
        <td></td>
        <td>
            <a href="app-screenshot.png?raw=true" alt="App Screenshot">
                <img src="app-screenshot.png?raw=true" width="217" alt="Screenshot of App">
            </a>
            <br>
            <em>App showing discovered devices</em>
        </td>
    </tr>
</table>

> You can control your device using your [Energy Local Dashboard](https://dashboard.energylocal.org.uk) account


---------------------------------------------



## quick run
```bash
$ git clone [this repo]
$ cd [this repo directory]
$ cordova platform add android
$ cordova run android --device
```

## cordova requirements
```bash
$ cordova plugin add cordova-plugin-zeroconf
$ cordova plugin add https://github.com/tripflex/wifiwizard2
$ cordova plugin add cordova-plugin-advanced-http
```

## problems
if you have problems compiling try to remove then add the platform
```bash
$ cordova platform remove android
$ cordova platform add android
```
or `$ rm -rf [repo dir]/platforms && cordova platform add android`y




---------------------------------------------



## Debugging API responses
If you're vs code to [live-preview your code in a browser][1] there are a few "external" api calls that require JSON responses.
These are the examples I've been using to test with: (paste them into the "Android in a browser simulator" reponses for each call)


### WifiWizard2.isWifiEnabled()
This just requires a success or fail response to test. I tested with both to see the result on the application.
> eg: "true" -> click [SUCCESS]

### WifiWizard2.getConnectedSSID()
You can respond with any `String`, however if you use your actual wifi connection name the "current connection" will be correctly hightlighted in the access point list
> eg: "BTHub5-AAAA" -> click [SUCCESS]

### WifiWizard2.getWifiIp()
You can respond with any `String`, however try entering in a similar IP address to your local network
> eg: "192.168.1.222" -> click [SUCCESS]

### WifiWizard2.scan()
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
-> click [SUCCESS]

### WifiWizar2d.add([SSID]])
    -> click [SUCCESS]

### WifiWizar2.connect([SSID]])
    -> click [SUCCESS]
> WifiWizar2.connect() is the same as calling formatWifiConfig() then add() then enable()

### CordovaHttpPlugin.post([host], [username], [password])
This returns error not data if there is an error
```JSON
{
    "status":200,
    "url":"http://test.localhost",
    "data":"{\"success\": true,\"userid\": 0,\"apikey_write\": \"e31da26bd2f9807930cad74adb9853a0\",\"apikey_read\": \"6c255f8156fe09694a9a316fb36db971\"}",
    "headers":{}
}
```
    -> click [SUCCESS]

or an error
```JSON
{
    "status":404,
    "url":"http://test.localhost",
    "error":"{\"success\": false, \"message\": \"Incorrect authentication\"}",
    "headers":{}
}
```
    -> click [FAILURE]

### ZeroConf.reInit()
This just requires a success or fail response to test. Value is not important.
    -> click [SUCCESS]

### ZeroConf.watch()
This requires a specific JSON object with known properties:
> eg: `{"action":"resolved","service":{"domain":"local.","type":"_workstation._tcp.","name":"emonpi [b8:27:b8:27:b8:27]","port":9,"hostname":"","ipv4Addresses":["192.168.1.186"],"ipv6Addresses":["fe80::b03c:1111:1111:1111"],"txtRecord":{}}}`
    -> click [SUCCESS]

5 more different example responses:-
```JSON
{"action":"added","service":{"domain":"local.","type":"_http._tcp.","name":"smartplug5339","port":0,"hostname":"smartplug5339._http._tcp.local.","ipv4Addresses":[],"ipv6Addresses":[],"txtRecord":{"smartplug5339._http._tcp.local.":"true"}}}
{"action":"resolved","service":{"domain":"local.","type":"_http._tcp.","name":"smartplug5339","port":80,"hostname":"","ipv4Addresses":["192.168.1.78"],"ipv6Addresses":[],"txtRecord":{}}}
{"action":"added","service":{"domain":"local.","type":"_http._tcp.","name":"openevse-8970","port":0,"hostname":"openevse-8970._http._tcp.local.","ipv4Addresses":[],"ipv6Addresses":[],"txtRecord":{"openevse-8970._http._tcp.local.":"true"}}}
{"action":"resolved","service":{"domain":"local.","type":"_http._tcp.","name":"openevse-8970","port":80,"hostname":"","ipv4Addresses":["192.168.1.81"],"ipv6Addresses":[],"txtRecord":{}}}
{"action":"added","service":{"domain":"local.","type":"_workstation._tcp.","name":"emonpi [b8:27:b8:27:b8:27]","port":0,"hostname":"emonpi [b8:27:b8:27:b8:27]._workstation._tcp.local.","ipv4Addresses":[],"ipv6Addresses":[],"txtRecord":{"emonpi [b8:27:b8:27:b8:27]._workstation._tcp.local.":"true"}}}
```
> you could also use the `avahi-discover` terminal command to see your actual results and change the above examples to match

### ZeroConf.close()
This just requires a success or fail response to test. Value is not important.
    -> click [SUCCESS]


> there is a larger example in the [wifi-scan](https://github.com/emrysr/wifiscan) repo I based this work on  - RAW: [WifiWizard2.scan.response.example.json](https://raw.githubusercontent.com/emrysr/wifiscan/master/WifiWizard2.scan.response.example.json)

---------------------------------------------


## Scripts to scan local network devices

### Avahi Utils
> "...service discovery on a local network via the mDNS/DNS-SD protocol suite..."

This is used to find devices on the network

#### Install it with:
```bash
$ sudo apt install avahi-utils
```

#### Scan your network:
```bash
$ avahi-browse -a
```

#### Simulate a device on the network.
the paramerters are:
`name`, `type`, `port`, `TXT`
```bash
$ avahi-publish-service "Dev Laptop" _http._tcp. 80 v=10.2.0 platform=emoncms path=/emoncms
```


---------------------------------------------

# todo
- `onOffline()` and `onOnline()` are not called correctly. need to improve the "I'm offline" event handling to store the `currentSSID` and `currentIP` correctly
- translation - i18n label placeholders and translations
- better structure the code into backend and frontend methods. 


[1]: <https://docs.microsoft.com/en-us/visualstudio/cross-platform/tools-for-cordova/run-your-app/simulate-in-browser?view=toolsforcordova-2017>
