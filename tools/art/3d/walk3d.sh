#!/bin/bash
M="$1"; BL="$(ls -d /Applications/Blender*.app | head -1)/Contents/MacOS/Blender"; cd "$M"
for spec in "side:90" "sb-65:-65" "towards:-10" "away:180"; do
  d="${spec%%:*}"; y="${spec##*:}"; rm -rf "out/walk3d-$d"
  FRONT=1.4 KEY=2.4 AMB=0.45 EXPOSURE=-0.6 NSTR=2.6 ACTION_FROM="$M/out/base-n/move-1.glb" perl -e 'alarm 900; exec @ARGV' "$BL" -b -P render.py -- out/base-pbr/rigged-fixed.glb "out/walk3d-$d" 8 "$y" 900 2>&1 | grep RENDERED | sed "s/^/$d /"
done
