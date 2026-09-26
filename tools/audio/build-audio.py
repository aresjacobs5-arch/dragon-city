#!/usr/bin/env python3
"""Builds the game's audio from licensed source packs.

Usage: AUDIO_SOURCES=/path/to/sources FFMPEG=/path/to/ffmpeg python3 tools/audio/build-audio.py

AUDIO_SOURCES must contain (all freely licensed, see CREDITS below):
  uisfx/        npm package "uisfx" 0.4.0, folder package/sounds (CC0)
  kenney/       Kenney.nl sounds as shipped in the Python "arcade" package (CC0)
  tuxemon/      github.com/Tuxemon/Tuxemon, folder mods/tuxemon (only the files listed below)
  superpowers/  github.com/sparklinlabs/superpowers-asset-packs (CC0)
  bevy/         github.com/bevyengine/bevy, folder assets/sounds (only the files listed below)

Writes public/audio/**.mp3, src/data/audio.json (manifest read by the game) and
public/audio/CREDITS.txt. Every file is trimmed, loudness-matched and encoded as
MP3 so it plays in every browser.
"""
import json
import os
import re
import subprocess
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
SRC = os.environ.get('AUDIO_SOURCES')
FF = os.environ.get('FFMPEG', 'ffmpeg')
OUT = os.path.join(ROOT, 'public', 'audio')
if not SRC:
    sys.exit('Set AUDIO_SOURCES')

# ----------------------------------------------------------------------------- licences
LIC = {
    'uisfx': ('uisfx by Romain Simon', 'CC0 1.0', 'https://github.com/romainsimon/uisfx'),
    'kenney': ('Kenney (kenney.nl)', 'CC0 1.0', 'https://kenney.nl'),
    'rubberduck': ('rubberduck (80 CC0 creature / RPG / sci-fi SFX packs)', 'CC0 1.0', 'https://opengameart.org/users/rubberduck'),
    'josepharaoh99': ('josepharaoh99', 'CC0 1.0', 'https://freesound.org/people/Jofae/'),
    'superpowers': ('Pixel-boy / Sparklin Labs (Superpowers asset packs)', 'CC0 1.0', 'https://github.com/sparklinlabs/superpowers-asset-packs'),
    'bart-cc0': ('bart ("Ice spells")', 'CC0 1.0', 'https://opengameart.org/content/ice-spells'),
    'bartk': ('Bart K ("Spell 4 - Fire", "6 Monstrous Growls")', 'CC BY 3.0', 'https://opengameart.org/users/bart'),
    'freqman': ('FreqMan ("splash-1")', 'CC BY 4.0', 'https://freesound.org/people/FreqMan/sounds/25819/'),
    'yubatake': ('Yubatake ("JRPG Collection" and "JRPG Collection 2")', 'CC BY 3.0', 'https://opengameart.org/content/jrpg-collection'),
    'spring': ('Spring ("Boss Introduction")', 'CC BY 3.0', 'https://opengameart.org/content/boss-introduction'),
    'migfus20': ('Migfus20 (epic orchestra music, looped by the Bevy project)', 'CC BY 4.0', 'https://freesound.org/people/Migfus20/sounds/560449/'),
}

U = 'uisfx/'
K = 'kenney/'
TM = 'tuxemon/sounds/monster/'
TU = 'tuxemon/music/'
SP = 'superpowers/'

