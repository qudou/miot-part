/*!
 * auto.js v1.0.0
 * https://github.com/qudou/miot-parts
 * (c) 2009-2017 qudou
 * Released under the MIT license
 */

const xmlplus = require("xmlplus");
const schedule = require("node-schedule");

xmlplus("9a088a44-970b-4383-a7a2-a318ad8fd3fe", (xp, $_, t) => {

$_().imports({
    Index: {
        xml: "<main id='index'>\
                <Timers id='timers'/>\
                <Update id='update'/>\
                <Schedule id='schedule'/>\
              </main>",
        map: { share: "Sqlite"}
    },
    Timers: {
        xml: "<Sqlite id='sqlite'/>",
        fun: async function (sys, items, opts) {
            function timers() {
                return new Promise((resolve, reject) => {
                    items.sqlite.all(`SELECT * FROM timers`, (err, rows) => {
                        if (err) throw err;
                        resolve(rows);
                    });
                });
            }
            this.watch("/timers", async () => {
                let list = await timers();
                this.trigger("to-user", ["/timers", list]);
            });
            let list = await timers();
            list.forEach(timer => this.notify("set-timer", timer.id));
        }
    },
    Update: {
        xml: "<Sqlite id='sqlite'/>",
        fun: function (sys, items, opts) {
            this.watch("/update", (e, p) => {
                let update = "UPDATE timers SET pattern=? WHERE id=?";
                let stmt = items.sqlite.prepare(update);
                stmt.run(p.pattern, p.id, err => {
                    if (err) throw err;
                    this.notify("set-timer", p.id);
                });
            });
        }
    },
    Schedule: {
        xml: "<main id='schedule'>\
                <Sqlite id='sqlite'/>\
              </main>",
        fun: function (sys, items, opts) {
            let jobs = [];
            function timer(id) {
                return new Promise((resolve, reject) => {
                    let stmt = `SELECT * FROM timers WHERE id=${id}`;
                    items.sqlite.all(stmt, (err, rows) => {
                        if (err) throw err;
                        resolve(rows[0]);
                    });
                });
            }
            this.watch("set-timer", async (e, id) => {
                let t = await timer(id);
                let job = jobs[t.id];
                job && job.cancel();
                jobs[t.id] = makeJob(t);
            });
            function makeJob(item) { // action: paly or pause
                let p = item.pattern.split(':');
                return schedule.scheduleJob(`${p[1]} ${p[0]} * * *`, e => {
                    let payload = {topic: "control", body: {stat: item.action}};
                    sys.schedule.trigger("to-part", [item.target, payload]);
                });
            }
        }
    },
    Sqlite: {
        fun: function (sys, items, opts) {
            let sqlite = require("sqlite3").verbose(),
                db = new sqlite.Database(`${__dirname}/data.db`);
            db.exec("VACUUM");
            db.exec("PRAGMA foreign_keys = ON");
            return db;
        }
    }
});

});