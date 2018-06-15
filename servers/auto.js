/*!
 * auto.js v1.0.0
 * https://github.com/qudou/miot-parts
 * (c) 2009-2017 qudou
 * Released under the MIT license
 */

const xmlplus = require("xmlplus");
const schedule = require("node-schedule");

xmlplus("auto", (xp, $_, t) => {

$_().imports({
    Client: {
        xml: "<i:Client id='client' xmlns:i='//miot-parts'>\
                <Schedule id='schedule'/>\
                <Message id='message'/>\
              </i:Client>"
    },
    Message: {
        fun: function (sys, items, opts) {
            this.once("enter", (e, msg) => this.notify("sh-schedule#", msg));
        }
    },
    Schedule: {
        xml: "<Proxy id='proxy' xmlns='//miot-parts'/>",
        fun: function (sys, items, opts) {
            let jobs = [];
            this.watch("sh-schedule#", (e, d) => {
                jobs.forEach(job => job.cancel());
                jobs.splice(0);
                d.schedule.forEach(item => jobs.push(make(item)));
                this.trigger("publish", ["schedule", d.schedule]);
            });
            function make(item) {
                let p = item.pattern.split(':');
                return schedule.scheduleJob(`${p[1]} ${p[0]} * * *`, e => {
                    items.proxy.publish("control", item.target, item.body);
                });
            }
            this.on("enter", (e, msg) => this.notify("sh-schedule#", msg));
        }
    }
});

});