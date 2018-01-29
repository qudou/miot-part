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
        xml: "<div id='client'>\
                <Navbar id='navbar'/>\
                <Content id='content'/>\
              </div>",
        fun: function (sys, items, opts) {
            let message = {};
            items.navbar.title(opts.name);
            this.trigger("publish", "message");
            this.watch("message", (e, msg) => {
                xp.extend(message, msg);
                this.notify("msg-change", message);
            }).glance("message", e => this.trigger("ready"));
        }
    },
    Navbar: {
        css: ".ios .navbar-inner { padding: 0 10px; }\
              .ios .navbar #close { margin-right: 0; width: 22px; height: 22px; }",
        xml: "<div id='navbar' class='navbar'>\
                <div class='navbar-inner'>\
                   <div id='close' class='left'>\
                      <i class='icon f7-icons ios-only' style='margin:auto;'>close</i>\
                   </div>\
                   <div id='title' class='title'/>\
                   <div class='right'/>\
                </div>\
              </div>",
        fun: function (sys, items, opts) {
            sys.close.on("touchend", e => this.trigger("close"));
            return { title: sys.title.text };
        }
    },
    Content: {
        css: "#vol { margin-top: 35px; }",
        xml: "<div id='content' class='page' xmlns:i='content'>\
                <div class='page-content'>\
                    <i:Player id='player'/>\
                    <i:Range id='vol'/>\
                    <div class='block-title'>定时开启</div>\
                    <i:TimePicker id='open'/>\
                    <div class='block-title'>定时关闭</div>\
                    <i:TimePicker id='stop'/>\
                </div>\
              </div>",
        map: { nofragment: true },
        fun: function (sys, items, opts) {
            sys.vol.on("range-change", e => {
                this.trigger("publish", ["control", { key: "pl-vol#", vol: items.vol.value }]);
            });
            sys.content.on("picker-change", e => {
                clearTimeout(opts.timer);
                opts.timer = setTimeout(update, 10);
            });
            function update() {
                let payload = [{pattern: items.open.value, action: "sh-open#"}, {pattern: items.stop.value, action: "sh-stop#"}];
                sys.content.trigger("publish", ["control", {key: "sh-schedule#", schedule: payload}]);
            }
            this.watch("msg-change", (e, data) => {
                items.vol.value = data.vol;
                items.open.value = data.schedule[0].pattern;
                items.stop.value = data.schedule[1].pattern;
            });
        }
    }
});

$_("content").imports({
    Player: {
        css: "#toggle { margin: 10px auto; }",
        xml: "<div id='player' xmlns:i='player'>\
                <i:Title id='title'/>\
                <i:Toggle id='toggle'/>\
              </div>"
    },
    Range: {
        xml: "<div id='range' class='list simple-list'>\
              <ul>\
                <li>\
                  <div class='item-cell width-auto flex-shrink-0'>\
                    <i class='icon f7-icons ios-only'>volume_mute_fill</i>\
                    <i class='icon material-icons md-only'>volume_mute</i>\
                  </div>\
                  <div class='item-cell flex-shrink-3'>\
                    <div id='range' class='range-slider range-slider-init'>\
                      <input id='input' type='range' min='0' max='100' step='1' value='10'/>\
                    </div>\
                  </div>\
                  <div class='item-cell width-auto flex-shrink-0'>\
                    <i class='icon f7-icons ios-only'>volume_fill</i>\
                    <i class='icon material-icons md-only'>volume_up</i>\
                  </div>\
                </li>\
              </ul>\
            </div>",
        fun: function (sys, items, opts) {
            let timer;
            let range = app.range.create({
                label: true,
                el: sys.range.elem()
            });
            range.on("change", e => {
                clearTimeout(timer);
                timer = setTimeout(e => this.trigger("range-change"), 100); 
            });
            function getValue() {
                return range.getValue();
            }
            function setValue(value) {
                parseInt(getValue()) != value && range.setValue(value)
            }
            return Object.defineProperty({}, "value", { get: getValue, set: setValue });
        }
    },
    TimePicker: {
        css: ".sheet-modal { z-index: 100000; }",
        xml: "<div class='list no-hairlines-md'>\
                <ul><li><div class='item-content item-input'><div class='item-inner'><div class='item-input-wrap'>\
                      <input id='input' type='text' readonly='readonly'/>\
                </div></div></div></li></ul>\
              </div>",
        fun: function (sys, items, opts) {
            let today = new Date();
            let picker = app.picker.create({
                inputEl: sys.input.elem(),
                rotateEffect: true,
                toolbarCloseText: "确定",
                value: [today.getHours(), today.getMinutes()],
                cols: [{values: hours()},{divider: true, content: ':'},{values: minutes()}],
                on: { close: p => sys.input.trigger("picker-change") },
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

$_("content/player").imports({
    Title: {
        css: "#title { text-align: center; }", 
        xml: "<div id='title' class='block-title'>标题</div>",
        fun: function (sys, items, opts) {
            this.watch("msg-change", (e, data) => {
                data.song && sys.title.text(data.song.name);
            });
        }
    },
    Toggle: {
        css: "#toggle, #toggle > * { width: 64px; height: 64px; }\
              #toggle i { font-size: 64px; }",
        xml: "<ViewStack id='toggle'>\
                <i id='play' class='icon f7-icons ios-only'>play_round</i>\
                <i id='pause' class='icon f7-icons ios-only'>pause_round</i>\
                <i id='ready' class='icon f7-icons ios-only'>world</i>\
              </ViewStack>",
        fun: function (sys, items, opts) {
            let table = { play: "pause", pause: "play", ready: "ready" };
            sys.toggle.on("touchend", "./*[@id]", function () {
                sys.toggle.trigger("switch", table[this]);
                sys.toggle.trigger("publish", ["control", {key: "pl-toggle#"}]);
            });
            this.watch("msg-change", (e, data) => {
                sys.toggle.trigger("switch", table[data.stat]);
            });
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

});

if ( typeof define === "function" ) {
    define( "xmlplus", [], function () { return xmlplus; } );
}