/**
 * @file Mobile app to display and add emoncms devices | Part of the OpenEnergyMonitor project
 * @author Emrys Roberts <emrys@openenergymonitor.org.uk>
 * @description Mobile app that scans the local network for compatible devices. Connects to new device hotspot and pairs it. Adds the device to the user's online dashboard.
 * @summary Emon Devices App
 * @see {@link http://openenergymonitor.org|OpenEnergyMonitor project}
 * @license AGPL-3.0-or-later {@link https://raw.githubusercontent.com/emrysr/devices/master/LICENSE.txt|LICENSE.txt}
 * @copyright EmonCMS 2020 {@link https://raw.githubusercontent.com/emrysr/devices/master/COPYRIGHT.txt|COPYRIGHT.txt}
 * @version 0.2.3
 */

const APP_VERSION = "0.2.3";
/**
 * Display messages during debug based on logging levels
 * 
 * <br>LEVELS: FATAL(1), ERROR(2), WARN(4), INFO(8), DEBUG(16), TRACE(32).
 * <br>Higher logging levels also show lower levels. eg:
 * <br>  - DEBUG also shows FATAL,ERROR,WARN and INFO messages
 * <br>  - ERROR also shows FATAL messages
 * @param {number} _LEVEL log level to control output
 * @class
 */
var logger = (function() {
    /** List of available levels - higher level numbers display all lower level messages
     * @type {object} 
     * @alias logger.levels
    */
    var _levels = {
        OFF: 0,   // no logging
        FATAL: 1, // very serious errors that will lead to app aborting (hardware or system failure events)
        ERROR: 2, // error events that still allow app to continue (if resources are unavailable/unresponsive)
        WARN: 4,  // has potential to harm data or app state (bad user input or mal-formed api responses)
        INFO: 8,  // useful points within the app can be outputted (a little output for simple debugging)
        DEBUG: 16,// more detail regarding the running process of the app (very detailed, can be hard to follow)
        TRACE: 32 // all possible output regarding everyting (very detailed, better outputted to file and reviewd)
    }
    var _level = _levels.WARN;
    var _showLevel = function () {
        var level_name = Object.keys(_levels)[Object.values(_levels).indexOf(_level)];
        console.info(`--------LOGGING AT LEVEL ${_level} (${level_name})-----`);
    }
    return {
        /** Level of logging. Default 4 (Warn). Set during init. Default WARN(4).
         * @type {number} 
         * @alias logger.level
        */
        /** @alias logger.fatal */
        fatal: function(message) {
            if(_level>=1) console.error('FATAL!',message);
        },
        /** @alias logger.error */
        error: function(message) {
            if(_level>=2) console.error('ERROR!',message);
        },
        /** @alias logger.warn */
        warn: function(message) {
            if(_level>=4) console.warn('WARN!', message);
        },
        /** @alias logger.info */
        info: function(message) {
            if(_level>=8) console.info('INFO:', message);
        },
        /** @alias logger.debug */
        debug: function(message) {
            if(_level>=16) console.log('DEBUG:', message);
        },
        /** @alias logger.trace */
        trace: function(message) {
            if(_level>=32) console.log('TRACE:', message);
        },
        setLevel: function(level) {
            _level = typeof level !== "undefined" ? level : _levels.WARN;
            _showLevel();
        },
        levels: _levels
    }
})();

/**
 * Override app settings by changing the following options...
 * 
 * <br> - `device_ssid_pattern`- change this regexp pattern when a new device tyoe become available 
 * <br> - `log_level`: 4 - to see more output during debug (1,2,4,8,16,32)
 * <br> - `defaultView`: '#devices' - when a different 'first page' is required
 * <br> - `deviceScanTimeout`: 3000 - ms before zeroconfScan aborts a scan.
 * <br> - `deviceScanRepeat`: 2000 - ms before zeroconfScan begins new scan.
 * <br> - `deviceApScanRepeat`: 5000 - ms before new device scan (wifiWizard2) is repeated
 * <br> - `deviceApScanMaxRetries`: 8 - number of tries before aborting new device scan (wifiWizard2),
 * <br> - `apScanIntervalDelay`: 4000 - ms before new accesspoint (wifiWizard2) scan is started
 */
_SETTINGS = {
    log_level: logger.levels.WARN,
    defaultView: "#devices",
    deviceScanTimeout: 3000,
    deviceScanRepeat: 2000,
    deviceApScanRepeat: 5000,
    deviceApScanMaxRetries: 4,
    device_ssid_pattern: /^(smartplug|wifirelay|hpmon|openevse|meterreader|emonpi|emoncms|emonbase).*$/g,
    apScanIntervalDelay: 4000
}


/**
 * Collection of methods that alter the DOM
 * @class
 */
