/**
 * @file Mobile app to display and add emoncms devices | Part of the OpenEnergyMonitor project
 * @author Emrys Roberts <emrys@openenergymonitor.org.uk>
 * @description Mobile app that scans the local network for device. Connects to new device hotspot and pairs it. Adds the device to the user's online dashboard.
 * @summary Emon Devices App
 * @see {@link http://openenergymonitor.org|OpenEnergyMonitor project}
 * @version 0.2.0
 * @license AGPL-3.0-or-later {@link https://raw.githubusercontent.com/emrysr/devices/master/LICENSE.txt|LICENSE.txt}
 * @copyright EmonCMS 2020 {@link https://raw.githubusercontent.com/emrysr/devices/master/COPYRIGHT.txt|COPYRIGHT.txt}
 *
 */



/**
 * Populated once initialized by app.initialize()->app.onDeviceReady()
 */
var view;
/**
 * Similar (ish) to MVC Controller
 * instance of Controller
 * @see Controller
 * @see app.onDeviceReady()
 */
var controller;
/**
 * Displays debugging output at different levels ** instance of Logger
 * filled once initialized by app.initialize()->app.onDeviceReady()
 * @see Logger
 * @see _loggerLevels for list of output levels
 * @see app.onDeviceReady()
 */
var logger;

/**
 * generic functions not app or controller specific
 * Filled once initialized by app.initialize()->app.onDeviceReady()
 * @see Utilities
 * @see app.onDeviceReady()
 */
var utils;

/**
 * main settings and methods of app eg. authorize() etc.
 * stores all app state/variable changes
 * @constructor
 * @alias App
 */
