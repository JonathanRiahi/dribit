# Hebrew voiceover for the 3 TikToks (2026-10-26)

1. Check the key: `echo ${ELEVENLABS_API_KEY:0:3}` must print `sk_`.
2. Work dir: copy `marketing/tiktok/source/{engine2.html,spec_t*.js}` + `icons/icon.svg` (from main) into `W/scripts/`,
   the four PNGs into `W/shots/`, and `renderfull.js, events.js, music.py` from
   `/mnt/project-files/marketing/reels/source/scripts/` into `W/scripts/` (in renderfull.js change `engine.html` to `engine2.html`).
3. Fonts: install Rubik + Assistant TTFs from Google Fonts into ~/.fonts and run `fc-cache -f`.
4. Run `python3 vo/build_vo.py W t1 t2 t3`. Output: `W/out/dribit_tiktok_tN_voice.mp4` (1080x1920).
   - Voice: first young male native Hebrew voice in the Voice Library (printed to stderr), or set `VOICE_ID`.
   - Model `eleven_v3` (multilingual v2 has no Hebrew). Text per scene: `vo/lines.json` (numbers as words, niqqud on דריבית).
   - Scenes stretch to fit each line; up to 1.12x speed-up to stay near 15 s. If a video still runs long, shorten the line in lines.json.
   - Music: synthesized, normalised to -26 LUFS under a -16 LUFS voice, plus sidechain ducking.
   - `DRY=1` tests the pipeline with silent fake voice (~51 s per video).
5. Listen to each line before delivering (no speech-to-text here, so check pronunciation of S&P, ETF, דריבית by ear or ask Jonathan).

The "every friend moves you 5 places up" line was removed from the end card (engine2.html) on 2026-10-26; don't bring it back.
