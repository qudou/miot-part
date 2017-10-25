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
        xml: "<main id='index' xmlns:i='.'>\
                <i:Musicbox id='musicbox'/>\
                <i:Remote id='remote'/>\
                <i:Speeker id='speek'/>\
                <i:Buffer id='buffer'/>\
                <i:Schedule id='schedule'/>\
                <i:Monitor id='monitor'/>\
              </main>",
        map: { share: "speeker/BDAudio" },
        fun: function (sys, items, opts) {
            let cmds = [], data = {};
            function exec(e, c, d = {}) {
                cmds = c.split(' ');
                items.remote.lock();
                sys.index.notify(cmds.shift(), [data = d]);
            }
            function next(e, str) {
                str && rebuild(str);
                let cmd = cmds.shift();
                cmd ? sys.index.notify(cmd, [data]) : items.remote.unlock();
            }
            this.watch("mc-open", e => this.unwatch("exec").watch("exec", exec));
            function rebuild(str) {
                let c = str.charAt(0), s = str.substr(1);
                c == "-" ? s.split(' ').forEach(item => {
                    let i = cmds.indexOf(item);
                    i !== -1 && cmds.splice(i, 1);
                }) : (cmds = cmds.concat(s.split(' ')));
            }
            require("getmac").getMac((err, mac) => {
                if (err) throw err;
                let MAC = mac.replace(/:/g, '') + '/';
                sys.index.append("Client", { prefix: MAC });
                logger.info(`the mac address is ${mac}`);
            });
            this.watch("mc-stop", e => this.unwatch("exec")).notify("mc-open").watch("next", next);
            
        }
    },
    Client: {
        xml: "<i:MQTT id='mqtt' xmlns:i='/xmlmqtt' xmlns:c='client'>\
                <c:Schedule id='schedule'/>\
                <c:Control id='control'/>\
              </i:MQTT>",
        map: { attrs: { mqtt: "prefix" } },
        cfg: { mqtt: { server: "mqtt://t-store.cn:3000", auth: {username: "qudouo", password: "123456"} } },
        fun: function (sys, items, opts) {
            this.watch("publish", (e, topic, payload) => {
                items.mqtt.publish(topic, JSON.stringify(payload));
            });
        }
    },
    Musicbox: {
        xml: "<main id='index' xmlns:i='player'>\
                <i:Channel id='channel'/>\
                <i:Playlist id='playlist'/>\
                <i:Player id='player'/>\
              </main>"
    },
    Remote: {
        fun: function (sys, items, opts) {
            let locked = true, jobs = [];
            this.watch("keypress", (e, key, save) => {
                if (key == "sh-reboot*")
                    return this.notify(key, {});
                locked ? (save && jobs.push(key)) : this.notify(key, {});
            });
            return { lock: e => locked = 1, unlock: e => jobs.length ? this.notify(jobs.shift()) : (locked = 0) };
        }
    },
    Speeker: {
        xml: "<main id='speeker' xmlns:i='speeker'>\
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
    Buffer: {
        xml: "<NetEase id='netease' xmlns='player/tools'/>",
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
                if ( files.length > 120 ) {
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
            this.watch("sh-time", (e, d) => {
                let now = new Date, hours = now.getHours();
                d.buf = true;
                d.speek = `北京时间${hours}点整`;
                this.notify("exec", ["pl-pause speek pl-resume", d]);
            });
            this.watch("sh-reboot*", e => {
                process.exec("reboot", err => {err && logger.error(err)});
            });
            schedule.scheduleJob('0 3 * * *', e => this.notify("mc-stop"));
            schedule.scheduleJob('0 7 * * *', e => this.notify("sh-reboot*"));
            schedule.scheduleJob('0 6-23 * * *', e => this.notify("keypress", "sh-time", true));
        }
    },
    Monitor: {
        fun: function (sys, items, opts) {
            let key = 0;
            let path = `${__dirname}/tmp/ping.log`;
            let ping = `ping www.baidu.com -c 10 > ${path}`;
            let grep = `grep "packet loss" ${path} |awk '{print $6}' |sed 's/%//g'`;
            setInterval(() => {
                if ( !key ) return;
                process.exec(`${ping}\n${grep}`, (error, stdout) => {
                    parseInt(stdout || 100) > 70 ? this.notify("ch-local", {}) : this.notify("load-remotes*").notify("ch-restore", {});
                    logger.debug(`packet loss ${stdout || 100}%`);
                });
            }, 1000 * 60 * 3);
            setInterval(e => {
                process.exec(`bash ${__dirname}/bluetooth.sh`, err => {err && console.log(err)});
            }, 1000 * 60 * 0.5);
            this.watch("pl-paused", e => key = 1).watch("pl-resumed", e => key = 0);
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
                "CH+": "ch-next*", "CH-": "ch-prev*", "|<<": "pl-prev*", ">>|": "pl-next*", ">||": "pl-toggle*", "-": "pl-vol-prev*", "+": "pl-vol-next*",
                "RELOAD": "load-remotes*", "REBOOT": "sh-reboot*"
            };
            let config = { "RELOAD": { force: true } }
            this.on("enter", (e, d) => {
                this.notify("mc-open");
                let key = JSON.parse(d.msgin).key;
                this.notify("keypress", table[key] || key, config[key] || {});
            });
        }
    }
});