var app = {
    scan_retries: 0,
    scan_counter: 0,
    settings: {
        defaultView: "#devices",
        deviceScanTimeout: 3000,
        deviceScanRepeat: 2000,
        deviceApScanRepeat: 5000,
        deviceApScanMaxRetries: 8,
        wifiScanTimeout: 2000,
        wifiScanRepeat: 20000,
        device_ssid_pattern: /^(smartplug|wifirelay|hpmon|openevse|meterreader).*$/g
    },
    state: {
        devices: [],
        accessPoints: [],
        hotspots: [],
        online: false,
        currentSSID: false,
        currentIP: false,
        selectedHotspot: false,
        deviceListCleanInterval: false,
        deviceConnectionSSID: false,
        deviceConnectionPsk: false,
        deviceScanRepeatObj: false,
        deviceScanCancelled: false,
        deviceApScanRepeatObj: false,
        deviceApScanRetries: 0,
        wifiScanRepeatObj: false
    },
    initialize: function() {
        document.addEventListener('deviceready', this.onDeviceReady.bind(this), false);
    },
    
    onDeviceReady: function() {
        // populate global variables
        logger = new Logger(_loggerLevels.WARN); // handle application event loggin
        controller = new Controller(app.defaultView); // handle all view/tab changes
        utils = new Utilities(); // fill global variable with methods
        view = new View(); // handle dom changes

        // ready.
        logger.debug('Cordova JS Ready');

        // add mobile system events
        document.addEventListener("reload", this.onReload.bind(this), false);//window.location.reload(true);
        document.addEventListener("connect", this.onConnect.bind(this), false);
        document.addEventListener("offline", this.onOffline.bind(this), false);
        document.addEventListener("online", this.onOnline.bind(this), false);
        // get network status
        app.getStatus();
        // load stored devices
        app.setState("devices", app.loadList("devices"));
        app.setState("accessPoints", Wifi.filterLatestAccessPoints(app.loadList("accessPoints")));

        // show welcome page
        controller.firstPage();
    },

    onReload: event=>{app.getStatus()},
    onConnect: event=>{app.getStatus()},
    onOffline: event=>{app.getStatus()},
    onOnline: event=>{app.getStatus()},
    
    /**
     * collect current wifi state to show in settings
     */
    getStatus: function() {
        logger.trace('Checking if connected to wifi');
        app.getWifiEnabled().then(status=> {app.setIsConnected(status)});
        app.getCurrentSSID().then(ssid=> {app.setCurrentSSID(ssid)});
        WifiWizard2.getWifiIP()
            .then(ip=> {
                app.setCurrentIP(ip);
            })
            .catch(()=>{
                app.setCurrentIP("");
                app.setIsConnected(false);
            });
    },
    /**
     * read settings from app object
     */
    getSettings: function(key) {
        if(app.settings.hasOwnProperty(key)) {
            logger.trace(`GET SETTINGS: app.settings.${key} = ${app.settings[key]}`);
            return app.settings[key];
        } else {
            logger.trace(`GET SETTINGS: "${key}" not in app.settings`);
            return undefined;
        }
    },
    /**
     * get app settings value
     * @param {String} key name of property value to return
     * @param {Boolean} log true default, false = do not show in log
     * @returns {*} property value or undefined
     */
    getState: function(key, log) {
        if(app.state.hasOwnProperty(key)) {
            var value = app.state[key];
            if(log) {
                if (typeof value !== "object") {
                    logger.trace(`GET STATE: app.state.${key} = "${app.state[key]}"`);
                } else {
                    logger.trace(`GET STATE: app.state.${key} = OBJECT.length:${(app.state[key]).length}`);
                }
            }
            return value;
        } else {
            logger.trace(`GET STATE: "${key}" not in app.state`);
            return undefined;
        }
    },
    setState: function(key, value) {
        if (typeof value !== "object") {
            logger.trace(`SET STATE: app.state.${key} = "${value}"`);
        } else {
            logger.trace(`SET STATE: app.state.${key} = OBJECT.length:${(value).length}`);
        }
        try {
            app.state[key] = value;
            return value;
        } catch (error) {
            app.showError(error);
        }
    },
    /**
     * toggle connectivity state and show result
     * @param {Boolean} isOnline - true = is online ok
     */
    setIsConnected: function(isOnline) {
        if(!isOnline) controller.show("disconnected");
        app.setState("online", isOnline);
        // controller.find("#connected").innerText = isOnline ? 'YES': 'NO';
        view.innerText(controller.find("#connected"), isOnline ? 'YES': 'NO')
    },
    /**
     * get the currently connected SSID. save to app.state and update view
     */
    getCurrentSSID: function() {
        return WifiWizard2.getConnectedSSID()
        .then(function(ssid) {
                logger.trace(`currently connected to ${ssid}`);
                app.setCurrentSSID(ssid);
                return ssid;
            })
            .catch(function(reason) { 
                logger.trace(`error checking connection! ${reason}`);
                app.showError(reason);
            });
    },
    setCurrentSSID: function(ssid) {
        app.setState("currentSSID", ssid);
        controller.find("#currentSSID").innerText = ssid;
    },
    setCurrentIP: function(ip) {
        app.setState("currentIP", ip);
        controller.find("#currentIP").innerText = ip;
    },
    onExternalLinkClick: function(event) {
        event.preventDefault();
        var url = utils.getClosest(event.target, "a").href;
        if(url) window.open(url,'_blank', 'location=yes');
    },
    /**
     * returns promise with bool as parameter in sucessful then()
     * @returns {Promise<Boolean>}
     */
    getWifiEnabled: function() {
        return WifiWizard2.isWifiEnabled();
    },
    getNetworkDevices: function () {
        controller.startLoader("Searching for devices on the network...");
        app.zeroconfScan().catch(app.showError)
            .finally(() => {
                // repeat the scan after delay - only if in "device scan" tab
                if(controller.state === "#devices" && !app.getState("deviceScanCancelled")) {
                    var t = setTimeout(function() {
                                app.getNetworkDevices()
                            }, app.getSettings("deviceScanRepeat"));
                    app.setState("deviceScanRepeatObj", t);
                }
                controller.stopLoader();
            });
    },

    /**
     * scan wifi, save results, filter results to only show device hotspots and
     */
    checkForNewDevices: function() {
        controller.startLoader("Searching for new devices in range...");
        Wifi.scan()
            .then(accessPoints=> { 
                Wifi.setAccessPointTTL(accessPoints);
                app.setState("accessPoints", accessPoints);
                // app.save() returns undefined on success;
                if (typeof app.save("accessPoints", accessPoints) !== "undefined") {
                    app.showError("Error saving accessPoints to local store");
                }
                return accessPoints;
            })
            .then(accessPoints=> { 
                return Devices.getDeviceHotspots(accessPoints, app.getSettings("device_ssid_pattern"));
            })
            .then(hotspots=> {
                app.setState("hotspots", hotspots);
                view.showDeviceHotspots(hotspots);
            })
            .then(()=> {
                // ALL DONE. REPEAT IF NOT HIT MAX REPEATS
                // repeat the scan after delay - only if in "device scan" tab
                if(controller.state === "#add-device") {
                    // increment counter
                    app.setState("deviceApScanRetries", app.getState("deviceApScanRetries") + 1);
                    // test if counter reached max
                    if(app.getState("deviceApScanRetries") <= app.getSettings("deviceApScanMaxRetries")) {
                        WifiWizard2.timeout(app.getSettings("deviceApScanRepeat"))
                        .then(function() {
                            app.checkForNewDevices();
                        });
                    } else {
                        controller.stopLoader();
                        app.showError("Max AP scan retries reached!", app.getSettings("deviceApScanMaxRetries"));
                        self.show("#add-device [data-reload]");
                        app.setState("deviceApScanRetries", 0);
                        if(app.getState("hotspots").length === 0) {
                            controller.changeView("#add-device-failed");
                        }
                    }
                }
            })
            .catch(function(error) {
                // SCAN_FAILED 
                // - seems to ba a fault with the wifi. wait longer (x3) between retries
                if(error === "SCAN_FAILED") {
                    // increment counter
                    app.setState("deviceApScanRetries", app.getState("deviceApScanRetries") + 1);
                    // test if counter reached max
                    if(app.getState("deviceApScanRetries") <= app.getSettings("deviceApScanMaxRetries")) {
                        WifiWizard2.timeout(app.getSettings("deviceApScanRepeat")*3)
                        .then(function() {
                            app.checkForNewDevices();
                        });
                    }
                }
                app.showError(error, app.getState("deviceApScanRetries"));
            });
    },
    
    /**
     * returned a sorted list of devices already found
     * cleans out old results
     */
    getStoredDevices: function() {
        var results = app.getState("devices") || [];
        // clear out old entries
        results = app.removeExpired(results);
        // sort by name [a-z]
        results.sort((a, b) => (a.name > b.name) ? 1 : -1)
        app.setState("devices", app.loadList("devices"));
        return results;
    },
    /**
     * merge new devices with old devices 
     * aka "array merge recursive"
     * add list2 entries if not already in list1 or newer
     * @param {Array} list1 list to base the merge on
     * @param {Array} list2 list to merge to existing devices list
     * @returns {Array} merged list1 (cached devices) and list2 (new devices)
     */
    updateDevices: function(list1, list2) {
        // return list1 if both are identical
        if(JSON.stringify(list1)===JSON.stringify(list2)) return list1;
        
        // test list2 values against list1 values
        var list2 = list2.reduce((devices, device) => {
            if(app.deviceIsUnique(device, list1)) {
                devices.push(device);
            } else {
                if(app.deviceIsNewer(device, list1)) {
                    devices.push(device);
                } else {
                    var old_device = controller.findDevice(device.ip);
                    old_device.lastSeen = new Date().valueOf();
                    devices.push(old_device);
                }
            }
            return devices;
        }, []);

        // test list1 values against list2 values. return new list with overlaps removed
        var list1 = list1.reduce((devices, device)=> {
            if(app.deviceIsUnique(device, list2)) {
                devices.push(device);
            }
            return devices;
        }, [])
        


        
        // join reduced list2 to reduced list1
        return list1.concat(list2);
    },
    /**
     * get matching device from devices list
     * @param {String} ip ipv4 address
     * @returns {Array<Object>} empty if not found.
     */
    findDevice: function (ip) {
        return app.getState("devices").reduce((devices, device)=> {
            if(device.ip === ip) {
                devices.push(device);
            }
            return devices;
        }, []);
    },
    /**
     * return new list of devices that have not yet expired
     * @param {Array} _devices 
     */
    removeExpired: function(_devices) {
        return _devices.reduce((list, item) => {
            // 15seconds TTL
            if ((new Date().valueOf() - item.lastSeen) / 1000 < 15) {
                list.push(item);
            }
            return list;
        }, []);
    },
    /**
     * return filtered list of accespoints based on name
     * match known list of accesspoints names
     * @param {Array} acccessPoints list of objects with access point details
     */
    getDeviceHotspots: function(accessPoints) {
        var pattern = app.getSettings("device_ssid_pattern");
        var hotspots = accessPoints.reduce((accumulator, currentValue) => {
            // app.log(currentValue.SSID, currentValue.capabilities);
            if(currentValue.SSID) {
                var found = currentValue.SSID.match(pattern);
                if (found) {
                    accumulator.push(currentValue);
                }
            }
            return accumulator;
        }, []);
        app.setState("hotspots", hotspots);
        return hotspots;
    },
    /**
     * get the list of access points
     * store results in `app.state.accessPoints`
     * on error retry after short delay
     */
    getWifiHotspots: function() {
        this.getAccessPoints()
            .then(function() {
                app.showWifiNetworks();
                app.scan_counter++;
                app.scan_retries = 0;
                // app.log(`Scan ${app.scan_counter} complete. (${app.getState("accessPoints").length} items)`);
                
                // re-scan after delay
                if(controller.state==="#accesspoints") {
                    var timeout = setTimeout(function() {
                        app.getWifiHotspots();
                    }, app.getSettings("wifiScanRepeat"));
                    // save a ref to the timeout to allow cancel
                    app.setState("wifiScanRepeatObj", timeout);
                }
            })
            .catch(function(reason){ 
                // error running scan. clear auto refresh, wait and retry
                app.showError(app.scan_retries + ". " + reason);
                WifiWizard2.timeout(app.getSettings("wifiScanTimeout"))
                    .then(function() {
                        app.scan_retries++;
                        if (app.scan_retries > app.max_retries) {
                            app.showError("============ WIFI SCAN FAIL. CLICK TO RESTART");
                            app.scan_retries = 0;
                            app.showReload();
                            return;
                        } else {
                            app.info("Restarting scan " + app.scan_counter++)
                            app.getWifiHotspots();
                        }
                    });
            });
    },

    
    /**
     * @param {Boolean|Event} arguments[0] is true == password visible
     */
    togglePasswordVisible: function (event) {
        var button = event.target.tagName === 'BUTTON' ? event.target: utils.getClosest(event.target, 'button'),
            event,
            state,
            input = controller.find(button.dataset.showPassword);
        if (arguments[0].hasOwnProperty('target')) {
            event = arguments[0];
        } else {
            state = arguments[0];
        }
        if (event) {
            event.preventDefault();
        }
        // if no state passed just toggle
        if (typeof state !== "undefined") {
            input.type = input.type === "password" ? "text": "password";
            button.classList.toggle("active");
            
        } else {
            input.type = !state ? "password": "text";
            button.classList.toggle("active", state);
        }
    },
    zeroconfScan: function() {
        var zeroconf = cordova.plugins.zeroconf;
        return new Promise((resolve, reject) => {
            zeroconf.reInit(function() {
                zeroconf.registerAddressFamily = 'ipv4';
                zeroconf.watchAddressFamily = 'ipv4';
                var devices = app.getState("devices");
                zeroconf.watch('_workstation._tcp.', 'local.', result=> {
                    app.saveDevice(app.parseDevice(result));
                    
                    view.displayDevices(controller.find("#devices nav.list"), Devices.getStoredDevices(devices));
                });
                zeroconf.watch('_http._tcp.', 'local.', result=> {
                    app.saveDevice(app.parseDevice(result));
                    view.displayDevices(controller.find("#devices nav.list"), Devices.getStoredDevices(devices));
                });
                
                // top scan after `deviceScanTimeout`
                setTimeout(function() {
                    var devices = app.getState("devices");
                    if(devices && devices.length > 0) {
                        zeroconf.close(
                            ()=>resolve(devices),
                            ()=>reject("Unable to close zeroconf browser")
                        );
                    } else {
                        reject("No devices found");
                    }
                },  app.getSettings("deviceScanTimeout"));
            });
        });
    },
    /**
     * return processed device object
     * @param {Object} result as returned by zeroconf
     */
    parseDevice: function(result) {
        var action = result.action;
        var service = result.service;
        if (action == 'resolved') {
            var ip = service.ipv4Addresses[0],
                name = service.name.match(/(.*) \[.*\]*/) || [],
                protocol = service.txtRecord.https ? 'https://': 'http://',
                platform = service.txtRecord.platform || '',
                version = service.txtRecord.v || '',
                path = service.txtRecord.path || '',
                url = protocol + ip + path;

            var device = {
                name: name[1] || service.name,
                ip: ip,
                platform: platform,
                version: version,
                path: path,
                url: url,
                lastSeen: new Date().valueOf()
            }
            return device;
        } else {
            return false;
        }
    },
    /**
     * 
     * @param {Array} accessPoints list of objects with accesspoint details
     * @param {HTMLElement} list container to display the entries in
     */
    displayAccessPoints: function(accessPoints, list) {
        // filtered access points to NOT show device hotspots (only standard wifi connections)
        var pattern = app.getSettings("device_ssid_pattern");
        var filtered = accessPoints.reduce((accumulator, currentValue) => {
            var found = currentValue.SSID.match(pattern);
            if (!found) {
                accumulator.push(currentValue);
            }
            return accumulator;
        }, []);
        // Access point(s) ?
        var _aps = filtered.length === 1 ? "Access point": "Access points";
        list.innerHTML = `<p>Found ${filtered.length} ${_aps}</p>`;

        // show each wifi connection as individual link
        filtered.forEach(ap => {
            var item = document.createElement('div');
            var wpa, ess, wps;
            [wpa, ess, wps] = app.getApCapabilities(ap);
            var title = ap.SSID === "" ? `<span class="text-muted">${ap.BSSID}</span>`: ap.SSID;
            var css = ap.SSID === app.getState("currentSSID") ? 'current': '';
            item.innerHTML = `<a href="#accesspoint_password" data-ssid="${ap.SSID}" data-wpa="${wpa}" class="${css}">
                                <span>${title}<small class="badge text-muted">${wps}</small></span>
                                <progress max="5" value="${ap.rating}" title="${ap.strength}">
                                    ${ap.level}dBm
                                </progress>
                              </a>`;
            list.append(item.firstElementChild);
        });
    },
    /**
     * get wpa,ess and wps status for access point
     * 
     * The access point object's capabilities property :-
     *      "...Describes the authentication, key management, and encryption 
     *          schemes supported by the access point..." - WiFiWizard2 docs
     * Access point capabilites are returned as a formatted string
     *  3 examples: ["WPA2-PSK-CCMP", "ESS", "WPS"]
     *              ["WPA2-EAP-CCMP+TKIP", "WPA-EAP-CCMP+TKIP", "ESS"]
     *              ["ESS"]
     * @param {Object} ap AccessPoint object as returned by WiFiWizard2 plugin
     * @returns {Array.<String>} "WPA","ESS","WPS" or empty strings if not set
     * @see {@link https://github.com/tripflex/wifiwizard2#readme|WiFiWizard2 docs}
     */
    getApCapabilities: function(ap) {
        var capabilities = {
            wpa: false,
            ess: false,
            wps: false 
        }
        ap.capabilities.match(/(?:\[([\w-+]*)\])/g).reduce((accumulator, currentValue) => {
            accumulator.push(currentValue.replace(/[\[\]]/g, ""));
            return accumulator;
        }, [])
        .forEach(capability=> {
            if(/^WPA/i.test(capability)) {
                capabilities.wpa = true;
            }
            if(/^ESS/i.test(capability)) {
                capabilities.ess = true;
            }
            if(/^WPS/i.test(capability)) {
                capabilities.wps = true;
            }
        });
        return [
            capabilities.wpa?'WPA':'',
            capabilities.ess?'ESS':'',
            capabilities.wps?'WPS':''
        ];
    },
    /**
     * 
     * @param {String} ssid SSID of wifi ap - REQUIRED
     * @param {String} password password for connection - not needed for open network
     * @param {String} algorithm "WPA"|"WEP" - not needed for open network
     * @returns {Promise<String>} WifiWIzard2.connect() promise
     * @see {@link https://github.com/tripflex/wifiwizard2#readme|WifiWizard2 Docs}
     */
    connect: function(ssid, password, algorithm) {
        var bindAll = true;
        // connect without password
        if(!password) {
            password = null;
            algorithm = null;
        }
        return WifiWizard2.connect(ssid, bindAll, password, algorithm);
    },

    rebootDevice: function(ssid) {
        // send request to device
        return app.deviceInterface('restart');
    },
    /**
     * Store data to localStorage
     * @param {String} key name of item
     * @param {*} value value of item
     * @returns {*} undefined if success else error
     */
    save: function(key, value) {
        var storage = window.localStorage;
        try {
            return storage.setItem(key, JSON.stringify(value));
        } catch (error) {
            return error;
        }
    },
    /**
     * Return saved item from localStorage
     * @param {String} key name of item
     * @returns {*} null if not found
     */
    load: function(key) {
        var storage = window.localStorage;
        return JSON.parse(storage.getItem(key));
    },
    /**
     * Return saved item
     * @param {String} key name of item to load
     * @returns {Array} defaults to empty array if undefined
     */
    loadList: function(key) {
        return app.load(key) || [];
    },
    /**
     * device settings successfully saved
     */
    saved_success: function(button) {
        // move to next view
        return new Promise((resolve) => {
            setTimeout(function() {
                controller.find("#psk").value = "";
                controller.hideAll();
                controller.stopLoader();
                controller.show("#saved");
                button.innerText = button.dataset.originalText;
                resolve();
            }, 3000);
        });
    },
    /**
     * device settings problem saving
     */
    not_saved: function(button) {
        setTimeout(function() {
            // controller.find("#psk").value = "";
            controller.hideAll();
            controller.show("#not_saved");
            button.innerText = button.dataset.originalText;
        }, 4000)
    },
    /**
     * Add device if not already present
     * store all devices to localStorage
     * @param {Object} device with ip,name,url etc
     */
    saveDevice: function(device) {
        if(device && device.ip) {
            var devices = app.updateDevices(app.getState("devices"), [device]);
            app.setState("devices", devices);
            // app.save() returns undefined on success;
            if (typeof app.save("devices", devices) !== "undefined") {
                app.showError("Error saving devices");
            }
        }
    },

    /**
     * remove all discovered devices and accesspoints from cache
     * take user to start screen once finished to start again.
     */
    clearCache: function() {
        var state = "#devices";

        app.save("devices", []);
        app.setState("devices", []);
        app.save("accessPoints", []);
        app.setState("accessPoints", []);

        app.setState("deviceScanCancelled", true);
        // stop repeats
        controller.onViewExit(state);
        controller.stopLoader();
        // show message
        controller.find(state + " .list").innerHTML = "<p>Cached list of devices cleared</p>";
        // change to devices view
        controller.hideAll();
        controller.show(state);
        controller.show(state + " #devices_title");
        // show reload button
        controller.show(state + " [data-reload]");
    },
    /**
     * checks ip address exists in `app.state.devices[]` objects {name:'hub34',ip:'10.0.0.222'}
     * @param {Object} _device with ip,ssid,strength etc
     * @param {Array.<Object>} [_devices] check against given list 
     * @returns {Boolean} true if ip address is not already in list
     */
    deviceIsUnique: function(_device, _devices) {
        var ip = _device.ip;
        var devices = _devices || app.getState("devices") || [];
        for(d in devices) {
            var device = devices[d];
            if (device.ip === ip) return false;
        }
        return true;
    },
    /**
     * test to see if _device is newer than the one in _devices.
     * @param {Object} _device a single device to check
     * @param {Array.<Object>} _devices all the devices
     * @returns {boolean} true = _device is newer or not in _devices
     */
    deviceIsNewer: function(_device, _devices) {
        var devices = _devices || app.getState("devices") || [];
        for(d in devices) {
            let device = devices[d];
            // return false if matching (by ip address) `device` is older than given `_device`
            if (device.ip === _device.ip && device.lastSeen >= _device.lastSeen) return false;
        }
        // if no matching entries or diven `_device` lastSeen is greater
        return true;
    },
    showError: function(error) {
        // todo: log errors
        logger.debug('call stack:', new Error().stack);
        logger.error(error);
    },
    log: function(message) {
        // todo: store log
        logger.debug('call stack:', new Error().stack);
        logger.info(message);
    },
    /**
     * get a response from the web service used to authenticate the user
     * 
     * @param {String} username 
     * @param {String} password
     * @returns {(Promise<Success>|Promise<Fail>)}
     */
    authenticate: function(username, password) {
        return new Promise((resolve, reject) => {
            var auth_endpoint = "https://dashboard.energylocal.org.uk/user/auth.json";
            var headers = {};
            var body = {username: username, password: password};
            cordova.plugin.http.post(auth_endpoint, body, headers,
                /** @param {Success} response */
                function(response) {
                    resolve(response);
                },
                /** @param {Fail} response */
                function(response) { 
                    reject(response);
                }
            );
        })
    },

    /**   
     * pass settings to EmonESP device using the api
     * default ip address for device once connected to hotspot is:
     *    192.168.4.1  (? might be different for other device types?)
     * @returns {Promise} 
     * {@see https://github.com/openenergymonitor/EmonESP/blob/master/src/web_server.cpp#L159 EmonESP `handleSaveNetwork()` function}
     * 
     */
    saveNetworkSettings: function() {
        logger.trace('saveNetworkSettings():');
        return new Promise((resolve, reject) => {
            // send details to device
            logger.trace('saveNetworkSettings: deviceInterface()');
            app.deviceInterface("savenetwork", {
                ssid: app.getState("deviceConnectionSSID"), 
                pass: app.getState("deviceConnectionPsk")
            })
            .then(response => {
                logger.trace(`saveNetworkSettings(): deviceInterface(): resolved()"`);
                if (response==="saved") {
                    logger.debug(`saveNetworkSettings(): deviceInterface(): resolved(): response="${response}"`);
                    resolve(response);
                } else {
                    throw response;
                }
            })
            .catch(error => {
                logger.error(`saveNetworkSettings(): error!: (${error.status}) "${error.error}"`);
                throw error;
            });

        })
        .catch(error=> {
            reject(`Error saving network settings! ${error.error}}`);
        });
    },

    /**   
     * pass settings to EmonESP device using the api
     * default ip address for device once connected to hotspot is:
     *    192.168.4.1  (? might be different for other device types?)
     * @returns {Promise} 
     * {@see https://github.com/openenergymonitor/EmonESP/blob/master/src/web_server.cpp#L218 EmonESP `handleSaveMqtt()` function}
     * 
     */
    saveMqttSettings: function() {
        return new Promise((resolve, reject) => {
            var mqtt_topic = controller.find("#mqtt #mqtt_topic").value || "";
            var mqtt_server = controller.find("#mqtt #mqtt_server").value || "dashboard.energylocal.org.uk";
            var mqtt_port = controller.find("#mqtt #mqtt_port").value || "1883";
            var mqtt_username = controller.find("#mqtt #mqtt_username").value || app.getState("dashboard_username");
            var mqtt_password = controller.find("#mqtt #mqtt_password").value || "";

            // if authenticated via web service use response data, else use form data
            if (app.getState('authenticated')) {
                var mqtt_topic = `user/${app.getState('dashboard_userid')}`;
                var mqtt_password = app.getState("dashboard_apikey_write");
            } else {
                logger.trace(`auth`)
                app.showError(`web authentication failed!`);
            }
            // save mqtt settings to device
            var params = {
                server: mqtt_server,
                topic: mqtt_topic,
                user: mqtt_username,
                port: mqtt_port,
                pass: mqtt_password
            };
            app.deviceInterface('savemqtt', params)
                .then(responseBodyAsText => {
                    // returns "Saved: [host] [port] [topic] [username] [password]"
                    if(responseBodyAsText.toLowerCase().startsWith('saved')) {
                        resolve(responseBodyAsText);
                    }else{
                        throw responseBodyAsText;
                    }
                }).catch(error => {
                    reject(error);
                });
        });
    },

    /**
     * Send GET requests to device once connected to it via wifi directly
     * @param {String} endpoint path to url endpoint
     * @param {Object} params key value pairs for values to send as query
     * @param {Object} headers key value pairs for headers to send with request
     * @returns {(String|Fail)} returns reponse body as string on success
     * @todo 192.168.4.1  (? might be different ip for other device types?)
     * @see https://github.com/openenergymonitor/EmonESP/blob/master/src/web_server.cpp#L753 EmonESP api endpoints
     * @see https://www.npmjs.com/package/cordova-plugin-advanced-http#get Cordova plugin used to make HTTP calls
     */
    deviceInterface: function(endpoint,params,headers) {
        const schema = "http://";
        const host = "192.168.4.1";
        const url = `${schema}${host}/${endpoint}`;
        
        return new Promise((resolve, reject) => {
            // max 6s for device to respond
            setTimeout(function(){
                reject({
                    error: "Request Timeout!",
                    url: url,
                    status: 408,
                    header: {}
                });
            }, 6000);

            if(app.getState('debugMode')===true) {
                // dev only
                logger.debug('---using dummy success response for debugging', url);
                // fake a delay
                setTimeout(()=>{
                    resolve("saved");
                }, 1300);
            } else {
                // use codova plugin to do web requests
                // resolve to parent function with response from plugin function get()
                cordova.plugin.http.get(url, params, headers, 
                    response=> {
                        logger.info(`http.get success: ${url}`)
                        if(response.status >= 200 && response.status <= 299) {
                            logger.trace(`http.get.status: ${response.status}`);
                            resolve(response.data);
                        } else {
                            logger.error(`http.get response not OK: ${response.status}`)
                            throw {
                                status: response.status,
                                error: "Not OK",
                                url: url,
                                headers: response.headers
                            }
                        }
                    },
                    error=> { reject(error) }
                );
            }
        });
    },

    /**
     * connect and send information to device via wifi.
     * restore original ssid at end
     * 
     * shows progress to user of what has been completed
     */
    saveToDevice: function() {
        return new Promise((resolve, reject) => {
            // store settings on device
   
            app.setState("deviceConnectionPsk", controller.find("#psk").value);
            const deviceConnectionSSID = app.getState("deviceConnectionSSID");

            const currentSSID = app.getState("currentSSID");

            // save passkey locally
            var passwordList = app.load('ssid') || {};
            if(controller.find("#save-psk").checked && deviceConnectionSSID) {
                passwordList[deviceConnectionSSID] = app.getState("deviceConnectionPsk");
            } else {
                delete passwordList[deviceConnectionSSID];
            }
            // save altered passwword list
            app.save('ssid', passwordList);

            // connect to device hotspot and save settings before reconnecting back to current wifi
            controller.hide("#password-confirm");
            var selectedHotspot = app.getState("selectedHotspot");

            // add grayed out items "todo". once done class "done" is added
            controller.find("#saving .log").innerHTML= `
                <li id="connect_device">Connecting to ${selectedHotspot}</li>
                <li id="save_network_setting">Saving Network Settings</li>
                <li id="save_mqtt_settings">Saving Remote Settings</li>
                <li id="restart_device">Restarting ${selectedHotspot}</li>
                <li id="connect_original">Reconnecting to ${currentSSID}</li>
            `;

            // connect to device's hotspot
            app.connect(selectedHotspot)
                .then(status=> {
                    if(status==="NETWORK_CONNECTION_COMPLETED") {
                        app.log(`connected to ${selectedHotspot}`);
                        controller.find(`#connect_device`).classList.add("done");
                    } else {
                        logger.debug(`Unable to connect to SSID: ${selectedHotspot}`);
                        return;
                    }

                    // save wifi settings to device
                    logger.trace("calling saveNetworkSettings()");
                    app.saveNetworkSettings()
                        .then(savenetwork_response=> {
                            logger.trace("network settings saved:", savenetwork_response);
                            controller.find(`#save_network_setting`).classList.add("done");

                            // save mqtt settings to device
                            app.saveMqttSettings()
                                .then(savemqtt_response=> {
                                    logger.info("MQTT settings saved", savemqtt_response);
                                    controller.find(`#save_mqtt_settings`).classList.add("done");

                                    // implement the new settings by rebooting the device
                                    app.rebootDevice()
                                        .then(restart_response=> {
                                            logger.trace("device reboot started", restart_response);
                                            controller.find(`#restart_device`).classList.add("done");
                                            
                                            // re-connect to original wifi connection
                                            app.connect(currentSSID)
                                                .then(()=> {
                                                    logger.trace("connected to", currentSSID);
                                                    controller.find(`#connect_original`).classList.add("done");
                                                    // SUCCESS - pass confirmation to as button text
                                                    resolve("Saved ✔");
                                                });
                                        });
                                })
                                .catch(error=>{logger.error(`Error Saving MQTT Settings! ${error}`)});
                        })
                        .catch(error=>{logger.error(`Error Saving network settings! ${error}`)});
                })
                .catch(error=> {
                    var link = controller.find('#indicator');
                    link.innerText = "Not Saved!";
                    link.classList.remove("blink");
                    app.not_saved(link);
                    app.stopLoader();
                    app.showError('/#saved Error:',error);
                    reject(`Failed saving to device! ${error}`);
                });
        });
    }
};









