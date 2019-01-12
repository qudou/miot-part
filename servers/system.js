/*!
 * system.js v1.0.0
 * https://github.com/qudou/miot-parts
 * (c) 2009-2017 qudou
 * Released under the MIT license
 */

const xmlplus = require("xmlplus");
const schedule = require("node-schedule");

xmlplus("system", (xp, $_, t) => {

$_().imports({
    Client: {
        xml: "<i:Client id='client' xmlns:i='//miot-parts'>\
                <Infomation id='info'/>\
                <Reboot id='reboot'/>\
              </i:Client>"
    },
    Infomation: {
        fun: function (sys, items, opts) {
            let si = require('systeminformation');
            let spawn = require('child_process').spawn;
            let checkDiskSpace = require('check-disk-space');
            let schedule = require("node-schedule");
            this.watch("sysinfo", async e => {
                let sysinfo = await si.cpu();
                sysinfo.dateTime = (new Date).toLocaleString();
                sysinfo.temp = await temp();
                sysinfo.diskspace = await diskspace();
                this.trigger("publish", sysinfo);
            });
            function temp() {
                return new Promise((resolve, reject) => {
                    let t = spawn('cat', ['/sys/class/thermal/thermal_zone0/temp']);
                    t.stdout.on('data', data => resolve(data/1000 + '℃'));
                });
            }
            function diskspace() {
                return new Promise((resolve, reject) => {
                    checkDiskSpace('/').then(ds => {
                        let free = ds.free/1024/1024/1024;
                        let size = ds.size/1024/1024/1024;
                        resolve(`${free.toFixed(2)}G/${size.toFixed(2)}G (free/size)`);
                    });
                });
            }
            schedule.scheduleJob("*/1 * * * *", () => this.notify("sysinfo"));
        }
    },
    Reboot: {
        fun: function (sys, items, opts) {
            let process = require("child_process");
            this.watch("reboot", () => {
                process.exec("sudo reboot", err => {err && console.log(err)});
            });
            this.on("enter", (e, msg) => this.notify("reboot", msg));
        }
    }
});

});