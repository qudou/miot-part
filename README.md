# musicbox

基于树莓派的红外遥控版网易云音乐播放器。下面是遥控键盘示意图：

<pre>
CH-     CH      CH+  
<<      >>      ||   
-       +       EQ   
0       100+    200+ 
1       2       3    
4       5       6    
7       8       9    
</pre>

musicbox 以当前用户收藏的歌单为频道列表。`CH-/+` 代表切换至上/下一频道，单按 `CH` 键可播报当前频道的相关信息，双按 `CH` 键则重新启动 musicbox。`<</>>` 代表切换至上/下一首曲目，按 `||` 键可播放/暂停当前曲目。`+/-` 是音量调节键。按 `EQ` 键可播报当前曲目的相关信息。单/双按 `0` 至 `9` 按键，则播放相应序数的曲目。比如单按 `6`，则播放序数为 `6` 的曲目；又如，双按 `7`，则播放序数为 `77` 的曲目。按 `100+` 播报当前日期，按 `200+` 播报当前时间。

## 安装依赖软件包

```bash
$ [sudo] apt-get install mpg123
$ [sudo] apt-get install python-dev
$ [sudo] pip install requests
$ [sudo] pip install BeautifulSoup4
$ [sudo] pip install pycrypto
$ [sudo] pip install future
$ [sudo] npm install forever -g
```

## 红外接收功能安装与配置

VCC 接 3.3v 引脚，GND 接地，IN 接 GPIO 18 口。

打开文件 `/boot/config.txt`，找到以 `dtoverlay` 为开头的配置，去看注释，修改成如下内容。

```
dtoverlay=lirc-rpi,gpio_in_pin=18
```

红外默认输出是 18 管脚，上述后面的 `,gpio_in_pin=18` 可以不写。如果红外接收头接到其他管脚则需修改对应管脚。

安装完 lirc 软件。

```bash
$ [sudo] apt-get install lirc
```

编辑文件 `/etc/lirc/hardware.conf` 修改其中的部分内容如下。修改完后保存并重启系统，并通过 `ls /dev/l*` 命令查看红外线设备是否能用，如果有 lirc0 就说明能用了。

```
LIRCD_ARGS=”--uinput”  
DRIVER=”default”  
DEVICE=”/dev/lirc0″
MODULES=”lirc_rpi”  
```

测试红外线接收功能，首先使用命令 `/etc/init.d/lirc stop` 关闭 LIRC 软件，然后执行如下命令。

```bash
$ [sudo] mode2 -d /dev/lirc0
```

最后，将文件 `musicbox/lircd.conf` 覆盖 LIRC 软件的相应文件

```bash
$ [sudo] cp lircd.conf /etc/lirc/lircd.conf
```

## 安装自启动脚本

1. 拷贝文件 `musicbox` 至目录 `/etc/init.d/`

```bash
$ [sudo] cp musicbox /etc/init.d/
```

2. 修改拷贝后文件的执行权限

```bash
$ [sudo] chmod 755 musicbox
```

3. 添加开机启动项

```bash
$ [sudo] update-rc.d musicbox defaults
```