/**
 * Available log levels - higher level numbers display all lower level messages
 */
var _loggerLevels = {
    OFF: 0, // no logging
    FATAL: 1, // very serious errors that will lead to app aborting (hardware or system failure events)
    ERROR: 2, // error events that still allow app to continue (if resources are unavailable/unresponsive)
    WARN: 4, // has potential to harm data or app state (bad user input or mal-formed api responses)
    INFO: 8, // useful points within the app can be outputted (a little output for simple debugging)
    DEBUG: 16, // more detail regarding the running process of the app (very detailed, can be hard to follow)
    TRACE: 32 // all possible output regarding everyting (very detailed, better outputted to file and reviewd)
}
/**
 * Display messages during debug based on logging levels
 * 
 * Higher logging levels also show lower levels.
 * eg. DEBUG also shows FATAL,ERROR,WARN and INFO messages
 *     ERROR also shows FATAL messages
 * @param {number} _LEVEL log level as defined in _loggerLevels
 * @constructor
 * 
 */
var Logger = function(_LEVEL) {
    var _ = {
        level: _loggerLevels.WARN,
        fatal: function(message) {
            if(_.level>0) console.error('FATAL!',message);
        },
        error: function(message) {
            if(_.level>1) console.error('ERROR!',message);
        },
        warn: function(message) {
            if(_.level>3) console.warn('WARN!', message);
        },
        info: function(message) {
            if(_.level>7) console.info('INFO:', message);
        },
        debug: function(message) {
            if(_.level>15) console.debug('DEBUG:', message);
        },
        trace: function(message) {
            if(_.level>31) console.log('TRACE:', message);
        },

        initialize: function (level) {
            this.level=level;
            var level_name = Object.keys(_loggerLevels)[Object.values(_loggerLevels).indexOf(level)];
            console.info(`--------LOGGING AT LEVEL ${level} (${level_name})-----`);
            console.log()
        }
    }
    _.initialize(_LEVEL);
    return _;
}











