# musicbox

基于树莓派的红外遥控版网易云音乐播放器

## 安装 bcm2835

bcm2835 库是安装模块 `node-dht-sensor` 必需的。bcm2835 库是树莓派 cpu 芯片的库函数，相当于stm32的固件库一样，底层是直接操作寄存器。从 bcm22835 官网（http://www.airspayce.com/mikem/bcm2835/）下载最新版本的库，然后解压安装。

```bash
$ tar -zxvf bcm2835-1.xx.tar.gz
$ cd bcm2835-1.xx
$ ./configure
$ make
$ sudo make check
$ sudo make install
```

## 安装依赖软件包

apt-get install mpg123

apt-get install python-dev

pip install requests
pip install BeautifulSoup4
pip install pycrypto
pip install future

## 红外接收功能安装与配置

VCC 接 3.3v 引脚，GND 接地，IN 接 GPIO 18 口。

打开文件 `/boot/config.txt`，找到以 `dtoverlay` 为开头的配置，去看注释，修改成如下内容。

```
dtoverlay=lirc-rpi,gpio_in_pin=18
```

红外默认输出是18管脚，上述后面的 `,gpio_in_pin=18` 可以不写。如果红外接收头接到其他管脚则需修改对应管脚。

安装完 lirc 软件。

```bash
sudo apt-get install lirc
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
sudo mode2 -d /dev/lirc0
```

最后，将文件 `musicbox/lircd.conf` 覆盖lirc软件的相应文件

```bash
sudo cp ~/lircd.conf /etc/lirc/lircd.conf
```