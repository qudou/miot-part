/*!
 * auto.js v1.0.0
 * https://github.com/qudou/musicbox
 * (c) 2009-2017 qudou
 * Released under the MIT license
 */

const xmlplus = require("xmlplus");
const schedule = require("node-schedule");

xmlplus("auto", (xp, $_, t) => {

$_().imports({
    Client: {
        xml: "<i:Client id='client' xmlns:i='//musicbox'>\
                <Schedule id='schedule'/>\
                <Message id='message'/>\
              </i:Client>"
    },
    Message: {
        xml: "<Auto id='auto' xmlns='//musicbox/parts'/>",
        fun: function (sys, items, opts) {
            this.once("enter", (e, msg) => this.notify("sh-schedule#", msg));
        }
    },
    Schedule: {
        xml: "<Player id='player' xmlns='//musicbox/parts'/>",
        fun: function (sys, items, opts) {
            let jobs = [];
            this.watch("sh-schedule#", (e, d) => {
                jobs.forEach(job => job.cancel());
                jobs.splice(0);
                d.schedule.forEach(item => jobs.push(make(item)));
                this.trigger("publish", ["schedule", d.schedule]);
            });
            this.watch("sh-stop#", async e => {
                let d = await items.player.data();
                if (d.stat == "play") {
                    items.player.publish("control", {key: "pl-toggle#"});
                } else if (d.stat == "ready") {
                    setTimeout(e => this.notify("sh-stop#"), 5000);
                }
            });
            this.watch("sh-open#", async e => {
                let d = await items.player.data();
                if (d.stat == "pause") {
                    items.player.publish("control", {key: "pl-toggle#"});
                }
            });
            function make(item) {
                let p = item.pattern.split(':');
                return schedule.scheduleJob(`${p[1]} ${p[0]} * * *`, e => {
                    sys.player.notify(item.action);
                });
            }
            this.on("enter", (e, msg) => this.notify("sh-schedule#", msg));
        }
    }
});

});