# miot-parts

基于树莓派的物联网配件集。该配件集专为物联平台 [miot](https://github.com/qudou/miot) 设计，client 目录包含的是客户端文件。


## 播放器配置

如果使用默认的音频播放接口，则无需额外的配置。如果使用 usb 声卡，请参考 [树莓派上使用 USB 声卡](http://blog.xmlplus.cn/index.php/archives/5/)。如果要连接蓝牙音响，请参考 [树莓派连接蓝牙音箱](http://blog.xmlplus.cn/index.php/archives/19/)。

## 安装依赖软件包

```bash
$ sudo apt-get install mpg123 aria2
$ sudo apt-get install python-dev python-pip
$ sudo pip install requests BeautifulSoup4 pycrypto future
$ sudo npm install forever -g
```

## 安装自启动脚本

1. 移动文件 `miot-parts` 至目录 `/etc/init.d/`

```bash
$ sudo mv miot-parts /etc/init.d/
```

2. 修改拷贝后文件的执行权限

```bash
$ sudo chmod 755 /etc/init.d/miot-parts
```

3. 添加开机启动项

```bash
$ sudo update-rc.d miot-parts defaults
```