/*!
 * miot-part.js v1.0.0
 * https://github.com/qudou/miot-parts
 * (c) 2009-2017 qudou
 * Released under the MIT license
 */

const xmlplus = require("xmlplus");

xmlplus("miot-part", (xp, $_) => {

$_().imports({
    Client: {
        opt: { server: "mqtt://localhost:1886", pid: "pid" },
        fun: function (sys, items, opts) {
            let client  = require("mqtt").connect(opts.server);
            client.on("connect", e => {
                client.subscribe(opts.pid);
            });
            client.on("message", (topic, p) => {
                p = JSON.parse(p);
                this.notify(p.topic, p.body);
            });
            function publish(topic, p) {
                client.publish(topic, JSON.stringify(p), {qos:1,retain: true});
            }
            // 将消息发往用户端
            this.on("to-users", (e, topic, body) => {
                e.stopPropagation();
                publish("to-gateway", {pid: opts.pid, topic: targets, data: topic});
            });
            // 将消息发往局域网内配件
            this.on("to-parts", (e, targets, topic, body) => {
                e.stopPropagation();
                let body_ = {targets: targets, pid: opts.pid, topic: topic, body: body}
                publish("to-parts", body_);
            });
        }
    }
});


});