/**
 * view related settings and methods
 * 
 * Similar (ish) to MVC Controller - handling clicks and events, changing pages and what code is executed on each view
 * changeView() is used to call app methods based on what is clicked/loaded
 * 
 * @param {string} defaultView - query selector to identify the default view/tab/overlay
 * @see Controller.changeView()
 * @constructor
 * 
 */
var Controller = function(defaultView) {
    var controller = {
        self: null,
        state: defaultView,
        initialize: function() {
            self = this;
            this.bindEvents();
            // list of all views to hide initially
            // todo: automatically create this list by searching the page for <section> tags
            self.views = [
                "#welcome",
                "#devices",
                "#add-device",
                "#add-device-failed",
                "#accesspoints",
                "#accesspoint_password",
                "#mqtt",
                "#saving",
                "#saved",
                "#not_saved"
            ];
            self.hideAll();
        },

        bindEvents: function() {
            // handle click events of every link in page
            controller.findAll('a').forEach(item=> {
                item.addEventListener('click', this.onClick);
            });
            // handle click events for items not yet added to list
            controller.findAll('.list').forEach(item=> {
                item.addEventListener('click', this.onClick);
            });
            controller.findAll('[data-show-password]').forEach(item=> {
                item.addEventListener('click', app.togglePasswordVisible);
            });
        },
        firstPage: function() {
            self.hideAll();
            // default view
            var defaultView = app.getSettings("defaultView");
            if(!app.load("welcome_seen")) {
                self.show("#welcome");
                // remove view title when welcome page in view
                self.hide(defaultView + "_title");
            } else {
                self.show(defaultView + "_title");
            }
            self.show(defaultView);
    
            // scan for devices to show on default view
            view.addClass(controller.find("#welcome"), "in");
            // display any cached entries
            view.displayDevices(controller.find("#devices nav.list"), Devices.getStoredDevices());
            // scan for new devices
            app.getNetworkDevices();
            app.save("welcome_seen", true);
        },
        /**
         * Main navigation handler (similar to front controller in php)
         * handles link clicks and shows/hides sections based on the link's href attr
         * @param {Event} event Mouse Click event
         */
        onClick: function(event) {
            logger.trace(`CLICK-${event.target.tagName} "${event.target.innerText}"`)
            event.preventDefault();
            var link = event.target;
            if (link.tagName !== "A") {
                link = utils.getClosest(event.target, "a");
            }
            if (!link || link.classList.contains('active')) {
                return;
            }

            // open external links in browser
            // todo: check href starts with http:// as well as data-weblink attribute
            if(link.hasAttribute('data-weblink')) {
                app.onExternalLinkClick(event);
                return;
            }
            // close overlay clicked
            if(link.hasAttribute('data-close')) {
                utils.getClosest(link, ".fade").classList.remove("in");
                if(controller.state === "#devices") {
                    controller.find("#devices_title").classList.remove('d-none');
                }
                return;
            }
            // app.log(`link clicked: "${link.innerText}", links to "${link.hash}"`);
            var href = link.hash;

            self.changeView(href, link);
        },
        /**
         * Change UI to show new View/Tab/Page/Overlay
         * default to selector if available, else back to welcome screen
         * @param {String} view CSS selector for item to show
         * @param {HTMLElement} link clicked element
         */
        changeView: function(view, link) {
            logger.trace(`Changing to ${view}`);
            // clear current page intervals or timeouts before changing
            self.onViewExit(self.state);
            // set current controller state - aka. "what page am I on?"
            if(view==="#welcome") {
                // no view called "#welcome"... set it to default view
                self.state = app.getSettings("defaultView");
            } else {
                self.state = view;
            }

            // show sidebar (don't hide previous view)
            if(view === "#sidebar") {
                self.toggleSidebar();
                return;
            }
            // clear the cached list of devices 
            if(view === "#clear-cache") {
                if(utils.getClosest(link, "#sidebar")!==null) {
                    self.toggleSidebar();
                }
                app.clearCache();
                return;
            }
            // set to default if view not found
            if(!view) {
                view = app.getSettings("defaultView");
            } else if(!document.querySelector(view)) {
                view = app.getSettings("defaultView");
            }
            // change to new view by default
            // or fire off functions specific to requested view
            switch(view) {
                case "#connecting":
                    controller.find("#connecting .ssid").innerText = link.dataset.name;
                    setTimeout(function() {
                        self.hideAll();
                        self.show('#accesspoints');
                        link.classList.remove('blink');
                    }, 2000);
                break;

                case "#devices":
                    // todo: add zeroconf scan list
                    self.hideAll();
                    // enable scanning
                    app.setState("deviceScanCancelled", false);
                    // scan for devices
                    app.getNetworkDevices();
                    self.show("#devices_title");
                    self.hide(view + " [data-reload]");
                    self.show(view);
                break;

                case "#add-device":
                    self.hideAll();
                    self.show(view);
                    controller.find(view + " [data-reload]").classList.add("d-none");
                    app.checkForNewDevices();
                break;

                case "#accesspoints":
                    self.hideAll();
                    if(link.dataset.name) {
                        app.setState("selectedHotspot", link.dataset.name);
                    }
                    controller.find("#selectedDevice").innerText = app.getState("selectedHotspot");
                    
                    controller.stopLoader();
                    self.show(view);
                    // show the list of access points to choose from
                    app.displayAccessPoints(app.getState("accessPoints"), controller.find("#accesspoints .list"));
                break;

                case "#accesspoint_password":
                    controller.stopLoader();
                    self.hideAll();
                    self.show(view);
                    
                    // recall saved password
                    var passwordList = app.load('ssid') || {};
                    if(passwordList.hasOwnProperty(link.dataset.ssid)) {
                        controller.find("#psk").value = passwordList[link.dataset.ssid];
                        controller.find("#save-psk").checked = true;
                    }


                    // display selected ssid and set value in hidden form field
                    controller.find("#accesspoint_password .ssid").innerText = link.dataset.ssid;
                    controller.find("#accesspoint_password #ssid_input").innerText = link.dataset.ssid;
                    
                    // pass ssid to next view (if button clicked)
                    controller.find("#accesspoint_password #save_auth").dataset.ssid = link.dataset.ssid;
                    app.setState("deviceConnectionSSID", link.dataset.ssid);
                break;

                case "#mqtt":
                    // connect device to mqtt service
                    self.hideAll();
                    self.show(view);
                    var name = app.getState("selectedHotspot"), type, icon_name;
                    [type,icon_name] = Devices.getDeviceType(name);
                    controller.find("#mqtt #device-name").innerHTML = `
                        <span>
                            ${controller.icon(icon_name)}
                            ${name}
                        </span> `;

                    controller.find("#dashboard_username").value = app.getState("dashboard_username") || "";
                    controller.find("#dashboard_password").value = app.getState("dashboard_password") || "";

                    controller.stopLoader();
                break;

                case "#saving":
                    // todo: add ability to skip adding dashboard login

                    var dashboard_username = controller.find("#mqtt #dashboard_username").value;
                    var dashboard_password = controller.find("#mqtt #dashboard_password").value;
                    // todo: santize and store username and password inputs!!

                    // set title for #saving view
                    var name = app.getState("selectedHotspot"), type, icon;
                    [type,icon] = Devices.getDeviceType(name);
                    controller.find("#saving #device-name").innerHTML = `
                        <span>
                            ${controller.icon(icon)}
                            ${name}
                        </span> `;
                    
                    // before displaying #saving view authenticate with web api
                    // login to remote server to get api key
                    link.dataset.originalText = link.innerText;
                    link.setAttribute("aria-disabled", true);
                    link.innerText = "Authenticating";
                    link.classList.add('blink');
                    controller.startLoader();

                    // authenticate with web api
                    logger.trace(`/auth api called...`);
                    app.authenticate(dashboard_username, dashboard_password)
                        .then(response=> {
                            app.setState("dashboard_username", "");
                            app.setState("dashboard_password", "");
                            logger.trace(`/auth api response: ${response.data}`);
                            // if http request successful, check response
                            if(response.status >= 200 && response.status <= 300) {
                                var data = false;
                                try{
                                    data = JSON.parse(response.data);
                                    app.setState('authenticated', data.success===true);
                                    app.setState("dashboard_username", dashboard_username);
                                    app.setState("dashboard_password", dashboard_password);
                                    app.setState("dashboard_userid", data.userid);
                                    app.setState("dashboard_apikey_write", data.apikey_write);
                                } catch(error) {
                                    throw `Error parsing authentication response! ${error}`;
                                }
                            }

                            // todo: save dashboard_username and dashboard_password to localstorage
                            // todo: continue even if auth fails. need to save network info on device
                            // AUTH SUCCESS - reset loading indicator text & button.
                            // move to #saving view
                            link.innerText = "Authenticated ✔";
                            link.classList.remove('blink');
                            setTimeout(()=> {
                                self.hideAll();
                                link.innerText = link.dataset.originalText;
                                self.show(view);
                                link.removeAttribute('aria-disabled');
                            }, 1800);

                            controller.startLoader();
                            var savingButton = controller.find('#indicator');
                            // connect to device ssid and save values on device via api
                            app.saveToDevice()
                                .then(save_response=> {
                                    app.log('savetodevice success',save_response);
                                    // reset ajax loader animation
                                    savingButton.innerText = save_response;
                                    savingButton.classList.remove("blink");
                                    // reset to original after wait
                                    app.saved_success(savingButton);
                                })
                                .catch(status=> {
                                    app.showError(`Error saving settings to device! status: ${status}`);
                                    savingButton.innerText = "Not Saved";
                                    savingButton.classList.remove("blink");
                                    app.not_saved(savingButton);
                                })
                                .finally(()=> {
                                    controller.stopLoader();
                                    savingButton.removeAttribute('aria-disabled');
                                })
                        })
                        .catch(auth_response=>{
                            logger.error(`Web authentication failed! Continuing to save wifi settings: (${auth_response.status}) "${auth_response.error}"`);
                            controller.hideAll();
                            controller.show("#saving");
                            app.saveToDevice().catch(status=> {
                                logger.error(`Error saving unauthenticated settings to device! status: ${status}`);
                            })
                        });
                break;

                case "#saved":
                    self.hideAll();
                    self.show(view);
                break;
                case "#welcome":
                    if(utils.getClosest(link, "#sidebar")!==null) {
                        self.toggleSidebar();
                    }
                    app.save("welcome_seen", false);
                    controller.firstPage();
                    break;

                default:
                    self.hideAll();
                    self.show(view);
            }
            logger.trace(`Changed to ${view}`);
        },



        /**
         * called to stop wating timeouts once view is quit
         * timeouts should only be created for specific pages/view
         * run on exit of view (before next view code)
         * 
         * called before changing to next page
         * @param {String} CSS selector for current page (before moving to next)
         */
        onViewExit: function(previous_view) {
            switch(previous_view) {
                case "#devices":
                    clearTimeout(app.getState("deviceScanRepeatObj"));
                    clearInterval(app.getState("deviceListCleanInterval"));
                    break;
                case "#add-device":
                    clearTimeout(app.getState("wifiScanRepeatObj"));
                    break;
                case "#accesspoints":
                    clearTimeout(app.getState("wifiScanRepeatObj"));
                    break;
                case "#saving":
                    document.querySelectorAll("#mqtt a.blink").forEach(link => {
                        link.classList.add('blink');
                    });
                    break;
            }
        },
        /**
         * 
         * @param {Boolean} state true is open false is close
         */
        toggleSidebar: function(state) {
            controller.find('#sidebar').classList.toggle("in");
        },
        /**
         * hide all views 
         */
        hideAll: function() {
            self.views.forEach(selector=>{
                this.hide(selector);
            });
        },
        /**
         * @param {*} selector Array|String CSS selector to identify element(s)
         */
        show: function(selector) {
            if(Array.isArray(selector)) {
                selector.forEach(item=>self.showOne(item));
            } else {
                self.showOne(selector);
            }
        },
        /**
         * @param {*} selector Array|String CSS selector to identify element(s)
         */
        hide: function(selector) {
            if(Array.isArray(selector)) {
                selector.forEach(item=>self.hideOne(item));
            } else {
                self.hideOne(selector);
            }
        },
        /**
         * Hide single HTMLElement
         * @param {String} selector CSS selector to identify single element
         */
        hideOne: function(selector) {
            controller.find(selector).classList.add('d-none');
        },
        /**
         * Show single HTMLElement
         * @param {String} selector CSS selector to identify single element
         */
        showOne: function(selector) {
            controller.find(selector).classList.remove('d-none');
        },
        /**
         * @param {String} selector css query selector. only matches first
         * @returns {HTMLElement} DOM element, empty <DIV> if no match.
         */
        find: function(selector) {
            return document.querySelector(selector) || document.createElement('div');
        },
        /**
         * @param {String} selector css query selector. matches all
         * @returns {NodeList} itterable list of HTMLElements that match
         */
        findAll: function(selector) {
            var list = document.querySelectorAll(selector);
            if (!list) {
                var docFragment = document.createDocumentFragment();
                list = docFragment.children;
            }
            return list;
        },
        startLoader: function(action) {
            logger.trace(`Ajax loader started-----`);
            controller.find("#loader-animation").classList.add("in");
            controller.setLoader(action || 'Loading...');
        },
        stopLoader: function() {
            logger.trace(`Ajax loader stopped-----`);
            controller.find("#loader-animation").classList.remove("in");
            controller.setLoader("");
        },
        // show current loading state as text
        // changed to only be used as element title. might re-work into design
        setLoader: function(text) {
            app.setState("ajaxLoaderText", text);
            controller.find("#loader-animation").title = text;
        },
        /**
         * create the svg markup needed to display an icon.
         * 
         * svg icons must be inline in the html to enable xlink references
         * will not work with external files eg. <img> src .svg files
         * @param {String} name last part of icon id. eg #icon-xxxx
         */
        icon: function(name){
            return `<svg class="icon"><use xlink:href="#icon-${name}"></use></svg>`
        },
    }
    controller.initialize();
    return controller;
}



