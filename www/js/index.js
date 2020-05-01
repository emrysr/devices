
var controller = null;

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
        wifiScanRepeatObj: false,
        device_ssid_pattern: /^(smartplug|wifirelay|hpmon|openevse|meterreader).*$/g,
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
        deviceApScanRetries: 0
    },
    initialize: function() {
        document.addEventListener('deviceready', this.onDeviceReady.bind(this), false);
    },
    
    onDeviceReady: function() {
        // handle all view/tab changes
        controller = new Controller();

        // add mobile system events
        document.addEventListener("reload", this.onReload.bind(this), false);//window.location.reload(true);
        document.addEventListener("connect", this.onConnect.bind(this), false);
        document.addEventListener("offline", this.onOffline.bind(this), false);
        document.addEventListener("online", this.onOnline.bind(this), false);
        // get network status
        app.getStatus();
        // load stored devices
        app.setState("devices", app.loadList("devices"));
        app.setState("accessPoints", app.getLatestAccessPoints(app.loadList("accessPoints")));

        // show welcome page
        this.firstPage();
    },

    firstPage: function() {
        controller.hideAll();
        // default view
        var defaultView = app.getSettings("defaultView");
        if(!app.load("welcome_seen")) {
            controller.show("#welcome");
            // remove view title when welcome page in view
            controller.hide(defaultView + "_title");
        } else {
            controller.show(defaultView + "_title");
        }
        controller.show(defaultView);

        // scan for devices to show on default view
        app.find("#welcome").classList.add("in");
        // display any cached entries
        app.displayDevices();
        // scan for new devices
        app.getNetworkDevices();

        app.save("welcome_seen", true);
    },
    onReload: function(event) {
        app.getStatus();
    },
    onConnect: function(event) {
        app.getStatus();
    },
    onOffline: function(event) {
        app.getStatus();
    },
    onOnline: function(event) {
        app.getStatus();
    },
    getStatus: function() {
        // collect current wifi state to show in settings
        app.getWifiEnabled().then(status=> app.setIsConnected(status));
        app.getCurrentSSID().then(ssid=> app.setCurrentSSID(ssid));
        WifiWizard2.getWifiIP()
            .then(ip=> app.setCurrentIP(ip))
            .catch(()=>{
                app.setCurrentIP("");
                app.setIsConnected(false);
            });
    },
    getSettings: function(key) {
        if(app.settings.hasOwnProperty(key)) {
            return app.settings[key];
        } else {
            return undefined;
        }
    },
    /**
     * get app settings value
     * @param {String} key name of property value to return
     * @returns {*} property value or undefined
     */
    getState: function(key) {
        if(app.state.hasOwnProperty(key)) {
            return app.state[key];
        } else {
            return undefined;
        }
    },
    setState: function(key, value) {
        // console.log("setting ",key, "to ", value);
        try {
            app.state[key] = value;
            return value;
        } catch (error) {
            console.error(error);
        }
    },

    setIsConnected: function(isOnline) {
        if(!isOnline) controller.show("disconnected");
        app.setState("online", isOnline);
        app.find("#connected").innerText = isOnline ? 'YES': 'NO';
    },
    /**
     * get the currently connected SSID. save to app.state and update view
     */
    getCurrentSSID: function() {
        return WifiWizard2.getConnectedSSID()
            .then(function(ssid) {
                app.setCurrentSSID(ssid);
                return ssid;
            })
            .catch(function(reason) { 
                console.error(reason);
            });
    },
    setCurrentSSID: function(ssid) {
        app.setState("currentSSID", ssid);
        app.find("#currentSSID").innerText = ssid;
    },
    setCurrentIP: function(ip) {
        app.setState("currentIP", ip);
        app.find("#currentIP").innerText = ip;
    },
    onExternalLinkClick: function(event) {
        event.preventDefault();
        var url = getClosest(event.target, "a").href;
        if(url) window.open(url,'_blank', 'location=yes');
    },
    /**
     * returns promise with bool as parameter in sucessful then()
     */
    getWifiEnabled: function() {
        return WifiWizard2.isWifiEnabled();
    },
    getNetworkDevices: function () {
        app.startLoader("Searching for devices on the network...");
        app.zeroconfScan().catch(app.showError)
            .finally(() => {
                // repeat the scan after delay - only if in "device scan" tab
                if(controller.state === "#devices" && !app.getState("deviceScanCancelled")) {
                    var t = setTimeout(function() {
                                app.getNetworkDevices()
                            }, app.getSettings("deviceScanRepeat"));
                    app.setState("deviceScanRepeatObj", t);
                }
                app.stopLoader();
            });
    },
    /**
     * return all the known networks on the device
     * @returns {Promise} 
     */
    getAccessPointsStoredOnDevice: function() {
        return WifiWizard2.listNetworks();
    },
    /**
     * scan wifi, save results, filter results to only show device hotspots and
     */
    checkForNewDevices: function() {
        app.startLoader("Searching for new devices in range...");
        app.getAccessPoints()
            .then(accessPoints=> app.setAccessPoints(accessPoints))
            .then(accessPoints=> app.getDeviceHotspots(accessPoints))
            .then(hotspots=> app.showDeviceHotspots(hotspots))
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
                        app.stopLoader();
                        console.error("Max AP scan retries reached!", app.getSettings("deviceApScanMaxRetries"));
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
                console.error(error, app.getState("deviceApScanRetries"));
            });
    },
    
    /**
     * request a scan and return a promise
     * @returns {Promise} 
     */
    getAccessPoints: function() {
        return WifiWizard2.scan();
    },
    /**
     * checks that SSID is unique before adding to the list
     * adds lastSeen property to aid in caching
     * 
     * @param {Object} accessPoints list of found accesspoints from WiFiWizard2.scan();
     */
    setAccessPoints: function(accessPoints) {
        var accessPoints = accessPoints.reduce((_accesspoints, ap) => {
            if (app.apIsUnique(ap)) {
                var strength, rating;
                [strength, rating] = app.getApStrengthAndRating(ap);
                ap.strength = strength;
                ap.rating = rating;
                ap.lastSeen = new Date().valueOf();
                _accesspoints.push(ap);
            }
            return _accesspoints;
        }, []);

        var accessPoints = app.getLatestAccessPoints(accessPoints);
        app.setState("accessPoints", accessPoints);
        // app.save() returns undefined on success;
        if (typeof app.save("accessPoints", accessPoints) !== "undefined") {
            console.error("Error saving accessPoints");
        }
        return accessPoints;
    },
    /**
     * will check the lastSeen prop to test validity
     * @param {Array} accessPoints accesspoints to add to current list
     * @returns {Array} filtered list
     */
    getLatestAccessPoints: function(accessPoints) {
        var updated = app.getState("accessPoints").concat(accessPoints||[]);
        return updated.reduce((accessPoints, ap) => {
            // 15mins TTL
            if ((new Date().valueOf() - ap.lastSeen) / 1000 / 60 < 15) {
                accessPoints.push(ap);
            }
            return accessPoints;
        }, []);
    },
    /**
     * merge new devices with old devices 
     * aka "array merge recursive"
     * add list2 entries if not already in list1 or newer
     * @param {Array} list1 list to base the merge on
     * @param {Array} list2 list to merge to existing devices list
     * @returns {Array} merged list1 (cached devices) and list2 (new devices)
     */
    merge: function(list1, list2) {
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
                    var old_device = app.findDevice(device.ip);
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
        var hotspots = accessPoints.reduce((accumulator, currentValue) => {
            // console.log(currentValue.SSID, currentValue.capabilities);
            if(currentValue.SSID) {
                var found = currentValue.SSID.match(app.getSettings("device_ssid_pattern"));
                if (found) {
                    accumulator.push(currentValue);
                }
            }
            return accumulator;
        }, []);
        app.setState("hotspots", hotspots);
        return hotspots;
    },
    showDeviceHotspots: function(hotspots) {
        const list = app.find("#add-device .list");
        var _devices = hotspots.length === 1 ? "Device": "Devices";
        list.innerHTML = `<p>Found ${hotspots.length} ${_devices}</p>`;
        hotspots.forEach(hotspot=> {
            var name = hotspot.SSID, type, icon,
            [type,icon] = app.getDeviceType(name);
            var html = `<a href="#accesspoints" data-name="${name}">
                <span>
                    <svg class="icon"><use xlink:href="#icon-${icon}"></use></svg> 
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
                console.log(`Scan ${app.scan_counter} complete. (${app.getState("accessPoints").length} items)`);
                
                // re-scan after delay
                if(controller.state==="#accesspoints") {
                    var t = setTimeout(function() {
                        app.getWifiHotspots();
                    }, app.getSettings("wifiScanRepeat"));
                    // save a ref to the timeout to allow cancel
                    app.setState("wifiScanRepeatObj", t);
                }
            })
            .catch(function(reason){ 
                // error running scan. clear auto refresh, wait and retry
                console.error(app.scan_retries + ". " + reason);
                WifiWizard2.timeout(app.getSettings("wifiScanTimeout"))
                    .then(function() {
                        app.scan_retries++;
                        if (app.scan_retries > app.max_retries) {
                            console.error("============ WIFI SCAN FAIL. CLICK TO RESTART");
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
    showReloadButton: function(buttonIsVisible) {
        app.find("#reload").classList.toggle("d-none", !buttonIsVisible);
    },
    displayDevices: function() {
        var results = app.getState("devices") || [];
        // clear out old entries
        results = app.removeExpired(results);
        // sort by name [a-z]
        results.sort((a, b) => (a.name > b.name) ? 1 : -1)

        var list = app.find("#devices nav.list");

        var _devices = results.length === 1 ? "Device": "Devices";
        list.innerHTML = `<p>Found ${results.length} ${_devices}</p>`;

        results.forEach(result => {
            var type, icon,
            [type,icon] = app.getDeviceType(result.name);
            var url = result.url,
                ip = result.ip,
                name = result.name,
                item = document.createElement('div'),
                html = `<a data-weblink href="${url}" title="${type}">
                            <span>
                                <svg class="icon"><use xlink:href="#icon-${icon}"></use></svg> 
                                ${name}
                            </span> 
                            <small class="badge">${ip}</small>
                        </a>`;

            item.innerHTML = html;
            list.appendChild(item.firstElementChild);
        });
    },
    /**
     * @param {Boolean|Event} arguments[0] is true == password visible
     */
    togglePasswordVisible: function () {
        var button = app.find("[data-show-password]"),
            event,
            state,
            input = app.find(button.dataset.showPassword);

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
    
                zeroconf.watch('_workstation._tcp.', 'local.', result=> {
                    app.saveDevice(app.parseDevice(result));
                    app.displayDevices();
                });
                zeroconf.watch('_http._tcp.', 'local.', result=> {
                    app.saveDevice(app.parseDevice(result));
                    app.displayDevices();
                });
                
                // top scan after `deviceScanTimeout`
                setTimeout(function() {
                        if(app.getState("devices").length > 0) {
                            zeroconf.close(
                                ()=>resolve(app.getState("devices")),
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
        var filtered = accessPoints.reduce((accumulator, currentValue) => {
            var found = currentValue.SSID.match(app.getSettings("device_ssid_pattern"));
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
            item.innerHTML = `<a href="#auth" data-ssid="${ap.SSID}" data-wpa="${wpa}" class="${css}">
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
     * @see https://github.com/tripflex/WifiWizard2/blob/master/README.md WiFiWizard2 docs
     * 
     * @param {Object} ap AccessPoint object as returned by WiFiWizard2 plugin
     * @returns {string[]} "WPA","ESS","WPS" or empty strings if not set
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
     * @returns {Promise} WifiWIzard2.connect() promise
     */
    connect: function(ssid, password, algorithm) {
        function success() {
            // console.log(`Connected to ${ssid}`);
            app.find(`#auth .log #connect_${ssid}`).classList.add("done");
        }
        var bindAll = true;
        if(!password) {
            // connect without password
            return WifiWizard2.connect(ssid, bindAll)
            .then(()=>success());
        } else {
            return WifiWizard2.connect(ssid, bindAll, password, algorithm)
            .then(()=>success());
        }
    },
    /**
     * pass settings to EmonESP device using the api
     * default ip address for device once connected to hotspot is:
     *  192.168.4.1
     * @param {String} ssid the name of the wifi connection
     * @param {String} psk the wifi connection passkey
     * @returns {Promise} 
     * 
     * {@see https://github.com/openenergymonitor/EmonESP/blob/master/src/web_server.cpp#L753 EmonESP api endpoints}
     * {@see https://github.com/openenergymonitor/EmonESP/blob/master/src/web_server.cpp#L159 EmonESP `handleSaveNetwork()` function}
     */
    saveSettings: function(ssid, password) {
        return new Promise((resolve, reject) => {
            setTimeout(function(){
                reject("Timed out");
            }, 6000);
            if(ssid === "") reject("SSID cannot be empty");
            // send details to device
            var url = `http://192.168.4.1/savenetwork?ssid=${ssid}&pass=${password}`;
            return fetch(url)
                .then(response => {
                    // console.log("response received from ", url);
                    // return the response body as text if 200 OK, else throw error
                    if (response.ok) return "saved";
                    throw response;
                })
                .then(()=> {
                    // console.log(`Saved settings on ${ssid}`);
                    app.find(`#auth .log #save_${ssid}`).classList.add("done");
                    resolve("saved");
                })
                .catch(error => {
                    if (error instanceof Error) return error;
                    reject(`HTTP ${error.status} ${error.statusText}`);
                });

        })
        .catch(error=> {
            console.error("app.saveSettings():", error);
        });
    },
    rebootDevice: function(ssid) {
        // send request to device
        var url = "http://192.168.4.1/restart";
        return fetch(url)
            .then(response => {
                // console.log("response received from ", url);
                // return the response body as text if 200 OK, else throw error
                if (response.ok) return "saved";
                throw response;
            })
            .then(()=> {
                console.log("Device Restart Requested");
                app.find(`#auth .log #restart_${ssid}`).classList.add("done");
            });
    },
    /**
     * return type and icon for given name
     * eg smartplug3213 will return ['Smart Plug','smartplug']
     * @param {String} name name of ssid or device
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
        setTimeout(function() {
            app.find("#psk").value = "";
            controller.hideAll();
            controller.show("#saved");
            button.innerText = button.dataset.originalText;
        }, 5000)
    },
    /**
     * device settings problem saving
     */
    not_saved: function(button) {
        setTimeout(function() {
            app.find("#psk").value = "";
            controller.hideAll();
            controller.show("#not_saved");
            button.innerText = button.dataset.originalText;
        }, 4000)
    },
    /**
     * Return strength and rating for given ap.level value
     * @param {Object} ap AccessPoint object
     * @returns {Iterable} requires multiple values to be returned
     * @see: "destructing assingment" https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/Destructuring_assignment
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
     * Add device if not already present
     * store all devices to localStorage
     * @param {Object} device with ip,name,url etc
     */
    saveDevice: function(device) {
        if(device && device.ip) {
            var devices = app.merge(app.getState("devices"), [device]);
            app.setState("devices", devices);
            // app.save() returns undefined on success;
            if (typeof app.save("devices", devices) !== "undefined") {
                console.error("Error saving devices");
            }
        }
    },

    /**
     * remove all items take user to start screen
     */
    clearCache: function() {
        var state = "#devices";

        app.save("devices", []);
        app.setState("devices", []);
        app.save("accessPoints", []);
        app.setState("accessPoints", []);

        app.setState("deviceScanCancelled", true);
        // stop repeats
        controller.clearViewTimeouts(state);
        app.stopLoader();
        // show message
        app.find(state + " .list").innerHTML = "<p>Cached list of devices cleared</p>";
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
    apIsUnique: function(ap) {
        var accessPoints = app.getState("accessPoints");
        for(n in accessPoints) {
            var accessPoint = accessPoints[n];
            if (ap.SSID === "" || accessPoint.SSID === ap.SSID) return false;
        }
        return true;
    },
    showError: function(error) {
        console.error(error);
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
        app.find("#loader-animation").classList.add('in');
        app.setLoader(action || 'Loading...');
    },
    stopLoader: function() {
        app.find("#loader-animation").classList.remove('in');
        app.setLoader('');
    },
    setLoader: function(text) {
        // commented out as not currently enough room in design.
        app.find(".loader-text").innerHTMLl = "";
        app.find(controller.state + " .loader-text").innerHTML = text;
    },
    
};






// view switcher
var Controller = function() {
    var controller = {
        self: null,
        state: app.getSettings('defaultView'),
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
                "#auth",
                "#saved",
                "#not_saved"
            ];
            self.hideAll();
        },

        bindEvents: function() {
            // handle click events of every link in page
            app.findAll('a').forEach(item=> {
                item.addEventListener('click', this.onClick);
            });
            // handle click events for items not yet added to list
            app.findAll('.list').forEach(item=> {
                item.addEventListener('click', this.onClick);
            });
            app.find("[data-show-password]").addEventListener('click', app.togglePasswordVisible)

        },
        /**
         * Main navigation handler (similar to front controller in php)
         * 
         * handles link clicks and shows/hides sections based on the link's href attr
         * @param {Event} event Mouse Click event
         */
        onClick: function(event) {
            event.preventDefault();
            var link = event.target;
            if (link.tagName !== "A") {
                link = getClosest(event.target, "a");
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
                getClosest(link, ".fade").classList.remove("in");
                if(controller.state === "#devices") {
                    app.find("#devices_title").classList.remove('d-none');
                }
                return;
            }
            // console.log(`link clicked: "${link.innerText}", links to "${link.hash}"`);
            var href = link.hash;

            self.changeView(href, link);
        },
        /**
         * Change UI to show new View/Tab/Page/Overlay
         * default to selector if available, else back to welcome screen
         * @param {String} view CSS selector for item to show
         * @param {HTMLElement} link clicked element
         */
        changeView(view, link) {
            if(view === "#sidebar") {
                self.toggleSidebar();
                return;
            }
            if(view === "#clear-cache") {
                if(getClosest(link, "#sidebar")!==null) {
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
                    app.find("#connecting .ssid").innerText = link.dataset.name;
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
                    app.find(view + " [data-reload]").classList.add("d-none");
                    app.checkForNewDevices();
                break;
                case "#accesspoints":
                    self.hideAll();
                    if(link.dataset.name) {
                        app.setState("selectedHotspot", link.dataset.name);
                    }
                    app.find("#selectedDevice").innerText = app.getState("selectedHotspot");
                    
                    app.stopLoader();
                    self.show(view);
                    // show the list of access points to choose from
                    app.displayAccessPoints(app.getState("accessPoints"), app.find("#accesspoints .list"));
                break;
                case "#auth":
                    app.stopLoader();
                    self.hideAll();
                    self.show(view);
                    
                    // recall saved password
                    var passwordList = app.load('ssid') || {};
                    if(passwordList.hasOwnProperty(link.dataset.ssid)) {
                        app.find("#psk").value = passwordList[link.dataset.ssid];
                        app.find("#save-psk").checked = true;
                    }
                    // clear the log view
                    app.find("#auth .log").innerHTML = "";

                    // display selected ssid and set value in hidden form field
                    app.find("#auth .ssid").innerText = link.dataset.ssid;
                    app.find("#auth #ssid_input").innerText = link.dataset.ssid;
                    
                    // pass ssid to next view (if button clicked)
                    app.find("#auth #save_auth").dataset.ssid = link.dataset.ssid;
                    app.setState("deviceConnectionSSID", link.dataset.ssid);

                break;
                case "#saved":
                    // saving data before showing success message
                    // todo: connect to device hotspot and save settings
                    app.setState("deviceConnectionPsk", app.find("#psk").value);

                    // fixed in during testing
                    app.getState("selectedHotspot")


                    const deviceConnectionSSID = app.getState("deviceConnectionSSID");
                    const deviceConnectionPsk = app.getState("deviceConnectionPsk");

                    const selectedHotspot = app.getState("selectedHotspot");
                    const currentSSID = app.getState("currentSSID");

                    // use save button as ajax loader
                    link.dataset.originalText = link.innerText;
                    link.innerText = "Saving...";
                    link.classList.add('blink');

                    // save passkey locally
                    // @todo: this will be saved in plain text to allow us to send it to the device.
                    //        research browser local storage security.
                    var passwordList = app.load('ssid') || {};
                    if(app.find("#save-psk").checked && deviceConnectionSSID) {
                        passwordList[deviceConnectionSSID] = deviceConnectionPsk;
                    } else {
                        delete passwordList[deviceConnectionSSID];
                    }
                    // save altered passwword list
                    app.save('ssid', passwordList);

                    // connect to device hotspot and save settings before reconnecting back to current wifi
                    controller.hide("#password-confirm");

                    // add grayed out items "todo". once done class "done" is added
                    app.find("#auth .log").innerHTML+= `
                    <li id="connect_${selectedHotspot}">Connecting to ${selectedHotspot}</li>
                    <li id="save_${deviceConnectionSSID}">Saving Settings</li>
                    <li id="restart_${selectedHotspot}">Restarting Device</li>
                    <li id="connect_${currentSSID}">Reconnecting to ${currentSSID}</li>
                    `;

                    app.connect(selectedHotspot)
                        .then(()=> app.saveSettings(deviceConnectionSSID, deviceConnectionPsk))
                        .then(()=> app.rebootDevice(selectedHotspot))
                        .then(()=> app.connect(currentSSID))
                        .then(()=> {
                            link.innerText = "Saved";
                            link.classList.remove("blink");
                            app.saved_success(link)
                            // console.log('/#saved',"Saved");
                        })
                        .catch(error=> {
                            link.innerText = "Not Saved";
                            link.classList.remove("blink");
                            app.not_saved(link);
                            console.error('/#saved Error:',error);
                        })
                break;

                case "#welcome":
                    if(getClosest(link, "#sidebar")!==null) {
                        self.toggleSidebar();
                    }
                    app.save("welcome_seen", false);
                    app.firstPage();
                    break;

                default:
                    self.hideAll();
                    self.show(view);
            }
            // clear current page intervals or timeouts before changing
            self.clearViewTimeouts(self.state);
            // set current controller state - aka. "what page am I on?"
            if(view==="#welcome") {
                // no view called "#welcome"... set it to default view
                self.state = app.getSettings("defaultView");
            } else {
                self.state = view;
            }

        },
        /**
         * called to stop wating timeouts once view is quit
         * timeouts should only be created for specific pages/view
         * 
         * called before changing to next page
         * @param {String} CSS selector for current page (before moving to next)
         */
        clearViewTimeouts: function(previous_view) {
            switch(previous_view) {
                case "#devices":
                    clearTimeout(app.getState("deviceScanRepeatObj"));
                    clearInterval(app.getState("deviceListCleanInterval"));
                    break;
                case "#add-device":
                    // var timeout = app.getState("deviceApScanRepeatObj");
                    // clearTimeout(timeout);
                    break;
            }
        },
        /**
         * 
         * @param {Boolean} state true is open false is close
         */
        toggleSidebar: function(state) {
            app.find('#sidebar').classList.toggle("in");
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
            app.find(selector).classList.add('d-none');
        },
        /**
         * Show single HTMLElement
         * @param {String} selector CSS selector to identify single element
         */
        showOne: function(selector) {
            app.find(selector).classList.remove('d-none');
        }
    }
    controller.initialize();
    return controller;
}


app.initialize();


/**
 * Return nearest parent matching `selector`.
 * Searches up DOM `elem` parentNode() tree for given `selector`
 * @param {HTMLElement} elem child element
 * @param {String} selector css query to match potential parent
 * @returns {HTMLElement} parent/closest element that matches | or null
 */
var getClosest = function (elem, selector) {
    for ( ; elem && elem !== document; elem = elem.parentNode ) {
        if ( elem.matches( selector ) ) return elem;
    }
    return null;
};



/**
 * NOT FOR PRODUCTION
 */
var Dev = function() {
    var _ = {
        initialize: function () {
            console.info("DEV SCRIPTS INITIALIZED----------------")
            var input = document.getElementById("colour");
            if(input) {
                var colour = getComputedStyle(document.documentElement).getPropertyValue('--color-primary').trim();
                input.value = colour;
                input.addEventListener('input', this.onColourChange.bind(this), false);
                input.addEventListener('change', this.onColourChange.bind(this), false);
            }
        },
        onColourChange: function(event) {
            this.changeAccentColour(event.target.value);
        },
        changeAccentColour: function(colour){
            document.documentElement.style.setProperty('--color-primary', colour);
        }
    }
    _.initialize();
    return _;
}
// create instatnce of dev scripts (and run init)
var _dev = new Dev();
