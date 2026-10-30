"""Render the Dribit TikToks with a Hebrew ElevenLabs voiceover.

usage: python3 build_vo.py WORKDIR t1 [t2 t3]
WORKDIR layout (see vo/README.md): scripts/ (engine2.html, spec_tN.js, renderfull.js,
events.js, music.py, icon.svg), shots/, audio/, out/.
env: ELEVENLABS_API_KEY (sk_...), optional VOICE_ID, VO_MODEL (default eleven_v3),
DRY=1 (fake silent voice, to test the pipeline without the API).
"""
import hashlib, json, os, re, subprocess, sys, urllib.request, wave
import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
W = os.path.abspath(sys.argv[1]); VIDS = sys.argv[2:]
LINES = json.load(open(os.path.join(HERE, 'lines.json')))
KEY = os.environ.get('ELEVENLABS_API_KEY', '')
MODEL = os.environ.get('VO_MODEL', 'eleven_v3')
DRY = os.environ.get('DRY') == '1'
SR = 44100
TARGET, MAX_TEMPO = 15.4, float(os.environ.get('MAX_TEMPO', '1.2'))
LEAD = 0.12          # voice starts this long after its scene starts
TAIL = 0.28          # gap after a line before the next scene
API = 'https://api.elevenlabs.io'
SEEDS = {'t1': 11, 't2': 12, 't3': 13}
os.makedirs(f'{W}/audio', exist_ok=True); os.makedirs(f'{W}/out', exist_ok=True)


def api(path, body=None, raw=False):
    req = urllib.request.Request(API + path, data=json.dumps(body).encode() if body is not None else None,
                                 headers={'xi-api-key': KEY, 'Content-Type': 'application/json'},
                                 method='POST' if body is not None else 'GET')
    with urllib.request.urlopen(req, timeout=120) as r:
        data = r.read()
    return data if raw else json.loads(data)


def pick_voice():
    if os.environ.get('VOICE_ID'):
        return os.environ['VOICE_ID']
    # Native Hebrew voices from the Voice Library; prefer a young male narrator.
    res = api('/v1/shared-voices?language=he&page_size=40&sort=usage_character_count_1y')
    vs = res.get('voices', [])
    for v in vs[:15]:
        print('  voice:', v.get('name'), v.get('gender'), v.get('age'), v.get('use_case'), v.get('voice_id'), file=sys.stderr)
    good = [v for v in vs if v.get('gender') == 'male' and v.get('age') in ('young', 'middle_aged')] or vs
    if not good:
        raise SystemExit('no Hebrew voices found; set VOICE_ID')
    v = good[0]
    mine = {x['voice_id'] for x in api('/v1/voices').get('voices', [])}
    if v['voice_id'] not in mine:
        api(f"/v1/voices/add/{v['public_owner_id']}/{v['voice_id']}", {'new_name': 'Dribit ' + v['name'][:20]})
    print('using voice', v['name'], v['voice_id'], file=sys.stderr)
    return v['voice_id']


def tts(text, voice, out_wav):
    if DRY:
        n = int(len(re.sub(r'[֑-ׇ]', '', text)) * 0.068 * SR)
        write_wav(out_wav, np.zeros(n))
        return
    h = hashlib.sha1(f'{voice}|{MODEL}|{text}'.encode()).hexdigest()[:12]
    mp3 = f'{W}/audio/vo_{h}.mp3'
    if not os.path.exists(mp3):
        body = {'text': text, 'model_id': MODEL, 'language_code': 'he',
                'voice_settings': {'stability': 0.5, 'similarity_boost': 0.8, 'style': 0.35, 'use_speaker_boost': True}}
        if MODEL == 'eleven_v3':
            body['voice_settings']['stability'] = 0.5
        data = api(f'/v1/text-to-speech/{voice}?output_format=mp3_44100_128', body, raw=True)
        open(mp3, 'wb').write(data)   # write only after a successful call, so a failed call never leaves an empty cache file
    # trim silence at both ends, mono 44.1k
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', mp3, '-af',
                    'silenceremove=start_periods=1:start_threshold=-45dB,areverse,'
                    'silenceremove=start_periods=1:start_threshold=-45dB,areverse',
                    '-ac', '1', '-ar', str(SR), out_wav], check=True)


def read_wav(p):
    with wave.open(p) as w:
        x = np.frombuffer(w.readframes(w.getnframes()), dtype=np.int16).astype(np.float64) / 32768
        return x.reshape(-1, w.getnchannels()).mean(axis=1) if w.getnchannels() > 1 else x


def write_wav(p, x):
    with wave.open(p, 'wb') as w:
        w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR)
        w.writeframes((np.clip(x, -1, 1) * 32767).astype(np.int16).tobytes())


def load_spec(v):
    src = open(f'{W}/scripts/spec_{v}.js').read()
    return src, json.loads(subprocess.check_output(
        ['node', '-e', f"global.window={{}};require('{W}/scripts/spec_{v}.js');console.log(JSON.stringify(window.SPEC))"]))