# ----------------------------------------------------------------------------- sound effects
# name -> list of variants: (source, licence key, {options})
# options: maxlen (s), gain (dB, applied after levelling)
SFX = {
    # interface (uisfx "rubber": elastic taps for casual games)
    'click': [(U + 'rubber/press.mp3', 'uisfx', {})],
    'tab': [(U + 'rubber/select.mp3', 'uisfx', {})],
    'back': [(U + 'rubber/back.mp3', 'uisfx', {})],
    'error': [(U + 'rubber/error.mp3', 'uisfx', {})],
    'tick': [(U + 'rubber/snap.mp3', 'uisfx', {'gain': -4})],
    'pop': [(U + 'rubber/open.mp3', 'uisfx', {})],
    'place': [(U + 'rubber/drop.mp3', 'uisfx', {})],
    'heart': [(U + 'rubber/reaction.mp3', 'uisfx', {})],
    # rewards (uisfx "arcade": cheerful game rewards)
    'collect': [(U + 'arcade/receive.mp3', 'uisfx', {})],
    'reward': [(U + 'arcade/reward.mp3', 'uisfx', {})],
    'quest': [(U + 'arcade/checkpoint.mp3', 'uisfx', {})],
    'unlock': [(U + 'arcade/unlock.mp3', 'uisfx', {})],
    'built': [(U + 'arcade/complete.mp3', 'uisfx', {})],
    'burst': [(U + 'arcade/bonus.mp3', 'uisfx', {})],
    'sparkle': [(U + 'dreamy/bonus.mp3', 'uisfx', {'gain': -3})],
    'coin': [(K + 'coin1.wav', 'kenney', {'gain': -3}), (K + 'coin2.wav', 'kenney', {'gain': -3}), (K + 'coin3.wav', 'kenney', {'gain': -3})],
    # island (uisfx "organic": wood, water, small stones)
    'food': [(U + 'organic/receive.mp3', 'uisfx', {})],
    'crack': [(U + 'organic/snap.mp3', 'uisfx', {})],
    'land': [(U + 'organic/drop.mp3', 'uisfx', {})],
    'build': [(SP + 'prehistoric-platformer/sound/wood-1.wav', 'superpowers', {}), (SP + 'prehistoric-platformer/sound/wood-2.wav', 'superpowers', {}), (SP + 'prehistoric-platformer/sound/wood-3.wav', 'superpowers', {})],
    'whoosh': [(TM + 'Woosh-2.wav', 'superpowers', {'gain': -2}), (TM + 'Woosh-1.wav', 'superpowers', {'gain': -2})],
    'swoosh': [(TM + 'Woosh-2.wav', 'superpowers', {'gain': -4})],
    'eat': [(TM + 'eat_01.ogg', 'rubberduck', {}), (TM + 'eat_03.ogg', 'rubberduck', {})],
    'faint': [(TM + 'die_04.ogg', 'rubberduck', {'maxlen': 1.2})],
    # battle
    'attack': [(TM + 'Woosh-1.wav', 'superpowers', {}), (TM + 'Woosh-2.wav', 'superpowers', {})],
    'hit': [(SP + 'prehistoric-platformer/sound/hit-1.wav', 'superpowers', {}), (SP + 'prehistoric-platformer/sound/hit-2.wav', 'superpowers', {}), (TM + 'bite-cartoon-style.mp3', 'josepharaoh99', {'gain': -2})],
    'crit': [(U + 'cinematic/drop.mp3', 'uisfx', {'gain': 2})],
    'fire': [(TM + 'spell_fire_06.ogg', 'rubberduck', {'maxlen': 1.0}), (TM + 'spell_fire_07.ogg', 'rubberduck', {}), (TM + 'Foom_0.wav', 'bartk', {'maxlen': 1.2})],
    'water': [(TM + 'splash-1.wav', 'freqman', {'maxlen': 1.1})],
    'zap': [(K + 'laser4.wav', 'kenney', {'gain': -4}), (K + 'phaseJump1.wav', 'kenney', {'gain': -4})],
    'ice': [(TM + 'Ice.wav', 'bart-cc0', {'maxlen': 1.1})],
    'rock': [(TM + 'Stones_04.ogg', 'rubberduck', {'maxlen': 1.0}), (K + 'rockHit2.wav', 'kenney', {})],
    'magic': [(TM + 'teleport_02.ogg', 'rubberduck', {'maxlen': 1.3, 'gain': -2})],
    'heal': [(U + 'dreamy/success.mp3', 'uisfx', {})],
    'shield': [(TM + 'Steel_Clang.wav', 'superpowers', {'gain': -3})],
    'buff': [(K + 'upgrade1.wav', 'kenney', {'gain': -5})],
    'debuff': [(U + 'arcade/warning.mp3', 'uisfx', {'gain': -3})],
    'charge': [(U + 'cinematic/start.mp3', 'uisfx', {}), (K + 'upgrade3.wav', 'kenney', {'gain': -6})],
    'boom': [(K + 'explosion1.wav', 'kenney', {'maxlen': 1.4}), (K + 'explosion2.wav', 'kenney', {})],
    'thunder': [(K + 'explosion1.wav', 'kenney', {'maxlen': 1.6, 'gain': -6})],
}

