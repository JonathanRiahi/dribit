"""Synthesize a short upbeat background track plus whoosh/pop effects for a reel.
usage: python3 music.py events.json out.wav seed
"""
import json, sys, wave
import numpy as np

SR = 44100
ev = json.load(open(sys.argv[1]))
out_path, seed = sys.argv[2], int(sys.argv[3])
rng = np.random.default_rng(seed)
total = ev['total'] + 0.3
N = int(total * SR)
mix = np.zeros(N)

PROGS = [  # semitone offsets from A3 (220 Hz) for 4-bar loops
    [[0, 3, 7], [-4, 0, 3], [3, 7, 10], [-2, 2, 5]],     # Am F C G
    [[3, 7, 10], [-2, 2, 5], [0, 3, 7], [-4, 0, 3]],     # C G Am F
    [[-4, 0, 3], [3, 7, 10], [-2, 2, 5], [0, 3, 7]],     # F C G Am
]
prog = PROGS[seed % 3]
bpm = [104, 100, 108, 102, 106, 98][seed % 6]
beat = 60 / bpm
bar = 4 * beat
f = lambda semi, base=220.0: base * 2 ** (semi / 12)

def add(sig, t0, gain=1.0):
    i = int(t0 * SR)
    if i >= N: return
    j = min(N, i + len(sig))
    mix[i:j] += sig[:j - i] * gain

def env(n, a=0.005, d=0.3, curve=4.0):
    t = np.arange(n) / SR
    e = np.minimum(1, t / a) * np.exp(-t * curve / max(d, 1e-3))
    return e

def tone(freq, dur, kind='sine', det=0.0):
    t = np.arange(int(dur * SR)) / SR
    if kind == 'saw':  # band-limited-ish saw from a few harmonics
        s = sum(np.sin(2 * np.pi * freq * (1 + det) * k * t) / k for k in range(1, 7))
        return s * 0.5
    if kind == 'tri':
        return 2 / np.pi * np.arcsin(np.sin(2 * np.pi * freq * t))
    return np.sin(2 * np.pi * freq * t)

def kick():
    n = int(0.35 * SR); t = np.arange(n) / SR
    fr = 50 + 90 * np.exp(-t * 30)
    ph = 2 * np.pi * np.cumsum(fr) / SR
    return np.sin(ph) * np.exp(-t * 9)

def noise(dur, decay):
    n = int(dur * SR); t = np.arange(n) / SR
    return rng.standard_normal(n) * np.exp(-t * decay)

def hp(x, a=0.85):  # simple one-pole high-pass
    y = np.zeros_like(x); prev_x = prev_y = 0.0
    for i in range(len(x)):
        prev_y = a * (prev_y + x[i] - prev_x); prev_x = x[i]; y[i] = prev_y
    return y

def lp(x, a=0.15):
    y = np.zeros_like(x); acc = 0.0
    for i in range(len(x)):
        acc += a * (x[i] - acc); y[i] = acc
    return y

hat = lp(hp(noise(0.05, 80), 0.6), 0.6)
clap = lp(hp(noise(0.16, 24), 0.7), 0.3)
K = kick()

nbars = int(total / bar) + 2
for b in range(nbars):
    t0 = b * bar
    ch = prog[b % 4]
    intro = b == 0  # first bar lighter, but still with drums so second 0 has energy
    # pad: detuned saws, soft attack, low-passed
    for semi in ch:
        p = tone(f(semi), bar, 'saw', 0.003) + tone(f(semi), bar, 'saw', -0.003)
        e = np.minimum(1, np.arange(len(p)) / SR / 0.08) * np.minimum(1, (len(p) - np.arange(len(p))) / SR / 0.1)
        add(lp(p * e, 0.08), t0, 0.035)
    # bass: root, eighth-note pulse
    root = f(ch[0], 110.0 / 2 * 2)  # A2 region
    for k in range(8):
        n = tone(root, beat / 2 * 0.9, 'tri') * env(int(beat / 2 * 0.9 * SR), 0.004, 0.25, 3)
        add(n, t0 + k * beat / 2, 0.16 if k % 2 == 0 else 0.11)
    # pluck arpeggio, 16ths pattern over chord tones an octave up
    if not intro:
        pat = [0, 1, 2, 1, 0, 2, 1, 2]
        for k in range(8):
            semi = ch[pat[k]] + 12
            n = (tone(f(semi), 0.25) + 0.3 * tone(f(semi) * 2, 0.25)) * env(int(0.25 * SR), 0.002, 0.18, 4)
            add(n, t0 + k * beat / 2, 0.06)
    # drums
    for k in range(4):
        add(K, t0 + k * beat, 0.55 if k % 2 == 0 else 0.35)
        if k % 2 == 1: add(clap, t0 + k * beat, 0.22)
        for h in range(2):
            add(hat, t0 + k * beat + h * beat / 2, 0.025 if h == 0 else 0.045)

# music fades: short fade-in (keep frame-0 energy), fade-out at the end
t = np.arange(N) / SR
mix *= np.minimum(1, t / 0.05) * np.clip((total - t) / 1.2, 0, 1)

# effects
def whoosh():
    n = int(0.35 * SR); tt = np.arange(n) / SR
    w = lp(rng.standard_normal(n), 0.25) * np.sin(np.pi * tt / 0.35) ** 2
    return hp(w, 0.9)
def pop():
    n = int(0.12 * SR); tt = np.arange(n) / SR
    fr = 900 + 700 * np.exp(-tt * 40)
    return np.sin(2 * np.pi * np.cumsum(fr) / SR) * np.exp(-tt * 35)

for c in ev['cuts']: add(whoosh(), c - 0.2, 0.25)
for p_ in ev['pops']: add(pop(), p_, 0.18)

mix /= max(1e-9, np.abs(mix).max()) / 0.89
pcm = (mix * 32767).astype(np.int16)
with wave.open(out_path, 'wb') as w:
    w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR); w.writeframes(pcm.tobytes())
print('ok', out_path, round(total, 2), 's', bpm, 'bpm')
