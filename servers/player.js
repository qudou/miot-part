/*!
 * musicbox.js v1.0.0
 * https://github.com/qudou/musicbox
 * (c) 2009-2017 qudou
 * Released under the MIT license
 */

const xmlplus = require("xmlplus");
const fs = require("fs");
const process = require("child_process");
const schedule = require("node-schedule");
const log4js = require("log4js");
const logger = log4js.getLogger("musicbox");

const ListLength = 300;
const TimeInterval = 3600 * 1000;
const Root = `${__dirname}/player`;
const [Username, Password] = ["17095989603", "139500i"];

xmlplus("player", (xp, $_) => {

$_().imports({
    Client: {
        xml: "<i:Client id='client' xmlns:i='//musicbox' xmlns:c='client'>\
                <Index id='index'/>\
                <c:Message id='message'/>\
                <c:Control id='control'/>\
              </i:Client>",
        map: { msgscope: true, share: "musicbox/NetEase schedule/Sqlite sqlite/Sqlite" }
    },
    Index: {
        xml: "<main id='index'>\
                <Musicbox id='musicbox'/>\
                <Router id='router'/>\
                <Schedule id='schedule'/>\
              </main>",
        fun: function (sys, items, opts) {
            this.watch("service-ready", (e, message) => {
                this.notify("pl-next#");
                this.notify("sh-schedule#", message);
                this.notify("sh-bluetooth#", message);
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
            this.watch("pl-next#", async e => {
                let d = {song: await list.next()};
                this.notify("*", ["pl-pause pl-play", d]);
            });
        }
    },
    Router: {
        xml: "<main id='router'/>",
        fun: function (sys, items, opts) {
            let cmds = [], data = {}, locked = 0, jobs = [];
            function exec(c, d = {}) {
                locked = 1;
                cmds = c.split(' ');
                sys.router.notify(cmds.shift(), [data = d]);
            }
            this.watch("next", (e, str) => {
                str && rebuild(str);
                let cmd = cmds.shift();
                cmd ? this.notify(cmd, [data]) : unlock();
            });
            function rebuild(str) {
                let c = str.charAt(0), s = str.substr(1);
                c == "-" ? s.split(' ').forEach(item => {
                    let i = cmds.indexOf(item);
                    i !== -1 && cmds.splice(i, 1);
                }) : (cmds = cmds.concat(s.split(' ')));
            }
            function unlock() {
                let job = jobs.shift();
                job ? exec(job.key, job.data) : (locked = 0);
            }
            this.watch("*", (e, key, d = {}, save) => {
                if (key.split('').pop() == '#')
                    return this.notify(key, d);
                locked ? (save && jobs.push({key:key,data:d})) : exec(key, d);
            });
        }
    },
    Schedule: {
        xml: "<main id='schedule' xmlns:i='schedule'>\
                <i:TimingSwitch id='ts'/>\
                <i:Download id='download'/>\
                <i:Unlink id='unlink'/>\
                <i:Bluetooth id='bluetooth'/>\
                <i:Sqlite id='sqlite'/>\
                <NetEase id='netease' xmlns='musicbox'/>\
              </main>",
        fun: function (sys, items, opts) {
            this.watch("sh-reboot#", e => {
                process.exec("reboot", err => {err && logger.error(err)});
            });
            schedule.scheduleJob("0 8 * * *", async e => {
                let login = await items.netease.login(Username, Password);
                if (login.code !== 200)
                    logger.error(`login error! code: ${login.code}`);
            });
            setInterval(async e => {
                this.notify(await items.sqlite.length() < ListLength ? "download" : "unlink");
            }, TimeInterval / 2);
        }
    }
});

$_("musicbox").imports({
    Player: {
        fun: function (sys, items, opts) {
            let stat = "ready";
            let mpg = require("mpg123");
            let player = new mpg.MpgPlayer();

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
                if (stat != "ready")
                    this.notify("*", stat == "play" ? "pl-pause" : "pl-resume");
            });
            this.watch("pl-play", (e, d) => {
                player.play(`${Root}/buffer/${d.song.mp3Url}`);
                this.notify("msg-change", ["song", d.song]);
            });
            player.on("end", e => {
                stat = "ready";
                this.notify("pl-next#").notify("msg-change", ["stat", stat]);
            });
            this.watch("pl-vol#", (e, d) => player.volume(d.vol));
            player.on("volume", vol => this.notify("msg-change", ["vol", vol]));
            player.on("error", err => logger.error(err));
        }
    },
    Songlist: {
        xml: "<Sqlite id='sqlite' xmlns='/schedule'/>",
        fun: function (sys, items, opts) {
            let tmp = { id: undefined };
            async function next() {
                let last = await items.sqlite.last();
                let song = await items.sqlite.random();
                return song.id == tmp.id || last && song.id == last.id ? next() : (tmp = song);
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
                return new Promise((resolve, reject) => {
                    let pyshell = new PythonShell("playlist.py", {scriptPath: Root});
                    pyshell.send(JSON.stringify(values));
                    pyshell.once('message', message => {
                        let msg = JSON.parse(message);
                        resolve(msg == -1 ? null : msg);
                    });
                    pyshell.end(err => {err && logger.error(err)});
                });
            }
            funList.forEach(key => {
                result[key] = async (...values) => {return await request.apply(null, [key].concat(values))};
            });
            return result;
        }
    }
});

$_("schedule").imports({
    TimingSwitch: {
        xml: "<main id='timingSwitch'/>",
        fun: function (sys, items, opts) {
            let wait, stat = "ready", jobs = [];
            this.watch("sh-schedule#", (e, d) => {
                jobs.forEach(job => job.cancel());
                jobs.splice(0);
                d.schedule.forEach(item => jobs.push(make(item)));
                this.notify("msg-change", ["schedule", d.schedule]);
            });
            this.watch("sh-stop#", e => {
                wait = stat == "play" ? this.notify("pl-toggle#") : "play";
            });
            this.watch("sh-open#", e => {
                wait = stat == "pause" ? this.notify("pl-toggle#") : "pause";
            });
            this.watch("msg-change", (e, key, value) => {
                if (key == "stat") {
                    stat = value;
                    stat == wait && this.notify("pl-toggle#");
                }
            });
            function make(item) {
                let p = item.pattern.split(':');
                return schedule.scheduleJob(`${p[1]} ${p[0]} * * *`, e => sys.timingSwitch.notify(item.action, {}));
            }
        }
    },
    Download: {
        xml: "<main id='download'>\
                <Sqlite id='sqlite'/>\
                <NetEase id='netease' xmlns='../musicbox'/>\
              </main>",
        fun: function (sys, items, opts) {
            let request = require("request");
            this.watch("download", async () => {
                let song, songs = await items.netease.personal_fm() || [];
                for (song of songs) {
                    if (await items.sqlite.exist(song.id)) continue;
                    song.mp3Url = (await items.netease.songs_detail_new_api(song.id)).url;
                    break;
                }
                if (!song || !song.mp3Url) return;
                let filename = song.mp3Url.split('/').pop();
                let filePath = `${Root}/buffer/${filename}`;
                let download = fs.createWriteStream(filePath);
                download.once('error', e => logger.error(e));
                download.once('finish', async e => {
                    await items.sqlite.insert(song.id, song.name, filename);
                });
                request(song.mp3Url).pipe(download);
            });
        }
    },
    Unlink: {
        xml: "<Sqlite id='sqlite'/>",
        fun: function (sys, items, opts) {
            this.watch("unlink", async () => {
                let song = await items.sqlite.last();
                if (song == null) return;
                await items.sqlite.unlink(song);
            });
        }
    },
    Bluetooth: {
        fun: function (sys, items, opts) {
            let timer, bluetooth;
            function bluetooth_() {
                process.exec(`bash ${Root}/bluetooth.sh`, err => {
                    if (err) logger.error(err);
                    else timer = setTimeout(bluetooth_, 30 * 1000);
                });
            }
            this.watch("sh-bluetooth#", (e, o) => {
                if(bluetooth != o.bluetooth) {
                    bluetooth = !!o.bluetooth;
                    bluetooth ? bluetooth_() : clearTimeout(timer);
                    this.notify("msg-change", ["bluetooth", bluetooth]);
                }
            });
        }
    },
    Sqlite: {
        xml: "<Sqlite id='sqlite' xmlns='/sqlite'/>",
        fun: function (sys, items, opts) {
            function exist(songId) {
                return new Promise((resolve, reject) => {
                    let stmt = `SELECT count(*) AS count FROM songs WHERE id=${songId}`;
                    items.sqlite.all(stmt, (err, data) => {
                        if (err) throw err;
                        resolve(data[0].count);
                    });
                });
            }
            function length() {
                return new Promise((resolve, reject) => {
                    let stmt = `SELECT count(*) AS count FROM songs`;
                    items.sqlite.all(stmt, (err, data) => {
                        if (err) throw err;
                        resolve(data[0].count);
                    });
                });
            }
            function insert(id, name, mp3Url) {
                return new Promise((resolve, reject) => {
                    let stmt = items.sqlite.prepare("INSERT INTO songs(id,name,mp3Url) VALUES(?,?,?)");
                    stmt.run(id, name, mp3Url, (err) => {
                        if (err) throw err;
                        resolve(true);
                    });
                });
            }
            function unlink(song) {
                return new Promise((resolve, reject) => {
                    let stmt = items.sqlite.prepare(`DELETE FROM songs WHERE id = ${song.id}`);
                    stmt.run(err => {
                        if (err) throw err;
                        else fs.unlink(`${Root}/buffer/${song.mp3Url}`, err => {
                            if (err) throw err;
                            resolve(true);
                        });
                    });
                });
            }
            function last() {
                return new Promise((resolve, reject) => {
                    let stmt = `SELECT * FROM songs ORDER BY createtime LIMIT 1`;
                    items.sqlite.all(stmt, (err, data) => {
                        if (err) throw err;
                        resolve(data[0]);
                    });
                });
            }
            function random() {
                return new Promise((resolve, reject) => {
                    let stmt = `SELECT * FROM songs ORDER BY RANDOM() LIMIT 1`;
                    items.sqlite.all(stmt, (err, data) => {
                        if (err) throw err;
                        resolve(data[0]);
                    });
                });
            }
            return { exist: exist, length: length, insert: insert, unlink: unlink, last: last, random: random };
        }
    }
});

$_("client").imports({
    Message: {
        xml: "<Sqlite id='sqlite' xmlns='/sqlite'/>",
        fun: async function (sys, items, opts) {
            let message = await options();
            this.watch("msg-change", async (e, key, value) => {
                await update(message[key] = value);
                this.trigger("publish", message);
            });
            function options() {
                return new Promise(resolve => {
                    items.sqlite.all("SELECT * FROM options", (err, rows) => {
                        err ? logger.error(err) : resolve(JSON.parse(rows[0].value));
                    });
                });
            }
            function update() {
                return new Promise(resolve => {
                    let stmt = items.sqlite.prepare("UPDATE options SET value=?");
                    stmt.run(JSON.stringify(message), err => {
                        err ? logger.error(err) : resolve(true);
                    });
                });
            }
            sys.sqlite.watch("msg-change", (e, key, value) => {
                if (key == "stat" && value == "play")
                    sys.sqlite.unwatch().notify("pl-vol#", message);
            });
            this.on("enter", (e, d) => this.trigger("publish", message));
            this.notify("service-ready", message);
        }
    },
    Control: {
        fun: function (sys, items, opts) {
            let set = new Set(
                ["pl-toggle#", "pl-vol#", "sh-schedule#", "sh-reboot#", "sh-bluetooth#"]
            );
            this.on("enter", (e, dd) => {
                let d = JSON.parse(dd.msgin);
                set.has(d.key) && this.notify("*", [d.key, d]);
            });
        }
    }
});

$_("sqlite").imports({
    Sqlite: {
        fun: function (sys, items, opts) {
            let sqlite = require("sqlite3").verbose(),
                db = new sqlite.Database(`${Root}/data.db`);
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

});