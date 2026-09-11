#!/usr/bin/env python3
"""Build the narrated walkthrough: VOICEVOX audio + the cue sheet the page plays it from.

Each line carries the picture that goes with it, because a narration that talks about
one thing while the diagram shows another is worse than no narration at all:

  beat  - an action on the page (open a panel, run the sample order, switch a toggle)
  focus - the label in the 3D diagram to light up while the line is spoken

Output (both committed, so the page needs no build step to narrate):
  public/narration/narration.m4a   one file, all lines, with silence between them
  public/narration/narration.json  {start, end, chapter, beat, focus, text} per line

Usage:
  python3 tools/build_narration.py              # synthesize everything
  python3 tools/build_narration.py --dry-run    # print the script and the timing estimate
  python3 tools/build_narration.py --only 3 6   # re-render just these chapters, keep the rest

Requires a running VOICEVOX engine (default http://127.0.0.1:50021, override with
VOICEVOX_ENGINE) and ffmpeg on PATH.
"""

import argparse
import json
import os
import pathlib
import shutil
import subprocess
import sys
import tempfile
import urllib.parse
import urllib.request

ENGINE = os.environ.get("VOICEVOX_ENGINE", "http://127.0.0.1:50021")
SPEAKER = 101          # 離途・シリアス. Credit "VOICEVOX:離途" is required on publication.
SPEED = 1.06
GAP_LINE = 0.42        # silence between lines
GAP_CHAPTER = 0.95     # silence between chapters, so the camera can arrive

ROOT = pathlib.Path(__file__).resolve().parent.parent
OUT_DIR = ROOT / "public" / "narration"
CACHE_DIR = ROOT / "output" / "narration_lines"   # kept out of public/, it must not ship

# (chapter, text, beat, focus)
SCRIPT = [
    (0, "エーエックスを進めたい。その一言だけでは、システムはつくれません。", None, None),
    (0, "会社の中には、営業も、経理も、受注の現場もあります。", None, "営業"),
    (0, "課題は経営から出ますが、答えは現場の中にあります。", None, "受注現場"),
    (0, "現場に入り、業務を整理して、経営の成果になるまで見届ける。", None, "FDE"),
    (0, "この役割が、エフディーイーと呼ばれ始めました。", None, "FDE"),

    (1, "ひとつの受注現場に、降りてみます。", None, None),
    (1, "ここには、まだ仕様がありません。", None, None),
    (1, "メールで届く注文。エクセルへの転記。", None, "注文メール"),
    (1, "担当者しか知らない、例外の扱い。", None, "例外の条件"),
    (1, "確認が遅い、という一言の中に、いくつもの仕事が隠れています。", None, "確認待ち"),
    (1, "エフディーイーは、担当者と仕事をたどり、誰が、何を見て、何を判断するかを聞きます。", None, "FDE"),

    (2, "散らばった情報を、判断できる形に並べ替えます。", "organize", None),
    (2, "必要なデータは何か。", None, "入力 / データ"),
    (2, "どの条件なら、自動で進めてよいか。", None, "判断 / ルール"),
    (2, "例外は、誰に確認してもらうか。", None, "担当 / 責任"),
    (2, "入力、判断、担当。この三つに分けたものが、設計図になります。", None, None),

    (3, "まず、仕事をデータとして見ます。", None, None),
    (3, "注文メール、では、まだ粗すぎます。", None, "判断に必要な事実"),
    (3, "注文番号、取引先、金額、納期。", None, "注文番号"),
    (3, "判断に必要な事実を、一つずつ取り出します。", None, "金額"),

    (4, "次に、判断を分岐として描きます。", None, "条件に一致？"),
    (4, "金額が一致すれば、自動で進める。", None, "自動で進む"),
    (4, "一致しなければ、人へ戻す。", None, "人に戻す"),
    (4, "暗黙の勘を、条件と例外に分けていきます。", None, None),

    (5, "そして、判断に人と責任を置きます。", None, None),
    (5, "誰が実行し、誰が確認し、誰が承認するか。", None, "確認"),
    (5, "人が見る、だけでは、仕事は止まります。", None, "誰が引き受ける？"),
    (5, "判断を返す相手と期限まで、仕組みに含めます。", None, "承認"),

    (6, "三つの概念が、動くシステムになります。", None, None),
    (6, "注文を取り込み、条件を照合します。", "order-run", "取込"),
    (6, "金額が合わない注文は、自動で登録せず、人の確認へ進みます。", None, "人の確認"),
    (6, "確認した結果を、登録します。", "order-approve", "登録"),
    (6, "整理したルールと役割が、そのまま仕組みになりました。", None, None),

    (7, "ここで、よくある問いに答えます。", None, None),
    (7, "エフディーイーの中身は、会社ごとに違います。", None, None),
    (7, "客先常駐と同じでは、という問いに答えられるのは、名前ではありません。", None, None),
    (7, "何を決められるか。", "inspect-0", "課題・優先順位"),
    (7, "何に責任を持つか。", "inspect-1", "本番での成果"),
    (7, "学びを、どこに残すか。", "inspect-2", "学びを残す"),
    (7, "この三つを見ると、担っている中身が分かります。", None, None),

    (8, "もう一度、経営から会社全体を見ます。", None, "経営"),
    (8, "受注現場でつくった接続部品や、評価の手順。", None, "受注現場"),
    (8, "共通化できれば、他の部署でも活かせます。", "shared", "再利用できる部品"),
    (8, "個別の解決を、繰り返し使える力にする。ここが分かれ目です。", None, None),

    (9, "最後に、エーアイの時代の話をします。", None, None),
    (9, "エーアイが支援できる工程は、増えていきます。", "ai", "AIが構造化・実装を支援"),
    (9, "それでも、何を任せ、何を確かめるかは、人が決めます。", None, "人の確認"),
    (9, "現場理解、構造化、実装、検収、定着。", "stages", None),
    (9, "つくるだけでなく、使われるまで見届ける。それが、人に残る役割です。", None, "FDE"),
]


