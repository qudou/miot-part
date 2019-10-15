/*!
 * auto.js v1.0.0
 * https://github.com/qudou/miot-parts
 * (c) 2009-2017 qudou
 * Released under the MIT license
 */

const xmlplus = require("xmlplus");
const schedule = require("node-schedule");

xmlplus("445cd2f5-bd07-45c0-9c82-86c0cb3da3b1", (xp, $_, t) => {

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
        xml: "<main id='schedule'/>",
        fun: function (sys, items, opts) {
            let jobs = [];
            this.watch("sh-schedule#", (e, d) => {
                jobs.forEach(job => job.cancel());
                jobs.splice(0);
                d.schedule.forEach(item => jobs.push(make(item)));
                this.trigger("to-user", ["data-change", {schedule: d.schedule}]);
            });
            function make(item) {
                let p = item.pattern.split(':');
                return schedule.scheduleJob(`${p[1]} ${p[0]} * * *`, e => {
                    let payload = {topic: "control", body: item.body};
                    sys.schedule.trigger("to-part", [item.target, payload]);
                });
            }
            this.on("enter", (e, msg) => this.notify("sh-schedule#", msg));
        }
    }
});

});