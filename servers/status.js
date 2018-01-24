/*!
 * musicbox.js v1.0.0
 * https://github.com/qudou/musicbox
 * (c) 2009-2017 qudou
 * Released under the MIT license
 */

const xmlplus = require("xmlplus");

xmlplus("status", (xp, $_, t) => {

$_().imports({
    Client: {
        xml: "<i:Client id='client' xmlns:i='//musicbox' xmlns:c='client'>\
                <c:Message id='message'/>\
              </i:Client>",
        map: { msgscope: true }
    }
});

$_("client").imports({
    Message: {
        fun: async function (sys, items, opts) {
            var cpu = require('cpu');
            this.on("enter", (e, d) => {
                cpu.usage(usages => {
                    this.trigger("publish", {num: cpu.num(), usages: usages});
                });
            });
        }
    }
});

});