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

1. 移动文件 `musicbox` 至目录 `/etc/init.d/`

```bash
$ sudo mv musicbox /etc/init.d/
```

2. 修改拷贝后文件的执行权限

```bash
$ sudo chmod 755 /etc/init.d/musicbox
```

3. 添加开机启动项

```bash
$ sudo update-rc.d musicbox defaults
```