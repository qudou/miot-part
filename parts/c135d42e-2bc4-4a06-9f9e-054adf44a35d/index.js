/*!
 * auto.js v1.0.0
 * https://github.com/qudou/miot-parts
 * (c) 2009-2017 qudou
 * Released under the MIT license
 */

const xmlplus = require("xmlplus");
const schedule = require("node-schedule");

xmlplus("c135d42e-2bc4-4a06-9f9e-054adf44a35d", (xp, $_, t) => {

$_().imports({
    Index: {
        xml: "<main id='index'>\
                <Schedule id='schedule'/>\
                <Message id='message'/>\
              </main>"
    },
    Message: {
        fun: function (sys, items, opts) {
            this.glance("message", (e, msg) => this.notify("sh-schedule#", msg));
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
            this.watch("schedule", (e, msg) => this.notify("sh-schedule#", msg));
        }
    }
});

});