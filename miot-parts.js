/*!
 * miot-parts.js v1.0.0
 * https://github.com/qudou/miot-parts
 * (c) 2009-2017 qudou
 * Released under the MIT license
 */

const xmlplus = require("xmlplus");
const MiotRoot = `${__dirname}/../miot-local`;
const Server = "mqtt://raspberrypi:1883";
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
        xml: "<main id='index'>\
                <Sqlite id='sqlite'/>\
                <MQTT id='mqtt'/>\
                <Client id='client'/>\
              </main>",
        map: { share: "Sqlite", defer: "client" },
        fun: function (sys, items, opts) {
            items.sqlite.all(`SELECT * FROM parts`, (err, rows) => {
                if (err) throw err;
                rows.forEach(p => {
                    try {load(p)}
                    catch (e) {logger.error(e)}
                });
                sys.client.show();
            });
            function load(part) {
                if (part.link != Link) return;
                require(`./parts/${part.id}/index.js`);
                let c = xp.hasComponent(`//${part.id}/Index`);
                c.map.msgscope = true;
                sys.mqtt.append(`<Index id='${part.id}' xmlns='//${part.id}'/>`);
            }
        }
    },
    MQTT: {
        xml: "<main id='mqtt'/>",
        fun: function (sys, items, opts) {
            let table;
            // 此 to-user 用于局域网内配件与视图端之间的通信
            this.on("to-user", "./*[@id]", function (e, topic, data) {
                e.stopPropagation();
                let p = {topic: topic, pid: this.toString(), data: data };
                sys.mqtt.notify("publish", ["to-gateway", p]);
            });
            // 此 to-part 用于局域网内配件之间的通信
            this.on("to-part", "./*[@id]", function (e, target, p) {
                e.stopPropagation();
                p.pid = this.toString();
                sys.mqtt.notify("publish", [target, p]);
            });
            this.watch("connect", () => {
                table = table || this.children().hash();
                Object.keys(table).forEach(partId => this.notify("subscribe", partId));
                console.log("connected to " + Server);
            });
            this.watch("message", (e, topic, p) => {
                table[topic] && table[topic].notify(p.topic, p.body);
            });
        }
    },
    Client: {
        fun: function (sys, items, opts) {
            let client  = require("mqtt").connect(Server, {clientId: Link});
            client.on("connect", e => this.notify("connect"));
            client.on("message", (topic, p) => {
                this.notify("message", [topic, JSON.parse(p)])
            });
            this.watch("publish", (e, topic, p) => {
                client.publish(topic, JSON.stringify(p), {qos:1,retain: true});
            });
            this.watch("subscribe", (e, topic) => client.subscribe(topic));
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