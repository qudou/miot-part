/*!
 * player.js v1.0.0
 * https://github.com/qudou/miot-parts
 * (c) 2009-2017 qudou
 * Released under the MIT license
 */

const fs = require("fs");
const xmlplus = require("xmlplus");
const log4js = require("log4js");
const logger = log4js.getLogger("miot-parts");

const Root = `${__dirname}/player`;
const Server = "http://www.xmlplus.cn:8080";

xmlplus("player", (xp, $_, t) => {

$_().imports({
    Client: {
        xml: "<i:Client id='client' xmlns:i='//miot-parts'>\
                <Index id='index'/>\
                <Message id='message'/>\
                <Control id='control'/>\
              </i:Client>",
        map: { share: "index/schedule/Database index/schedule/Sqlite" }
    },
    Index: {
        xml: "<main id='index' xmlns:i='index'>\
                <i:Musicbox id='musicbox'/>\
                <i:Router id='router'/>\
                <i:Schedule id='schedule'/>\
              </main>"
    },
    Message: {
        xml: "<main id='player'/>",
        fun: function (sys, items, opts) {
            this.once("enter", (e, msg) => {
                sys.player.watch("stat-change", (e, value) => {
                    if (value == "play")
                        sys.player.unwatch().notify("pl-vol#", msg.vol);
                });
                this.notify("pl-interval#", msg.interval);
                msg.stat != "pause" && this.notify("pl-channel#", msg.channel);
            });
        }
    },
    Control: {
        fun: function (sys, items, opts) {
            let buf = {};
            let set = new Set(["channel", "stat", "vol", "interval"]);
            this.on("enter", (e, msg) => {
                for (let key in msg)
                  if (set.has(key) && buf[key] != msg[key])
                     this.notify("*", [`pl-${key}#`, msg[key]]);
                buf = msg;
            });
        }
    }
});

$_("index").imports({
    Musicbox: {
        xml: "<main xmlns:i='musicbox'>\
                <i:Player id='player'/>\
                <i:Songlist id='songlist'/>\
              </main>",
        fun: function (sys, items, opts) {
            let timer, channel, notified = {};
            this.watch("pl-channel#", (e, value) => {
                channel = value;
                this.trigger("publish", ["channel", channel]).notify("pl-next#");
            });
            this.watch("pl-next#", async e => {
                let ch = channel;
                let d = {song: await items.songlist.next(ch)};
                clearTimeout(timer);
                if (d.song) {
                    d.mp3Url = `${Root}/${ch}/${d.song.mp3Url}`
                    return this.notify("*", ["pl-pause pl-play", d]);
                }
                timer = setTimeout(e => this.notify("pl-next#"), 300 * 1000);
                notified[ch] || this.notify("quantity-control") && (notified[ch] = 1);
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
                <i:Download id='download'/>\
                <i:Unlink id='unlink'/>\
                <i:Database id='database'/>\
              </main>",
        fun: async function (sys, items, opts) {
            let timer;
            let channel = "云音乐热歌榜";
            let schedule = require("node-schedule");
            this.watch("channel-change", (e, value) => channel = value);
            this.watch("pl-interval#", (e, value) => {
                clearInterval(timer);
                timer = setInterval(e => this.notify("quantity-control"), value * 60 * 1000);
                this.trigger("publish", ["interval", value]);
            });
            this.watch("quantity-control", () => this.notify("download", channel));
            setInterval(() => sys.unlink.notify("unlink", channel), 24 * 60 * 60 * 1000);
        }
    }
});

$_("index/musicbox").imports({
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
                this.notify("next").trigger("publish", ["stat", stat]);
            });
            this.watch("pl-resume", (e, d) => {
                stat == "pause" ? player.pause() : this.notify("next");
            });
            player.on("resume", e => {
                stat = "play";
                this.notify("next").trigger("publish", ["stat", stat]);
            });
            this.watch("pl-stat#", (e, value) => {
                if (stat != "ready")
                    this.notify("*", stat == "play" ? "pl-pause" : "pl-resume");
            });
            this.watch("pl-play", (e, d) => {
                player.play(d.mp3Url);
                this.trigger("publish", ["song", d.song]);
            });
            player.on("end", e => {
                stat = "ready";
                this.notify("pl-next#").trigger("publish", ["stat", stat]);
            });
            this.watch("pl-vol#", (e, value) => player.volume(value));
            player.on("volume", vol => this.trigger("publish", ["vol", vol]));
            player.on("error", err => logger.error(err));
        }
    },
    Songlist: {
        xml: "<Database id='db' xmlns='../schedule'/>",
        fun: function (sys, items, opts) {
            let tmp = { id: undefined };
            async function next(channel) {
                let song = await items.db.random(channel);
                if (!song) return;
                let len = await items.db.length(channel);
                return song.id == tmp.id && len > 1 ? next(channel) : (tmp = song);
            }
            return { next: next };
        }
    }
});

$_("index/schedule").imports({
    Download: {
        xml: "<Database id='db'/>",
        fun: function (sys, items, opts) {
            let request = require("request");
            this.watch("download", async (e, channel) => {
                let songs = await songsByChannel(channel);
                for (let song of songs) {
                    if (await items.db.exist(channel, song.id)) continue;
                    song.mp3Url = `${Server}/${encodeURIComponent(channel)}/${song.mp3Url}`;
                    if (await exists(channel, song)) continue;
                    if (song.mp3Url) {
                        download(channel, song); break;
                    }
                }
            });
            function songsByChannel(channel) {
                return new Promise((resolve, reject) => {
                    request(`${Server}/songlist/${encodeURIComponent(channel)}`, (error, response, body) => {
                       if ( error || response.statusCode !== 200 )
                            return resolve([]);
                       resolve(JSON.parse(body));
                    });
                });                
            }
            function download(channel, song) {
                let filename = song.mp3Url.split('/').pop();
                let filePath = `${Root}/${channel}/${filename}`;
                let download = fs.createWriteStream(filePath);
                download.once("error", e => logger.error(e));
                download.once("finish", async e => {
                    await items.db.insert(channel, song.id, song.name, filename);
                });
                try {
                    request(song.mp3Url).pipe(download);
                } catch(err) {
                    logger.error(err);
                }
            }
            function exists(channel, song) {
                return new Promise((resolve, reject) => {
                    let filename = song.mp3Url.split('/').pop();
                    let filePath = `${Root}/${channel}/${filename}`;
                    fs.exists(filePath, exists => resolve(exists)); 
                });
            }
        }
    },
    Unlink: {
        xml: "<main id='unlink'>\
                <Database id='db'/>\
                <Sqlite id='sqlite'/>\
              </main>",
        fun: function (sys, items, opts) {
            let current = {id: undefined};
            let request = require("request");
            this.watch("unlink", async (e, channel) => {
                let arr = [];
                let songs = await songsByChannel(channel) || [];
                for (let item of songs)
                    arr.push(item.id);
                let stmt = `SELECT * FROM ${channel} WHERE id NOT IN (${arr.join(',')}) AND id <> ${current.id}`;
                items.sqlite.all(stmt, (err, data) => {
                    if (err) throw err;
                    data.forEach(item => items.db.unlink(channel, item));;
                });
            });
            function songsByChannel(channel) {
                return new Promise((resolve, reject) => {
                    request(`${Server}/${encodeURIComponent(channel)}`, (error, response, body) => {
                       if ( error || response.statusCode !== 200 )
                            return resolve([]);
                       reslove(JSON.parse(body));
                    });
                });
            }
            this.watch("song-change", (e, value) => current = value);
        }
    },
    Database: {
        xml: "<Sqlite id='sqlite'/>",
        fun: function (sys, items, opts) {
            function exist(channel, songId) {
                return new Promise((resolve, reject) => {
                    let stmt = `SELECT count(*) AS count FROM ${channel} WHERE id=${songId}`;
                    items.sqlite.all(stmt, (err, data) => {
                        if (err) throw err;
                        resolve(data[0].count);
                    });
                });
            }
            function length(channel) {
                return new Promise((resolve, reject) => {
                    let stmt = `SELECT count(*) AS count FROM ${channel}`;
                    items.sqlite.all(stmt, (err, data) => {
                        if (err) throw err;
                        resolve(data[0].count);
                    });
                });
            }
            function insert(channel, id, name, mp3Url) {
                return new Promise((resolve, reject) => {
                    let stmt = items.sqlite.prepare(`INSERT INTO ${channel}(id,name,mp3Url) VALUES(?,?,?)`);
                    stmt.run(id, name, mp3Url, (err) => {
                        if (err) throw err;
                        resolve(true);
                    });
                });
            }
            function unlink(channel, song) {
                return new Promise((resolve, reject) => {
                    let stmt = items.sqlite.prepare(`DELETE FROM ${channel} WHERE id = ${song.id}`);
                    stmt.run(err => {
                        if (err) throw err;
                        fs.unlink(`${Root}/${channel}/${song.mp3Url}`, err => {
                            if (err) throw err;
                            resolve(true);
                        });
                    });
                });
            }
            function last(channel) {
                return new Promise((resolve, reject) => {
                    let stmt = `SELECT * FROM ${channel} ORDER BY createtime LIMIT 1`;
                    items.sqlite.all(stmt, (err, data) => {
                        if (err) throw err;
                        resolve(data[0]);
                    });
                });
            }
            function random(channel) {
                return new Promise((resolve, reject) => {
                    let stmt = `SELECT * FROM ${channel} ORDER BY RANDOM() LIMIT 1`;
                    items.sqlite.all(stmt, (err, data) => {
                        if (err) throw err;
                        resolve(data[0]);
                    });
                });
            }
            return { exist: exist, length: length, insert: insert, unlink: unlink, last: last, random: random };
        }
    },
    Sqlite: {
        fun: function (sys, items, opts) {
            let sqlite = require("sqlite3").verbose(),
                db = new sqlite.Database(`${Root}/data.db`);
			db.exec("VACUUM");
            db.exec("PRAGMA foreign_keys = ON");
            return db;
        }
    }
});

});