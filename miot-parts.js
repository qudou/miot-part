/*!
 * miot-parts.js v1.0.0
 * https://github.com/qudou/miot-parts
 * (c) 2009-2017 qudou
 * Released under the MIT license
 */

const xmlplus = require("xmlplus");
const MiotRoot = `${__dirname}/../miot-local/`;
const Link = "5971b164-779f-4bfa-a676-16582a77d7e9";

const log4js = require("log4js");
log4js.configure({
    appenders: { "miot-parts": { type: "file", filename: `${__dirname}/miot-parts.log` } },
    categories: { default: { appenders: ["miot-parts"], level: "debug" } }
});
const logger = log4js.getLogger('miot-parts');

xmlplus("miot-parts", (xp, $_) => {

$_().imports({
    Index: {
        xml: "<MQTT id='mqtt'>\
                <Sqlite id='sqlite'/>\
              </MQTT>",
        map: { share: "Sqlite" },
        fun: async function (sys, items, opts) {
            items.sqlite.all(`SELECT * FROM parts`, (err, rows) => {
                if (err) throw err;
                rows.forEach(loadPart);
                items.mqtt.init();
            });
            function loadPart(part) {
                if (part.link != Link) return;
                try {
                    load(part);
                    sys.mqtt.append(`<Client id='${part.id}'/>`);
                } catch(e) {
                    logger.error(e), console.log(e);
                }
            }
            function load(part) {
                require(`./parts/${part.id}/index.js`);
                let c = {map: {}, fun: fun};
                c.xml = `<Index xmlns='//${part.id}'/>`;
                c.map.msgscope = true;
                $_().imports({Client: c});
            }
            function fun(sys, items, opts) {
                this.on("/SYS", (e, p) => {
                    p = JSON.parse(p);
                    this.notify(p.topic, p.body);
                });
            }
        }
    },
    MQTT: {
        opt: { server: "mqtt://raspberrypi:1883", clientId: "5971b164-779f-4bfa-a676-16582a77d7e9" },
        fun: function (sys, items, opts) {
            let client;
            const that = this;
            // 此 to-user 用于局域网内配件与视图端之间的通信
            this.on("to-user", "./*[@id]", function (e, topic, data) {
                e.stopPropagation();
                let payload = {topic: topic, pid: this.toString(), data: data };
                client.publish("to-gateway", JSON.stringify(payload), {qos:1,retain: true});
            });
            // 此 to-part 用于局域网内配件之间的通信
            this.on("to-part", "./*[@id]", function (e, target, payload) {
                e.stopPropagation();
                payload.pid = this.toString();
                client.publish(target, JSON.stringify(payload), {qos:1,retain: true});
            });
            function init() {
                let table = that.children().hash();
                delete table.sqlite;
                client  = require("mqtt").connect(opts.server, opts);
                client.on("connect", e => {
                    Object.keys(table).forEach(partId => client.subscribe(partId));
                    console.log("connected to " + opts.server);
                    logger.info("connected to " + opts.server);
                });
                client.on("message", (topic, msg) => {
                    table[topic] && table[topic].trigger("/SYS", msg, false);
                });
            }
            return { init: init };
        }
    },
    Sqlite: {
        fun: function (sys, items, opts) {
            let sqlite = require("sqlite3").verbose(),
                db = new sqlite.Database(`${MiotRoot}/data.db`);
			db.exec("VACUUM");
            db.exec("PRAGMA foreign_keys = ON");
            return db;
        }
    }
});


}).startup("//miot-parts/Index");