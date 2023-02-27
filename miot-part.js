/*!
 * miot-part.js v1.1.1
 * https://github.com/qudou/miot-part
 * (c) 2017-2022 qudou
 * Released under the MIT license
 */

const xmlplus = require("xmlplus");

xmlplus("miot-part", (xp, $_) => {

$_().imports({
    Client: {
        opt: { port: 1883, partId: "pid", protocol: "mqtt" },
        fun: function (sys, items, opts) {
			opts.clientId = opts.partId;
            let client  = require("mqtt").connect(opts);
            client.on("connect", e => {
                client.subscribe(opts.partId);
            });
            client.on("message", (topic, p) => {
                p = JSON.parse(p);
                this.notify(p.topic, p.body);
            });
            function publish(topic, p) {
                client.publish(topic, JSON.stringify(p), {qos:1,retain: true});
            }
            // 将消息发往用户端
            this.on("to-users", (e, topic, data) => {
                e.stopPropagation();
                publish("to-gateway", {pid: opts.partId, topic: topic, data: data});
            });
            // 将消息发往局域网内配件
            this.on("to-parts", (e, targets, topic, body) => {
                e.stopPropagation();
                let body_ = {targets: targets, pid: opts.partId, topic: topic, body: body}
                publish("to-parts", body_);
            });
        }
    }
});


});

module.exports = xmlplus;