app.initialize();

/**
 * Generic utility functions
 * @constructor
 */
var Utilities = function() {
    var _ = {
        initialize: function () {
            console.info("--------UTILITY SCRIPTS INITIALIZED--------")
        },
        /**
         * Return nearest parent matching `selector`.
         * Searches up DOM `elem` parentNode() tree for given `selector`
         * @param {HTMLElement} elem child element
         * @param {String} selector css query to match potential parent
         * @returns {HTMLElement} parent/closest element that matches | or null
         */
        getClosest: function (elem, selector) {
            for ( ; elem && elem !== document; elem = elem.parentNode ) {
                if ( elem.matches( selector ) ) return elem;
            }
            return null;
        }
    }
    _.initialize();
    return _;
};
/**
 * Collection of methods and properties for managing Wifi access points
 * @class
 * @hideconstructor
 */
var Wifi = (function() {
    return {
        /**
         * request a scan and return a promise
         * @alias Wifi.getAccessPoints
         * @returns {Promise<Network>} 
         */
        scan: function() {
            return WifiWizard2.scan();
        },
        /**
         * checks that SSID is unique before adding to the list
         * adds lastSeen property to aid in caching
         * @alias Wifi.setAccessPointTTL
         * @param {Object} accessPoints list of found accesspoints from WiFiWizard2.scan();
         * @see: "Destructing Assingment" https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/Destructuring_assignment
         * 
         */
        setAccessPointTTL: function(accessPoints) {
            var accessPoints = accessPoints.reduce((_accesspoints, ap) => {
                if (this.accessPointIsUnique(ap)) {
                    var strength, rating;
                    [strength, rating] = this.getApStrengthAndRating(ap);
                    ap.strength = strength;
                    ap.rating = rating;
                    ap.lastSeen = new Date().valueOf();
                    _accesspoints.push(ap);
                }
                return _accesspoints;
            }, []);

            var accessPoints = Wifi.filterLatestAccessPoints(accessPoints);
            app.setState("accessPoints", accessPoints);
            // app.save() returns undefined on success;
            if (typeof app.save("accessPoints", accessPoints) !== "undefined") {
                app.showError("Error saving accessPoints to local store");
            }
            return accessPoints;
        },
        /**
         * returns true if given access point in not already known by app
         * @alias Wifi.apIsUnique
         * @returns {Boolean}
         * @param {Network} accessPoint Access Point Object
         */
        accessPointIsUnique: function(accessPoint) {
            var accessPoints = app.getState("accessPoints", false);
            for(n in accessPoints) {
                var ap = accessPoints[n];
                if (ap.SSID === "" || accessPoint.SSID === ap.SSID) return false;
            }
            return true;
        },
        /**
         * Return strength and rating for given ap.level value.<br>
         * 
         * Strength is given as text eg. "Very Good"<br>
         * rating is given as integer [1-5]<br>
         * 
         * reference table of values gained from metageek.com
         * @param {Object} ap AccessPoint object
         * @alias Wifi.getApStrengthAndRating
         * @returns {Array.<!String, !Number>} eg ["Very Good", 4]
         * @see [metageek.com - values referenced in "Ideal Signal Strength" table - metageek.com/wifi-signal-strength-basics]{@link https://www.metageek.com/training/resources/wifi-signal-strength-basics.html}
         */
        getApStrengthAndRating: function(ap) {
            var strength = "Very Weak";
            var rating = 1;
            if(ap.level > -81) {
                strength = "Not Good";
                rating = 2;
            }
            if(ap.level > -71) {
                strength = "Okay";
                rating = 3;
            }
            if(ap.level > -67) {
                strength = "Very Good";
                rating = 4;
            }
            if(ap.level > -30) {
                strength = "Amazing";
                rating = 5;
            }
            return [strength, rating]
        },
        /**
         * will check the lastSeen prop to test validity. removing old entries.
         * loads previous results from app state/local store
         * @param {Array} accessPoints - access points to add 
         * @param {Array} cache - list already stored from previous scan
         * @alias Wifi.filterLatestAccessPoints
         * @returns {Array} filtered list
         */
        filterLatestAccessPoints: function(accessPoints, cache) {
            logger.trace(`Found ${accessPoints.length} Access Points`);
            var cache = app.getState("accessPoints") || [];
            var updated = accessPoints;
            if(cache) {
                updated = cache.concat(accessPoints||[]);
            }
            return updated.reduce((accessPoints, ap) => {
                // 15mins TTL
                if ((new Date().valueOf() - ap.lastSeen) / 1000 / 60 < 15) {
                    accessPoints.push(ap);
                }
                return accessPoints;
            }, []);
        }
    }
})();