# creature voices: each species picks one voice from a pool and keeps it for life
VOICES = {
    'cute': [(TM + f, 'rubberduck') for f in ['cute_01.ogg', 'cute_02.ogg', 'cute_03.ogg', 'cute_04.ogg', 'burble_02.ogg', 'bug_03.ogg', 'bug_05.ogg', 'weird_09.ogg']],
    'beast': [(TM + f, 'rubberduck') for f in ['monster_05.ogg', 'monster_06.ogg', 'monster_16.ogg', 'monster_17.ogg', 'monster_19.ogg', 'grunt_02.ogg', 'troll_01.ogg', 'troll_02.ogg']]
    + [(SP + 'medieval-fantasy/sounds/monster-1.wav', 'superpowers'), (SP + 'medieval-fantasy/sounds/monster-2.wav', 'superpowers')],
    'big': [(TM + 'roar_03.ogg', 'rubberduck'), (TM + 'roar_05.ogg', 'rubberduck'), (TM + 'creature-roar.mp3', 'josepharaoh99'), (TM + 'Growl1.wav', 'bartk'),
            (SP + 'prehistoric-platformer/sound/dinosaur-1.wav', 'superpowers'), (SP + 'prehistoric-platformer/sound/dinosaur-3.wav', 'superpowers')],
}

# ----------------------------------------------------------------------------- music
MUSIC = {
    'island': [(TU + 'JRPG_town_loop.ogg', 'yubatake'), (SP + 'ninja-adventure/musics/theme-1.ogg', 'superpowers')],
    'map': [(TU + 'JRPGCollection/ogg/JRPG_fields_loop.ogg', 'yubatake'), (SP + 'ninja-adventure/musics/theme-3.ogg', 'superpowers')],
    'battle': [(TU + 'JRPGCollection/ogg/JRPG_battle_loop.ogg', 'yubatake'), (SP + 'rpg-battle-system/music/theme-13.ogg', 'superpowers')],
    'boss': [('bevy/Epic orchestra music.ogg', 'migfus20'), (TU + 'boss  introduction.mp3', 'spring')],
}
JINGLES = {
    'victory': (TU + 'JRPG_winBattle.ogg', 'yubatake'),
    'victoryBoss': (TU + 'JRPGCollection2/ogg/JRPG_winBattleBoss.ogg', 'yubatake'),
    'defeat': (TU + 'JRPGCollection/ogg/JRPG_gameOver.ogg', 'yubatake'),
    'levelup': (TU + 'JRPGCollection2/ogg/JRPG_levelUp.ogg', 'yubatake'),
    'hatch': (TU + 'JRPGCollection2/ogg/JRPG_joinParty.ogg', 'yubatake'),
    'island': (TU + 'JRPGCollection2/ogg/JRPG_discovery.ogg', 'yubatake'),
    'evolve': (TU + 'JRPG_winBattleBig.ogg', 'yubatake'),
    'welcome': (TU + 'JRPG_goodMorning.ogg', 'yubatake'),
}


# ----------------------------------------------------------------------------- processing
def levels(path, filt=''):
    af = (filt + ',' if filt else '') + 'volumedetect'
    r = subprocess.run([FF, '-hide_banner', '-i', path, '-af', af, '-f', 'null', '-'], capture_output=True, text=True).stderr
    mean = float(re.search(r'mean_volume: (-?[\d.]+)', r).group(1))
    peak = float(re.search(r'max_volume: (-?[\d.]+)', r).group(1))
    return mean, peak


def duration(path):
    r = subprocess.run([FF, '-hide_banner', '-i', path], capture_output=True, text=True).stderr
    m = re.search(r'Duration: (\d+):(\d+):([\d.]+)', r)
    return int(m.group(1)) * 3600 + int(m.group(2)) * 60 + float(m.group(3)) if m else 0


def channels(path):
    r = subprocess.run([FF, '-hide_banner', '-i', path], capture_output=True, text=True).stderr
    return 1 if re.search(r'Audio:.*\bmono\b', r) else 2


