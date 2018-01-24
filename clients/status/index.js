xmlplus("10002", (xp, $_, t) => {

$_().imports({
    Client: {
        xml: "<i:Loader id='client' xmlns:i='loader'>\
                <i:Link url='/parts/10001/framework7.ios.min.css'/>\
                <i:Link url='/parts/10001/framework7.ios.colors.min.css'/>\
                <i:Script url='/parts/10001/framework7.min.js'/>\
                <i:Header id='header'/>\
                <i:Defer id='defer' target='/Body'/>\
              </i:Loader>",
        fun: function (sys, items, opts) {
            items.header.title(opts.name);
            this.once("willRemoved", e => this.notify("willRemoved"));
        }
    },
    Body: {
        css: "#toggle { margin: 20px auto; }",
        xml: "<div id='body'>\
                <h1>hello, world</h1>\
              </div>",
        fun: function (sys, items, opts) {
            this.watch("message", (e, msg) => {
                console.log(msg);
            });
            this.trigger("publish", ["message"]);
        }
    }
});

$_("icon").imports({
    Icon: {
        css: "#icon { display: inline-block; none repeat scroll; width: 28px; height: 28px; }\
              #icon svg { fill: currentColor; width: 100%; height: 100%; }",
        xml: "<a id='icon'/>",
        fun: function (sys, items, opts) {
            sys.icon.append(`${opts.id}`);
        }
    },
    Close: {
        xml: "<svg viewBox='0 0 1024 1024' width='200' height='200'>\
                <path d='M744.747008 310.295552 713.714688 279.264256 512.00512 480.9728 310.295552 279.264256 279.264256 310.295552 480.9728 512.00512 279.264256 713.714688 310.295552 744.747008 512.00512 543.03744 713.714688 744.747008 744.747008 713.714688 543.03744 512.00512Z'/>\
              </svg>"
    }
});

$_("loader").imports({
    Loader: {
        css: "#loader { padding: 0 16px 16px; background: #FFF; }",
        xml: "<div id='loader'/>",
        fun: function (sys, items, opts) {
            var ptr, first = this.first();
            this.on("next", (e, d) => {
                e.stopPropagation();
                ptr = ptr.next();
                ptr.trigger("enter", d, false);
            });
            setTimeout(e => {
                ptr = first;
                ptr.trigger("enter", {}, false);
            }, 0);
        }
    },
    Link: {
        fun: function (sys, items, opts) {
            let head = document.getElementsByTagName('head')[0];
            this.on("enter", e => {
                let link = document.createElement('link');
                link.type = 'text/css';
                link.rel = 'stylesheet';
                link.onload = () => {
                    setTimeout(() => this.trigger("next"), 7);
                };
                link.href = opts.url;
                head.appendChild(link);
                this.watch("willRemoved", e => head.removeChild(link));
            });
        }
    },
    Script: {
        fun: function (sys, items, opts) {
            this.on("enter", (e, d) => {
                require([opts.url], () => this.trigger("next"));
            });
        }
    },
    Header: {
        css: "#header { position: relative; margin: 0; height: 44px; line-height: 44px; text-align: center; box-sizing: border-box; }\
              #header:after { content: ''; position: absolute; left: 0; bottom: 0; right: auto; top: auto; height: 1px; width: 100%; background-color: #c4c4c4; display: block; z-index: 15; -webkit-transform-origin: 50% 100%; transform-origin: 50% 100%; }\
              #close { position: absolute; left: 0; top: 0; margin-top: 8px; } #title { font-size: 18px; font-weight: bold; display: inline; }",
        xml: "<header id='header'>\
                <Icon id='close' xmlns='../icon'/>\
                <h1 id='title'/>\
              </header>",
        fun: function (sys, items, opts) {
            this.on("enter", e => this.trigger("next"));
            sys.close.on("touchend", e => this.trigger("close"));
            return { title: sys.title.text };
        }
    },
    Defer: {
        fun: function (sys, items, opts) {
            this.on("enter", (e, d) => this.append(opts.target));
        }
    }
});

});

if ( typeof define === "function" ) {
    define( "xmlplus", [], function () { return xmlplus; } );
}