def build(v, voice):
    src, spec = load_spec(v)
    scenes = spec['scenes']; lines = LINES[v]
    clips = []
    for k, ln in enumerate(lines):
        p = f'{W}/audio/vo_{v}_{k}.wav'
        tts(ln['text'], voice, p)
        clips.append(read_wav(p))

    def plan(tempo):
        durs = [s['dur'] for s in scenes]
        for ln, c in zip(lines, clips):
            d = len(c) / SR / tempo
            last = scenes[ln['scenes'][-1]]['type'] == 'end'
            need = LEAD + d + (1.1 if last else TAIL)
            orig = sum(scenes[i]['dur'] for i in ln['scenes'])
            if need > orig:
                for i in ln['scenes']:
                    durs[i] = scenes[i]['dur'] * need / orig
        return durs

    tempo = 1.0
    durs = plan(tempo)
    while sum(durs) > TARGET and tempo < MAX_TEMPO:
        tempo = round(tempo + 0.02, 2); durs = plan(tempo)
    print(f'{v}: tempo {tempo}, total {sum(durs):.2f}s, durs {[round(d, 2) for d in durs]}', file=sys.stderr)

    # write the stretched spec as spec_<v>v.js
    out_src = src.replace(f"id: '{v}'", f"id: '{v}v'")
    parts = re.split(r'(dur:\s*[\d.]+)', out_src)
    k = 0
    for i in range(1, len(parts), 2):
        parts[i] = f'dur: {durs[k]:.3f}'; k += 1
    assert k == len(scenes), 'dur count mismatch'
    open(f'{W}/scripts/spec_{v}v.js', 'w').write(''.join(parts))

    # voice track
    total = sum(durs) + 0.3
    vt = np.zeros(int(total * SR))
    starts = np.cumsum([0] + durs[:-1])
    for ln, k in zip(lines, range(len(lines))):
        p = f'{W}/audio/vo_{v}_{k}.wav'
        if tempo != 1.0 and not DRY:
            q = f'{W}/audio/vo_{v}_{k}_t.wav'
            subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', p, '-af', f'atempo={tempo}', q], check=True)
            c = read_wav(q)
        else:
            c = clips[k] if tempo == 1.0 else clips[k][::1]
        i = int((starts[ln['scenes'][0]] + LEAD) * SR)
        j = min(len(vt), i + len(c)); vt[i:j] += c[:j - i]
    write_wav(f'{W}/audio/voice_{v}.wav', vt)

    vv = v + 'v'
    fr = f'{W}/frames_{vv}'; os.makedirs(fr, exist_ok=True)
    for f in os.listdir(fr): os.remove(os.path.join(fr, f))
    subprocess.run(['node', f'{W}/scripts/' + os.environ.get('RENDER', 'renderfull.js'), fr, '30', '', vv], check=True)
    ev = subprocess.check_output(['node', f'{W}/scripts/events.js', vv], cwd=f'{W}/scripts')
    open(f'{W}/audio/ev_{vv}.json', 'wb').write(ev)
    subprocess.run(['python3', f'{W}/scripts/music.py', f'{W}/audio/ev_{vv}.json', f'{W}/audio/music_{vv}.wav', str(SEEDS.get(v, {'s1': 21, 's2': 22, 's3': 23, 's4': 24, 's5': 25, 's6': 26}.get(v, 11)))], check=True)

    # mix: voice normalised, music ~10 dB under it and ducked a bit more while the voice speaks
    out = f'{W}/out/dribit_tiktok_{v}_voice.mp4'
    fc = ('[1:a]aresample=44100,loudnorm=I=-16:TP=-1.5:LRA=7,asplit=2[vo][sc];'
          '[2:a]aresample=44100,loudnorm=I=-26:TP=-3:LRA=11[mu];'
          '[mu][sc]sidechaincompress=threshold=0.03:ratio=4:attack=20:release=300[duck];'
          '[vo][duck]amix=inputs=2:normalize=0:duration=first,alimiter=limit=0.89[a]')
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-framerate', '30', '-i', f'{fr}/%04d.jpg',
                    '-i', f'{W}/audio/voice_{v}.wav', '-i', f'{W}/audio/music_{vv}.wav',
                    '-filter_complex', fc, '-map', '0:v', '-map', '[a]',
                    '-c:v', 'libx264', '-profile:v', 'high', '-pix_fmt', 'yuv420p', '-crf', '19', '-preset', 'slow',
                    '-r', '30', '-c:a', 'aac', '-b:a', '160k', '-ar', '44100', '-shortest', '-movflags', '+faststart', out],
                   check=True)
    print('wrote', out, file=sys.stderr)


if __name__ == '__main__':
    voice = 'dry' if DRY else pick_voice()
    for v in VIDS:
        build(v, voice)
