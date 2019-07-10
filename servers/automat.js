/*!
 * automat.js v1.0.0
 * https://github.com/qudou/miot-parts
 * (c) 2009-2017 qudou
 * Released under the MIT license
 */

const xmlplus = require("xmlplus");

xmlplus("automat", (xp, $_, t) => {

$_().imports({
    Client: {
        xml: "<i:Client id='client' xmlns:i='//miot-parts'>\
                <DropGoods id='drop-goods'/>\
              </i:Client>"
    },
    DropGoods: {
        xml: "<main id='dropGoods'>\
                <Command id='command'/>\
                <SerialPort id='serialPort'/>\
              </main>",
        fun: function (sys, items, opts) {
            this.watch("drop-goods", (e, v) => {
                let datain = items.command(v.ln, v.col);
                items.serialPort.write(datain);
            });
            sys.serialPort.on("complete", (e, data) => {
                //this.trigger("publish", [data]);
            });
            this.on("enter", (e, msg) => this.notify("drop-goods", msg));
        }
    },
    Command: {
        fun: function (sys, items, opts) {
            const HEAD = [0xAA,0x18,0x01,0xC9];                         // 帧头,长度,索引,命令
            const SET_CODE = [0x04,0x03,0x02,0x01,0x04,0x03,0x02,0x01]; // 控制板子设备唯一码
            const CMD_CODE = [0x04,0x03,0x02,0x01,0x04,0x03];           // 指令唯一码

            function data(ln, col) {
                let a = [0x0E].concat(SET_CODE,[0x02],CMD_CODE);        // 0x0E 子命令，0x02 控制板命令
                return a.concat([0x01,ln,col,0x01,0x00]);               // 0x01 控制仓位总数，ln/col 仓位行列参数 0x01 0x00 仓位控制次数
            }
            function BBC_check(data) {                                  //  BYTE 异或校验码 校验范围：Length+ Index+ CMD+ Data
                let sum = 0;
                let num = HEAD.concat(data);
                for (let i = 1; i < num.length; i++)                    // 跳过帧头
                    sum = sum ^ num[i];
                return sum;
            }
            function dropGoods(ln, col) {
                let d = data(ln, col);
                let BBC = BBC_check(d);
                return new Buffer(HEAD.concat(d,BBC,[0xDD]));
            }
            return dropGoods;
        }
    },
    SerialPort: {
        xml: "<main id='serialport'/>",
        fun: function ( sys, items, opts ) {
            let serial, buffer;
            const raspi = require('raspi');
            const Serial = require('raspi-serial').Serial;

            raspi.init(() => {
                serial = new Serial({baudRate: 38400});
                serial.open(() => serial.on('data', onData));
            });
            function onData(data) {
                buffer = Buffer.concat([buffer, data]);
                data = buffer.toString('hex');
                data.length == 46 && complete(data.substr(40, 2));
            }
            function complete(data) {
                sys.serialport.trigger("complete", [parseInt("0x" + data)]);
            }
            function write(datain) {
                buffer = new Buffer([]);
                serial.write(datain);
            }
            return { write: write };
        }
    }
});

});