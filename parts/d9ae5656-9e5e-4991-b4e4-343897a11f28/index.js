/*!
 * system.js v1.0.0
 * https://github.com/qudou/miot-parts
 * (c) 2009-2017 qudou
 * Released under the MIT license
 */

const xmlplus = require("xmlplus");
const schedule = require("node-schedule");

xmlplus("d9ae5656-9e5e-4991-b4e4-343897a11f28", (xp, $_) => {

$_().imports({
    Index: {
        xml: "<main id='index'>\
                <Infomation id='sysinfo'/>\
                <Reboot id='reboot'/>\
                <ShutDown id='shutdown'/>\
              </main>"
    },
    Infomation: {
        fun: function (sys, items, opts) {
            let si = require('systeminformation');
            let spawn = require('child_process').spawn;
            let checkDiskSpace = require('check-disk-space');
            let schedule = require("node-schedule");
            let ip = require("ip");
            this.watch("/sysinfo", async e => {
                let sysinfo = await si.cpu();
                sysinfo.dateTime = (new Date).toLocaleString();
                sysinfo.temp = await temp();
                sysinfo.uptime = await uptime();
                sysinfo.diskspace = await diskspace();
                sysinfo.ip = ip.address();
                this.trigger("to-user", ["/sysinfo", sysinfo]);
            });
            function temp() {
                return new Promise((resolve, reject) => {
                    let t = spawn('cat', ['/sys/class/thermal/thermal_zone0/temp']);
                    t.stdout.on('data', data => resolve(data/1000 + '℃'));
                });
            }
            function uptime() {
                return new Promise((resolve, reject) => {
                    let t = spawn('uptime', ['-s']);
                    t.stdout.on('data', data => resolve(data+''));
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
            schedule.scheduleJob("*/1 * * * *", () => this.notify("/sysinfo"));
        }
    },
    Reboot: {
        fun: function (sys, items, opts) {
            let process = require("child_process");
            this.watch("/reboot", (e, msg) => {
                process.exec("sudo reboot", err => {err && console.log(err)});
            });
        }
    },
    ShutDown: {
        fun: function (sys, items, opts) {
            let process = require("child_process");
            this.watch("/shutdown", (e, msg) => {
                process.exec("sudo halt", err => {err && console.log(err)});
            });
        }
    }
});

});