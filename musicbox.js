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
    appenders: { musicbox: { type: 'file', filename: `${__dirname}/musicbox.log` } },
    categories: { default: { appenders: ['musicbox'], level: 'debug' } }
});
const logger = log4js.getLogger('musicbox');

xmlplus("musicbox", (xp, $_, t) => {

$_().imports({
    Index: {
        xml: "<main id='index'>\
                <Musicbox id='musicbox'/>\
                <Router id='router'/>\
                <Download id='download'/>\
                <Schedule id='schedule'/>\
                <Monitor id='monitor'/>\
                <Client id='client'/>\
              </main>",
        fun: function (sys, items, opts) {
            this.watch("service-ready", (e, message) => {
                this.notify("*", "pl-next*");
                for (let key in message)
                    this.notify("*", [key, 0, message]);
                logger.info("service is ready");
            });
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
            this.watch("*", (e, key, save, d = {}) => {
                if (key.split('').pop() == '#')
                    return this.notify(key, d);
                locked ? (save && jobs.push(key)) : this.notify(key, d);
            }).notify("rt-open");
        }
    },
    Download: {
        xml: "<NetEase id='netease' xmlns='musicbox'/>",
        fun: function (sys, items, opts) {
            let path = `${__dirname}/buffer`;
            function isExist(files, song) {
                let file = song.mp3Url.split('/').pop();
                return files.indexOf(file) != -1;
            }
            async function download() {
                let files = fs.readdirSync(path);
                let songs = await items.netease.personal_fm() || [];
                for (let song of songs) {
                    song.mp3Url = (await items.netease.songs_detail_new_api(song.id)).url;
                    if (!isExist(files, song)) break;
                }
                if (files.length > 256) {
                    let i = Math.floor(Math.random() * files.length);
                    fs.unlink(`${path}/${files[i]}`, err => {err && logger.info(err)});
                }
                if (song && !isExist(files, song)) {
                    process.exec(`aria2c ${song.mp3Url} -d ${path}`, err => {err && logger.error(err)});
                }
                setTimeout(download, files.length < 256 ? 15 * 60 * 1000 : 3600 * 1000);
            }
            setTimeout(download, 15 * 60 * 1000);
        }
    },
    Schedule: {
        xml: "<NetEase id='netease' xmlns='musicbox'/>",
        fun: function (sys, items, opts) {
            this.watch("sh-reboot#", e => {
                process.exec("reboot", err => {err && logger.error(err)});
            });
            this.watch("sh-stop#", e => this.notify("rt-stop"));
            this.watch("sh-open#", e => this.notify("rt-open").notify("*", "pl-next*", 1));
            let jobs = [];
            this.watch("sh-schedule#", (e, d) => {
                jobs.forEach(job => job.cancel());
                jobs.splice(0);
                d.schedule.forEach(item => jobs.push(make(item)));
                this.notify("msg-change", ["schedule", d.schedule]);
            });
            function make(item) {
                let p = item.pattern.split(':');
                return schedule.scheduleJob(`${p[1]} ${p[0]} * * *`, e => {
                    sys.netease.notify(item.action, {});
                });
            }
            schedule.scheduleJob('0 8 * * *', async e => {
                let login = await items.netease.login("13977097500", "139500i");
                if (login.code !== 200)
                    logger.error(`login error! code: ${login.code}`);
            });
        }
    },
    Monitor: {
        fun: function (sys, items, opts) {
            let bluetooth = false;
            function bluetooth_() {
                bluetooth && process.exec(`bash ${__dirname}/bluetooth.sh`, err => {
                    if (err) throw err;
                     setTimeout(bluetooth_, 30 * 1000);
                });
            }
            this.watch("mo-bluetooth#", (e, o) => {
                if(bluetooth != o.bluetooth) {
                    bluetooth = !!o.bluetooth;
                    this.notify("msg-change", ["bluetooth", bluetooth]);
                }
            });
        }
    },
    Client: {
        xml: "<i:MQTT id='mqtt' xmlns:i='/xmlmqtt' xmlns:c='client'>\
                <c:Message id='message'/>\
                <c:Control id='control'/>\
              </i:MQTT>"
    }
});

$_("client").imports({
    Message: {
        xml: "<Sqlite id='sqlite' xmlns='/sqlite'/>",
        fun: async function (sys, items, opts) {
            let message = await select();
            this.watch("msg-change", (e, key, value) => {
                update(message[key] = value);
                this.trigger("publish", message);
            });
            function select() {
                return new Promise(resolve => {
                    let stmt = "SELECT * FROM options";
                    items.sqlite.all(stmt, (err, rows) => {
                        if (err) { throw err; }
                        resolve(JSON.parse(rows[0].value));
                    });
                });
            }
            function update() {
                let stmt = items.sqlite.prepare("UPDATE options SET value=?");
                stmt.run(JSON.stringify(message), err => {
                    if (err) throw err;
                });
            }
            sys.sqlite.watch("msg-change", (e, key, value) => {
                if (key == "stat" && value == "play")
                    sys.sqlite.unwatch().notify("*", ["pl-vol#", 0, message]);
            });
            this.on("enter", (e, d) => this.trigger("publish", message));
            this.notify("service-ready", message);
        }
    },
    Control: {
        fun: function (sys, items, opts) {
            let set = new Set(
                ["pl-toggle#", "pl-vol#", "sh-schedule#", "sh-reboot#", "mo-bluetooth#"]
            );
            this.on("enter", (e, dd) => {
                let d = JSON.parse(dd.msgin);
                this.notify("rt-open")
                if (set.has(d.key)) {
                    this.notify("*", [d.key, 0, d]);
                }
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
                stat == "play" ? player.pause() : this.notify("next");
            });
            player.on("pause", e => {
                stat = "pause";
                this.notify("next").notify("msg-change", ["stat", stat]);
            });
            this.watch("pl-resume", (e, d) => {
                stat == "pause" ? player.pause() : this.notify("next");
            });
            player.on("resume", e => {
                stat = "play";
                this.notify("next").notify("msg-change", ["stat", stat]);
            });
            this.watch("pl-toggle#", (e, d) => {
                this.notify("exec", stat == "play" ? "pl-pause" : "pl-resume");
            });
            this.watch("pl-play", (e, d) => {
                player.play(d.song.mp3Url);
            });
            player.on("end", e => {
                stat = "ready";
                this.notify("*", ["pl-next*", 1]).notify("msg-change", ["stat", stat]);
            });
            player.on("error", err => {throw err});
            this.watch("pl-vol#", (e, d) => player.volume(d.vol));
            player.on("volume", vol => this.notify("msg-change", ["vol", vol]));
        }
    },
    Songlist: {
        fun: function (sys, items, opts) {
            let path = `${__dirname}/buffer`;
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

$_("xmlmqtt").imports({
    MQTT: {
        opt: { server: "mqtt://t-store.cn:3001", clientId: "aee81434-fe5f-451a-b522-ae3631da5f44", partId: "27b58bc7-b48b-4afe-a14f-192cca1b9f0b" },
        fun: function (sys, items, opts) {
            let table = this.children().hash();
            let client  = require("mqtt").connect(opts.server, opts);
            client.on("connect", e => {
                client.subscribe(opts.partId);
                console.log("connected to " + opts.server);
                logger.info("connected to " + opts.server);
            });
            client.on("message", (topic, msg) => {
                msg = JSON.parse(msg);
                if (table[msg.topic])
                    table[msg.topic].trigger("enter", {msgin: JSON.stringify(msg.data)}, false);
            });
            this.on("publish", "./*[@id]", function (e, data) {
                e.stopPropagation();
                let msgout = { topic: this.toString(), ssid: opts.partId, data: data };
                client.publish("00000", JSON.stringify(msgout), {qos:1,retain: true});
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

$_("sqlite").imports({
    Sqlite: {
        fun: function (sys, items, opts) {
            let sqlite = require("sqlite3").verbose(),
                db = new sqlite.Database(`${__dirname}/data.db`);
			db.exec("VACUUM");
            db.exec("PRAGMA foreign_keys = ON");
            return db;
        }
    },
    Prepare: {
        fun: function (sys, items, opts) {
            return stmt => {
                var args = [].slice.call(arguments).slice(1);
                args.forEach(item => {
                    stmt = stmt.replace("?", typeof item == "string" ? '"' + item + '"' : item);
                });
                return stmt;
            };
        }
    }
});

}).startup("//musicbox/Index");