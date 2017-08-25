# musicbox

基于树莓派的红外遥控版网易云音乐播放器，目前支持登录，频道切换，曲目切换和音量调整功能。另外还加入了整点报时和闹钟功能。还有一个功能就是加了个 dht11 的温湿度传感器，按 200+ 按键就可以播报了。

## 遥控键盘示意图

<pre>
CH-     CH      CH+       
|<<     >>|     ||  
-       +       EQ  
0       100+    200+
1       2       3   
4       5       6   
7       8       9   
</pre>

## 安装 bcm2835

bcm2835 库是安装模块 `node-dht-sensor` 必需的。bcm2835 库是树莓派 cpu 芯片的库函数，相当于stm32的固件库一样，底层是直接操作寄存器。从 [bcm22835 官网](http://www.airspayce.com/mikem/bcm2835/) 下载最新版本的库，然后解压安装。

```bash
$ tar -zxvf bcm2835-1.xx.tar.gz
$ cd bcm2835-1.xx
$ ./configure
$ make
$ sudo make check
$ sudo make install
```

## 安装依赖软件包

```bash
$ sudo apt-get install mpg123
$ sudo apt-get install python-dev
$ sudo pip install requests
$ sudo pip install BeautifulSoup4
$ sudo pip install pycrypto
$ sudo pip install future
```

## 红外接收功能安装与配置

VCC 接 3.3v 引脚，GND 接地，IN 接 GPIO 18 口。

打开文件 `/boot/config.txt`，找到以 `dtoverlay` 为开头的配置，去看注释，修改成如下内容。

```
dtoverlay=lirc-rpi,gpio_in_pin=18
```

红外默认输出是18管脚，上述后面的 `,gpio_in_pin=18` 可以不写。如果红外接收头接到其他管脚则需修改对应管脚。

安装完 lirc 软件。

```bash
$ sudo apt-get install lirc
```

编辑文件 `/etc/lirc/hardware.conf` 修改其中的部分内容如下。修改完后保存并重启系统，并通过 ls /dev/l* 命令查看红外线设备是否能用，如果有 lirc0 就说明能用了。

```
LIRCD_ARGS=”--uinput”  
DRIVER=”default”  
DEVICE=”/dev/lirc0″
MODULES=”lirc_rpi”  
```

测试红外线接收功能，首先使用命令 `/etc/init.d/lirc stop` 关闭 LIRC 软件，然后执行如下命令。

```bash
$ sudo mode2 -d /dev/lirc0
```

最后，将文件 `musicbox/lircd.conf` 覆盖lirc软件的相应文件

```bash
$ sudo cp ~/lircd.conf /etc/lirc/lircd.conf
```

## 安装自启动脚本

1. 拷贝 musicbox 至目录 `/etc/init.d`

```bash
$ sudo cp musicbox /etc/init.d/
```

2. 修改拷贝后文件的执行权限

```bash
$ sudo chmod 755 deamon
```

3. 添加开机启动项

```bash
$ sudo update-rc.d deamon defaults
```