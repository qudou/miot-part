/*!
 * musicbox.js v1.0.0
 * https://github.com/qudou/musicbox
 * (c) 2009-2017 qudou
 * Released under the MIT license
 */

require("./servers/player.js");
require("./servers/auto.js");

const xmlplus = require("xmlplus");
const MiotRoot = `${__dirname}/../miot-local/`;
const Gateway = "aee81434-fe5f-451a-b522-ae4631da5f45";

const log4js = require("log4js");
log4js.configure({
    appenders: { musicbox: { type: "file", filename: `${__dirname}/musicbox.log` } },
    categories: { default: { appenders: ["musicbox"], level: "debug" } }
});
const logger = log4js.getLogger('musicbox');

xmlplus("musicbox", (xp, $_, t) => {

$_().imports({
    Index: {
        xml: "<MQTT id='mqtt'>\
                <Client id='96b2e3ce-917e-4551-98ee-02a0a3a9c93e' xmlns='//player'/>\
                <Client id='445cd2f5-bd07-45c0-9c82-86c0cb3da3b1' xmlns='//auto'/>\
              </MQTT>",
        map: { share: "/sqlite/Sqlite" }
    },
    MQTT: {
        opt: { server: "mqtt://127.0.0.1:1883", clientId: "7ac4c6ac-83a6-4e2a-a019-6b577d38ca71" },
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
                client.publish(Gateway, JSON.stringify(msg), {qos:1,retain: true});
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
                change[key] = value;
                clearTimeout(timer);
                timer = setTimeout(e => dispatch(this), 300);
                this.notify(`${key}-change`, [value]);
            });
            function dispatch(that) {
                that.trigger("$publish", {topic: that + '', data: change});
                change = {};
            }
        }
    }
});

$_("parts").imports({
    Player: {
        xml: "<Proxy id='player' target='96b2e3ce-917e-4551-98ee-02a0a3a9c93e'/>",
        fun: function (sys, items, opts) {
            return items.player;
        }
    },
    Auto: {
        xml: "<Proxy id='auto' target='445cd2f5-bd07-45c0-9c82-86c0cb3da3b1'/>",
        fun: function (sys, items, opts) {
            return items.auto;
        }
    },
    Proxy: {
        xml: "<Sqlite id='sqlite' xmlns='/sqlite'/>",
        fun: function (sys, items, opts) {
            function data() {
                return new Promise(resolve => {
                    items.sqlite.all(`SELECT * FROM parts WHERE id='${opts.target}'`, (err, rows) => {
                        if (err) throw err;
                        resolve(JSON.parse(rows[0].data));
                    });
                });
            }
            function publish(topic, data) {
                sys.sqlite.trigger("#publish", [opts.target, {topic: topic, body: data}]);
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

}).startup("//musicbox/Index");