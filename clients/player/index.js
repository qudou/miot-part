/*!
 * musicbox.js v1.0.0
 * https://github.com/qudou/musicbox
 * (c) 2009-2017 qudou
 * Released under the MIT license
 */

xmlplus("10001", (xp, $_, t) => {

let app = new Framework7();

$_().imports({
    Client: {
        css: "#client { padding: 0 16px 16px; background: #FFF; position: relative; }",
        xml: "<div id='client'>\
                <Header id='header'/>\
                <Body id='body'/>\
              </div>",
        fun: function (sys, items, opts) {
            items.header.title(opts.name);
            this.trigger("publish", ["message"]);
            this.glance("message", e => this.trigger("ready"))
        }
    },
    Header: {
        css: "#header { position: relative; margin: 0; height: 44px; line-height: 44px; text-align: center; box-sizing: border-box; }\
              #header:after { content: ''; position: absolute; left: 0; bottom: 0; right: auto; top: auto; height: 1px; width: 100%; background-color: #c4c4c4; display: block; z-index: 15; -webkit-transform-origin: 50% 100%; transform-origin: 50% 100%; }\
              #close { position: absolute; left: 0; top: 0; margin-top: 8px; } #title { font-size: 18px; font-weight: bold; display: inline; }",
        xml: "<header id='header'>\
                <Icon id='close' xmlns='/'/>\
                <h1 id='title'/>\
              </header>",
        fun: function (sys, items, opts) {
            sys.close.on("touchend", e => this.trigger("close"));
            return { title: sys.title.text };
        }
    },
    Body: {
        css: "#player { margin: 20px auto; }",
        xml: "<div id='body' xmlns:i='body'>\
                <i:Player id='player'/>\
                <i:From id='from'/>\
              </div>"
    },
    Icon: {
        css: "#icon { display: inline-block; none repeat scroll; width: 28px; height: 28px; }\
              #icon svg { fill: currentColor; width: 100%; height: 100%; }",
        xml: "<a id='icon'/>",
        fun: function (sys, items, opts) {
            sys.icon.append(`/icon/${opts.id}`);
        }
    },
    ViewStack: {
        xml: "<div id='viewstack'/>",
        fun: function (sys, items, opts) {
            var args, children = this.children(),
                table = children.call("hide").hash(),
                ptr = table[opts.index] || children[0];
            if (ptr) ptr = ptr.trigger("show", null, false).show();
            this.on("switch", function (e, to) {
                table = this.children().hash();
                if ( !table[to] || table[to] == ptr ) return;
                e.stopPropagation();
                args = [].slice.call(arguments).slice(2);
                ptr.trigger("hide", [to+''].concat(args)).hide();
                ptr = table[to].trigger("show", [ptr+''].concat(args), false).show();
            });
            return Object.defineProperty({}, "selected", { get: () => {return ptr}});
        }
    }
});

$_("body").imports({
    Player: {
        css: "#toggle { margin: 10px auto; }",
        xml: "<div id='player' xmlns:i='player'>\
                <i:Title id='title'/>\
                <i:Toggle id='toggle'/>\
              </div>"
    },
    From: {
        css: ".form-horizontal div#vol { margin-left: 0; margin-right: 0; }",
        xml: "<form id='form' class='form-horizontal' xmlns:i='form'>\
                <i:Range id='vol' class='form-group'/>\
                <i:TimePicker id='open' label='定时开启: '/>\
                <i:TimePicker id='stop' label='定时关闭: '/>\
              </form>",
        map: { nofragment: true },
        fun: function (sys, items, opts) {
            sys.vol.on("change", e => { 
                this.trigger("publish", ["control", { key: "pl-vol#", vol: items.vol.value }]);
            });
            sys.form.on("change_", e => {
                clearTimeout(opts.timer);
                opts.timer = setTimeout(update, 10);
            });
            function update() {
                let payload = [{pattern: items.open.value, action: "sh-open#"}, {pattern: items.stop.value, action: "sh-stop#"}];
                sys.form.trigger("publish", ["control", {key: "sh-schedule#", schedule: payload}]);
            }
            this.watch("message", (e, data) => {
                items.vol.value = data.vol;
                items.open.value = data.schedule[0].pattern;
                items.stop.value = data.schedule[1].pattern;
            });
        }
    }
});

$_("body/player").imports({
    Title: {
        css: "#text { text-align: center; color: #01C5AD; font-size: 14px;}", 
        xml: "<div id='title'>\
                <div id='text'>title</div>\
              </div>",
        fun: function (sys, items, opts) {
            this.watch("message", (e, data) => {
                data.song && sys.text.text(data.song.name);
            });
        }
    },
    Toggle: {
        css: "#toggle, #toggle > * { width: 64px; height: 64px; }",
        xml: "<i:ViewStack id='toggle' xmlns:i='/'>\
                <i:Icon id='play'/>\
                <i:Icon id='pause'/>\
                <i:Icon id='ready'/>\
              </i:ViewStack>",
        fun: function (sys, items, opts) {
            let table = { play: "pause", pause: "play", ready: "ready" };
            sys.toggle.on("touchend", "./*[@id]", function () {
                sys.toggle.trigger("switch", table[this]);
                sys.toggle.trigger("publish", ["control", {key: "pl-toggle#"}]);
            });
            this.watch("message", (e, data) => {
                sys.toggle.trigger("switch", table[data.stat]);
            });
        }
    }
});    

$_("body/form").imports({ 
    Range: {
        css: "#range { position: relative; display: table; border-collapse: separate; }\
              #range > * { border-top-right-radius: 0; border-bottom-right-radius: 0; }\
              #input { -webkit-appearance: none; display: inline-block; vertical-align: middle; background: #eee; box-shadow: none; padding: 0; position: relative; }\
              #input { z-index: 2; float: left; width: 100%; margin-bottom: 0; height: 34px; font-size: 14px; line-height: 1.42857143; color: #555; border: 1px solid #ccc; border-radius: 4px;}\
              #input:after { content: ''; display: block; position: absolute; width: 90%; height: 3px; top: 50%; margin-top: -1.5px; left: 5%; background: #ccc; border-radius: 3px; box-shadow: inset 0 1px 0 rgba(0,0,0,.125); cursor: pointer;}\
              #input[type=range]::-webkit-slider-thumb { -webkit-appearance: none; position: relative; z-index: 2; display: table-cell; height: 30px; width: 30px; border: 1px solid #ccc; border-radius: 3px; background: #ffffff; cursor: pointer; }\
              #label { min-width: 42px; border-left: 0; padding: 6px 12px; font-size: 14px; font-weight: 400; line-height: 1; color: #555; text-align: center; background-color: #eee; border: 1px solid #ccc; border-radius: 4px; width: 1%; white-space: nowrap; vertical-align: middle; display: table-cell;}",
        xml: "<div id='range' class='form-group'>\
                <input id='input' type='range' max='99' class='from-control'/>\
                <span id='label'/>\
              </div>",
        fun: function (sys, items, opts) {
            function getValue() {
                return sys.input.prop("value");
            }
            function setValue(value) {
                sys.input.prop("value", value);
                sys.label.text(parseInt(value));
            }
            sys.input.on("input", e => { 
                sys.label.text(`${parseInt(getValue())}`);
            });
            return Object.defineProperty({}, "value", { get: getValue, set: setValue });
        }
    },
    TimePicker: {
        css: ".sheet-modal { z-index: 100000; }",
        xml: "<div class='form-group'>\
                <label id='label' class='col-sm-2 control-label'/>\
                <div id='view' class='col-sm-10'>\
                   <input id='input' readonly='true' class='form-control'/>\
                </div>\
              </div>",
        fun: function (sys, items, opts) {
            let today = new Date();
            let picker = app.picker.create({
                inputEl: sys.input.elem(),
                rotateEffect: true,
                toolbarCloseText: "确定",
                value: [today.getHours(), today.getMinutes()],
                cols: [{values: hours()},{divider: true, content: ':'},{values: minutes()}],
                on: { close: p => sys.input.trigger("change_") },
                formatValue: (p, values) => {return `${values[0]}:${values[1]}`}
            });
            function hours() {
                let arr = [];
                for (let i = 0; i <= 23; i++) arr.push(i < 10 ? '0' + i : i);
                return arr;
            }
            function minutes() {
                let arr = [];
                for (let i = 0; i <= 59; i++) arr.push(i < 10 ? '0' + i : i);
                return arr;
            }
            sys.label.text(opts.label);
            function getValue() {
                return picker.value.join(':');
            }
            function setValue(value) {
                if (getValue() == value) return;
                let val = value.split(':');
                picker.setValue([val[0], val[1]]);
            }
            return Object.defineProperty({}, "value", { get: getValue, set: setValue });
        }
    }
});

$_("icon").imports({
    Close: {
        xml: "<svg viewBox='0 0 1024 1024' width='200' height='200'>\
                <path d='M744.747008 310.295552 713.714688 279.264256 512.00512 480.9728 310.295552 279.264256 279.264256 310.295552 480.9728 512.00512 279.264256 713.714688 310.295552 744.747008 512.00512 543.03744 713.714688 744.747008 744.747008 713.714688 543.03744 512.00512Z'/>\
              </svg>"
    },
    Play: {
        xml: "<svg viewBox='0 0 1024 1024' width='200' height='200'>\
                <path d='M512 985.6C250.85952 985.6 38.4 773.14048 38.4 512S250.85952 38.4 512 38.4 985.6 250.85952 985.6 512 773.14048 985.6 512 985.6M512 0C229.23264 0 0 229.23264 0 512s229.23264 512 512 512 512-229.23264 512-512S794.76736 0 512 0z m234.27072 493.93664l-366.6944-184.40192a21.7088 21.7088 0 0 0-31.41632 19.51744v365.89568a21.7088 21.7088 0 0 0 31.41632 19.53792l366.6944-184.40192a19.968 19.968 0 0 0 0-36.1472z'/>\
              </svg>"
    },
    Pause: {
        xml: "<svg viewBox='0 0 1024 1024' width='200' height='200'>\
                <path d='M389.896 296.754c-19.234 0-38.466 19.234-38.466 43.275l0 336.588c0 24.043 19.234 43.275 43.275 43.275s43.275-19.234 43.275-43.275l0-336.588c-4.809-24.043-24.043-43.275-48.083-43.275l0 0zM976.519 315.986c-24.043-57.701-62.509-115.401-105.784-158.676-48.083-48.083-100.975-81.743-158.676-105.784-67.318-28.851-134.635-43.275-201.953-43.275s-129.827 14.426-192.336 38.466c-62.509 24.043-115.401 62.509-158.676 110.593-48.083 48.083-81.743 100.975-105.784 158.676-28.851 62.509-43.275 125.018-43.275 192.336s14.426 134.635 38.466 197.144c24.043 57.701 62.509 115.401 105.784 158.676 48.083 48.083 100.975 81.743 158.676 105.784 62.509 24.043 129.827 38.466 197.144 38.466s134.635-14.426 197.144-38.466c57.701-24.043 115.401-62.509 158.676-105.784 48.083-48.083 81.743-100.975 105.784-158.676 24.043-62.509 38.466-129.827 38.466-197.144 4.809-67.318-9.617-129.827-33.658-192.336l0 0zM678.399 907.419c-52.892 24.043-110.593 33.658-168.293 33.658s-115.401-9.617-168.293-33.658c-52.892-24.043-96.167-52.892-139.444-91.36-33.658-38.466-67.318-86.552-86.552-139.444-24.043-52.892-33.658-110.593-33.658-168.293s9.617-115.401 33.658-168.293c24.043-52.892 52.892-96.167 91.36-139.444 38.466-38.466 86.552-72.126 139.444-91.36 52.892-24.043 110.593-33.658 168.293-33.658s115.401 9.617 168.293 33.658c52.892 24.043 96.167 52.892 139.444 91.36 38.466 38.466 72.126 86.552 91.36 139.444 24.043 52.892 33.658 110.593 33.658 168.293s-9.617 115.401-33.658 168.293c-24.043 52.892-52.892 96.167-91.36 139.444-43.275 38.466-91.36 72.126-144.252 91.36l0 0zM630.315 296.754c-24.043 0-43.275 19.234-43.275 43.275l0 336.588c0 24.043 19.234 43.275 43.275 43.275s43.275-19.234 43.275-43.275l0-336.588c0-24.043-19.234-43.275-43.275-43.275l0 0z'/>\
              </svg>"
    },
    Ready: {
        xml: "<svg viewBox='0 0 1024 1024' width='200' height='200'>\
                <path d='M512 0C229.229714 0 0 229.229714 0 512c0 113.956571 37.705143 218.843429 100.644571 303.945143l49.92-55.222857C101.851429 689.993143 73.142857 604.379429 73.142857 512 73.142857 269.604571 269.641143 73.142857 512 73.142857s438.857143 196.461714 438.857143 438.857143c0 242.358857-196.498286 438.857143-438.857143 438.857143-80.274286 0-155.318857-21.942857-220.086857-59.574857L242.029714 946.468571C320.475429 995.328 412.781714 1024 512 1024c282.770286 0 512-229.266286 512-512C1024 229.229714 794.770286 0 512 0zM412.598857 721.078857C419.84 728.32 429.348571 731.830857 438.857143 731.721143c9.508571 0.109714 19.017143-3.401143 26.258286-10.642286 0.694857-0.694857 0.914286-1.609143 1.536-2.340571l327.606857-327.533714c14.299429-14.299429 14.299429-37.412571 0-51.712s-37.449143-14.299429-51.712 0L438.857143 643.108571 281.453714 485.741714c-14.262857-14.299429-37.412571-14.299429-51.712 0s-14.299429 37.412571 0 51.712l181.321143 181.248C411.684571 719.469714 411.904 720.384 412.598857 721.078857z'/>\
              </svg>"
    }
});

});

if ( typeof define === "function" ) {
    define( "xmlplus", [], function () { return xmlplus; } );
}