def synthesize(text, path):
    query_url = f"{ENGINE}/audio_query?{urllib.parse.urlencode({'text': text, 'speaker': SPEAKER})}"
    with urllib.request.urlopen(urllib.request.Request(query_url, method="POST"), timeout=30) as response:
        query = json.load(response)
    query["speedScale"] = SPEED
    query["prePhonemeLength"] = 0.06
    query["postPhonemeLength"] = 0.10
    synth_url = f"{ENGINE}/synthesis?{urllib.parse.urlencode({'speaker': SPEAKER})}"
    request = urllib.request.Request(
        synth_url, data=json.dumps(query).encode(), headers={"Content-Type": "application/json"}, method="POST"
    )
    with urllib.request.urlopen(request, timeout=120) as response:
        path.write_bytes(response.read())


def duration(path):
    out = subprocess.run(
        ["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", str(path)],
        capture_output=True, text=True, check=True,
    )
    return float(out.stdout.strip())


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--only", nargs="*", type=int, help="chapters to re-render (default: all)")
    args = parser.parse_args()

    if args.dry_run:
        for chapter, text, beat, focus in SCRIPT:
            print(f"{chapter}  {text}   [beat={beat} focus={focus}]")
        moras = sum(len(text) for _, text, _, _ in SCRIPT)
        print(f"\n{len(SCRIPT)} lines, {moras} characters, roughly {moras / 7.4 + len(SCRIPT) * GAP_LINE:.0f}s")
        return

    for tool in ("ffmpeg", "ffprobe"):
        if not shutil.which(tool):
            sys.exit(f"{tool} not found on PATH")

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    work = pathlib.Path(tempfile.mkdtemp(prefix="narration-"))
    lines, concat, cursor = [], [], 0.0

    for index, (chapter, text, beat, focus) in enumerate(SCRIPT):
        wav = work / f"{index:03d}.wav"
        if args.only and chapter not in args.only:
            cached = CACHE_DIR / f"{index:03d}.wav"
            if cached.exists():
                shutil.copy(cached, wav)
        if not wav.exists():
            synthesize(text, wav)
            print(f"  synthesized {index:03d} ch{chapter} {text[:28]}")
        seconds = duration(wav)
        gap = GAP_CHAPTER if index + 1 < len(SCRIPT) and SCRIPT[index + 1][0] != chapter else GAP_LINE
        lines.append({
            "chapter": chapter, "text": text, "beat": beat, "focus": focus,
            "start": round(cursor, 3), "end": round(cursor + seconds, 3),
        })
        concat.append((wav, gap))
        cursor += seconds + gap

    # Keep the per-line wavs so --only can re-render one chapter without touching the others.
    cache = CACHE_DIR
    cache.mkdir(parents=True, exist_ok=True)
    for index, (wav, _) in enumerate(concat):
        shutil.copy(wav, cache / f"{index:03d}.wav")

    list_file = work / "concat.txt"
    silence = work / "gap.wav"
    subprocess.run(["ffmpeg", "-y", "-f", "lavfi", "-i", "anullsrc=r=24000:cl=mono", "-t", "0.01", str(silence)],
                   capture_output=True, check=True)
    entries = []
    for wav, gap in concat:
        gap_file = work / f"gap-{gap:.2f}.wav"
        if not gap_file.exists():
            subprocess.run(["ffmpeg", "-y", "-f", "lavfi", "-i", "anullsrc=r=24000:cl=mono", "-t", str(gap), str(gap_file)],
                           capture_output=True, check=True)
        entries.append(f"file '{wav}'")
        entries.append(f"file '{gap_file}'")
    list_file.write_text("\n".join(entries))

    output = OUT_DIR / "narration.m4a"
    subprocess.run([
        "ffmpeg", "-y", "-f", "concat", "-safe", "0", "-i", str(list_file),
        "-af", "loudnorm=I=-18:TP=-2:LRA=11", "-ar", "44100", "-c:a", "aac", "-b:a", "96k", str(output),
    ], capture_output=True, check=True)

    (OUT_DIR / "narration.json").write_text(json.dumps({
        "engine": "VOICEVOX", "speaker": "離途・シリアス", "speakerId": SPEAKER,
        "credit": "VOICEVOX:離途", "audio": "./narration/narration.m4a",
        "duration": round(duration(output), 3), "lines": lines,
    }, ensure_ascii=False, indent=1))

    shutil.rmtree(work)
    print(f"\n{len(lines)} lines / {duration(output):.1f}s → {output.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