/**
 * Collection of methods and properties for managing Devices
 * @class
 * @hideconstructor
 */
var Devices = (function() {
    var instance = null;
    
    return {
          /**
         * returned a sorted list of devices already found
         * cleans out old results
         * @alias Devices.getStoredDevices
         */
        getStoredDevices: function(devices) {
            var results = devices || [];
            // clear out old entries
            results = app.removeExpired(results);
            // sort by name [a-z]
            results.sort((a, b) => (a.name > b.name) ? 1 : -1)
            app.setState("devices", app.loadList("devices"));
            return results;
        },
        /**
         * return new list of devices that have not yet expired
         * @alias Devices.removeExpired
         * @param {Array} _devices 
         */
        removeExpired: function(_devices) {
            return _devices.reduce((list, item) => {
                // 15seconds TTL
                if ((new Date().valueOf() - item.lastSeen) / 1000 < 15) {
                    list.push(item);
                }
                return list;
            }, []);
        },
        /**
         * return filtered list of accespoints based on name
         * match known list of accesspoints names
         * @alias Devices.getDeviceHotspots
         * @param {Array} acccessPoints list of objects with access point details
         */
        getDeviceHotspots: function(accessPoints, pattern) {
            var hotspots = accessPoints.reduce((accumulator, currentValue) => {
                // app.log(currentValue.SSID, currentValue.capabilities);
                if(currentValue.SSID) {
                    var found = currentValue.SSID.match(pattern);
                    if (found) {
                        accumulator.push(currentValue);
                    }
                }
                return accumulator;
            }, []);
            return hotspots;
        },
        /**
         * return type and icon for given name
         * eg smartplug3213 will return ['Smart Plug','smartplug']
         * @param {String} name name of ssid or device
         * @alias Devices.getDeviceType
         * @returns {Array.<string>} the discoverd type and icon of device as an array of strings [type,icon]
         */
        getDeviceType: function(name) {
            var icon, // icon class name ... smartplug|smartmeter|openevse|hpmon|edmi-am|emonth
                type; // text label
    
            if(/^(smartplug).*$/g.test(name)) {
                icon = "smartplug";
                type = "Smart Plug";
            } else if(/^(wifirelay).*$/g.test(name)) {
                icon = "wifirelay";
                type = "WiFi Relay";
            } else if(/^(hpmon).*$/g.test(name)) {
                icon = "hpmon";
                type = "Heat Pump";
            } else if(/^(openevse).*$/g.test(name)) {
                icon = "openevse";
                type = "Car Charger";
            } else if(/^(meterreader).*$/g.test(name)) {
                icon = "edmi-am";
                type = "Smart Meter";
            } else if(/^(emonpi).*$/g.test(name)) {
                icon = "smartmeter";
                type = "Emon Pi";
            } else {
                icon = "device";
                type = "Device"
            }
            return [type, icon];
        }
    };
})();

