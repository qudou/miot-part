/*!
 * musicbox.js v1.0.0
 * https://github.com/qudou/musicbox
 * (c) 2009-2017 qudou
 * Released under the MIT license
 */

const xmlplus = require("xmlplus");

xmlplus("musicbox", (xp, $_, t) => {

$_().imports({
    Index: {
        xml: "<main id='index' xmlns:i='.'>\
                <i:Remote id='remote'/>\
                <i:Speeker id='speek'/>\
                <i:Channel id='channel'/>\
                <i:Playlist id='playlist'/>\
                <i:Player id='player'/>\
                <i:Schedule id='schedule'/>\
              </main>",
        map: { share: "speeker/BDAudio" },
        fun: function (sys, items, opts) {
            let cmds = [], data = {};
            this.watch("exec", (e, c, d = {}) => {
                cmds = c.split(' ');
                items.remote.lock();
                this.notify(cmds.shift(), [data = d]);
            });
            this.watch("next", (e, str) => {
                str && rebuild(str);
                let cmd = cmds.shift();
                cmd ? this.notify(cmd, [data]) : items.remote.unlock();
            });
            this.watch("error", (e, type, err) => {
                console.log("my", err);
            });
            function rebuild(str) {
                let c = str.charAt(0), s = str.substr(1);
                c == "-" ? s.split(' ').forEach(item => {
                    let i = cmds.indexOf(item);
                    i !== -1 && cmds.splice(i, 1);
                }) : (cmds = cmds.concat(s.split(' ')));
            }
        }
    },
    Remote: {
        fun: function (sys, items, opts) {
            let locked = true,
                last, timer, jobs = [],
                lirc_node = require('lirc_node');
            lirc_node.init();
            lirc_node.addListener(data => {
                if ( data.repeat != "00" ) return;
                clearTimeout(timer);
                if ( last && data.key == last.key ) {
                    last = null;
                    return this.notify("keypress", data.key + data.key);
                }
                last = data;
                timer = setTimeout(e => {
                    last = null;
                    this.notify("keypress", data.key);
                }, 400); 
            });
            this.watch("keypress", (e, key, save) => {
                if (key == "CHCH")
                    return this.notify(key, {});
                locked ? (save && jobs.push(key)) : key.match(/^[0-9]{1,2}$/) ? this.notify("NUM", {index: parseInt(key)}) : this.notify(key, {});
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
            let fs = require("fs");
            this.watch("speek", async (e, d) => {
                try {
                    let file = await items.bdAudio(d.speek);
                    await items.player.play(file);
                    d.buf ? (d.buf = undefined) : fs.unlinkSync(file);
                    this.notify("next");
                } catch (err) {
                    this.notify("error", ["speek", err]);
                }
            });
        }
    },
    Channel: {
        xml: "<DataLoader id='channel' xmlns='channel'/>",
        fun: function (sys, items, opts) {
            let cursor = 0, list = [];
            this.watch("CH-", (e, d) => { 
                if ( --cursor == -1 )
                    cursor = list.length - 1;
                d.channel = list[cursor].list;
                d.speek = `上一频道：${list[cursor].name}`;
                this.notify("exec", ["pause speek ch_change", d]);
            });
            this.watch("CH+", (e, d) => {
                if ( ++cursor == list.length )
                    cursor = 0;
                d.channel = list[cursor].list;
                d.speek = `下一频道：${list[cursor].name}`;
                this.notify("exec", ["pause speek ch_change", d]);
            });
            this.watch("CH", (e, d) => {
                d.speek = `当前频道：${list[cursor].name}，曲目量：${list[cursor].list.length()}`;
                this.notify("exec", ["pause speek resume", d]);
            });
            this.on("data_ready", (e, _list, d) => {
                list = _list;
                d.channel = list[cursor].list;
                d.buf = true;
                d.speek = "网易云音乐，听见好时光！";
                console.log("service is ready");
                this.notify("exec", ["speek ch_change", d]);
            });
        }
    },
    Playlist: {
        fun: function (sys, items, opts) {
            let channel, volume = 100;
            this.watch("ch_change", (e, d) => {
                d.song = (channel = d.channel).curr();
                d.speek = `下面播放曲目：${d.song.name}，演唱者：${d.song.artists[0].name}`;
                this.notify("next", "+speek open");
            });
            this.watch("PREV", (e, d) => {
                d.song = channel.prev();
                d.speek = `上一首：${d.song.name}，演唱者：${d.song.artists[0].name}`;
                this.notify("exec", ["pause speek open", d]);
            });
            this.watch("_next", (e, d) => {
                channel.next().then(item => {
                    d.song = item;
                    d.speek = `下一首：${d.song.name}，演唱者：${d.song.artists[0].name}`;
                    this.notify("next");
                });
            }).watch("NEXT", (e, d) => this.notify("exec", ["pause _next speek open", d]));
            this.watch("NUM", (e, d) => {
                d.song = channel.index(d.index);
                if ( !d.song ) {
                    d.speek = `序数为${d.index}的曲目不存在，请重新选择`;
                    return this.notify("exec", ["pause speek resume", d]);
                }
                d.speek = `下面播放曲目：${d.song.name}，演唱者：${d.song.artists[0].name}`;
                this.notify("exec", ["pause speek open", d]);
            });
            this.watch("EQ", (e, d) => {
                d.song = channel.curr();
                d.speek = `当前曲目：${d.song.name}，序数：${channel.cursor()}，演唱者：${d.song.artists[0].name}，音量：${volume}%`;
                this.notify("exec", ["pause speek resume", d]);
            });
            this.watch("volume", (e, vol) => volume = parseInt(vol));
        }
    },
    Player: {
        xml: "<Player id='player' xmlns='tools'/>",
        fun: function (sys, items, opts) {
            let player = items.player,
                song, stat = "ready";
            this.watch("pause", (e, d) => {
                stat == "playing" ? player.pause() : this.notify("next", "-resume");
            });
            player.on("pause", e => {
                stat = "pause";
                this.notify("next");
            });
            this.watch("resume", (e, d) => {
                stat == "pause" ? player.pause() : this.notify("next");
            });
            player.on("resume", e => {
                stat = "playing";
                this.notify("next");
            });
            this.watch("PLAY/PAUSE", (e, d) => {
                this.notify("exec", stat == "playing" ? "pause" : "resume");
            });
            this.watch("play", (e, d) => {
                player.play((song = d.song).mp3Url);
            });
            player.on("end", e => {
                stat = "ready";
                song.mp3Url ? this.notify("NEXT", {}) : this.notify("exec", ["open", {song: song}]);
            });
            player.on("error", e => song.mp3Url = null);
        }
    },
    Schedule: {
        fun: function (sys, items, opts) {
            let schedule = require("node-schedule");
            this.glance("CHCH", (e, d) => {
                console.log("restart");
                d.buf = true;
                d.speek = `网易云音乐即将重新启动，请稍后`;
                this.notify("exec", ["pause speek restart", d]);
            });
            this.watch("restart", (e, d) => {
                require('child_process').exec("service musicbox restart", err => {err && console.log(err)});
            });
            this.watch("100+", (e, d) => {
                let now = new Date, year = now.getFullYear(), month = now.getMonth(), day = now.getDate(), week = now.getDay();
                d.speek = `${year}年${month+1}月${day}日，星期${week}`;
                this.notify("exec", ["pause speek resume", d]);
            });
            this.watch("200+", (e, d) => {
                let now = new Date, hours = now.getHours(), minutes = now.getMinutes();
                d.buf = true;
                d.speek = minutes ? `北京时间${hours}点${minutes}分` : `北京时间${hours}点整`;
                this.notify("exec", ["pause speek resume", d]);
            });
            schedule.scheduleJob('0 6-23 * * *', e => this.notify("keypress", "200+"));
        }
    }
});

$_("channel").imports({
    DataLoader: {
        xml: "<NetEase id='netease' xmlns='/tools'/>",
        fun: async function (sys, items, opts) {
            let login = await items.netease.login("user", "pass"); // 这里输入用户名与密码（注：临时硬编码）
            let list = await items.netease.user_playlist(login.account.id);
            function create(widget, opts) {
                return xp.create("//musicbox/channel/" + widget, opts);
            }
            for( let item of list ) {
                let songs = await items.netease.playlist_detail(item.id);
                songs.length && (item.list = create("Songlist", songs));
            }
            let songs = await items.netease.personal_fm();
            list.unshift({name: "私人电台", list: sys.netease.append("PersonalFM", {list: songs}).value()});
            sys.netease.trigger("data_ready", [list, {}]);
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
        xml: "<NetEase id='netease' xmlns='/tools'/>",
        fun: function (sys, items, opts) {
            let cursor = 0, list = opts.list;
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
                if ( list[++cursor] ) 
                    return list[cursor];
                list = list.concat(await items.netease.personal_fm());
                return list[cursor];
            }
            return { cursor: cursor_, index: index, length: length, curr: curr, prev: prev, next: next };
        }
    }
});

$_("tools").imports({
    Player: {
        xml: "<NetEase id='netease'/>",
        fun: function (sys, items, opts) {
            let volume = 100,
                mpg = require('mpg123'),
                player = new mpg.MpgPlayer();
            player.on("volume", vol => this.notify("volume", vol));
            this.watch("VOL-", e => volume > 0 && player.volume(volume -= 10));
            this.watch("VOL+", e => volume < 100 && player.volume(volume += 10));
            this.watch("open", async (e, d) => {
                if ( !d.song.mp3Url )
                    d.song.mp3Url = (await items.netease.songs_detail_new_api(d.song.id)).url;
                d.song.mp3Url ? this.notify("next", "+play") : this.notify("NEXT", {});
            });
            return player;
        }
    },
    NetEase: {
        xml: "<main id='netease'/>",
        fun: function (sys, items, opts) {
            let resolve, result = {},
                PythonShell = require('python-shell'),
                funList = ["login", "personal_fm", "top_songlist", "songs_detail_new_api", "get_version", "daily_signin", "recommend_playlist", "user_playlist", "playlist_detail", "songs_detail", "channel_detail"];
            function request() {
                let pyshell = new PythonShell("playlist.py", {scriptPath: __dirname});
                pyshell.send(JSON.stringify([].slice.call(arguments)));
                pyshell.once('message', message => resolve(JSON.parse(message)));
                pyshell.end((err) => {if (err) throw err});
                return new Promise((resolve_, reject) => resolve = resolve_);
            }
            funList.forEach(key => {
                result[key] = async function() {return await request.apply(null, [key].concat([].slice.call(arguments)))};
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
                let filePath = "/tmp/" + md5(tex);
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

}).startup("//musicbox/Index");