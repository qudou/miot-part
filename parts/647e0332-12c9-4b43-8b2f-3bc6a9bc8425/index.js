/*!
 * automat.js v1.0.0
 * https://github.com/qudou/miot-parts
 * (c) 2009-2017 qudou
 * Released under the MIT license
 */

const xmlplus = require("xmlplus");

xmlplus("647e0332-12c9-4b43-8b2f-3bc6a9bc8425", (xp, $_) => {

$_().imports({
    Index: {
        xml: "<main id='index'>\
                <Ready id='ready'/>\
                <Update id='update'/>\
              </main>",
        map: { share: "Sqlite" }
    },
    Ready: {
        xml: "<Sqlite id='sqlite'/>",
        fun: function (sys, items, opts) {
            function data() {
                return new Promise((resolve, reject) => {
                    let stmt = `SELECT * FROM 商品资料`;
                    items.sqlite.all(stmt, (err, data) => {
                        if (err) throw err;
                        resolve(data);
                    });
                });
            }
            this.watch("/ready", async (e, msg) => {
                let table = [];
                let r = await data();
                r.forEach(i => {
                    table[i['行号']] = (table[i['行号']] || []);
                    table[i['行号']][i['列号']] = i;
                });
                this.trigger("to-user", ["/ready", table]);
            });
        }
    },
    Update: {
        xml: "<main id='update'>\
                <Sqlite id='db'/>\
              </main>",
        fun: function (sys, items, opts) {
            this.watch("/update", (e, p) => {
                console.log(p);
                if (p.货号.length > 1 && p.品名.length > 1)
                    return update(p);
                let data = {code: -1, desc: "输入有误"};
                this.trigger("to-user", ["/update", data]);
            });
            function update(b) {
                let update = "UPDATE 商品资料 SET 货号=?,品名=?,库存=?,售价=?,图片=? WHERE id=?";
                let stmt = items.db.prepare(update);
                stmt.run(b.货号,b.品名,b.库存,b.售价,b.图片,b.id, err => {
                    if (err) throw err;
                    let data = {code: 0, desc: "更新成功"};
                    sys.update.trigger("to-user", ["/update", data]);
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