$_("player").imports({
    Channel: {
        xml: "<DataLoader id='channel' xmlns='channel'/>",
        fun: function (sys, items, opts) {
            let prev = 0, cursor = 0, list = [];
            this.watch("ch-prev*", (e, d) => {
                if ( --cursor == -1 )
                    prev = cursor, cursor = list.length - 1;
                d.channel = list[cursor].list;
                this.notify("exec", ["pl-change", d]);
            });
            this.watch("ch-next*", (e, d) => {
                if ( ++cursor == list.length )
                    prev = cursor, cursor = 0;
                d.channel = list[cursor].list;
                this.notify("exec", ["pl-change", d]);
            });
            this.watch("ch-local", (e, d) => {
                if ( 0 == cursor ) return;
                prev = cursor;
                d.channel = list[cursor = 0].list;
                this.notify("exec", ["pl-change", d]);
            });
            this.watch("ch-restore", (e, d) => {
                if ( prev == cursor ) return;
                cursor = prev;
                d.channel = list[cursor].list;
                this.notify("exec", ["pl-change", d]);
            });
            this.watch("ch-refresh", (e, d) => {
                list[prev] || (prev = 0);
                list[cursor] || (cursor = 0);
                d.keep = true;
                d.channel = list[cursor].list;
                this.notify("exec", ["pl-change", d]);
            });
            this.on("ch-ready", (e, _list, d) => {
                list = _list;
                d.channel = list[cursor].list;
                logger.info("service is ready");
                this.notify("exec", ["pl-change", d]);
            });
        }
    },
    Playlist: {
        fun: function (sys, items, opts) {
            let channel;
            this.watch("pl-change", (e, d) => {
                if ( channel == d.channel ) 
                    return this.notify("next");
                d.song = (channel = d.channel).curr();
                this.notify("next", d.keep ? "+pl-keep" : "+pl-pause pl-open");
            });
            this.watch("pl-prev*", (e, d) => {
                d.song = channel.prev();
                this.notify("exec", ["pl-pause pl-open", d]);
            });
            this.watch("_next", (e, d) => {
                channel.next().then(item => {
                    d.song = item;
                    this.notify("next");
                });
            }).watch("pl-next*", (e, d) => this.notify("exec", ["pl-pause _next pl-open"]));
        }
    },
    Player: {
        xml: "<Player id='player' xmlns='tools'/>",
        fun: function (sys, items, opts) {
            let player = items.player,
                song, stat = "ready";
            this.watch("pl-pause", (e, d) => {
                stat == "playing" ? player.pause() : this.notify("next", "-pl-resume");
            });
            player.on("pause", e => {
                stat = "pause";
                this.notify("next").notify("pl-paused");
            });
            this.watch("pl-resume", (e, d) => {
                stat == "pause" ? player.pause() : this.notify("next");
            });
            player.on("resume", e => {
                stat = "playing";
                this.notify("next").notify("pl-resumed");
            });
            this.watch("pl-toggle*", (e, d) => {
                this.notify("exec", stat == "playing" ? "pl-pause" : "pl-resume");
            });
            this.watch("pl-play", (e, d) => {
                player.play((song = d.song).mp3Url);
            });
            player.on("end", e => {
                stat = "ready";
                song.mp3Url ? this.notify("pl-next*") : this.notify("exec", ["pl-open", {song: song}]);
            });
            this.watch("pl-keep", (e, d) => {
                stat != "pause" ? this.notify("next", "+pl-pause pl-open") : this.notify("next");
            });
            player.on("error", e => song.mp3Url = null);
        }
    }
});

