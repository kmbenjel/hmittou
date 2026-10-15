#!/usr/bin/env python3
"""Lay the narration out on a timeline that the scene and the mixer both read.

    python tools/build_timeline.py ar     # or: en

Reads voice/script.<lang>.json and build/voice/<lang>/*.json (from tts.py) and
writes scene/timeline.<lang>.json: when each segment plays, when each word is
spoken (as the caption shows it), how the captions are chunked, and when each
scene starts and ends.
"""
import difflib
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
FPS = 30
LEAD_IN = 0.4      # silence before the first line
TAIL = 0.7          # after the last line, before the end card
END_CARD = 6.0      # credits, no narration
SCENE_LEAD = 0.3    # a scene starts this long before its first line
TASHKEEL = re.compile("[ً-ْٰـ]")
PUNCT_END = tuple("،,.:;؛…!؟?")
MAX_WORDS = {"ar": 6, "en": 7}


def norm(word):
    word = TASHKEEL.sub("", word).lower()
    return re.sub(r"[^\w؀-ۿ]", "", word)


def display_words(seg, lang):
    """The caption's words, each with the index of the spoken word it follows."""
    spoken = seg["say"].split()
    shown = (seg.get("show") or TASHKEEL.sub("", seg["say"])).split()
    if lang == "ar" and not seg.get("show"):
        return [(w, i, i) for i, w in enumerate(shown)]
    # align the shown words to the spoken ones; replaced runs share a time span
    a = [norm(w) for w in shown]
    b = [norm(w) for w in spoken]
    out = []
    for op, i1, i2, j1, j2 in difflib.SequenceMatcher(None, a, b, autojunk=False).get_opcodes():
        if op == "equal":
            out += [(shown[i1 + k], j1 + k, j1 + k) for k in range(i2 - i1)]
        elif op in ("replace", "delete"):
            j_first, j_last = (j1, max(j1, j2 - 1)) if j2 > j1 else (max(0, j1 - 1), max(0, j1 - 1))
            out += [(shown[i], j_first, j_last) for i in range(i1, i2)]
    return out


def chunk(words, lang, breaks=None):
    """Split a segment's caption into short phrases, at punctuation when possible.
    A segment may set its own `breaks`: the caption words that start a new phrase."""
    if breaks:
        edges = [0, *breaks, len(words)]
        return [list(range(a, b)) for a, b in zip(edges, edges[1:]) if b > a]
    phrases, cur = [], []
    for i, w in enumerate(words):
        cur.append(i)
        if w["t"].endswith(PUNCT_END):
            phrases.append(cur)
            cur = []
    if cur:
        phrases.append(cur)
    out = []
    for p in phrases:
        n = len(p)
        parts = -(-n // MAX_WORDS[lang])
        size = -(-n // parts)
        out += [p[k:k + size] for k in range(0, n, size)]
    # a phrase of one word joins its neighbour when they fit together
    merged = []
    for i, p in enumerate(out):
        if len(p) == 1 and i + 1 < len(out) and len(out[i + 1]) < MAX_WORDS[lang]:
            out[i + 1] = p + out[i + 1]
        elif len(p) == 1 and merged and len(merged[-1]) < MAX_WORDS[lang]:
            merged[-1] = merged[-1] + p
        else:
            merged.append(p)
    return merged


def main(lang):
    script = json.loads((ROOT / "voice" / f"script.{lang}.json").read_text(encoding="utf-8"))
    vdir = ROOT / "build" / "voice" / lang
    t = LEAD_IN
    segments = []
    for seg in script["segments"]:
        if seg.get("kind") == "recite":
            # clips of the recitation, back to back; each clip is one bayt, split in two shatrs
            clips, shatrs, at = [], [], t
            for k, (a, b) in enumerate(seg["clips"]):
                clips.append({"src": a, "srcEnd": b, "at": round(at, 3)})
                split = at + seg["splits"][k] - a
                line = seg["lines"][k]
                shatrs.append({"t": line[0], "s": round(at, 3), "e": round(split, 3), "bayt": k, "half": 0})
                shatrs.append({"t": line[1], "s": round(split, 3), "e": round(at + b - a, 3), "bayt": k, "half": 1})
                at += b - a
            segments.append({"id": seg["id"], "scene": seg["scene"], "kind": "recite",
                             "start": round(t, 3), "speechStart": round(t, 3), "speechEnd": round(at, 3),
                             "clips": clips, "shatrs": shatrs, "lines": seg["lines"],
                             "words": [], "chunks": []})
            t = at + seg.get("gap", 0.45)
            continue
        meta = json.loads((vdir / f"{seg['id']}.json").read_text(encoding="utf-8"))
        spoken = meta["words"]
        n_say = len(seg["say"].split())
        if len(spoken) != n_say:
            print(f"  note {seg['id']}: {len(spoken)} timed words for {n_say} written")
        words = []
        for text, j1, j2 in display_words(seg, lang):
            j1 = min(j1, len(spoken) - 1)
            j2 = min(j2, len(spoken) - 1)
            words.append({"t": text, "s": round(t + spoken[j1]["start"], 3),
                          "e": round(t + spoken[j2]["end"], 3)})
        speech_end = t + spoken[-1]["end"]
        segments.append({
            "id": seg["id"], "scene": seg["scene"], "audio": f"{seg['id']}.mp3",
            "start": round(t, 3), "speechStart": round(t + spoken[0]["start"], 3),
            "speechEnd": round(speech_end, 3), "fileDuration": meta["duration"],
            "words": words, "chunks": chunk(words, lang, seg.get("breaks"))})
        t = speech_end + seg.get("gap", 0.45)

    scenes, order = {}, []
    for s in segments:
        if s["scene"] not in scenes:
            scenes[s["scene"]] = {"start": max(0.0, s["speechStart"] - SCENE_LEAD)}
            order.append(s["scene"])
        scenes[s["scene"]]["end"] = s["speechEnd"]
    scenes[order[0]]["start"] = 0.0
    for a, b in zip(order, order[1:]):
        scenes[a]["end"] = scenes[b]["start"]
    end_start = segments[-1]["speechEnd"] + TAIL
    scenes[order[-1]]["end"] = end_start
    scenes["end"] = {"start": end_start, "end": end_start + END_CARD}
    order.append("end")
    duration = round(end_start + END_CARD, 3)
    for k in scenes:
        scenes[k] = {"start": round(scenes[k]["start"], 3), "end": round(scenes[k]["end"], 3)}

    out = {"lang": lang, "fps": FPS, "duration": duration, "frames": int(round(duration * FPS)),
           "voice": script["voice"], "order": order, "scenes": scenes, "segments": segments}
    path = ROOT / "scene" / f"timeline.{lang}.json"
    path.write_text(json.dumps(out, ensure_ascii=False, indent=1), encoding="utf-8")
    print(f"{path.name}: {duration:.2f}s, {out['frames']} frames")
    for k in order:
        print(f"  {k:10s} {scenes[k]['start']:6.2f} → {scenes[k]['end']:6.2f}")


if __name__ == "__main__":
    main(sys.argv[1])
