## EmonCMS Devices App - Pair your new device

[EmonCMS devices](https://github.com/emrysr/devices) create wifi hotspots when not connected. Once connected to these hotspots you can configure the device to connect to your local wifi connection.

This app will discover these hotspots and connect your device to your wifi without manual configuration.

You can sign into your dashboard to allow your device to be controlled online as well as locally.

Written with [Apache Cordova](https://cordova.apache.org/) - works on multiple devices, however main development done one Android 9. Other devices and versions should be compatible with this Cordova App.

> :information_source: If any issues found running the app on iPhones please create a [github issue](https://github.com/emrysr/devices/issues) :bug: to track problems and fixes


---------------------------------------------

 
## Screenshots
Screenshots of the web based [Energy Local Dashboard](https://dashboard.energylocal.org.uk) and this App running on Android
> :link: You can control your device using your [Energy Local Dashboard](https://dashboard.energylocal.org.uk) account

<table>
    <tr>
        <td>
            <a href="dashboard-screenshot.png?raw=true" alt="Dashbaord Screenshot">
                <img src="dashboard-screenshot.png?raw=true" width="450" alt="Screenshot of Dashboard">
            </a>
            <br>
            <em>Dashboard showing device synced with the <a href="https://octopus.energy/agile/">Octopus Agile tariff</a> pricing</em>
        </td>
        <td>
            <a href="app-screenshot.png?raw=true" alt="App Screenshot">
                <img src="app-screenshot.png?raw=true" width="217" alt="Screenshot of App">
            </a>
            <br>
            <em>App showing discovered devices</em>
        </td>
    </tr>
</table>



---------------------------------------------


## Quick run
> If Cordova not installed... `$ sudo npm install -g cordova`

```bash
$ git clone [this repo]
$ cd [this repo directory]
$ cordova platform add android
$ cordova run android --device
```

## Required Cordova plugins
```bash
$ cordova plugin add cordova-plugin-zeroconf
$ cordova plugin add https://github.com/tripflex/wifiwizard2
$ cordova plugin add cordova-plugin-advanced-http
$ cordova plugin add cordova-plugin-inappbrowser
```
or as one liner...

```bash
$ cordova plugin add cordova-plugin-zeroconf https://github.com/tripflex/wifiwizard2 cordova-plugin-advanced-http cordova-plugin-inappbrowser
```


---------------------------------------------

## Compling Problems
You may have problems compiling, try to remove then add the cordova platform to fix this:
```bash
$ cordova platform remove android
$ cordova platform add android
```
or remove the whole `platform` directory and re-add:
```bash
$ rm -rf platforms && cordova platform add android
```
> __⚠ NOTE__ : The Cordova plugins will also need to be re-installed once you remove a platform


## Github issue tracker
If you find any issues please add a new entry onto the github repo's issue tracker. Thanks

> :link: We use __[Github issues](https://github.com/emrysr/devices/issues)__ to track issues and create fixes.

---------------------------------------------



## Documentation
### code documentation (jsdoc)
The code comments have been used to document the code using jsdoc in the `/docs` directory

Changes to comments in `www/js/index.js` or the `README.md` can automatically be shown in the documentation by using jsdoc
```bash
$ jsdoc www/js/index.js README.md -d docs
```

The hosted github pages version is here: http://code.emrys.cymru/devices/

---------------------------------------------

# Debugging
## VS Code specific debugging
You can debug running Cordova apps using the vscode debug tools. The web browser based simulator expects responses when the app uses any plugin api.
I've created a [list of example responses](https://github.com/emrysr/devices/blob/master/README-vscode-debugging.md) for you to use during debugging.

> there more details on vscode setup in the [wifi-scan](https://github.com/emrysr/wifiscan#using-vscode) repo I based this work on 

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
