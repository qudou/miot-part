/*!
 * miot-parts.js v1.0.0
 * https://github.com/qudou/miot-parts
 * (c) 2009-2017 qudou
 * Released under the MIT license
 */

require("./servers/player.js");
require("./servers/auto.js");
require("./servers/system.js");

const xmlplus = require("xmlplus");
const MiotRoot = `${__dirname}/../miot-local/`;

const log4js = require("log4js");
log4js.configure({
    appenders: { "miot-parts": { type: "file", filename: `${__dirname}/miot-parts.log` } },
    categories: { default: { appenders: ["miot-parts"], level: "debug" } }
});
const logger = log4js.getLogger('miot-parts');

xmlplus("miot-parts", (xp, $_, t) => {

$_().imports({
    Index: {
        xml: "<MQTT id='mqtt'>\
                <Client id='96b2e3ce-917e-4551-98ee-02a0a3a9c93e' xmlns='//player'/>\
                <Client id='445cd2f5-bd07-45c0-9c82-86c0cb3da3b1' xmlns='//auto'/>\
                <Client id='2ce3d22e-1bb2-11e8-accf-0ed5f89f718b' xmlns='//system'/>\
              </MQTT>",
        map: { share: "/sqlite/Sqlite" }
    },
    MQTT: {
        opt: { server: "mqtt://raspberrypi:1883", clientId: "5971b164-779f-4bfa-a676-16582a77d7e9" },
        fun: function (sys, items, opts) {
            let table = this.children().hash();
            let client  = require("mqtt").connect(opts.server, opts);
            client.on("connect", e => {
                Object.keys(table).forEach(partId => client.subscribe(partId));
                console.log("connected to " + opts.server);
                logger.info("connected to " + opts.server);
            });
            client.on("message", (topic, msg) => {
                if (table[topic])
                    table[topic].trigger("enter", msg, false);
            });
            this.on("$publish", "./*[@id]", function (e, msg) {
                e.stopPropagation();
                msg.ssid = this.toString();
                client.publish("to-gateway", JSON.stringify(msg), {qos:1,retain: true});
            });
            this.on("#publish", "./*[@id]", function (e, topic, msg) {
                e.stopPropagation();
                msg.ssid = this.toString();
                client.publish(topic, JSON.stringify(msg), {qos:1,retain: true});
            });
        }
    },
    Client: {
        map: { msgscope: true },
        fun: function (sys, items, opts) {
            let change = {}, timer;
            let table = this.children().hash();
            this.on("enter", (e, msg) => {
                msg = JSON.parse(msg);
                if (table[msg.topic])
                    table[msg.topic].trigger("enter", msg.body, false);
            });
            this.on("publish", "./*[@id]", function (e, key, value) {
                e.stopPropagation();
                let isKey = typeof key == "string";
                isKey ? (change[key] = value) : xp.extend(change, key);
                clearTimeout(timer);
                timer = setTimeout(e => dispatch(this), 300);
                isKey && this.notify(`${key}-change`, [value]);
            });
            function dispatch(that) {
                that.trigger("$publish", {topic: that + '', data: change});
                change = {};
            }
        }
    },
    Proxy: {
        xml: "<Sqlite id='sqlite' xmlns='/sqlite'/>",
        fun: function (sys, items, opts) {
            function data(target) {
                return new Promise(resolve => {
                    items.sqlite.all(`SELECT * FROM parts WHERE id='${target}'`, (err, rows) => {
                        if (err) throw err;
                        resolve(JSON.parse(rows[0].data));
                    });
                });
            }
            function publish(topic, target, data) {
                sys.sqlite.trigger("#publish", [target, {topic: topic, body: data}]);
            }
            return { data: data, publish: publish };
        }
    }
});

$_("sqlite").imports({
    Sqlite: {
        fun: function (sys, items, opts) {
            let sqlite = require("sqlite3").verbose(),
                db = new sqlite.Database(`${MiotRoot}/data.db`);
			db.exec("VACUUM");
            db.exec("PRAGMA foreign_keys = ON");
            return db;
        }
    },
    Prepare: {
        fun: function (sys, items, opts) {
            return stmt => {
                let args = [].slice.call(arguments).slice(1);
                args.forEach(item => {
                    stmt = stmt.replace("?", typeof item == "string" ? '"' + item + '"' : item);
                });
                return stmt;
            };
        }
    }
});

}).startup("//miot-parts/Index");