#!/bin/bash

#DEVICE_MAC="58:00:00:00:34:A8"
DEVICE_MAC="00:00:05:04:20:D0"   # 海景店
index=$(pactl list sinks short | awk '$2 ~ /bluez/ {print $1}')
running=$(pactl list sinks short | awk '$7 ~ /RUNNING/ {print $1}')

if [ -z "$index" ] ; then
    echo -e "connect $DEVICE_MAC\nquit" | bluetoothctl > /dev/null 2>&1
elif [[ ! -z "$running" && "$running" != "$index" ]] ; then
    pactl move-sink-input "$index" "$index"
fi
