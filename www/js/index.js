
var controller = null;

var app = {
    scan_retries: 0,
    scan_counter: 0,
    settings: {
        defaultView: "#devices",
        deviceScanTimeout: 10000,
        deviceScanRepeat: 3000,
        wifiScanTimeout: 2000,
        wifiScanRepeat: 20000,
        wifiScanRepeatObj: false,
        device_ssid_pattern: /^(smartplug|wifirelay).*$/g,
    },
    state: {
        devices: [],
        accessPoints: [],
        online: false,
        currentSSID: false,
        currentIP: false,
        selectedHotspot: false,
        deviceConnectionSSID: false,
        deviceConnectionPsk: false,
        deviceScanRepeatObj: false,
    },
    initialize: function() {
        document.addEventListener('deviceready', this.onDeviceReady.bind(this), false);
    },
    
    onDeviceReady: function() {
        // handle all view/tab changes
        controller = new Controller();
        // show welcome page
        this.firstPage();
        // add mobile system events
        document.addEventListener("reload", this.onReload.bind(this), false);//window.location.reload(true);
        document.addEventListener("connect", this.onConnect.bind(this), false);
        document.addEventListener("offline", this.onOffline.bind(this), false);
        document.addEventListener("online", this.onOnline.bind(this), false);
        // get network status
        app.getStatus();
    },

    firstPage: function() {
        controller.hideAll();
        // default view
        var defaultView = app.getSettings("defaultView");
        controller.show("#welcome");
        controller.show(defaultView);
        // remove view title when welcome page in view
        controller.hide(defaultView + "_title");

        // scan for devices to show on default view
        app.find("#welcome").classList.add("in");
        app.getNetworkDevices();
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
        app.zeroconfScan()
            .then(app.displayDevices)
            .catch(app.showError)
            .finally(() => {
                // repeat the scan after delay - only if in "device scan" tab
                if(controller.state==="#devices") {
                    var t = setTimeout(() => {app.getNetworkDevices()}, app.getSettings("deviceScanRepeat"));
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
     * request a scan and return a promise
     * @returns {Promise} 
     */
    getAccessPoints: function() {
        return WifiWizard2.scan();
    },
    setAccessPoints: function(acccessPoints) {
        app.setState("accessPoints", acccessPoints);
        return acccessPoints;
    },
    /**
     * return filtered list of accespoints based on name
     * match known list of accesspoints names
     * @param {Array} acccessPoints list of objects with access point details
     */
    getDeviceHotspots: function(acccessPoints) {
        return acccessPoints.reduce((accumulator, currentValue) => {
            // console.log(currentValue.SSID, currentValue.capabilities);
            if(currentValue.SSID) {
                var found = currentValue.SSID.match(app.getSettings("device_ssid_pattern"));
                if (found) {
                    accumulator.push(currentValue);
                }
            }
            return accumulator;
        }, []);
    },
    showDeviceHotspots: function(hotspots) {
        const list = app.find("#add-device .list");
        var _devices = hotspots.length === 1 ? "Device": "Devices";
        list.innerHTML = `<p>Found ${hotspots.length} ${_devices}</p>`;
        hotspots.forEach(hotspot=> {
            var name = hotspot.SSID, type, icon,
            [type,icon] = app.getDeviceType(name);
            var html = `<a href="#accesspoints" data-name="${name}"><span><svg class="icon"><use xlink:href="#icon-${icon}"></use></svg> ${name}</span> <small class="badge">${type}</small></a>`,
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
    displayDevices: function(results) {
        var list = app.find("#devices nav.list");
        var _devices = results.length === 1 ? "Device": "Devices";
        list.innerHTML = `<p>Found ${results.length} ${_devices}</p>`;
        results.forEach(result => {
            var type, icon,
            [type,icon] = app.getDeviceType(result.name);
            var url = result.url,
                ip = result.ip,
                name = result.name,
                html = `<a data-weblink href="${url}" title="${type}"><span><svg class="icon"><use xlink:href="#icon-${icon}"></use></svg> ${name}</span> <small class="badge">${ip}</small></a>`,
                item = document.createElement('div');

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
        // todo: add to devices instead of clearing out and starting agian
        app.setState("devices", []);
        return new Promise((resolve, reject) => {
            zeroconf.reInit(function() {
                zeroconf.registerAddressFamily = 'ipv4';
                zeroconf.watchAddressFamily = 'ipv4';
    
                zeroconf.watch('_workstation._tcp.', 'local.', app.parseDevices);
                zeroconf.watch('_http._tcp.', 'local.', app.parseDevices);
    
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
    parseDevices: function(result) {
        var action = result.action;
        var service = result.service;
        if (action == 'resolved') {
            var ip = service.ipv4Addresses[0];
            var name = service.name.match(/(.*) \[.*\]*/) || [];
            var protocol = service.txtRecord.https ? 'https://': 'http://';
            var platform = service.txtRecord.platform || '';
            var version = service.txtRecord.v || '';
            var path = service.txtRecord.path || '';
            var url = protocol + ip + path;
            var device = {
                name: name[1] || service.name,
                ip: ip,
                platform: platform,
                version: version,
                path: path,
                url: url
            }
            if(ip && app.deviceIsUnique(ip)) {
                let devices = app.getState("devices") || [];
                devices.push(device);
                app.setState("devices", devices);
                app.displayDevices(devices);
            }
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
            var wpa, ess, wps, strength = "", rating = "";
            [wpa, ess, wps] = app.getApCapabilities(ap);
            [strength, rating] = app.getApStrengthAndRating(ap);

            var title = ap.SSID === "" ? `<span class="text-muted">${ap.BSSID}</span>`: ap.SSID;
            var css = ap.SSID === app.getState("currentSSID") ? 'current': '';
            item.innerHTML = `<a href="#auth" data-ssid="${ap.SSID}" data-wpa="${wpa}" class="${css}">
                                <span>${title}<small class="badge text-muted">${wps}</small></span>
                                <progress max="5" value="${rating}">
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
            console.log(`Connected to ${ssid}`);
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
     * {@see https://github.com/openenergymonitor/EmonESP/blob/master/src/web_server.cpp#L753 EmonESP api endpoint}
     * {@see https://github.com/openenergymonitor/EmonESP/blob/master/src/web_server.cpp#L159 EmonESP save ssid function}
     */
    saveSettings: function(ssid, password) {
        return new Promise((resolve, reject) => {
            if(ssid === "") reject("SSID cannot be empty");
            // send details to device
            var url = `http://192.168.4.1/savenetwork?ssid=${ssid}&pass=${password}`;
            return fetch(url)
                .then(response => {
                    console.log("response received from ", url);
                    // return the response body as text if 200 OK, else throw error
                    if (response.ok) return "saved";
                    throw response;
                })
                .then(()=> new Promise((r) => setTimeout(r, 1000)))
                .then(()=> {
                    console.log(`Saved settings on ${ssid}`);
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
    /**
     * return type and icon for given name
     * eg smartplug3213 will return ['Smart Plug','smartplug']
     * @param {String} name name of ssid or device
     */
    getDeviceType: function(name) {
        // todo: change icon based on name
        var icon = "smartplug", // smartplug|smartmeter|openevse|hpmon|edmi-am|emonth
            type = "Smart-Plug";
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
     * @return {*} null if not found
     */
    load: function(key) {
        var storage = window.localStorage;
        return JSON.parse(storage.getItem(key));
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
        }, 2000)
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
        }, 2000)
    },
    /**
     * Return strength and rating for given ap.level value
     * @param {Object} ap AccessPoint object
     * @returns {Iterable} requires multiple values to be returned
     * @see: "destructing assingment" https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/Destructuring_assignment
     */
    getApStrengthAndRating: function(ap) {
        var strength = "Unusable";
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
     * checks ip address exists in `app.devices[]` objects {name:'1bc',ip:'1.1.1.1'}
     * @param {String} ip ipv4 address eg: "1.1.1.1"
     * @returns {Boolean} true if ip address is not already in list
     */
    deviceIsUnique: function(ip) {
        var devices = app.getState("devices");
        for(d in devices) {
            var device = devices[d];
            if (device.ip === ip) return false;
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
        app.setLoader(action || 'Loading...');
    },
    stopLoader: function() {
        app.setLoader('');
    },
    setLoader: function(text) {
        app.find("#loader").innerHTML = text;
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
                "#accesspoints",
                "#add-device",
                "#auth",
                "#saved"
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
                console.log('state', controller.state)
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
         */
        changeView(view, link) {
            if(view === "#sidebar") {
                self.toggleSidebar();
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
                    app.getNetworkDevices();
                    self.show("#devices_title");
                    self.show(view);
                break;
                case "#add-device":
                    self.hideAll();
                    self.show(view);
                    app.getAccessPoints()
                        .then(accessPoints=> app.setAccessPoints(accessPoints))
                        .then(accessPoints=> app.getDeviceHotspots(accessPoints))
                        .then(hotspots=> app.showDeviceHotspots(hotspots))
                        .catch(function(error) {
                            console.error(view, error);
                        })
                        .finally(()=> app.stopLoader);
                    app.startLoader("Searching for new devices in range...");
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
                    <li id="connect_${currentSSID}">Connecting to ${currentSSID}</li>
                    `;

                    app.connect(selectedHotspot)
                        .then(()=> app.saveSettings(deviceConnectionSSID, deviceConnectionPsk))
                        .then(()=> app.connect(currentSSID))
                        .then(()=> {
                            link.innerText = "Saved";
                            link.classList.remove("blink");
                            app.saved_success(link)
                            console.log('/#saved',"Saved");
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
         */
        clearViewTimeouts: function(state) {
            switch(state) {
                case "#scan":
                    clearTimeout(app.getState("deviceScanRepeatObj"));
                    break;
                case "#accesspoints":
                    // todo: clear wifi scan timeouts
                    // clearTimeout(app.getState("wifiScanRepeatObj"));
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