/**
 * Collection of methods that alter the DOM
 * @constructor
 */
var View = function() {
    var _ = {
        initialize: function () {
            console.info("--------VIEW METHODS INITIALIZED--------")
        },
        /**
         * add list of devices to container
         * @param {HTMLElement} container - container
         * @param {Array<Device>} results - list of devices
         * @todo save results of app.removeExpired() and sort to app.state.devices
         */
        displayDevices: function(container, results) {
            logger.trace(`displayDevices(): ${container.tagName}: ${results.length} found`);
            if (!container) return;
            var _devices = results.length === 1 ? "device": "devices";
            container.innerHTML = `<p>Found ${results.length} ${_devices} on your network</p>`;

            results.forEach(result => {
                var type, icon_name,
                [type,icon_name] = Devices.getDeviceType(result.name);
                var url = result.url,
                    ip = result.ip,
                    name = result.name,
                    item = document.createElement('div'),
                    html = `<a title="${type}" href="${url}" data-weblink data-ip="${ip}">
                                <span>
                                    ${controller.icon(icon_name)}
                                    ${name}
                                </span> 
                                <small class="badge">${ip}</small>
                            </a>`;

                item.innerHTML = html;
                container.appendChild(item.firstElementChild);
            });
        },
        innerText: function(elem,text) {
            elem.innerText = text;
        },
        addClass: function(elem, className) {
            elem.classList.add(className);
        },
        /**
         * display given list of new device hotspots to choose from
         * 
         * once clicked the process of selecting a wifi connection for the device is started
         * @param {Array} hotspots list of hotspots as returned by WifiWizard2.listNetworks()
         */
        showDeviceHotspots: function(hotspots) {
            const list = controller.find("#add-device .list");
            var _devices = hotspots.length === 1 ? "device": "devices";
            list.innerHTML = `<p>Found ${hotspots.length} available ${_devices}</p>`;
            hotspots.forEach(hotspot=> {
                var name = hotspot.SSID, type, icon_name,
                [type,icon_name] = Devices.getDeviceType(name);
                var html = `<a href="#accesspoints" data-name="${name}">
                    <span>
                        ${controller.icon(icon_name)}
                        ${name}
                        ${hotspot.rating < 3 ? '<small class="text-muted">('+hotspot.strength+')</small>': ''}
                    </span> 
                    <small class="badge">${type}</small>
                </a>
                `,
                    item = document.createElement('div');

                item.innerHTML = html;
                list.appendChild(item.firstElementChild);
            });
        }
    }
    _.initialize();
    return _;
};