$_("player/channel").imports({
    DataLoader: {
        xml: "<NetEase id='netease' xmlns='../tools'/>",
        fun: function (sys, items, opts) {
            // let login = await items.netease.login("phone number", "password");
            // let list = await items.netease.user_playlist(login.account.id);
            // console.log(login.account.id);
            let list = [];
            function create(widget, opts) {
                return xp.create("//musicbox/player/channel/" + widget, opts);
            }
            list.unshift({name: "私人电台", list: sys.netease.append("PersonalFM", {list: []}).value()});
            async function load_remotes(e, force) {
                if ( !force && list.length > 2 ) return;
                logger.info("load-remotes begin...");
                let plist = await items.netease.user_playlist(133253499) || [];
                for( let item of plist ) {
                    let songs = await items.netease.playlist_detail(item.id) || [];
                    songs.length && (item.list = create("Songlist", songs));
                }
                if ( !plist.length ) return;
                list.splice(1);
                plist.forEach(item => list.push(item));
                sys.netease.notify("ch-refresh", {}).glance("load-remotes*", load_remotes);
                logger.info("load-remotes complete");
            }
            this.glance("load-remotes*", load_remotes).notify("load-remotes*");
            setTimeout(e => this.trigger("ch-ready", [list, {}]), 0);
        }
    },
    Songlist: {
        fun: function (sys, items, opts) {
            let cursor = 0, list = opts;
            function cursor_() {
                return cursor;
            }
            function index(idx) {
                list[idx] && (cursor = idx);
                return list[idx];
            }
            function length() {
                return list.length;
            }
            function curr() {
                return list[cursor];
            }
            function prev() {
                if ( --cursor == -1 )
                    cursor = list.length - 1;
                return list[cursor];
            }
            async function next() {
                if ( ++cursor == list.length )
                    cursor = 0;
                return list[cursor];
            }
            return { cursor: cursor_, index: index, length: length, curr: curr, prev: prev, next: next };
        }
    },
    PersonalFM: {
        fun: function (sys, items, opts) {
            let cursor = 0;
            let list = opts.list;
            let path = `${__dirname}/tmp/buffer`;
            function cursor_() {
                return cursor;
            }
            function index(idx) {
                list[idx] && (cursor = idx);
                return list[idx];
            }
            function length() {
                return list.length;
            }
            function curr() {
                list[cursor] || list.push(local());
                return update(cursor);
            }
            function prev() {
                if ( --cursor == -1 )
                    cursor = list.length - 1;
                return update(cursor);
            }
            async function next() {
                if ( list[++cursor] )
                    return update(cursor);
                list.push(local());
                if ( list.length > 100 )
                    list.splice(0, 1), --cursor;
                return list[cursor];
            }
            function local() {
                let files = fs.readdirSync(path),
                    i = Math.floor(Math.random()*files.length);
                return files[i].split('.').pop() == "mp3" ? { mp3Url: `${path}/${files[i]}` } : local();
            }
            function update(cursor) {
                let files = fs.readdirSync(path);
                let file = list[cursor].mp3Url.split('/').pop();
                if ( files.indexOf(file) == -1 )
                    list[cursor] = local();
                return list[cursor];
            }
            return { cursor: cursor_, index: index, length: length, curr: curr, prev: prev, next: next };
        }
    }
});

$_("player/tools").imports({
    Player: {
        xml: "<NetEase id='netease'/>",
        fun: function (sys, items, opts) {
            let volume = 100,
                mpg = require('mpg123'),
                player = new mpg.MpgPlayer();
            this.watch("pl-vol-prev*", e => volume > 0 && player.volume(volume -= 10));
            this.watch("pl-vol-next*", e => volume < 100 && player.volume(volume += 10));
            this.watch("pl-open", async (e, d) => {
                if ( !d.song.mp3Url )
                    d.song.mp3Url = (await items.netease.songs_detail_new_api(d.song.id)).url;
                d.song.mp3Url ? this.notify("next", "+pl-play") : this.notify("pl-next*", {});
            });
            return player;
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
            let resolve,
                mpg = require('mpg123'),
                player = new mpg.MpgPlayer();
            function play(file) {
                player.play(file);
                player.once("end", e => resolve(true));
                return new Promise(resolve_ => resolve = resolve_);
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
        opt: { server: "mqtt://test.mosquitto.org", prefix: "" },
        fun: async function (sys, items, opts) {
            let table = this.children().hash();
            let client  = require("mqtt").connect(opts.server, opts.auth);
            client.on("connect", e => {
                for ( let key in table )
                    client.subscribe(opts.prefix + key + "/in");
                console.log("connected to " + opts.server);
            });
            client.on("message", (topic, message) => {
                console.log(topic, message);
                let key = topic.substr(opts.prefix.length);
                key = key.substring(0, key.lastIndexOf("/in"));
                table[key].trigger("enter", {msgin: message.toString()}, false);
            });
            this.on("publish", "./*[@id]", function (e, d) {
                console.log(opts.prefix + this + "/out", d.msgout);
                e.stopPropagation();
                client.publish(opts.prefix + this + "/out", d.msgout);
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