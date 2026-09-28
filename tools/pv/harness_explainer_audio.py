#!/usr/bin/env python3
"""Soundtrack for the harness explainer animation (?motion&explain): a quiet stadium beat under
the narration, plus football effects placed on the narration's line times. No external samples.

Usage: python3 tools/pv/harness_explainer_audio.py NARRATION.json OUT.wav
"""
import json
import sys
import wave

import numpy as np

import harness_pv_audio as a


def main():
    lines = json.load(open(sys.argv[1]))["lines"]
    T = {}
    for l in lines:
        T.setdefault(l["chapter"], []).append((l["start"], l["end"]))
    dur = lines[-1]["end"] + 3.6
    a.DUR = dur
    a.N = int(a.SR * dur)
    a.mix = np.zeros((a.N, 2))
    put = a.put

    put(a.crowd_bed(dur), 0, 0.06)
    # a quiet beat, so the voice stays in front
    chords = [[220, 261.63, 329.63], [174.61, 220, 261.63], [196, 261.63, 329.63], [196, 246.94, 293.66]]
    roots = [220.0, 174.61, 261.63, 196.0]
    beat, end_beat = 0.5, dur - 3.0
    while beat < end_beat:
        bar = int((beat - 0.5) // 2) % 4
        if (beat - 0.5) % 2 < 1e-6:
            put(a.pad(chords[bar], 2.0), beat, 0.09)
        put(a.kick(), beat, 0.28)
        if int(round((beat - 0.5) / 0.5)) % 2 == 1:
            put(a.clap(), beat, 0.18, pan=0.15)
        put(a.hat(), beat + 0.25, 0.3, pan=-0.3)
        put(a.note(roots[bar] / 2, 0.45), beat, 0.1)
        beat += 0.5

    s0, s1, s2, s3, s4, s5, s6 = (T[k] for k in range(7))
    put(a.whistle(0.5), 0.15, 0.8)                        # kick-off
    put(a.ball(), 2.2, 0.8, pan=-0.3)
    put(a.cheer(1.6), 3.8, 0.55, pan=-0.4)                # left scores
    put(a.groan(1.3), 4.1, 0.5, pan=0.4)                  # right concedes
    put(a.tick(), s1[1][0] + 0.2, 1.0)                    # speech bubble
    put(a.boom(1.2), s1[2][0], 0.35)                      # the stadium lights up
    put(a.whoosh(0.7), s1[2][0] + 0.3, 0.9)               # the card flies to the player
    put(a.tick(), s1[4][0] + 1.6, 1.0)                    # the board is handed over
    for i in range(10):
        put(a.tick(), s2[0][0] + 0.3 + i * 0.38, 0.9)     # sticky notes
    put(a.whoosh(0.8), s2[2][0] + 0.8, 1.0)               # formation distorts to 8-1-1
    put(a.whoosh(0.6), s2[3][0] + 0.1, 1.0)               # dots fall onto the pitches
    put(a.groan(1.6), s2[3][0] + 1.4, 0.7)                # both concede
    put(a.whistle(0.25), s3[1][0] + 0.3, 0.55)            # confirm: stop
    for i in range(6):
        put(a.ball(), s3[2][0] + 0.2 + i * 0.25, 0.25)    # stop-don't: run
    put(a.whoosh(0.7), s4[0][0] + 0.2, 1.0)               # the board splits
    put(a.ball(), s5[0][0] + 1.0, 0.8, pan=-0.3)
    put(a.cheer(2.0), s5[0][0] + 2.2, 0.65)               # both win
    for i in range(3):
        put(a.tick(), s6[0][0] + 0.35 + i * 0.9, 1.0)     # calendar flips
    put(a.whoosh(0.8), s6[1][0] + 0.3, 0.9)               # the update sweeps the stadium
    put(a.boom(2.0), s6[2][1] + 0.4, 0.6)
    put(a.whistle(0.9), s6[2][1] + 0.55, 0.85)            # full time

    fade = np.minimum(1, (dur - np.arange(a.N) / a.SR) / 1.0)
    m = a.mix * fade[:, None]
    m /= np.max(np.abs(m)) + 1e-9
    m *= 0.5   # leaves room for the narration on top
    with wave.open(sys.argv[2], "wb") as w:
        w.setnchannels(2); w.setsampwidth(2); w.setframerate(a.SR)
        w.writeframes((m * 32767).astype(np.int16).tobytes())
    print("wrote", sys.argv[2], f"{dur:.1f}s")


if __name__ == "__main__":
    main()
