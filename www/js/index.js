
var controller = null;

var app = {
    initialize: function() {
        document.addEventListener('deviceready', this.onDeviceReady.bind(this), false);
    },
    
    onDeviceReady: function() {
        controller = new Controller();
        this.findAll('[data-weblink]').forEach((link,index)=>{
            link.addEventListener('click', this.onExternalLinkClick.bind(this), false);
            controller.show(['#welcome','#scan']);
        });
    },
    onExternalLinkClick: function(event) {
        event.preventDefault();
        var url = event.target.href;
        if(url) window.open(url,'_blank', 'location=yes');
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
    }
    
};

// view switcher
var Controller = function() {
    var controller = {
        self: null,
        initialize: function() {
            self = this;
            this.bindEvents();
            // list of all views to hide initially
            self.views = [
                "#welcome",
                "#scan",
                "#wifi",
                "#hotspots",
                "#auth",
                "#saved"
            ];
            self.hideAll();
        },

        bindEvents: function() {
            links = document.querySelectorAll('nav a') || [];
            links.forEach(link=>{
                link.addEventListener('click', this.onClick, false);
            });
            app.find('.brand a').addEventListener('click', this.onClick, false);
            app.findAll('[href="#sidebar"]').forEach(item=>{item.addEventListener('click', this.onClick, false)});
        },

        onClick: function(e) {
            e.preventDefault();
            var link = e.target;
            if (link.tagName !== "A") {
                link = getClosest(e.target, "a");
            }
            if (!link || link.classList.contains('active')) {
                return;
            }
            console.log(`link clicked: "${link.innerText}", links to "${link.hash}"`);
            var tab = link.hash;
            
            // default to link href if available, else back to welcome screen;
            if(tab==="#connecting") {
                self.hideAll();
                self.show(tab);
                app.find("#connecting .ssid").innerText = link.dataset.name;
                setTimeout(function() {
                    self.hideAll();
                    self.show('#wifi');
                },2000);
            } else if(tab==="#sidebar") {
                self.toggleSidebar();
            } else if(tab==="#auth") {
                self.hideAll();
                self.show(tab);
                app.find("#auth .ssid").innerText = link.dataset.ssid;
            } else if(tab==="#saved") {
                var originalText = link.innerText;
                link.innerText = "Saving...";
                link.classList.add('blink');
                setTimeout(function(){
                    self.hideAll();
                    self.show(tab);
                    link.innerText = originalText;
                    link.classList.remove('blink');
                }, 2000)
            } else if(tab){
                self.hideAll();
                self.show(tab);
            } else {
                self.hideAll();
                self.show(['#welcome','#scan']); 
            }
        },
        toggleSidebar: function() {
            var sidebar = app.find('#sidebar');
            sidebar.classList.toggle("in");
        },
        hideAll: function() {
            self.views.forEach(selector=>{
                this.hide(selector);
            });
        },
        show: function(selector) {
            if(Array.isArray(selector)) {
                selector.forEach(item=>{self.showOne(item)});
            } else {
                self.showOne(selector);
            }
        },
        hide: function(selector) {
            if(Array.isArray(selector)) {
                selector.forEach(item=>{self.hideOne(item)});
            } else {
                self.hideOne(selector);
            }
        },
        hideOne: function(selector) {
            app.find(selector).style.display = 'none';
        },
        showOne: function(selector) {
            if(!selector) return;
            app.find(selector).style.display = 'block';
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