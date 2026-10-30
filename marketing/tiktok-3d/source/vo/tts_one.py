# fetch one ElevenLabs line into the same cache build_vo.py uses (vo_<hash>.mp3)
import hashlib, json, os, sys, urllib.request
W, text = sys.argv[1], sys.argv[2]
voice = os.environ['VOICE_ID']; model = os.environ.get('VO_MODEL', 'eleven_v3')
h = hashlib.sha1(f'{voice}|{model}|{text}'.encode()).hexdigest()[:12]
mp3 = f'{W}/audio/vo_{h}.mp3'
if not os.path.exists(mp3):
    body = {'text': text, 'model_id': model, 'language_code': 'he',
            'voice_settings': {'stability': 0.5, 'similarity_boost': 0.8, 'style': 0.35, 'use_speaker_boost': True}}
    req = urllib.request.Request(f'https://api.elevenlabs.io/v1/text-to-speech/{voice}?output_format=mp3_44100_128', data=json.dumps(body).encode(),
                                 headers={'xi-api-key': os.environ['ELEVENLABS_API_KEY'], 'Content-Type': 'application/json'}, method='POST')
    with urllib.request.urlopen(req, timeout=120) as r: data = r.read()
    open(mp3, 'wb').write(data)
print(mp3)