var view = (function() {
    var _app;
    var _ = {
        init: function (app) {
            logger.info("---VIEW METHODS INITIALIZED");
            _app = app;
            var v = _app.hasOwnProperty("version") ? _app.version: '';
            view.setText(view.find("#app_version"), 'v'+v);
        },
        /**
         * add list of devices to container
         * @todo save results of Devices.removeExpired() and sort to _app.state.devices
         * @memberof view
         */
        displayDevices: function() {
            /** @type {HTMLElement} */
            var container = view.find("#devices nav.list");
            
            /** @type {Array.<Device>} */
            var results = Devices.getStoredDevices();

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
                                    ${view.icon(icon_name)}
                                    ${name}
                                </span> 
                                <small class="badge">${ip}</small>
                            </a>`;

                item.innerHTML = html;
                container.appendChild(item.firstElementChild);
            });
        },
        /**
         * Add class name to element
         * @param {HTMLElement} element 
         * @param {String} className
         * @memberof view
         */
        addClass: function(element, className) {
            element.classList.add(className);
        },
        /**
         * Add class name to element
         * @param {HTMLElement} element 
         * @param {String} className
         * @memberof view
         */
        removeClass: function(element, className) {
            element.classList.remove(className);
        },
        /**
         * Restores inner text value from saved value in dataset
         * @memberof view
         */
        resetOriginalText: function(elem) {
            if(elem.dataset.originalText) {
                elem.innerText = elem.dataset.originalText;
            } else {
                logger.trace(`no original text to replace for ${elem.tagName}`);
            }
        },
        /**
         * Store element's original innerText as dataset property.
         * <br>does not overwrite if already exists
         * @memberof view
         */
        setOriginalText: function(elem) {
            // todo: sanitize text
            if(!elem.dataset.originalText) {
                elem.dataset.originalText = elem.innerText;
            }
        },
        /**
         * Changes and element's inner text. Saves reference to original
         * @param {HTMLElement} elem the element to change
         * @param {String} text value to set innerText to
         * @memberof view
         */
        setText: function(elem, text) {
            this.setOriginalText(elem);
            elem.innerText = text;
        },
        /**
         * @param {String} selector css query selector. only matches first
         * @returns {HTMLElement} DOM element, empty <DIV> if no match.
         * @todo move to View class
         * @memberof view
         */
        find: function(selector) {
            // return empty element if not found
            return document.querySelector(selector) || document.createElement('div');
        },
        /**
         * @param {String} selector css query selector. matches all
         * @returns {NodeList} itterable list of HTMLElements that match
         * @memberof view
         */
        findAll: function(selector) {
            var list = document.querySelectorAll(selector);
            if (!list) {
                var docFragment = document.createDocumentFragment();
                list = docFragment.children;
            }
            return list;
        },
        /**
         * create the svg markup needed to display an icon.
         * 
         * svg icons must be inline in the html to enable xlink references
         * will not work with external files eg. <img> src .svg files
         * @param {String} name last part of icon id. eg #icon-xxxx
         * @memberof view
         */
        icon: function(name){
            return `<svg class="icon"><use xlink:href="#icon-${name}"></use></svg>`
        },
        /**
         * Return nearest parent matching `selector`.
         * Searches up DOM `elem` parentNode() tree for given `selector`
         * @param {HTMLElement} elem child element
         * @param {String} selector css query to match potential parent
         * @returns {HTMLElement} parent/closest element that matches | or null
         * @memberof view
         */
        getClosest: function (elem, selector) {
            for ( ; elem && elem !== document; elem = elem.parentNode ) {
                if ( elem.matches( selector ) ) return elem;
            }
            return null;
        },
        /**
         * Show single HTMLElement
         * @param {String} selector CSS selector to identify single element
         * @memberof view
         */
        showOne: function(selector) {
            view.find(selector).classList.remove('d-none');
        },
        /**
         * calls view.showOne() for individual or group of elements
         * @param {*} selector Array|String CSS selector to identify element(s)
         * @memberof view
         */
        show: function(selector) {
            if(Array.isArray(selector)) {
                selector.forEach(item=>view.showOne(item));
            } else {
                view.showOne(selector);
            }
        },
        /**
         * hide all views listed in app.views
         * @memberof view
         */
        hideAll: function() {
            _app.views.forEach(selector=>{
                view.hide(selector);
            });
        },
        /**
         * calls view.hideOne() for individual or group of elements
         * @see view.hideOne
         * @param {*} selector Array|String CSS selector to identify element(s)
         * @memberof view
         */
        hide: function(selector) {
            if(Array.isArray(selector)) {
                selector.forEach(item=>{ view.hideOne(item) });
            } else {
                view.hideOne(selector);
            }
        },
        /**
         * Hide single HTMLElement
         * @param {String} selector CSS selector to identify single element
         * @memberof view
         */
        hideOne: function(selector) {
            view.find(selector).classList.add('d-none');
        },
        /**
         * Uses css classes to toggle sidebar visibility
         * @param {Boolean} state true is open false is close
         * @memberof view
         */
        toggleSidebar: function(state) {
            view.find('#sidebar').classList.toggle("in");
        },
        /**
         * @param {Boolean|Event} event if arguments[0] is true == password visible
         * @memberof view
         */
        togglePasswordVisible: function (event) {
            var button = event.target.tagName === 'BUTTON' ? event.target: view.getClosest(event.target, 'button'),
                event,
                state,
                input = view.find(button.dataset.showPassword);
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
        /**
         * display given list of new device hotspots to choose from
         * 
         * once clicked the process of selecting a wifi connection for the device is started
         * @param {Array} hotspots list of hotspots as returned by WifiWizard2.listNetworks()
         * @memberof view
         */
        showDeviceHotspots: function(hotspots) {
            const list = view.find("#add-device .list");
            var _devices = hotspots.length === 1 ? "device": "devices";
            list.innerHTML = `<p>Found ${hotspots.length} available ${_devices}</p>`;
            hotspots.forEach(hotspot=> {
                var name = hotspot.SSID, type, icon_name,
                [type,icon_name] = Devices.getDeviceType(name);
                var html = `<a href="#accesspoints" data-name="${name}">
                    <span>
                        ${view.icon(icon_name)}
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
         * This is called to change a view. existing view still visible when this fires.
         * 
         * Change UI to show new View/Tab/Page/Overlay
         * default to selector if available, else back to welcome screen<br>
         * 
         * *similar* to how a [front controller]{@link https://en.wikipedia.org/wiki/Front_controller} handles routing}
         * 
         * @param {String} new_view CSS selector for item to show
         * @param {HTMLElement} link clicked element
         * @todo rename to onViewChange to have a common naming style eg. onViewEnter,onViewExit etc
         * @todo rename `link` param to button or elem - as not always an `&lt;a&gt;` tag
         * @todo look to see if any of the code could be moved to a suitable Model type Object. this function is very long!?
         * @memberof view
         */
        changeView: function(new_view, link) {
            var self = this;
            logger.trace(`Changing to ${new_view}`);
            // clear current page intervals or timeouts before changing
            controller.onViewExit(controller.state);
            // set current controller state - aka. "what page am I on?"
            controller.state = new_view;
            // start or clear any timeouts as required for each view
            // controller.onViewEnter(new_view);
            
            // show sidebar (don't hide previous view)
            if(new_view === "#sidebar") {
                view.toggleSidebar();
                return;
            }
            // clear the cached list of devices 
            if(new_view === "#clear-cache") {
                if(view.getClosest(link, "#sidebar")!==null) {
                    view.toggleSidebar();
                }
                _app.clearCache();
                return;
            }
            // set to default if view not found
            if(!new_view) {
                new_view = _app.getSettings("defaultView");
            } else if(!document.querySelector(new_view)) {
                new_view = _app.getSettings("defaultView");
            }
            // change to new view by default
            // or fire off functions specific to requested view
            switch(new_view) {
                case "#connecting":
                    view.find("#connecting .ssid").innerText = link.dataset.name;
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
                    _app.setState("deviceScanCancelled", false);
                    // scan for devices
                    Devices.getNetworkDevices();
                    self.show("#devices_title");
                    self.hide(new_view + " [data-reload]");
                    self.show(new_view);
                break;

                case "#add-device":
                    self.hideAll();
                    self.show(new_view);
                    view.find(new_view + " [data-reload]").classList.add("d-none");
                    Devices.checkForNewDevices();
                break;

                case "#accesspoints":
                    self.hideAll();
                    if(link.dataset.name) {
                        var name = _app.setState("selectedHotspot", link.dataset.name);
                        view.find("#selectedDevice").innerText = name;
                    }
                    controller.stopLoader();
                    self.show(new_view);
                    // show the list of access points to choose from
                    Wifi.displayAccessPoints();

                    // update accespoint list at intervals
                    var interval = setInterval(function() {
                        controller.startLoader();
                        Devices.checkForNewDevices().then(()=> {
                            Wifi.displayAccessPoints();
                        }).finally(()=> {
                            controller.stopLoader();
                        });
                    }, _app.getSettings("apScanIntervalDelay"));
                    
                    // store interval reference to enable abort
                    _app.setState("apScanIntervalId", interval);
                break;

                case "#accesspoint_password":
                    controller.stopLoader();
                    self.hideAll();
                    self.show(new_view);
                    
                    // recall saved password
                    var passwordList = _app.load('ssid') || {};
                    if(passwordList.hasOwnProperty(link.dataset.ssid)) {
                        view.find("#psk").value = passwordList[link.dataset.ssid];
                        view.find("#save-psk").checked = true;
                    }

                    // display selected ssid and set value in hidden form field
                    view.find("#accesspoint_password .ssid").innerText = link.dataset.ssid;
                    view.find("#accesspoint_password #ssid_input").innerText = link.dataset.ssid;
                    
                    // pass ssid to next view (if button clicked)
                    view.find("#accesspoint_password #save_auth").dataset.ssid = link.dataset.ssid;
                    _app.setState("deviceConnectionSSID", link.dataset.ssid);
                break;

                case "#mqtt":
                    // connect device to mqtt service
                    self.hideAll();
                    self.show(new_view);
                    var name = _app.getState("selectedHotspot"), type, icon_name;
                    [type,icon_name] = Devices.getDeviceType(name);
                    view.find("#mqtt #device-name").innerHTML = `
                        <span>
                            ${view.icon(icon_name)}
                            ${name}
                        </span> `;

                    view.find("#dashboard_username").value = _app.getState("dashboard_username") || "";
                    view.find("#dashboard_password").value = _app.getState("dashboard_password") || "";
                    document.addEventListener("input", controller.handleInput, false);
                    controller.alterMqttSaveButton(view.find("#dashboard_username"));
                    controller.stopLoader();
                break;

                case "#saving":
                    var dashboard_username = view.find("#mqtt #dashboard_username").value;
                    var dashboard_password = view.find("#mqtt #dashboard_password").value;
                    // todo: santize and store username and password inputs!!

                    // set title for #saving view
                    var name = app.getState("selectedHotspot"), type, icon;
                    [type,icon] = Devices.getDeviceType(name);
                    view.find("#saving #device-name").innerHTML = `
                        <span>
                            ${view.icon(icon)}
                            ${name}
                        </span> `;
                    
                    // before displaying #saving view authenticate with web api
                    // login to remote server to get user's api key

                    // disable button once clicked to avoid duplicate requests
                    link.setAttribute("aria-disabled", true);
                    view.setText(link, "Authenticating");
                    link.classList.add('blink');
                    controller.startLoader();

                    // authenticate with web api
                    logger.trace(`/auth api called...`);

                    controller.startLoader();
                    var savingButton = view.find('#indicator');

                    // abort auth after 6s
                    var auth_abort = setTimeout(function() {
                        controller.show_saved_failed(savingButton, "Auth timed out!").then(()=>{
                            view.changeView("#not_saved", savingButton);
                        });
                    }, 6000);

                    _app.authenticate(dashboard_username, dashboard_password).then(response=> {
                        _app.setState("dashboard_username", "");
                        _app.setState("dashboard_password", "");
                        logger.info(`/auth api response: ${response.data}`);
                        // todo: save dashboard_username and dashboard_password to localstorage
                        clearTimeout(auth_abort);

                        // if http request successful, check response
                        if(_app.authenticatedSuccessfully(dashboard_username, dashboard_password, response)) {
                            // auth successful
                            view.setText(link, "Authenticated ✔");
                            setTimeout(()=> {
                                self.hideAll();
                                view.resetOriginalText(link);
                                self.show(new_view);
                            }, 1800);

                            // abort save after 10s
                            var devices_abort = setTimeout(function() {
                                controller.show_saved_failed(savingButton, "Device did not respond!").then(()=>{
                                    view.changeView("#not_saved", savingButton);
                                });
                            }, 10000);

                            // connect to device hotspot and save values on device via api
                            Devices.saveToDevice()
                                .then(save_response=> {
                                    controller.onSaveToDevice(savingButton, save_response, devices_abort);
                                })
                                .catch(error=> {
                                    // not timed out. other error
                                    clearTimeout(devices_abort);
                                    logger.error(`saveToDevice() failed!: ${error}`);
                                    controller.show_saved_failed(savingButton, error).then(()=>{
                                        view.changeView("#not_saved", savingButton);
                                    });
                                })
                                .finally(()=> {
                                    savingButton.classList.remove("blink");
                                    savingButton.removeAttribute('aria-disabled');
                                })
                        } else {
                            // auth failed
                            view.setText(savingButton, "Failed");
                            logger.error("Authentication failure!")
                            savingButton.classList.remove("blink");
                            savingButton.removeAttribute("aria-disabled");
                            setTimeout(function(){
                                view.resetOriginalText(savingButton);
                            }, 1800);
                        }
                    })
                    .catch(auth_response=>{
                        clearTimeout(auth_abort);
                        logger.error(auth_response);
                        logger.warn(`Web authentication failed! : (${auth_response.status}) "${JSON.stringify(auth_response.data)}"`);
                        var data = auth_response.data;
                        try{
                            if (typeof data === "string") {
                                data = JSON.parse(auth_response.data);
                            }
                        } catch(error) {
                            logger.trace(JSON.stringify(auth_response));
                            logger.error(`Error parsing auth response!: ${error.message}`);
                        }
                        if(auth_response.status === 401) {
                            // continue without mqtt authentication...
                            view.hideAll();
                            view.show("#saving");
                            Devices.saveToDevice({mqtt: false}).then(save_response=>{
                                controller.onSaveToDevice(savingButton, save_response, auth_abort);
                            })
                            .catch(status=> {
                                logger.error(`Error saving settings to device! status: ${status}`);
                            });
                        } else if (data && data.success === false) {
                            // http success - promise reject caught...
                            view.setText(link, "Failed!");
                            view.setText(view.find('[for="dashboard_username"] small'), data.message);
                        }
                        // remove error message on button and reset text
                        setTimeout(function(){
                            view.resetOriginalText(link);
                        }, 1800);
                    })
                    .finally(()=>{
                        controller.stopLoader();
                        link.classList.remove('blink');
                        link.removeAttribute('aria-disabled');
                    });
                break;
                /**
                 * re-shows the welcome screen if already seen
                 * not full view. just an additional header
                 */
                case "#welcome":
                    if(view.getClosest(link, "#sidebar") !== null) {
                        self.toggleSidebar();
                    }
                    _app.save("welcome_seen", false);
                    // re-show first view only if link clicked
                    if(typeof link !== "undefined") {
                        view.hideAll()
                        controller.firstPage();
                    }
                    break;
                case "#saved":
                    // only show link to dashboard if successfully authenticated
                    self.hideAll();
                    self.show(new_view);
                    if(_app.getState("authenticated")) {
                        view.show("#saved #authenticated");
                        view.show("#saved #dashboard_link");
                    }
                break;
                case "#disconnected":
                    logger.trace("reload network status...");
                    Wifi.getStatus()
                    .then(function(network){
                        logger.info(`Wifi status: ${JSON.stringify(network)}`);
                        // All ok continue to first page
                        view.hideAll();
                        controller.firstPage();
                    }).catch(error=>{
                        view.hideAll();
                        // still not connected. show error page
                        view.show("#disconnected");
                        logger.fatal(`Network problem!: ${error}`);
                    });
                break;
                case "#reconnect":
                    logger.trace("Attempting to re-enable wifi...");
                    Wifi.enable().then(()=>{
                        logger.info("Wifi Enabled!");
                        controller.firstPage();
                    }).catch(error=>{
                        logger.fatal(`Error enabling Wifi!: ${error}`);
                        // still not connected. show error page
                        view.show("#disconnected");
                    });
                break;
                default:
                    self.hideAll();
                    self.show(new_view);
            }
            logger.debug(`view: Changed to ${new_view}`);
        },
        tick_item: function(selector) {
            // add delay to allow user to read items
            setTimeout(function(){
                view.find(selector).classList.add("done");
            }, 900)
        },
        cross_item: function(selector) {
            view.find(selector).classList.add("fail");
        }
    }
    return _;
})();




/**
 * handling clicks and events, changing pages and what code is executed on each view
 * view.changeView() is used to call app methods based on what is clicked/loaded
 * @see view.changeView()
 * @constructor
 */
var controller = (function() {
    var _ = {
        current_view: "",
        default_view: "",
        init: function(default_view) {
            logger.info("---CONTROLLER METHODS INITIALIZED");
            this.current_view = default_view;
            this.default_view = default_view;
            view.hideAll();
            this.bindEvents();
        },
        /**
         * Creates event handlers for all `&lt;a&gt;` tags
         * @memberof controller
         */
        bindEvents: function() {
            // handle click events of every link in page
            view.findAll('a').forEach(item=> {
                item.addEventListener('click', (event) => {
                    this.onClick(event);
                });
            });
            // handle click events for items not yet added to list
            view.findAll('.list').forEach(item=> {
                item.addEventListener('click', this.onClick);
            });
            view.findAll('[data-show-password]').forEach(item=> {
                item.addEventListener('click', view.togglePasswordVisible);
            });
        },
        /**
         * shows the welcome screen if not seen or shows `defaultView`
         * @alias Controller.firstPage
         */
        firstPage: function() {
            view.hideAll();
            // default view
            if(!app.load("welcome_seen")) {
                // slide in the welcome text
                view.show("#welcome");
                view.addClass(view.find("#welcome"), "in");
                // remove view title when welcome page in view
                view.hide(this.default_view + "_title");
                // scan for devices
                Devices.getNetworkDevices();
            } else {
                // show the devices title. set to be hidden by default
                view.show(this.default_view + "_title");
            }
            
            // if fails to get wifi info - show the offline page
            // todo: show local stored devices from previous scan?
            var default_view = this.default_view;
            Wifi.getStatus()
                .then(function(network){
                    logger.info(`Wifi status: ${JSON.stringify(network)}`);
                    // All ok continue to first page
                    view.show(default_view);
                }).catch(error=>{
                    // still not connected. show error page
                    view.show("#disconnected");
                    logger.fatal(`Network problem!: ${error}`);
                });

            // if firstpage is the devices list
            if("#devices" === this.default_view) {
                // display any cached entries if available
                let list = view.find("#devices nav.list");
                let items = Devices.getStoredDevices();
                view.displayDevices(list, items);
                // begin scan for new devices. save results
                Devices.getNetworkDevices();
                // store toggle value to localstorage so it is remembered between sessions
            }
        },
        /**
         * Main navigation handler (similar to front controller in php)
         * handles link clicks and shows/hides sections based on the link's href attr
         * @param {Event} event Mouse Click event
         * @alias Controller.onClick
         */
        onClick: function(event) {
            logger.trace(`CLICK-${event.target.tagName} "${event.target.innerText}"`)
            event.preventDefault();
            var link = event.target;
            if (link.tagName !== "A") {
                link = view.getClosest(event.target, "a");
            }
            if (!link || link.classList.contains('active')) {
                return;
            }

            // open external links in browser
            // todo: check href starts with http:// as well as data-weblink attribute
            if(link.hasAttribute('data-weblink')) {
                controller.onExternalLinkClick(event);
                return;
            }
            // close overlay clicked
            if(link.hasAttribute('data-close')) {
                view.getClosest(link, ".fade").classList.remove("in");

                // view specific..
                if(this.current_view === "#devices") {
                    view.show("#devices_title");
                }
                if(link.hash === "#close-welcome") {
                    // mark welcome screen as seen
                    app.save("welcome_seen", true);
                }
                return;
            }
            // open view that matches link's href attribute
            var href = link.hash;
            // no "#reload" view. just do the re loading
            if(href === "#reload") {
                logger.warn("-".repeat(20));
                logger.warn("    App Reloaded");
                logger.warn("-".repeat(20));
                window.location.reload();
            
            } else {
                // show the new view
                view.changeView(href, link);
            }
        },
        onExternalLinkClick: function(event) {
            event.preventDefault();
            var url = view.getClosest(event.target, "a").href;
            logger.info(`External link clicked: ${url}`);
            if(url) window.open(url, '_system', 'location=yes');
        },
        /**
         * handle the onInput event of input fields.
         * checks id of input field before triggering action
         * @param {KeyboardEvent} - event triggers on key up of all elements.
         */
        handleInput: function(event) {
            const target = event.target;
            switch(target.id) {
                case "dashboard_username":
                    controller.alterMqttSaveButton(target);
            }
            
        },
        /**
         * called to stop wating timeouts once view is quit
         * timeouts should only be created for specific pages/view
         * run on exit of view (before next view code)
         * 
         * called before changing to next page
         * @param {String} CSS selector for current page (before moving to next)
         * @alias Controller.onViewExit
         */
        onViewExit: function(previous_view) {
            switch(previous_view) {
                case "#devices":
                    logger.debug(`--- LAN SCAN LOOP stopped`);
                    clearTimeout(app.getState("deviceScanRepeatObj"));
                    break;
                case "#add-device":
                    // interval removed for looping timeout. checks for current view name before repeating
                    break;
                case "#accesspoints":
                    // stop scanning for access points
                    clearInterval(app.getState("apScanIntervalId"));
                    break;
                case "#saving":
                    var link = view.find("#saving #indicator");
                    view.resetOriginalText(link);
                    break;
                case "#mqtt":
                    document.removeEventListener("input", controller.handleInput, false);
                    break;
            }
        },
        /**
         * Displays a loading animation
         * @alias Controller.startLoader
         * @param {String} action Text to show as action begins
         */
        startLoader: function(action) {
            logger.trace(`Ajax loader started-----`);
            view.find("#loader-animation").classList.add("in");
            controller.setLoader(action || 'Loading...');
        },
        /**
         * stops/hides the loading animation
         * @alias Controller.stopLoader
         */
        stopLoader: function() {
            logger.trace(`Ajax loader stopped-----`);
            view.find("#loader-animation").classList.remove("in");
            controller.setLoader("");
        },
        /**
         * Show current loading state as text.
         * Changed to only be used as element title. might re-work into design
         * @param {String} text text to show the user as loader begins or closes
         * @alias Controller.setLoader
         */
        setLoader: function(text) {
            app.setState("ajaxLoaderText", text);
            view.find("#loader-animation").title = text;
        },
        onSaveToDevice: function(savingButton, save_response, abort) {
            // successfully saved to device. stop timeout counter
            clearTimeout(abort);
            controller.show_saved_success(savingButton, save_response).then(()=>{
                Wifi.removeAccessPoint(app.getState("selectedHotspot"));
                app.setState("selectedHotspot", false);
                view.changeView("#saved"); 
            });
        },
        /**
         * device settings successfully saved. show message and reset text after delay
         * @alias Controller.show_saved_success
         */
        show_saved_success: function(button, response) {
            app.log('savetodevice success', response);
            // reset ajax loader animation
            view.setText(button, response);
            // progress after 5s delay
            return new Promise(resolve => {
                setTimeout(function() {
                    view.find("#psk").value = "";
                    controller.stopLoader();
                    view.resetOriginalText(button);
                    resolve("Moving to success screen...");
                }, 5000);
            });
        },
        /**
         * device settings problem saving. show message and reset text after delay
         * @alias Controller.show_saved_failed
         */
        show_saved_failed: function(button, error) {
            logger.error(`Failed to save to device: ${error}`);
            // reset ajax loader animation
            view.setText(button, "Failed!");
            var listItem = view.find("#connect_device");
            // progress to error message after 5s delay
            return new Promise(resolve => {
                setTimeout(function() {
                    controller.stopLoader();
                    view.removeClass(listItem, "failed");
                    view.resetOriginalText(button);
                    resolve("Moving to fail screen...");
                }, 5000);
            })
        },
        /**
         * if input value not empty change the skip button to "Next"
         * @param {HTMLElement} <input> that triggered the callback
         * @alias Controller.alterMqttSaveButton
         */
        alterMqttSaveButton: function(formInput) {
            const LABEL_SKIP = "Skip";
            const button = view.find("#saving_button");

            if(formInput.value.length > 0) {
                view.resetOriginalText(button);
            } else {
                view.setText(button, LABEL_SKIP);
            }
        }
        
    }
    return _;
})();






/**
 * App - main settings and methods of app.
 * 
 * Stores all app state/variable changes
 * @constructor
 * @alias App
 */
var app = {
    version: typeof APP_VERSION !== "undefined" ? APP_VERSION: '',
    scan_retries: 0,
    scan_counter: 0,
    // defaults overwritten by altering _SETTINGS
    settings: Object.assign( {}, {
                log_level: logger.levels.TRACE,
                defaultView: "#devices",
                deviceScanTimeout: 3000,
                deviceScanRepeat: 2000,
                deviceApScanRepeat: 5000,
                deviceApScanMaxRetries: 8,
                device_ssid_pattern: /^(smartplug|wifirelay|hpmon|openevse|meterreader|emonpi|emoncms|emonbase).*$/g,
                apScanIntervalDelay: 4000
            }, _SETTINGS
        )
    ,
    state: {
        devices: [],
        accessPoints: [],
        hotspots: [],
        online: false,
        currentSSID: false,
        currentIP: false,
        selectedHotspot: false,
        deviceConnectionSSID: false,
        deviceConnectionPsk: false,
        deviceScanRepeatObj: false,
        deviceScanCancelled: false,
        deviceApScanRepeatObj: false,
        deviceApScanRetries: 0,
        apScanIntervalId: false
    },
    // list of all views to hide initially
    // todo: automatically create this list by searching the page for <section> tags
    views : [
        "#welcome",
        "#devices",
        "#add-device",
        "#add-device-failed",
        "#accesspoints",
        "#accesspoint_password",
        "#mqtt",
        "#saving",
        "#saved",
        "#not_saved",
        "#disconnected"
    ],

    initialize: function() {
        document.addEventListener('deviceready', this.onDeviceReady.bind(this), false);
    },
    
    onDeviceReady: function() {
        // populate global variables
        // view = new View(); // handle dom changes
        logger.setLevel(app.settings.log_level); // overwrite the default log level with app settings value
        view.init(app);
        controller.init(app.getSettings('defaultView'));
        // ready.
        logger.debug('Cordova JS Ready');
        window.open = cordova.InAppBrowser.open;
        
        // add mobile system events
        document.addEventListener("reload", Wifi.getStatus, false);//window.location.reload(true);
        document.addEventListener("connect", Wifi.getStatus, false);
        document.addEventListener("offline", Wifi.onOffline, false);
        document.addEventListener("online", Wifi.onOnline, false);

        // load stored devices
        app.setState("devices", app.loadList("devices"));
        app.setState("accessPoints", Wifi.filterLatestAccessPoints(app.loadList("accessPoints")));
        // show welcome page
        
        // get network status
        Wifi.getStatus().then(function(network){
            logger.info(`Wifi status: ${JSON.stringify(network)}`);
            controller.firstPage();
        }).catch(error=>{
            view.changeView("#disconnected");
            logger.fatal(`Network problem!: ${error}`);
        });

        // todo: update wifiwizard2 plugin once android 10 supported
        //       - android 10 doesn't allow apps to create & drop wifi connections as
        // hide links unsupported by android 10
        if (device.platform === 'Android' && Number(device.version) > 9) {
            document.querySelectorAll('.add-new-link').forEach(elem => {
                elem.classList.add('d-none');
            });
        }
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
        } else if(value == null) {
            logger.trace(`SET STATE: app.state.${key} = "[null]"`);
        } else {
            logger.trace(`SET STATE (obj): app.state.${key} = OBJECT.length:${(value).length}`);
        }
        try {
            app.state[key] = value;
            return value;
        } catch (error) {
            app.showError('setState:', error);
        }
    },
    
    

    /**
     * Store data to localStorage
     * @param {String} key name of item
     * @param {*} value value of item
     * @returns {*} Boolean true if success else error
     */
    save: function(key, value) {
        logger.trace(`Saving "${key}" to localStorage`);
        var storage = window.localStorage;
        try {
            return typeof storage.setItem(key, JSON.stringify(value)) === "undefined";
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
        logger.trace(`Loading "${key}" from localStorage`);
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
        view.find(state + " .list").innerHTML = "<p>Cached list of devices cleared</p>";
        // change to devices view
        view.hideAll();
        view.show(state);
        view.show(state + " #devices_title");
        // show reload button
        view.show(state + " [data-reload]");
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
        if(app.getState('debugMode')===true) {
            logger.error(error);
        }
    },
    log: function(message) {
        // todo: store log
        logger.debug('call stack:', new Error().stack);
        if(app.getState('debugMode')===true) {
            logger.info(message);
        }
    },
    /**
     * get a response from the web service used to authenticate the user
     * 
     * @param {String} username 
     * @param {String} password
     * @returns {(Promise<Success>|Promise<Fail>)}
     */
    authenticate: function(username, password) {
        logger.trace("Auth started...");
        // skip authenticate if username empty
        if (username.trim().length===0) {
            failed = {
                status: 401,
                error: "Empty username. Auth request not sent",
                url: false,
                headers: {},
                data: {success: false, message: ""}
            }
            logger.trace(`Auth aborted! Empty Username`);
            return Promise.reject(failed);
        }

        return new Promise((resolve, reject) => {
            var auth_endpoint = "https://dashboard.energylocal.org.uk/user/auth.json";
            var headers = {};
            var body = {username: username, password: password};
            logger.trace(`sending "${JSON.stringify(body)}" to: "${auth_endpoint}"`);
            cordova.plugin.http.post(auth_endpoint, body, headers,
                /** @param {Success} response */
                function(response) {
                    var data = JSON.parse(response.data);
                    logger.trace(`Received: ${JSON.stringify(data)}`);
                    if(data.success) {
                        resolve(response);
                    } else {
                        reject(response);
                    }
                },
                /** @param {Fail} response */
                function(response) {
                    logger.trace(`Failed: ${JSON.stringify(response)}`);
                    reject(response);
                }
            );
        })
    },
    authenticatedSuccessfully: function(username, password, response) {
        if(response.status >= 200 && response.status <= 300) {
            // auth successful
            var data = false;
            try{
                data = JSON.parse(response.data);
                app.setState('authenticated', data.success===true);
                app.setState("dashboard_username", username);
                app.setState("dashboard_password", password);
                app.setState("dashboard_userid", data.userid);
                app.setState("dashboard_apikey_write", data.apikey_write);
                logger.trace("Successfully read auth response json");
                return true;
            } catch(error) {
                logger.error(`Error parsing authentication response! ${error}`);
                return false;
            }
        } else {
            // auth http request response code not within acceptible range
            logger.fatal("Authentication service not responding correctly");
            return false;
        }
    }
};



/**
 * Collection of methods and properties for managing connections Wifi access points
 * @class
 */
var Wifi = (function() {
    return {
        /**
         * request a scan and return a promise
         * @memberof Wifi
         * @returns {Promise<Network>} 
         */
        scan: function() {
            return WifiWizard2.scan();
        },
        /**
         * 
         * @param {String} ssid SSID of wifi ap - REQUIRED
         * @param {String} password password for connection - not needed for open network
         * @param {String} algorithm "WPA"|"WEP" - not needed for open network
         * @returns {Promise<String>} WifiWIzard2.connect() promise
         * @memberof Wifi
         * @see {@link https://github.com/tripflex/wifiwizard2#readme|WifiWizard2 Docs}
         */
        connect: function(ssid, password, algorithm) {
            logger.debug(`Connecting to SSID: "${ssid}"...`);
            var bindAll = true;
            // connect without password
            if(!password) {
                password = null;
                algorithm = null;
            }
            if (!ssid) {
                logger.error("no SSID passed!");
                return Wifi.disconnect();
            }
            return WifiWizard2.connect(ssid, bindAll, password, algorithm);
        },
        /**
         * Enables the wifi on the device
         * @returns {Promise} 
         * @memberof Wifi
         */
        enable: function() {
            return WifiWizard2.enableWifi();
        },
        /**
         * disconnect from current SSID. if no ssid passed it will attempt to re-connect on previous connection
         * 
         * @returns {Promise}
         * @memberof Wifi
         * @see [WifiWizard2 Docs]{@link https://github.com/tripflex/WifiWizard2#disconnect-vs-disable}
         * "...ssid is OPTIONAL .. if not passed, will disconnect current WiFi (almost all Android versions now will just automatically reconnect to last wifi after disconnecting)..."
         */
        disconnect: function() {
            return WifiWizard2.disconnect();
        },
        /**
         * checks that SSID is unique before adding to the list
         * adds lastSeen property to aid in caching
         * adds strength property
         * adds rating property
         * @memberof Wifi
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
            if (!app.save("accessPoints", accessPoints)) {
                app.showError("Error saving accessPoints to local store");
            }
            return accessPoints;
        },
        /**
         * returns true if given access point in not already known by app
         * @memberof Wifi
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
         * Display a list of Access Points to select from.
         * 
         * Only used in #accesspoints view
         * @memberof Wifi
         */
        displayAccessPoints: function() {
            /** @type {Array.Network} */
            var accessPoints = app.getState("accessPoints");
            /** @type {HTMLElement} */
            var list = view.find("#accesspoints .list");
            if (!accessPoints) accessPoints = [];
            var pattern = app.getSettings("device_ssid_pattern");
            // filtered access points to NOT show device hotspots (only standard wifi connections)
            var filtered = accessPoints.reduce((aps, ap) => {
                var found = ap.SSID.match(pattern);
                if (!found) {
                    aps.push(ap);
                }
                return aps;
            }, []);
            logger.debug(`displayAccessPoints(): found ${filtered.length}`);
            // Access point(s) ?
            var _aps = filtered.length === 1 ? "Access point": "Access points";
            list.innerHTML = `<p>Found ${filtered.length} ${_aps}</p>`;
            
            // sort the accesspoints by strength level
            filtered.sort((a,b)=> b.level - a.level);
            
            logger.trace(filtered);
            // show each wifi connection as individual link
            filtered.forEach(ap => {
                var item = document.createElement('div');
                var wpa, ess, wps;
                [wpa, ess, wps] = Wifi.getApCapabilities(ap);
                var title = ap.SSID === "" ? `<span class="text-muted">${ap.BSSID}</span>`: ap.SSID;
                var css = ap.SSID === app.getState("currentSSID") ? 'current': '';
                
                logger.trace(`Displaying AP: ${title} (${ap.rating}/5)`)
                item.innerHTML = `<a href="#accesspoint_password" data-ssid="${ap.SSID}" data-wpa="${wpa}" class="${css}">
                                    <span>${title}<!--small class="badge text-muted">${wps}</small--></span>
                                    <progress max="5" value="${ap.rating}" title="${ap.strength}">
                                        ${ap.level}dBm
                                    </progress>
                                </a>`;
                list.append(item.firstElementChild);
            });
        },
        /**
         * Get wpa,ess and wps status for access point
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
         * @memberof Wifi
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
         * Return strength and rating for given ap.level value.<br>
         * 
         * Strength is given as text eg. "Very Good"<br>
         * rating is given as integer [1-5]<br>
         * 
         * reference table of values gained from metageek.com
         * @param {Network} ap
         * @memberof Wifi
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
         * Will check the lastSeen prop to test validity. removing old entries.
         * loads previous results from app state/local store
         * @param {Array} accessPoints - access points to add 
         * @param {Array} cache - list already stored from previous scan
         * @memberof Wifi
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
        },
        /**
         * Once new device added, the saved accesspoint can be removed.
         * @param {String} ssid name of accesspoint to remove from list
         * @memberof Wifi
         */
        removeAccessPoint: function(ssid) {
            const accessPoints = app.getState("accessPoints");
            if(!ssid || !accessPoints) return;
            logger.trace(`Removing "${ssid}" from list of accessPoints`);
            app.setState("accessPoints", accessPoints.reduce((list, ap) => {
                if (ap.SSID!==ssid) list.push(ap);
                return list;
            }, []));
        },
        /**
         * returns promise with bool as parameter in sucessful then()
         * @memberof Wifi
         * @returns {Promise<Boolean>}
         */
        isWifiEnabled: function() {
            return WifiWizard2.isWifiEnabled();
        },
        /**
         * toggle connectivity state and show result
         * @memberof Wifi
         * @param {Boolean} isOnline - true = is online ok
         */
        setIsConnected: function(isOnline) {
            app.setState("online", isOnline);
            view.setText(view.find("#connected"), isOnline ? 'YES': 'NO');
        },
        /**
         * @memberof Wifi
         * @param {String} ssid display the currently connect ssid in the sidebar
         */
        setCurrentSSID: function(SSID) {
            var ssid=SSID || "None";
            app.setState("currentSSID", ssid);
            view.setText(view.find("#currentSSID"), ssid);
        },
        /**
         * Display given ip address in the sidebar
         * @memberof Wifi
         * @param {String} ip address to show in the sidebar
         */
        setCurrentIP: function(IP) {
            var ip=IP || "0.0.0.0";
            app.setState("currentIP", ip);
            view.setText(view.find("#currentIP"), ip);
        },
        /**
         * Call the system api to get the curent ip address
         * @memberof Wifi
         * @returns {Promise}
         */
        getWifiIP: function() {
            return WifiWizard2.getWifiIP();
        },
        /**
         * get the currently connected SSID. save to app.state and update view
         * @alias Wifi.getCurrentSSID
         */
        getCurrentSSID: function() {
            return WifiWizard2.getConnectedSSID()
        },
        /**
         * collect current wifi state to show in settings
         * @alias Wifi.getStatus
         */
        getStatus: function() {
            var requests = [];
            var responses = [];
            logger.trace("Checking Wifi status...");
            
            return new Promise((resolve, reject) => {
                var network = {
                    wifi: false,
                    ip: "",
                    ssid: ""
                }
                const promise1 = Wifi.isWifiEnabled().then(isEnabled => {
                    logger.trace(`Wifi isEnabled? ${isEnabled}`);
                    network.wifi = isEnabled;
                    Wifi.setIsConnected(isEnabled);
                });

                const promise2 = Wifi.getWifiIP().then(ip=> {
                    logger.trace(`Current IP: "${ip}"`);
                    network.ip = ip;
                    Wifi.setCurrentIP(ip);
                });

                const promise3 = Wifi.getCurrentSSID().then(ssid=> {
                    logger.trace(`Current SSID: "${ssid}"`);
                    network.ssid = ssid;
                    Wifi.setCurrentSSID(ssid);
                });

                // wait for all promises to resolve
                Promise.all([promise1, promise2, promise3]).then((values) => {
                    resolve(network);
                }).catch(error=> {
                    Wifi.setIsConnected(false);
                    Wifi.setCurrentIP();
                    Wifi.setCurrentSSID();
                    reject(error);
                });
            });
        },
        /**
         * Show connection issue error message to user - Offline Event Callback
         * @see [Cordova docs]{@link https://cordova.apache.org/docs/en/latest/reference/cordova-plugin-network-information/index.html#offline}
         * @memberof Wifi
         */
        onOffline: function() {
            logger.info("offline");
            view.changeView("#disconnected");
        },
        /**
         * Show connection issue message to user - Online Event Callback
         * @see [Cordova docs]{@link https://cordova.apache.org/docs/en/latest/reference/cordova-plugin-network-information/index.html#online}
         * @memberof Wifi
         */
        onOnline: function() {
            logger.info("online");
            // changing to this view tests the current connection
            view.changeView("#disconnected");
        }
    }
})();

/**
 * Collection of methods and properties for managing Devices
 * @class
 */
var Devices = (function() {
    return {
        /**
         * starts zeroconfScan.
         * @returns {Promise<Success>} 
         * @alias Devices.checkForNewDevices
         */
        getNetworkDevices: function (counter) {
            if (!counter) counter = 0;
            controller.startLoader(`Searching for devices on the network (${counter})...`);
            logger.info(`--- LAN SCAN started(${counter++})`);
            Devices.zeroconfScan()
                .then(()=> {
                    controller.stopLoader();
                })
                .catch(error=> {
                    app.showError(`Error scanning network!:${error}`);
                    controller.stopLoader();
                })
                .finally(devices => {
                    var delay = app.getSettings("deviceScanRepeat");
                    logger.debug(`--- zeroconf scan ended after ${delay}ms: Found ${devices?devices.length:0} devices`);
                    // repeat the scan after delay - only if in "device scan" tab
                    if(controller.state === "#devices" && !app.getState("deviceScanCancelled")) {
                        logger.trace("network re-scan scheduled");
                        let timeout = setTimeout(function() {
                            Devices.getNetworkDevices(counter++);
                        }, delay);
                        app.setState("deviceScanRepeatObj", timeout);
                    } else {
                        logger.trace("network re-scan not scheduled");
                        controller.stopLoader();
                    }
                });
        },
        /**
         * save discovered device to list and update view
         * @param {Zeroconf_Scan_Result} result
         * @alias Devices.updateDevicesList
         */
        updateDevicesList: function(result) {
            var device = Devices.parseDevice(result);
            Devices.saveDevice(device);
            view.displayDevices();
        },
        /**
         * Add a device if not already present
         * store all devices to localStorage
         * @alias Devices.saveDevice
         * @param {Device} device with ip,name,url etc
         */
        saveDevice: function(device) {
            if(device && device.ip) {
                var saved_devices = Devices.getStoredDevices();
                var devices = Devices.updateDevices(saved_devices, [device]);
                app.setState("devices", devices);
                if (!app.save("devices", devices)) {
                    app.showError("Error saving devices");
                }
            }
        },
        /**
         * scan wifi, save results, filter results to only show device hotspots and
         * @alias Devices.checkForNewDevices
         */
        checkForNewDevices: function() {
            logger.info(`--- WIFI SCAN STARTED (${app.getState("deviceApScanRetries")})`);
            controller.startLoader("Searching for new devices in range...");
            return Wifi.scan()
                .then(accessPoints=> {
                    logger.info("--- WIFI SCAN COMPLETE");
                    return Wifi.setAccessPointTTL(accessPoints);
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
                    if(controller.state === "#add-device" || controller.state === "#accesspoints") {
                        // increment counter
                        app.setState("deviceApScanRetries", app.getState("deviceApScanRetries") + 1);
                        // test if counter reached max
                        if(app.getState("deviceApScanRetries") <= app.getSettings("deviceApScanMaxRetries")) {
                            WifiWizard2.timeout(app.getSettings("deviceApScanRepeat"))
                            .then(function() {
                                // re-scan by calling this function again
                                Devices.checkForNewDevices();
                            });
                        } else {
                            controller.stopLoader();
                            logger.debug("Max AP scan retries reached!")
                            app.showError("Max AP scan retries reached!", app.getSettings("deviceApScanMaxRetries"));
                            view.show("#add-device [data-reload]");
                            app.setState("deviceApScanRetries", 0);
                            if(app.getState("hotspots").length === 0) {
                                app.setState("deviceApScanRetries", 0);
                                logger.debug("No hotspot found!");
                                controller.stopLoader();
                                // view.changeView("#add-device-failed");
                            }
                        }
                    } else {
                        logger.trace("WiFi scan not repeated. Not in correct view.");
                    }
                })
                .catch(error=> {
                    // SCAN_FAILED error code returned. see docs for reference
                    /**
                     * @see [WifiWizard2 docs]{@link https://github.com/tripflex/WifiWizard2#global-functions}
                     */
                    if(error === "SCAN_FAILED") {
                        var delay = 3 * app.getSettings("deviceApScanRepeat");
                        logger.error(`SCAN_FAILED! Waiting ${delay}ms before retry...`);
                        // increment counter
                        app.setState("deviceApScanRetries", app.getState("deviceApScanRetries") + 1);
                        // test if counter not reached max repeat
                        if(controller.state === "#add-device" || controller.state === "#accesspoints") {
                            if(app.getState("deviceApScanRetries") <= app.getSettings("deviceApScanMaxRetries")) {
                                WifiWizard2.timeout(delay)
                                .then(function() {
                                    Devices.checkForNewDevices();
                                });
                            } else {
                                // max scans reached
                                logger.error("Max wifi scans reached");
                                controller.stopLoader();
                                app.setState("deviceApScanRetries", 0);
                                view.changeView("#add-device-failed");
                            }
                        } else {
                            logger.trace("Delayed WiFi scan not repeated. Not in correct view.");
                        }
                    }
                    // view.show("#add-device [data-reload]"); // show re-scan button
                    app.showError(`wifi scan (${app.getState("deviceApScanRetries")-1}): ${error}`);
                });
        },
        /**
         * returned a sorted list of devices already found
         * cleans out old results
         * @alias Devices.getStoredDevices
         */
        getStoredDevices: function() {
            var devices = app.getState("devices") || [];
            logger.debug(`getStoredDevices():found ${devices.length} devices`);
            // clear out old entries
            var results = Devices.removeExpired(devices);
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
         * @alias Devices.updateDevices
         */
        updateDevices: function(list1, list2) {
            // return list1 if both are identical
            if (!list1) list1 = [];
            if(JSON.stringify(list1)===JSON.stringify(list2)) return list1;
            
            // test list2 values against list1 values
            var list2 = list2.reduce((devices, device) => {
                if(app.deviceIsUnique(device, list1)) {
                    devices.push(device);
                } else {
                    if(app.deviceIsNewer(device, list1)) {
                        devices.push(device);
                    } else {
                        var old_device = Devices.findDevice(device.ip);
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
         * return given list of devices with expired entries removed
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
         * browse Bonjour devices on network for ip addresses
         * resolves returned promise once scan completes
         * rejects promise on timeout `deviceScanTimeout`
         * as new devices are found the view is updated if `_workstation` or `_http._tcp` devices found
         * @see view.displayDevices()
         * @alias Devices.zerconfScan
         * @returns {Promise}
         * @see {@link https://www.npmjs.com/package/cordova-plugin-zeroconf|zeroconf.watch() in docs for responses}
         */
        zeroconfScan: function() {
            var zeroconf = cordova.plugins.zeroconf;
            return new Promise((resolve, reject) => {
                zeroconf.reInit(function() {
                    zeroconf.registerAddressFamily = 'ipv4';
                    zeroconf.watchAddressFamily = 'ipv4';

                    zeroconf.watch('_workstation._tcp.', 'local.', device=> {
                        Devices.updateDevicesList(device);
                    });
                    zeroconf.watch('_http._tcp.', 'local.', device=> {
                        Devices.updateDevicesList(device);
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
                    }, app.getSettings("deviceScanTimeout"));
                });
            });
        },
        /**
         * get matching device from devices list based on ip address
         * @param {String} ip ipv4 address
         * @alias Devices.findDevice
         * @returns {Array<Object>} empty if not found. first match if any found.
         */
        findDevice: function (ip) {
            return app.getState("devices").reduce((devices, device)=> {
                if(device.ip === ip) {
                    devices.push(device);
                }
                return devices;
            }, []).shift();
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
        },
        /**
         * return processed device object
         * 
         * @param {Zeroconf_Scan_Result} result
         * @returns {Device}
         * @alias Devices.parseDevice
         * @see: [zeroconf plugin docs]{@link https://www.npmjs.com/package/cordova-plugin-zeroconf}
         */
        parseDevice: function(result) {
            var action = "";
            var service = {};
            if(result.hasOwnProperty('action')) {
                action = result.action
            }
            if(result.hasOwnProperty('service')) {
                service = result.service
            }
            
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
                if(!device.name.match(app.getSettings("device_ssid_pattern"))) {
                    return false;
                } else {
                    return device;
                }
            } else {
                return false;
            }
        },
        /**
         * connect and send information to device via wifi.
         * restore original ssid at end
         * 
         * shows progress to user of what has been completed
         * @param {Object} options
         * @alias Devices.saveToDevice
         */
        saveToDevice: function(options) {
            var default_options = {mqtt: true}
            if(typeof options === "object") {
                options = Object.assign({}, default_options, options);
            } else {
                options = default_options;
            }
            return new Promise((resolve, reject) => {
                // store settings on device
                app.setState("deviceConnectionPsk", view.find("#psk").value);
                const deviceConnectionSSID = app.getState("deviceConnectionSSID");
                // save accesspoint passkey locally
                var passwordList = app.load('ssid') || {};
                if(view.find("#save-psk").checked && deviceConnectionSSID) {
                    passwordList[deviceConnectionSSID] = app.getState("deviceConnectionPsk");
                } else {
                    delete passwordList[deviceConnectionSSID];
                }
                // save altered passwword list
                app.save('ssid', passwordList);

                // connect to device hotspot and save settings before reconnecting back to current wifi
                view.hide("#password-confirm");
                var selectedHotspot = app.getState("selectedHotspot");
                var html = "";
                // add grayed out items "todo". once done class "done" is added
                html += `
                    <li id="connect_device">Connecting to ${selectedHotspot}</li>
                    <li id="save_network_setting">Saving Network Settings</li>`;
                // show this option if mqtt auth successful
                if(options.mqtt !== false) {
                    html += `<li id="save_mqtt_settings">Saving Remote Settings</li>`;
                }
                html += `
                    <li id="restart_device">Restarting ${selectedHotspot}</li>
                    <li id="connect_original">Re-connecting WiFi</li>`;

                view.find("#saving .log").innerHTML= html;
                
                var currentItem = "#connect_device";
                Wifi.connect(selectedHotspot).then(res=>{
                    view.tick_item(currentItem);
                    logger.info(`connected to device ("${selectedHotspot}"): ${res}`);
                    Devices.saveNetworkSettings(res).then(res=> {
                        currentItem = "#save_network_setting";
                        logger.info(`network settings saved on device: ${res}`);
                        view.tick_item(currentItem);
                        Devices.saveMqttSettings(options.mqtt===false).then(res=>{
                            if(res!=="skipped") {
                                currentItem = "#save_mqtt_settings";
                                logger.info(`mqtt settings saved on device: ${res}`);
                                view.tick_item(currentItem);
                            }
                            Devices.rebootDevice().then(res=>{
                                currentItem = "#restart_device";
                                logger.info(`device reboot started: ${res}`);
                                view.tick_item(currentItem);
                                Wifi.disconnect().then(res=>{
                                    currentItem = "#connect_original";
                                    logger.info(`device disconnected: ${res}`);
                                    view.tick_item(currentItem);
                                    // response shown in clicked button
                                    resolve('Saved!');
                                });
                            });
                        });
                    }).catch(error=> {
                        view.cross_item(currentItem); // mark as failed in view
                        logger.error(`Error Saving network settings! ${error}`);
                    });
                });
            });
        },
        /**
         * Send GET requests to device once connected to it via wifi directly
         * @param {String} endpoint path to url endpoint
         * @param {Object} params key value pairs for values to send as query
         * @param {Object} headers key value pairs for headers to send with request
         * @returns {(String|Fail)} returns reponse body as string on success
         * @alias Devices.deviceInterface
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
                var device_abort = setTimeout(function(){
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
                            clearTimeout(device_abort);
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
                        error=> { clearTimeout(device_abort); reject(error) }
                    );
                }
            });
        },
        /**   
         * pass settings to EmonESP device using the api
         * default ip address for device once connected to hotspot is:
         *    192.168.4.1  (? might be different for other device types?)
         * @returns {Promise} 
         * @alias Devices.saveNetworkSettings
         * @see [EmonESP `handleSaveNetwork()` function]{@link https://github.com/openenergymonitor/EmonESP/blob/master/src/web_server.cpp#L159}
         * 
         */
        saveNetworkSettings: function() {
            logger.trace('saveNetworkSettings() started:');
            return new Promise((resolve, reject) => {
                // send details to device
                logger.trace('saveNetworkSettings: deviceInterface()');
                Devices.deviceInterface("savenetwork", {
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
                    throw `saveNetworkSettings(): error!: (${error.status}) "${error.error}"`;
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
         * @param {Boolean} skip this step if true
         * @returns {Promise} 
         * @alias Devices.saveMqttSettings
         * @see [EmonESP `handleSaveMqtt()` function]{@link https://github.com/openenergymonitor/EmonESP/blob/master/src/web_server.cpp#L218}
         * 
         */
        saveMqttSettings: function(skip) {
            if (skip === true) {
                logger.warn("Skipping saving MQTT details on device");
                return Promise.resolve("skipped");
            }
            return new Promise((resolve, reject) => {
                var mqtt_topic = view.find("#mqtt #mqtt_topic").value || "";
                var mqtt_server = view.find("#mqtt #mqtt_server").value || "dashboard.energylocal.org.uk";
                var mqtt_port = view.find("#mqtt #mqtt_port").value || "1883";
                var mqtt_username = view.find("#mqtt #mqtt_username").value || app.getState("dashboard_username");
                var mqtt_password = view.find("#mqtt #mqtt_password").value || "";

                // if authenticated via web service use response data, else use form data
                if (app.getState('authenticated')) {
                    var mqtt_topic = `user/${app.getState('dashboard_userid')}`;
                    var mqtt_password = app.getState("dashboard_apikey_write");
                } else {
                    logger.trace(`auth`)
                    app.showError(`user not authenticated!`);
                }
                // save mqtt settings to device
                var params = {
                    server: mqtt_server,
                    topic: mqtt_topic,
                    user: mqtt_username,
                    port: mqtt_port,
                    pass: mqtt_password
                };
                // send data to device api over device hotspot
                Devices.deviceInterface('savemqtt', params)
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
         * Call the `/restart` endpoint on the device api to start a reboot on the device
         * @alias Devices.rebootDevice
         */
        rebootDevice: function() {
            // send request to device
            return Devices.deviceInterface('restart');
        }
    };
})();


/**
 * Start all the scripts
 */
app.initialize();


// JSDOC variable definitions:
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
 * Simple js Object storing the unsuccesful response of a request by the cordova http plugin
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

  /**
   * zeroconf scan result format
   * @typedef {Object} Zeroconf_Scan_Result
   * @property {String} action - describes the state. eg "resolved"|"added"
   * @property {Zeroconf_Service} service - describes found device
   */

  /**
   * zeroconf discovered service format
   * @see: [zeroconf plugin docs]{@link https://www.npmjs.com/package/cordova-plugin-zeroconf}
   * @typedef {Object} Zeroconf_Service
   * @property {String} domain
   * @property {String} hostname
   * @property {String[]} ipv4Addresses
   * @property {String[]} ipv6Addresses
   * @property {String} name
   * @property {Number} port
   * @property {Object} txtRecord
   * @property {String} type
   */