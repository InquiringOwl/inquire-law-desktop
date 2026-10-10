#!/bin/bash
# Make a seamless loop from a clip by cross-fading its tail into its head. Usage: loop.sh in.mp4 out.mp4 [overlap_seconds]
IN="$1"; OUT="$2"; X="${3:-1.5}"
T=$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$IN")
ffmpeg -v error -y -i "$IN" -filter_complex "
[0:v]trim=start=$X:end=$(echo "$T - $X" | bc -l),setpts=PTS-STARTPTS[m];
[0:v]trim=start=$(echo "$T - $X" | bc -l):end=$T,setpts=PTS-STARTPTS[t];
[0:v]trim=start=0:end=$X,setpts=PTS-STARTPTS[h];
[t][h]xfade=transition=fade:duration=$X:offset=0[x];
[m][x]concat=n=2:v=1:a=0[v]" -map "[v]" -an -c:v libx264 -crf 22 -preset slow -pix_fmt yuv420p -movflags +faststart "$OUT"
