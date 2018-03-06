/*!
 * system.js v1.0.0
 * https://github.com/qudou/musicbox
 * (c) 2009-2017 qudou
 * Released under the MIT license
 */

const xmlplus = require("xmlplus");
const schedule = require("node-schedule");

xmlplus("system", (xp, $_, t) => {

$_().imports({
    Client: {
        xml: "<i:Client id='client' xmlns:i='//musicbox'>\
                <Infomation id='info'/>\
              </i:Client>"
    },
    Infomation: {
        fun: function (sys, items, opts) {
            let si = require('systeminformation');
            let spawn = require('child_process').spawn;
            this.watch("sysinfo", async e => {
                sysinfo = await si.cpu();
                sysinfo.temp = await temp();
                this.trigger("publish", sysinfo);
            });
            function temp() {
                return new Promise((resolve, reject) => {
                    let t = spawn('cat', ['/sys/class/thermal/thermal_zone0/temp']);
                    t.stdout.on('data', data => resolve(data/1000));
                });
            }
            setInterval(e => this.notify("sysinfo"), 60 * 1000);
        }
    }
});

});