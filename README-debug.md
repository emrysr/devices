# Debugging EmonCMS Devices
> This page is part of the [EmonCMS Devices README][parent-page]

Follow these instructions to debug the code while developing new features or testing existing ones.


This app has been developed in [vscode][vscode] and used the [vscode debugging tools][vscode-debugging-docs]. 

Other IDEs and debugging methods are available, just not tested them... pr appreciated


## VS Code specific debugging

You can debug running Cordova apps using the [vscode][vscode-cordova-docs] debug tools. The web browser based simulator expects responses when the app uses any plugin api.
I've created a [list of example responses][cordova-responses] for you to use during debugging.

> there more details on vscode setup in the [wifi-scan][wifiscan-docs] repo I based this work on 

## adb (Android Debug Bridge)

you can interrogate the connected device's activity log (and filter by specific tags) using the `logcat` and `grep` commands

```
adb logcat -v tag | grep -i -e 'connectivityservice\|wifiwizard2\|WifiService\|ssid\|wifi'
```

> this works for any android device connected (in developer mode with usb debugging turned on)

## Android Studio

Android studio has a feature where you can connect to and read from a device's log. Was not done as part of my development work.

---------------------------------------------

## Scripts to scan local network devices

The app requires that the individual devices broadcast their presence using [avahi][avahi-docs]. The found devices are then filtered to match the emoncms device list (can be changed in )

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


---
[parent-page]: <https://github.com/emoncms/cordova-emon-devices/README.md>

[vscode]: https://code.visualstudio.com/
[wifiscan-docs]: https://github.com/emrysr/wifiscan#using-vscode
[vscode-debugging-docs]: https://code.visualstudio.com/docs/editor/debugging
[vscode-cordova-docs]: https://docs.microsoft.com/en-us/visualstudio/cross-platform/tools-for-cordova/run-your-app/simulate-in-browser?view=toolsforcordova-2017
[avahi-docs]: https://www.avahi.org
[cordova-responses]: https://github.com/emoncms/cordova-emon-devices/blob/master/README-vscode-debugging.md
