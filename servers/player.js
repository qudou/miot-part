/*!
 * player.js v1.0.0
 * https://github.com/qudou/musicbox
 * (c) 2009-2017 qudou
 * Released under the MIT license
 */

const xmlplus = require("xmlplus");
const fs = require("fs");
const schedule = require("node-schedule");
const log4js = require("log4js");
const logger = log4js.getLogger("musicbox");

const ListLength = 300;
const TimeInterval = 3600 * 1000;
const Root = `${__dirname}/player`;
const [Username, Password] = ["17095989603", "139500i"];

let Channel = "豆瓣FM";
const Channels = { "新年歌单": 2101863569 };

xmlplus("player", (xp, $_, t) => {

$_().imports({
    Client: {
        xml: "<i:Client id='client' xmlns:i='//musicbox'>\
                <Index id='index'/>\
                <Message id='message'/>\
                <Control id='control'/>\
              </i:Client>",
        map: { share: "index/musicbox/NetEase index/schedule/Sqlite sqlite/Sqlite" }
    },
    Index: {
        xml: "<main id='index' xmlns:i='index'>\
                <i:Musicbox id='musicbox'/>\
                <i:Router id='router'/>\
                <i:Schedule id='schedule'/>\
              </main>"
    },
    Message: {
        xml: "<Player id='player' xmlns='//musicbox/parts'/>",
        fun: function (sys, items, opts) {
            this.once("enter", (e, message) => {
                sys.player.watch("stat-change", (e, value) => {
                    if (value == "play")
                        sys.player.unwatch().notify("pl-vol#", message);
                });
                this.notify("pl-channel#", message);
                logger.info("service is ready");
            });
        }
    },
    Control: {
        fun: function (sys, items, opts) {
            let set = new Set(
                ["pl-channel#", "pl-toggle#", "pl-vol#"]
            );
            this.on("enter", (e, msg) => {
                set.has(msg.key) && this.notify("*", [msg.key, msg]);
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
            let timer, list = items.songlist;
            this.watch("pl-channel#", (e, msg) => {
                Channel = msg.channel;
                this.trigger("publish", ["channel", Channel]);
                this.notify("pl-next#").notify("quantity-control");
            });
            this.watch("pl-next#", async e => {
                let d = {song: await list.next()};
                if (d.song)
                    return this.notify("*", ["pl-pause pl-play", d]);
                clearTimeout(timer);
                timer = setTimeout(e => this.notify("pl-next#"), 300 * 1000);
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
                <i:UnlinkFM id='unlinkFM'/>\
                <i:UnlinkPL id='unlinkPL'/>\
                <i:Sqlite id='sqlite'/>\
                <NetEase id='netease' xmlns='musicbox'/>\
              </main>",
        fun: function (sys, items, opts) {
            schedule.scheduleJob("0 8 * * *", async e => {
                let login = await items.netease.login(Username, Password);
                if (login.code !== 200)
                    logger.error(`login error! code: ${login.code}`);
            });
            this.watch("quantity-control", async () => {
                if (Channel == "豆瓣FM")
                    return this.notify(await items.sqlite.length() < ListLength ? "download" : "unlink-fm");
                this.notify("download").notify("unlink-pl");
            });
            setInterval(e => this.notify("quantity-control"), TimeInterval);
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
            this.watch("pl-toggle#", (e, d) => {
                if (stat != "ready")
                    this.notify("*", stat == "play" ? "pl-pause" : "pl-resume");
            });
            this.watch("pl-play", (e, d) => {
                player.play(`${Root}/${Channel}/${d.song.mp3Url}`);
                this.trigger("publish", ["song", d.song]);
            });
            player.on("end", e => {
                stat = "ready";
                this.notify("pl-next#").trigger("publish", ["stat", stat]);
            });
            this.watch("pl-vol#", (e, d) => player.volume(d.vol));
            player.on("volume", vol => this.trigger("publish", ["vol", vol]));
            player.on("error", err => logger.error(err));
        }
    },
    Songlist: {
        xml: "<Sqlite id='sqlite' xmlns='../schedule'/>",
        fun: function (sys, items, opts) {
            let tmp = { id: undefined };
            async function next() {
                let song = await items.sqlite.random();
                if (!song) return;
                return song.id == tmp.id ? next() : (tmp = song);
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

$_("index/schedule").imports({
    Download: {
        xml: "<main id='download'>\
                <Sqlite id='sqlite'/>\
                <NetEase id='netease' xmlns='../musicbox'/>\
              </main>",
        fun: async function (sys, items, opts) {
            let request = require("request");
            this.watch("download", async () => {
                let channel = Channel;
                let song, songs = await songsByChannel(channel);
                for (song of songs) {
                    if (await items.sqlite.exist(song.id)) continue;
                    song.mp3Url = (await items.netease.songs_detail_new_api(song.id)).url;
                    if (song.mp3Url) { 
                        download(channel, song); break;
                    }
                }
            });
            async function songsByChannel(channel) {
                if (Channels[channel])
                    return await items.netease.playlist_detail(Channels[channel]) || [];
                return await items.netease.personal_fm() || [];
            }
            function download(channel, song) {
                let filename = song.mp3Url.split('/').pop();
                let filePath = `${Root}/${channel}/${filename}`;
                let download = fs.createWriteStream(filePath);
                download.once('error', e => logger.error(e));
                download.once('finish', async e => {
                    await items.sqlite.insert(song.id, song.name, filename);
                });
                try {
                    request(song.mp3Url).pipe(download);
                } catch(err) {
                    logger.error(err);
                }
            }
        }
    },
    UnlinkFM: {
        xml: "<Sqlite id='sqlite'/>",
        fun: function (sys, items, opts) {
            let current = {id: undefined};
            this.watch("unlink-fm", async () => {
                let song = await items.sqlite.last();
                if (song == null || song.id == current.id) return;
                await items.sqlite.unlink(song);
            });
            this.watch("song-change", (e, value) => current = value);
        }
    },
    UnlinkPL: {
        xml: "<main id='download'>\
                <Sqlite id='sqlite'/>\
                <NetEase id='netease' xmlns='../musicbox'/>\
              </main>",
        fun: function (sys, items, opts) {
            let current = {id: undefined};
            this.watch("unlink-pl", async () => {
                let canRemove = true;
                let song = await items.sqlite.random();
                if (song == null || song.id == current.id) return;
                let songs = await items.netease.playlist_detail(Channels[Channel]) || [];
                for (let item of songs)
                    if (item.id == song.id)
                        canRemove = false;
                songs.length && canRemove && await items.sqlite.unlink(song);
            });
            this.watch("song-change", (e, value) => current = value);
        }
    },
    Sqlite: {
        xml: "<Sqlite id='sqlite' xmlns='/sqlite'/>",
        fun: function (sys, items, opts) {
            function exist(songId) {
                return new Promise((resolve, reject) => {
                    let stmt = `SELECT count(*) AS count FROM ${Channel} WHERE id=${songId}`;
                    items.sqlite.all(stmt, (err, data) => {
                        if (err) throw err;
                        resolve(data[0].count);
                    });
                });
            }
            function length() {
                return new Promise((resolve, reject) => {
                    let stmt = `SELECT count(*) AS count FROM ${Channel}`;
                    items.sqlite.all(stmt, (err, data) => {
                        if (err) throw err;
                        resolve(data[0].count);
                    });
                });
            }
            function insert(id, name, mp3Url) {
                return new Promise((resolve, reject) => {
                    let stmt = items.sqlite.prepare(`INSERT INTO ${Channel}(id,name,mp3Url) VALUES(?,?,?)`);
                    stmt.run(id, name, mp3Url, (err) => {
                        if (err) throw err;
                        resolve(true);
                    });
                });
            }
            function unlink(song) {
                return new Promise((resolve, reject) => {
                    let channel = Channel;
                    let stmt = items.sqlite.prepare(`DELETE FROM ${Channel} WHERE id = ${song.id}`);
                    stmt.run(err => {
                        if (err) throw err;
                        else fs.unlink(`${Root}/${channel}/${song.mp3Url}`, err => {
                            if (err) throw err;
                            resolve(true);
                        });
                    });
                });
            }
            function last() {
                return new Promise((resolve, reject) => {
                    let stmt = `SELECT * FROM ${Channel} ORDER BY createtime LIMIT 1`;
                    items.sqlite.all(stmt, (err, data) => {
                        if (err) throw err;
                        resolve(data[0]);
                    });
                });
            }
            function random() {
                return new Promise((resolve, reject) => {
                    let stmt = `SELECT * FROM ${Channel} ORDER BY RANDOM() LIMIT 1`;
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