/**
 * Pain javascript object storing the succesfull response of a request done with the cordova http plugin
 * @typedef {Object} Success
 * @property {Number} status - positive numbers are server reponses
 * @property {String} data - response from the server as a string
 * @property {String} url - the final URL obtained after any redirects as a string
 * @property {Object} headers - The keys of the returned object are the header names and the values are the respective header values
 * @see [Cordova http plugin Docs]{@link https://www.npmjs.com/package/cordova-plugin-advanced-http#success}
 */

/**
 * Simple js Object storing the unsuccesfull response of a request by the cordova http plugin
 * @typedef {Object} Fail
 * @property {Number} status - positive numbers are server reponses
 * @property {String} error - error response from the server as a string or an internal error message
 * @property {String} url - the final URL obtained after any redirects as a string
 * @property {Object} headers - The keys of the returned object are the header names and the values are the respective header values
 * @see [Cordova http plugin Docs]{@link https://www.npmjs.com/package/cordova-plugin-advanced-http#failure}
 */

/**
 * Response format for wifiWizard2 scan() function
 * @typedef {Object} Network
 * @property {Number} level - Raw RSSI value
 * @property {String} SSID - SSID as string, with escaped double quotes: "\"ssid name\""
 * @property {String} BSSID - MAC address of WiFi router as string
 * @property {Number} frequency - Frequency of the access point channel in MHz
 * @property {String} capabilities - Describes the authentication, key management, and encryption schemes supported by the access point.
 * @property {Number} timestamp - Timestamp of when the scan was completed
 * @property {Number} channelWidth - 
 * @property {Number} centerFreq0 - 
 * @property {Number} centerFreq1 - 
 * @see [WifiWizard2 Docs]{@link https://github.com/tripflex/wifiwizard2#global-functions}
 */


 /**
  * Device descriptions format
  * @typedef {Object} Device
  * @property {String} name - Label for device
  * @property {String} url
  * @property {String} ip
  */