def encode(src, dst, *, trim=True, maxlen=None, target=-20.0, gain=0.0, stereo=False, bitrate=None):
    src = os.path.join(SRC, src)
    if not os.path.exists(src):
        sys.exit(f'missing source {src}')
    # never upmix: a mono source copied to stereo loses 3 dB and doubles the size
    stereo = stereo and channels(src) == 2
    chain = []
    if trim:
        # drop leading and trailing silence
        chain += ['silenceremove=start_periods=1:start_threshold=-50dB:start_silence=0.01',
                  'areverse', 'silenceremove=start_periods=1:start_threshold=-50dB:start_silence=0.03', 'areverse']
    if maxlen:
        chain += [f'atrim=0:{maxlen}', f'afade=t=out:st={max(0, maxlen - 0.12)}:d=0.12']
    base = ','.join(chain)
    mean, peak = levels(src, base)
    # level to the target loudness; a soft limiter catches the peaks this pushes over -1 dBFS
    g = min(target - mean, -1.0 - peak + 6.0, 12.0) + gain
    chain += [f'volume={g:.2f}dB', 'alimiter=limit=0.89:attack=2:release=40:level=disabled']
    os.makedirs(os.path.dirname(dst), exist_ok=True)
    args = [FF, '-v', 'error', '-y', '-i', src, '-af', ','.join(chain), '-ar', '44100', '-ac', '2' if stereo else '1', '-c:a', 'libmp3lame']
    args += ['-b:a', bitrate] if bitrate else ['-q:a', '5']
    subprocess.run(args + [dst], check=True)
    return os.path.relpath(dst, os.path.join(ROOT, 'public'))


def main():
    used = {}
    manifest = {'sfx': {}, 'voices': {}, 'music': {}, 'jingles': {}}

    def note(src, lic, dst):
        used.setdefault(lic, []).append((src, dst))

    for name, variants in SFX.items():
        files = []
        for i, (src, lic, o) in enumerate(variants):
            dst = os.path.join(OUT, 'sfx', f'{name}-{i + 1}.mp3')
            files.append(encode(src, dst, maxlen=o.get('maxlen', 2.5), gain=o.get('gain', 0)))
            note(src, lic, dst)
        manifest['sfx'][name] = files
    for pool, variants in VOICES.items():
        files = []
        for i, (src, lic) in enumerate(variants):
            dst = os.path.join(OUT, 'voice', f'{pool}-{i + 1}.mp3')
            files.append(encode(src, dst, maxlen=2.0 if pool == 'big' else 1.4, target=-19))
            note(src, lic, dst)
        manifest['voices'][pool] = files
    for scene, tracks in MUSIC.items():
        files = []
        for i, (src, lic) in enumerate(tracks):
            dst = os.path.join(OUT, 'music', f'{scene}-{i + 1}.mp3')
            # loops keep their exact length so they repeat seamlessly
            files.append(encode(src, dst, trim=False, target=-21, stereo=True, bitrate='96k'))
            note(src, lic, dst)
        manifest['music'][scene] = files
    for name, (src, lic) in JINGLES.items():
        dst = os.path.join(OUT, 'jingles', f'{name}.mp3')
        manifest['jingles'][name] = encode(src, dst, target=-19, stereo=True, bitrate='128k')
        note(src, lic, dst)

    with open(os.path.join(ROOT, 'src', 'data', 'audio.json'), 'w') as f:
        json.dump(manifest, f, indent=1)
    lines = ['Beasthaven: music and sound credits', '', 'Every sound and music file in this folder comes from a freely licensed game-audio pack.',
             'CC0 works need no attribution; CC BY works are credited here and in the game settings.', '']
    for key, files in sorted(used.items(), key=lambda kv: (LIC[kv[0]][1] != 'CC0 1.0', kv[0])):
        who, lic, url = LIC[key]
        lines.append(f'{who} ({lic}) {url}')
        for src, dst in sorted(set(files), key=lambda x: x[1]):
            lines.append(f'  {os.path.relpath(dst, OUT)}  <-  {os.path.basename(src)}')
        lines.append('')
    with open(os.path.join(OUT, 'CREDITS.txt'), 'w') as f:
        f.write('\n'.join(lines))
    total = sum(os.path.getsize(os.path.join(dp, fn)) for dp, _, fns in os.walk(OUT) for fn in fns)
    print(f'wrote {sum(len(v) for v in manifest["sfx"].values())} sfx, {sum(len(v) for v in manifest["voices"].values())} voices, '
          f'{sum(len(v) for v in manifest["music"].values())} music tracks, {len(manifest["jingles"])} jingles; {total / 1e6:.1f} MB')


if __name__ == '__main__':
    main()
