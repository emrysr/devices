
var controller = null;

var app = {

    devices: [],
    deviceScanTimeout: 10000,
    deviceScanRepeat: 3000,
    deviceScanRepeatObj: false,
    wifiScanTimeout: 2000,
    wifiScanRepeat: 20000,
    wifiScanRepeatObj: false,
    online: false,
    currentSSID: false,
    currentIP: false,
    accessPoints: [],
    scan_retries: 0,
    scan_counter: 0,
    defaultView: "#devices",
    device_ssid_pattern: /^(smartplug|wifirelay).*$/g,

    initialize: function() {
        document.addEventListener('deviceready', this.onDeviceReady.bind(this), false);
    },
    
    onDeviceReady: function() {
        controller = new Controller();
        // default view
        controller.show(["#welcome", app.defaultView]);
        // scan for devices to show on default view
        app.getNetworkDevices();
        
        // collect current wifi state to show in settings
        this.setIsConnected(this.getWifiEnabled());
        this.getCurrentSSID().then(app.setCurrentSSID);
        WifiWizard2.getWifiIP().then(app.setCurrentIP)
            .catch(()=>{
                app.setCurrentIP("");
                app.setIsConnected(false);
            });

    },
    setIsConnected: function(isOnline) {
        if(!isOnline) controller.show("disconnected");
        app.online = isOnline;
        app.find("#connected").innerText = isOnline ? 'YES': 'NO';
    },
    getCurrentSSID: function() {
        return WifiWizard2.getConnectedSSID()
            .then(function(ssid) {
                // app.info(`connected to "${ssid}"`);
                app.currentSSID = ssid;
                return ssid;
            })
            .catch(function(reason) { 
                app.error(reason);
            });
    },
    setCurrentSSID: function(ssid) {
        app.currentSSID = ssid;
        app.find("#currentSSID").innerText = ssid;
    },
    setCurrentIP: function(ip) {
        app.currentIP = ip;
        app.find("#currentIP").innerText = ip;
    },
    onExternalLinkClick: function(event) {
        event.preventDefault();
        var url = event.target.href;
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
                    app.deviceScanRepeatObj = setTimeout(function(){
                        app.getNetworkDevices();
                    }, app.deviceScanRepeat);
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
        // console.log("Scanning for Wifi Access Points...");
        return WifiWizard2.scan();
    },
    setAccessPoints: function(acccessPoints) {
        app.accessPoints = acccessPoints;
        return acccessPoints;
    },
    /**
     * return filtered list of accespoints based on name
     * match known list of accesspoints names
     * @param {Array} acccessPoints list of objects with access point details
     */
    getDeviceHotspots: function(acccessPoints) {
        return acccessPoints.reduce((accumulator, currentValue) => {
            if(currentValue.SSID) {
                var found = currentValue.SSID.match(app.device_ssid_pattern);
                if (found) {
                    accumulator.push(found[0]);
                }
            }
            return accumulator;
        }, []);
    },
    showDeviceHotspots: function(hotspots) {
        const list = app.find("#add-device .list");
        var _devices = hotspots.length === 1 ? "Device": "Devices";
        list.innerHTML = `<p>Found ${hotspots.length} ${_devices}</p>`;
        hotspots.forEach(name=>{
            var type, icon,
            [type,icon] = app.getDeviceType(name);
            var html = `<a href="#accesspoints" data-name="${name}"><span><svg class="icon"><use xlink:href="#icon-${icon}"></use></svg> ${name}</span> <small class="badge">${type}</small></a>`,
                item = document.createElement('div');

            item.innerHTML = html;
            list.appendChild(item.firstElementChild);
        });
    },
    /**
     * get the list of access points
     * store results in `app.accessPoints`
     * on error retry after short delay
     */
    getWifiHotspots: function() {
        this.getAccessPoints()
            .then(function() {
                app.showWifiNetworks();
                app.scan_counter++;
                app.scan_retries = 0;
                console.log(`Scan ${app.scan_counter} complete. (${app.accessPoints.length} items)`);
                
                // re-scan after delay
                if(controller.state==="#accesspoints") {
                    app.wifiScanRepeatObj = setTimeout(function(){
                        app.getWifiHotspots();
                    }, app.wifiScanRepeat)
                }
            })
            .catch(function(reason){ 
                // error running scan. clear auto refresh, wait and retry
                console.error(app.scan_retries + ". " + reason);
                WifiWizard2.timeout(wifiScanTimeout)
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
        app.devices = []; 

        return new Promise((resolve, reject) => {
            zeroconf.reInit(function() {
                zeroconf.registerAddressFamily = 'ipv4';
                zeroconf.watchAddressFamily = 'ipv4';
    
                zeroconf.watch('_workstation._tcp.', 'local.', app.parseDevices);
                zeroconf.watch('_http._tcp.', 'local.', app.parseDevices);
    
                setTimeout(function() {
                    if(app.devices.length > 0) {
                        zeroconf.close(
                            ()=>resolve(app.devices),
                            ()=>reject("Unable to close zeroconf browser")
                        );
                    } else {
                        reject("No devices found");
                    }
                }, app.deviceScanTimeout);
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
                app.devices.push(device);
                app.displayDevices(app.devices);
            }
        }
    },
    /**
     * 
     * @param {Array} accessPoints list of objects with accesspoint details
     * @param {HTMLElement} list container to display the entries in
     */
    displayAccessPoints: function(accessPoints, list) {
        // filtered access points to not show device hotspots (only standard wifi connections)
        var filtered = accessPoints.reduce((accumulator, currentValue) => {
            var found = currentValue.SSID.match(app.device_ssid_pattern);
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
            var wps = "";
            if (ap.capabilities) {
                wps = ap.capabilities.match('WPS') ? ' WPS': '';
            }
            var strength = "", rating = "";
            [strength, rating] = app.getApStrengthAndRating(ap);

            var title = ap.SSID === "" ? `<span class="text-muted">${ap.BSSID}</span>`: ap.SSID;
            var css = ap.SSID === app.currentSSID ? 'current': '';
            item.innerHTML = `<a href="#auth" data-ssid="${ap.SSID}" class="${css}">
                                <span>${title}<small class="badge text-muted">${wps}</small></span>
                                <progress max="5" value="${rating}">
                                    ${ap.level}dBm
                                </progress>
                              </a>`;
            list.append(item.firstElementChild);
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
    saved_success: function(link) {
        controller.hideAll();
        controller.show("#saved");
        link.innerText = link.dataset.originalText;
        link.classList.remove("blink");
        controller.state = "#saved";
        app.find("#psk").value = "";
        app
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
        app.devices.forEach(device => {
            if (device.ip === ip) return false;
        });
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
        state: app.defaultView,
        initialize: function() {
            self = this;
            this.bindEvents();
            // list of all views to hide initially
            // todo: automatically create this list by searching the page for <section> tags
            self.views = [
                "#welcome",
                "#devices",
                "#devices_title", // hides this if welcome screen shown
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
                view = app.defaultView;
            } else if(!document.querySelector(view)) {
                view = app.defaultView;
            }
            // change to new view by default
            // or fire off functions specific to requested view
            switch(view) {
                case "#connecting":
                    app.find("#connecting .ssid").innerText = link.dataset.name;
                    setTimeout(function() {
                        self.hideAll();
                        self.show('#accesspoints');
                        // console.log(`moving from: "${self.state}", to: "${view}"`);
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
                    app.getAccessPoints()
                        .then(app.setAccessPoints)
                        .then(app.getDeviceHotspots)
                        .then(app.showDeviceHotspots)
                        .finally(()=>app.stopLoader);
                    self.hideAll();
                    self.show(view);
                    app.startLoader("Searching for new devices in range...");
                break;
                case "#accesspoints":
                    self.hideAll();
                    app.stopLoader();
                    app.displayAccessPoints(app.accessPoints, app.find("#accesspoints .list"));
                    self.show(view);
                break;
                case "#auth":
                    self.hideAll();
                    self.show(view);
                    
                    // recall saved password
                    var passwordList = app.load('ssid');
                    if(passwordList.hasOwnProperty(link.dataset.ssid)) {
                        app.find("#psk").value = passwordList[link.dataset.ssid];
                    }
                    
                    app.stopLoader();
                    app.find("#auth .log").innerHTML = "";
                    // display selected ssid and set value in hidden form field
                    app.find("#auth .ssid").innerText = link.dataset.ssid;
                    app.find("#auth #ssid_input").innerText = link.dataset.ssid;
                    // pass ssid to next view (if button clicked)
                    app.find("#auth #save_auth").dataset.ssid = link.dataset.ssid;
                break;
                case "#saved":
                    // saving data before showing success message
                    // todo: connect to device hotspot and save settings

                    // use save button as ajax loader
                    link.dataset.originalText = link.innerText;
                    link.innerText = "Saving...";
                    link.classList.add('blink');

                    // save passkey locally
                    if(app.find("#save-psk").checked && link.dataset.ssid) {
                        var psk = app.find("#psk").value;
                        var passwordList = app.load('ssid');
                        passwordList[link.dataset.ssid] = psk;
                        app.save('ssid', passwordList);
                    }

                    // FAKE AJAX RESPONSE-------------------
                    var log = app.find("#auth .log");
                    setTimeout(function() {
                        log.innerHTML+="<p>Switching WiFi...";
                    }, 300);
                    setTimeout(function() {
                        log.innerHTML+="<p>Connected.";
                    }, 1700);
                    setTimeout(function() {
                        log.innerHTML+="<p>Saving Settings...";
                    }, 1800);
                    setTimeout(function() {
                        log.innerHTML+="<p>Saved.";
                    }, 2800);
                    setTimeout(function() {
                        log.innerHTML+="<p>Reconnecting WiFI...";
                    }, 3500);
                    setTimeout(function() {
                        log.innerHTML+="<p>Connected.";
                    }, 5500);

                    // todo: send ssid and psk to device via api
                    setTimeout(function() {
                        app.saved_success(link)
                    }, 7000);
                break;

                case "#welcome":
                    self.hideAll();
                    if(getClosest(link, "#sidebar")!==null) {
                        self.toggleSidebar();
                    }
                    self.show(["#welcome", app.defaultView]);
                    break;

                default:
                    self.hideAll();
                    self.show(view);
            }
            // clear current page intervals or timeouts before changing
            self.clearViewTimeouts(self.state);
            // set current controller state - aka. "what page am I on?"
            self.state = view;

        },
        /**
         * called to stop wating timeouts once view is quit
         * timeouts should only be created for specific pages/view
         */
        clearViewTimeouts: function(state) {
            switch(state) {
                case "#scan":
                    clearTimeout(app.deviceScanRepeatObj);
                    break;
                case "#accesspoints":
                    // todo: clear wifi scan timeouts
                    // clearTimeout(app.wifiScanRepeatObj);
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
            console.log("DEV SCRIPTS INITIALIZED")
            var input = document.getElementById("colour");
            if(input) {
                var colour = getComputedStyle(document.documentElement).getPropertyValue('--color-primary').trim();
                input.value = colour;
                input.addEventListener('input', this.onColourChange.bind(this), false);
                input.addEventListener('change', this.onColourChange.bind(this), false);
            }
        },
        onColourChange: function(event) {
            console.log('input event caught')
            this.changeAccentColour(event.target.value);
        },
        changeAccentColour: function(colour){
            console.log('new colour set', colour);
            document.documentElement.style.setProperty('--color-primary', colour);
        }
    }
    _.initialize();
    return _;
}
var _dev = new Dev();
