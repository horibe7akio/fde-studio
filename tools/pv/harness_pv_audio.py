#!/usr/bin/env python3
"""Synthesize the soundtrack for the harness PV (30 s): a 120 BPM stadium beat plus football
sound effects, placed on the same cut times as tools/pv/harness-pv.html. No external samples.

Usage: python3 tools/pv/harness_pv_audio.py OUT.wav
"""
import sys
import wave

import numpy as np

SR = 44100
DUR = 30.0
BEAT = 0.5  # 120 BPM
rng = np.random.default_rng(7)
N = int(SR * DUR)
mix = np.zeros((N, 2))


def t_(sec):
    return np.arange(int(SR * sec)) / SR


def put(sig, at, gain=1.0, pan=0.0):
    i = int(at * SR)
    if i >= N:
        return
    sig = sig[: N - i] * gain
    mix[i:i + len(sig), 0] += sig * (1 - max(0, pan))
    mix[i:i + len(sig), 1] += sig * (1 + min(0, pan))


def lowpass(x, cutoff):
    # one-pole low-pass as an FFT convolution with its (truncated) impulse response
    a = np.exp(-2 * np.pi * cutoff / SR)
    k = (1 - a) * a ** np.arange(int(np.log(1e-4) / np.log(a)) + 1)
    n = len(x) + len(k) - 1
    size = 1 << (n - 1).bit_length()
    return np.fft.irfft(np.fft.rfft(x, size) * np.fft.rfft(k, size), size)[: len(x)]


def noise(sec):
    return rng.standard_normal(int(SR * sec))


def env(sec, attack=0.005, decay=None):
    t = t_(sec)
    e = np.minimum(1, t / max(attack, 1e-4))
    return e * (np.exp(-t / decay) if decay else 1)


# ---- instruments ----
def kick():
    t = t_(0.35)
    f = 110 * np.exp(-t * 18) + 45
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * env(0.35, 0.002, 0.12)


def clap():
    n = noise(0.22)
    return (n - lowpass(n, 900)) * env(0.22, 0.001, 0.05) * 0.6


def hat():
    n = noise(0.06)
    return (n - lowpass(n, 6000)) * env(0.06, 0.001, 0.015) * 0.35


def note(freq, sec, bright=1.0):
    t = t_(sec)
    saw = sum(np.sin(2 * np.pi * freq * k * t) / k for k in range(1, 7)) * (0.5 + 0.5 * bright)
    return saw * env(sec, 0.01, sec * 0.6)


def pad(freqs, sec):
    t = t_(sec)
    s = sum(np.sin(2 * np.pi * f * (1 + d) * t) for f in freqs for d in (-0.003, 0.003))
    e = np.minimum(1, t / 0.4) * np.minimum(1, (sec - t) / 0.5)
    return s / (len(freqs) * 2) * e


# ---- football effects ----
def whistle(sec=0.45):
    t = t_(sec)
    trill = 1 + 0.035 * np.sign(np.sin(2 * np.pi * 34 * t))
    s = np.sin(2 * np.pi * 2900 * trill * t) + 0.3 * np.sin(2 * np.pi * 5800 * trill * t)
    return s * np.minimum(1, t / 0.01) * np.minimum(1, (sec - t) / 0.03) * 0.45


def ball():
    t = t_(0.18)
    thump = np.sin(2 * np.pi * (180 * np.exp(-t * 30) + 70) * t) * env(0.18, 0.001, 0.05)
    return thump + noise(0.18) * env(0.18, 0.0005, 0.008) * 0.4


def crowd_bed(sec):
    n = noise(sec)
    s = lowpass(n, 700) - lowpass(n, 180)
    t = t_(sec)
    return s * (0.6 + 0.4 * np.sin(2 * np.pi * 0.23 * t)) * 1.6


def cheer(sec=1.8):
    n = noise(sec)
    s = lowpass(n, 2600) - lowpass(n, 350)
    t = t_(sec)
    return s * np.minimum(1, t / 0.12) * np.exp(-np.maximum(0, t - 0.5) * 1.6) * 2.6


def groan(sec=1.4):
    n = noise(sec)
    t = t_(sec)
    s = lowpass(n, 420) - lowpass(n, 90)
    return s * np.minimum(1, t / 0.15) * np.exp(-t * 1.8) * 3.0


def whoosh(sec=0.5):
    n = noise(sec)
    t = t_(sec)
    lo = lowpass(n, 1800)
    return (n - lo) * np.sin(np.pi * t / sec) ** 2 * 0.28


def tick():
    t = t_(0.05)
    return np.sin(2 * np.pi * 1600 * t) * env(0.05, 0.001, 0.01) * 0.25


def boom(sec=2.0):
    t = t_(sec)
    return (np.sin(2 * np.pi * (60 * np.exp(-t * 2) + 38) * t) * np.exp(-t * 1.6)
            + noise(sec) * np.exp(-t * 6) * 0.08)


# ---- arrangement ----
CUTS = [2, 6, 8, 12, 14, 18, 20, 24, 26, 28]
put(crowd_bed(DUR), 0, 0.10)
put(whistle(0.55), 0.35, 0.9)
put(boom(1.6), 1.9, 0.5)

roots = [220.0, 174.61, 261.63, 196.0]   # Am  F  C  G  (one bar each)
chords = [[220, 261.63, 329.63], [174.61, 220, 261.63], [196, 261.63, 329.63], [196, 246.94, 293.66]]
beat = 2.0
while beat < 28.0:
    bar = int((beat - 2) // 2) % 4
    if (beat - 2) % 2 < 1e-6:
        put(pad(chords[bar], 2.0), beat, 0.18)
    put(kick(), beat, 0.85)
    if int(round((beat - 2) / BEAT)) % 2 == 1:
        put(clap(), beat, 0.7, pan=0.15)
    put(hat(), beat + BEAT / 2, 0.8, pan=-0.3)
    put(note(roots[bar] / 2, 0.45), beat, 0.22)
    beat += BEAT

for c in CUTS:
    put(whoosh(0.5), c - 0.35, 1.0)
for at in (2.3, 6.2, 6.45, 8.2, 12.2, 12.45, 14.2, 18.2, 18.45, 20.2, 24.2, 24.45, 26.2, 26.45):
    put(tick(), at, 1.0)

# the plays, placed where the pictures land them
put(ball(), 9.0, 0.9, pan=-0.3)
put(cheer(1.9), 10.4, 0.8, pan=-0.4)      # ゲーム制作：得点
put(groan(1.5), 11.0, 0.7, pan=0.4)       # アプリ開発：失点
put(whistle(0.25), 15.6, 0.6)
put(ball(), 18.4, 0.9)
put(groan(1.6), 19.0, 0.9)                # 8-1-1：両方失点
put(cheer(2.2), 22.0, 0.85)               # ボードを分けると勝てる
put(boom(2.0), 28.0, 0.8)
put(whistle(0.9), 28.25, 0.9)             # 試合終了
put(cheer(2.0), 28.4, 0.55)

# fade out, normalise
fade = np.minimum(1, (DUR - np.arange(N) / SR) / 0.8)
mix *= fade[:, None]
mix /= np.max(np.abs(mix)) + 1e-9
mix *= 0.89
out = (mix * 32767).astype(np.int16)
with wave.open(sys.argv[1], "wb") as w:
    w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR)
    w.writeframes(out.tobytes())
print("wrote", sys.argv[1], f"{DUR:.1f}s")
