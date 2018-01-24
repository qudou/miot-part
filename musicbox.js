/*!
 * musicbox.js v1.0.0
 * https://github.com/qudou/musicbox
 * (c) 2009-2017 qudou
 * Released under the MIT license
 */

require("./servers/player.js");
require("./servers/status.js");

const xmlplus = require("xmlplus");
const Server = "mqtt://t-store.cn:1883";
const LinkId = "aee81434-fe5f-451a-b522-ae3631da5f44";

const log4js = require('log4js');
log4js.configure({
    appenders: { musicbox: { type: 'file', filename: `${__dirname}/musicbox.log` } },
    categories: { default: { appenders: ['musicbox'], level: 'debug' } }
});
const logger = log4js.getLogger('musicbox');

xmlplus("musicbox", (xp, $_, t) => {

$_().imports({
    Index: {
        xml: `<MQTT id='mqtt' server='${Server}' clientId='${LinkId}'>
                <Client id='27b58bc7-b48b-4afe-a14f-192cca1b9f0b' desc='player' xmlns='//player'/>
                <Client id='1f84a3a3-79c5-48c6-a676-e497950660d7' desc='status' xmlns='//status'/>
              </MQTT>`,
        fun: function (sys, items, opts) {
            this.on("connected", (e, msg) => logger.info(msg));
        }
    },
    MQTT: {
        opt: { server: "mqtt://127.0.0.1:1883", clientId: "aee81434-fe5f-451a-b522-ae4631da5f45" },
        fun: function (sys, items, opts) {
            let table = this.children().hash();
            let client  = require("mqtt").connect(opts.server, opts);
            client.on("connect", e => {
                Object.keys(table).forEach(partId => client.subscribe(partId));
                console.log("connected to " + opts.server);
                this.trigger("connected", "connected to " + opts.server);
            });
            client.on("message", (topic, msg) => {
                if (table[topic])
                    table[topic].trigger("enter", msg, false);
            });
            this.on("$publish", "./*[@id]", function (e, msg) {
                e.stopPropagation();
                msg.ssid = this.toString();
                client.publish("00000", JSON.stringify(msg), {qos:1,retain: true});
            });
        }
    },
    Client: {
        fun: function (sys, items, opts) {
            let that = this;
            let table = this.children().hash();
            this.on("enter", (e, msg) => {
                msg = JSON.parse(msg);
                if (table[msg.topic])
                    table[msg.topic].trigger("enter", {msgin: JSON.stringify(msg.data)}, false);
            });
            this.on("publish", "./*[@id]", function (e, data) {
                e.stopPropagation();
                this.trigger("$publish", { topic: this.toString(), data: data });
            });
        }
    },
    Flow: {
        fun: function ( sys, items, opts ) {
            let first = this.first(),
                table = this.find("./*[@id]").hash();
            this.on("start", (e, d) => {
                d.ptr = first;
                first.trigger("start", d, false);
            });
            this.on("next", (e, d, next) => {
                e.stopPropagation();
                if ( next == undefined ) {
                    d.ptr = d.ptr.next();
                    if ( !d.ptr )
                        throw new Error("next object not found")
                    d.ptr.trigger("start", d, false);
                } else if ( table[next] ) {
                    table[next].trigger("start", d, false);
                } else {
                    throw new Error("invalid next: " + next);
                }
            });
        }
    }
});

}).startup("//musicbox/Index");;