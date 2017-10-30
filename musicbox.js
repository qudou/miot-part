/*!
 * musicbox.js v1.0.0
 * https://github.com/qudou/musicbox
 * (c) 2009-2017 qudou
 * Released under the MIT license
 */

const xmlplus = require("xmlplus");
const fs = require('fs');
const process = require('child_process');
const schedule = require("node-schedule");
const log4js = require('log4js');
log4js.configure({
  appenders: { musicbox: { type: 'file', filename: `${__dirname}/tmp/musicbox.log` } },
  categories: { default: { appenders: ['musicbox'], level: 'debug' } }
});
const logger = log4js.getLogger('musicbox');

xmlplus("musicbox", (xp, $_, t) => {

$_().imports({
    Index: {
        xml: "<main id='index'>\
                <Musicbox id='musicbox'/>\
                <Router id='router'/>\
                <Speeker id='speek'/>\
                <Download id='download'/>\
                <Schedule id='schedule'/>\
                <Monitor id='monitor'/>\
              </main>",
        fun: function (sys, items, opts) {
            require("getmac").getMac((err, mac) => {
                if (err) throw err;
                let MAC = mac.replace(/:/g, '');
                sys.index.append("Client", { clientId: MAC });
                logger.info(`the mac address is ${mac}`);
            });
            this.notify("*", "pl-next*");
            logger.info("service is ready");
        }
    },
    Musicbox: {
        xml: "<main xmlns:i='musicbox'>\
                <i:Player id='player'/>\
                <i:Songlist id='songlist'/>\
              </main>",
        fun: function (sys, items, opts) {
            let list = items.songlist;
            this.watch("pl-next*", (e, d) => {
                d.song = list.next();
                this.notify("exec", ["pl-pause pl-play", d]);
            });
        }
    },
    Router: {
        xml: "<main id='router'/>",
        fun: function (sys, items, opts) {
            let cmds = [], data = {},
                locked = 0, jobs = [];
            function exec(e, c, d = {}) {
                locked = 1;
                cmds = c.split(' ');
                sys.router.notify(cmds.shift(), [data = d]);
            }
            this.watch("rt-stop", e => this.unwatch("exec"));
            this.watch("next", (e, str) => {
                str && rebuild(str);
                let cmd = cmds.shift();
                cmd ? this.notify(cmd, [data]) : unlock();
            });
            this.watch("rt-open", e => this.unwatch("exec").watch("exec", exec));
            function rebuild(str) {
                let c = str.charAt(0), s = str.substr(1);
                c == "-" ? s.split(' ').forEach(item => {
                    let i = cmds.indexOf(item);
                    i !== -1 && cmds.splice(i, 1);
                }) : (cmds = cmds.concat(s.split(' ')));
            }
            function unlock() {
                jobs.length ? this.notify(jobs.shift()) : (locked = 0);
            }
            this.watch("*", (e, key, save) => {
                if (key == "sh-reboot*")
                    return this.notify(key, {});
                locked ? (save && jobs.push(key)) : this.notify(key, {});
            }).notify("rt-open");
        }
    },
    Speeker: {
        xml: "<main xmlns:i='speeker'>\
                 <i:BDAudio id='bdAudio'/>\
                 <i:Player id='player'/>\
              </main>",
        fun: function (sys, items, opts) {
            this.watch("speek", async (e, d) => {
                try {
                    let file = await items.bdAudio(d.speek);
                    await items.player.play(file);
                    d.buf ? (d.buf = undefined) : fs.unlinkSync(file);
                } catch (error) {
                    logger.error(error);
                } finally {
                    this.notify("next");
                }
            });
        }
    },
    Download: {
        xml: "<NetEase id='netease' xmlns='musicbox'/>",
        fun: function (sys, items, opts) {
            let path = `${__dirname}/tmp/buffer`;
            function isExist(files, song) {
                let file = song.mp3Url.split('/').pop();
                return files.indexOf(file) != -1;
            }
            async function download() {
                let files = fs.readdirSync(path);
                let songs = await items.netease.personal_fm() || [];
                for ( var song of songs ) {
                    song.mp3Url = (await items.netease.songs_detail_new_api(song.id)).url;
                    if ( !isExist(files, song) ) break;
                }
                if ( files.length > 256 ) {
                    let i = Math.floor(Math.random() * files.length);
                    fs.unlink(`${path}/${files[i]}`, err => {err && logger.info(err)});
                }
                if ( song && !isExist(files, song)) {                   
                    process.exec(`aria2c ${song.mp3Url} -d ${path}`, err => {err && logger.error(err)});
                }
            }
            setInterval(download, 1 * 60 * 60 * 1000);
        }
    },
    Schedule: {
        fun: function (sys, items, opts) {
            this.watch("sh-time*", (e, d) => {
                let now = new Date, hours = now.getHours();
                d.buf = true; 
                d.speek = `北京时间${hours}点整`;
                this.notify("exec", ["pl-pause speek pl-resume", d]);
            });
            this.watch("sh-reboot*", e => {
                process.exec("reboot", err => {err && logger.error(err)});
            });
            this.watch("rt-open", e => logger.info("player opened"));
            this.watch("rt-stop", e => logger.info("player stopped"));
            schedule.scheduleJob('0 23 * * *', e => this.notify("rt-stop"));
            schedule.scheduleJob('0 07 * * *', e => this.notify("rt-open").notify("*", "pl-next*"));
            schedule.scheduleJob('0 6-23 * * *', e => this.notify("*", "sh-time*", 1));
        }
    },
    Monitor: {
        fun: function (sys, items, opts) {
            (function bluetooth() {
                process.exec(`bash ${__dirname}/bluetooth.sh`, err => {
                    if (err) throw err;
                    setTimeout(bluetooth, 30 * 1000);
                });
            }());
        }
    },
    Client: {
        xml: "<i:MQTT id='mqtt' xmlns:i='/xmlmqtt' xmlns:c='client'>\
                <c:Schedule id='schedule'/>\
                <c:Control id='control'/>\
              </i:MQTT>",
        map: { attrs: { mqtt: "clientId" } },
        cfg: { mqtt: { server: "mqtt://t-store.cn:3000", username: "qudouo", password: "123456" } },
        fun: function (sys, items, opts) {
            this.watch("publish", (e, topic, payload) => {
                items.mqtt.publish(topic, JSON.stringify(payload));
            });
        }
    }
});

$_("client").imports({
    Schedule: {
        xml: "<main id='schedule'/>",
        fun: function (sys, items, opts) {
            let jobs = [],
                schedule = require("node-schedule");
            this.on("enter", (e, d) => {
                jobs.forEach(job => job.cancel());
                let list = JSON.parse(d.msgin);
                jobs.splice(0);
                list.forEach(item => jobs.push(make(item)));
                d.msgout = '{"code": 0}';
                this.trigger("publish", d);
            });
            function make(item) {
                return schedule.scheduleJob(item.time, e => {
                    sys.schedule.notify(item.action, {});
                });
            }
        }
    },
    Control: {
        fun: function (sys, items, opts) {
            let table = {
                ">||": "pl-toggle*", "-": "pl-vol-prev*", "+": "pl-vol-next*", "REBOOT": "sh-reboot*"
            };
            this.on("enter", (e, d) => {
                this.notify("rt-open");
                let key = JSON.parse(d.msgin).key;
                this.notify("*", table[key] || key, {});
            });
        }
    }
});

$_("musicbox").imports({
    Player: {
        fun: function (sys, items, opts) {
            let stat = "ready",
                mpg = require('mpg123'),
                player = new mpg.MpgPlayer();
            this.watch("pl-pause", (e, d) => {
                stat == "playing" ? player.pause() : this.notify("next");
            });
            player.on("pause", e => {
                stat = "pause";
                this.notify("next");
            });
            this.watch("pl-resume", (e, d) => {
                stat == "pause" ? player.pause() : this.notify("next");
            });
            player.on("resume", e => {
                stat = "playing";
                this.notify("next");
            });
            this.watch("pl-toggle*", (e, d) => {
                this.notify("exec", stat == "playing" ? "pl-pause" : "pl-resume");
            });
            this.watch("pl-play", (e, d) => {
                player.play(d.song.mp3Url);
            });
            player.on("end", e => {
                stat = "ready";
                this.notify("*", "pl-next*", 1);
            });
            player.on("error", err => {throw err});
        }
    },
    Songlist: {
        fun: function (sys, items, opts) {
            let path = `${__dirname}/tmp/buffer`;
            function next() {
                let files = fs.readdirSync(path),
                    i = Math.floor(Math.random()*files.length);
                return files[i].split('.').pop() == "mp3" ? { mp3Url: `${path}/${files[i]}` } : next();
            }
            return { next: next };
        }
    },
    NetEase: {
        fun: function (sys, items, opts) {
            let resolve, reject, result = {},
                PythonShell = require('python-shell'),
                funList = ["login", "personal_fm", "top_songlist", "songs_detail_new_api", "get_version", "daily_signin", "recommend_playlist", "user_playlist", "playlist_detail", "songs_detail", "channel_detail"];
            function request(...values) {
                let pyshell = new PythonShell("playlist.py", {scriptPath: __dirname});
                pyshell.send(JSON.stringify(values));
                pyshell.once('message', message => {
                    let msg = JSON.parse(message);
                    resolve(msg == -1 ? null : msg);
                });
                pyshell.end((err) => {if (err) throw err});
                return new Promise((resolve_, reject_) => {resolve = resolve_; reject = reject_;});
            }
            funList.forEach(key => {
                result[key] = async (...values) => {return await request.apply(null, [key].concat(values))};
            });
            return result;
        }
    }
});

$_("speeker").imports({
    Player: {
        fun: function (sys, items, opts) {
            let mpg = require('mpg123'),
                player = new mpg.MpgPlayer();
            function play(file) {
                return new Promise(resolve => {
                    player.play(file);
                    player.once("end", e => resolve(true));
                });
            }
            player.on("error", err => {throw err});
            return { play: play };
        }
    },
    BDAudio: {
        xml: "<AccessToken id='access_token'/>",
        fun: function (sys, items, opts) {
            let fs = require("fs"),
                md5 = require('md5'),
                qs = require('querystring'),
                request = require('request'),
                schedule = require('node-schedule'),
                host = 'http://tsn.baidu.com/text2audio?',
                params = { 'lan':'zh', 'tok': "", 'ctp':1, 'cuid':'E8-4E-06-33-48-5E', 'spd':4, 'pit':5, 'vol':10, 'per':0 };
            schedule.scheduleJob('0 7 * * *', async () => params.tok = await items.access_token());
            return async (text, speed) => {
                let resolve, reject,
                    tex = encodeURIComponent(text);
                params.tok || (params.tok = await items.access_token());
                let url = host + qs.stringify(xp.extend({}, params, {tex: tex, spd: speed || 4}));
                let filePath = __dirname + "/tmp/" + md5(tex);
                try {
                    fs.accessSync(filePath,  fs.F_OK|fs.R_OK);
                    return resolve(filePath);
                } catch (err) {}
                download = fs.createWriteStream(filePath);
                download.once('error', e => reject(e));
                download.once('finish', e => resolve(filePath));
                request(url).pipe(download);
                return new Promise((res, rej) => {resolve = res; reject = rej});
            };
        }
    },
    AccessToken: {
        opt: { grant_type: "client_credentials", client_id: "X9SuOWy7uEv6vX2IHS75edOg", client_secret: "7e6ab9189c189c5e9a0dd0ce1ed3b5cc" },
        fun: function (sys, items, opts) {
            let qs = require('querystring'),
                request = require('request'),
                tok_url = "https://openapi.baidu.com/oauth/2.0/token?" + qs.stringify(opts);
            return function () {
                let resolve, reject;
                request(tok_url, (err, res, body) => {
                    if (err) return reject(err);
                    let result = JSON.parse(body);
                    result.error ? reject(result.error) : resolve(result.access_token);
                });
                return new Promise((res, rej) => {resolve = res; reject = rej});
            }
        }
    }
});

$_("xmlmqtt").imports({
    MQTT: {
        opt: { server: "mqtt://test.mosquitto.org" },
        fun: async function (sys, items, opts) {
            let table = this.children().hash();
            let client  = require("mqtt").connect(opts.server, opts);
            client.on("connect", e => {
                for ( let key in table )
                    client.subscribe(`${opts.clientId}/${key}/in`);
                console.log("connected to " + opts.server);
            });
            client.on("message", (topic, message) => {
                console.log(topic, message);
                let key = topic.substr(opts.clientId.length + 1);
                key = key.substring(0, key.lastIndexOf("/in"));
                table[key].trigger("enter", {msgin: message.toString()}, false);
            });
            this.on("publish", "./*[@id]", function (e, d) {
                console.log(`${opts.clientId}/${this}/out`, d.msgout);
                e.stopPropagation();
                client.publish(`${opts.clientId}/${this}/out`, d.msgout);
            });
            return client;
        }
    },
    Flow: {
        fun: function ( sys, items, opts ) {
            var first = this.first(),
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

}).startup("//musicbox/Index");