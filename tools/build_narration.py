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
  python3 tools/build_narration.py --page harness   # the harness page (public/narration/harness.*)

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


# The harness page. A fifth element is what the voice says when the caption cannot be read
# aloud as written (numbers like 8-1-1, Latin names, a bracketed aside).
# (chapter, caption, beat, focus[, spoken])
HARNESS = [
    (0, "ハーネスは、なぜ毎日組み直すのか。", None, None),
    (0, "サッカーの試合にたとえて、見ていきます。", None, None),

    (1, "左は、ゲーム制作の試合。", None, "ゲーム制作"),
    (1, "右は、アプリ開発の試合。", None, "アプリ開発"),
    (1, "走っている選手は、AIのモデルです。", None, "選手＝モデル", "走っている選手は、エーアイのモデルです。"),
    (1, "奥にあるのが作戦ボード。CLAUDE.md、メモリ、スキル、フックを書く場所です。", "clubhouse", "作戦ボード",
     "奥にあるのが作戦ボード。クロード・エムディー、メモリ、スキル、フックを書く場所です。"),
    (1, "ボードは一枚。だから、両方の試合に、同じ作戦が効きます。", "links", "作戦ボード"),

    (2, "アプリ開発で、確かめずに進めて、失点しました。", "concede", "失点"),
    (2, "そこで、ボードに確認のルールを足します。", "rule-check", "＋確認のルール"),
    (2, "右では、相手を止めて、守れました。", None, "守れた"),
    (2, "でも左では、確認待ちで止まり、攻めきれません。", None, "攻めきれない"),
    (2, "今度は、止まるなのルールを足します。", "rule-go", "＋止まるなのルール"),
    (2, "左は得点。右は、カウンターで失点。", None, "得点"),
    (2, "ルールそのものに、良い悪いはない。どの試合かで決まる。", "verdict", None),

    (3, "それなら、両方に効くルールを、全部足せばいい。", "pile", None),
    (3, "気づけば、最大公倍数。", None, "最大公倍数"),
    (3, "攻撃的にしようとして、8-1-1。", "811", "8-1-1", "攻撃的にしようとして、はち、いち、いち。"),
    (3, "両方の試合で、失点します。", None, "失点"),
    (3, "燃費がよくて、速い車のようなハーネスは幻想。", None, None),

    (4, "だから、ボードを試合ごとに分けます。", "split", None),
    (4, "ゲーム制作は、4-3-3と、止まるな。", None, "ゲーム制作のボード", "ゲーム制作は、よん、さん、さんと、止まるな。"),
    (4, "アプリ開発は、5-4-1と、確認。", None, "アプリ開発のボード", "アプリ開発は、ご、よん、いちと、確認。"),
    (4, "左は得点。右は守れた。", None, None),
    (4, "とある案件（試合）で最適なハーネスは、他の試合で最適とはかぎらない。", None, None,
     "とある案件、試合で最適なハーネスは、他の試合で最適とはかぎらない。"),

    (5, "足もとのスタジアムは、公式のハーネス。Claude Codeそのものです。", "stadium", "スタジアム＝公式のハーネス",
     "足もとのスタジアムは、公式のハーネス。クロード・コードそのものです。"),
    (5, "自分では書き換えられない、この世のことわりです。", None, None),
    (5, "回せるのは、用意されたツマミだけ。", "knobs", None),
    (5, "モデル、考える深さ、許可、道具。", "knob-sequence", None),

    (6, "書いても守られないことには、審判を置きます。", "referee", "審判＝フック"),
    (6, "ルールを破りそうになると、笛を吹く。", "whistle", None),
    (6, "笛が増えすぎると、試合が止まる。", "whistles", "試合が止まる"),
    (6, "笛の加減は、人が決める。", None, "笛の加減は、人が決める"),

    (7, "明日は、相手が変わります。", "rivals", None),
    (7, "公式のハーネスも更新され、選手も成長します。", "update", "更新"),
    (7, "だから、ハーネスは毎日組み直す。", "loop", None),
    (7, "ツマミを回すことと、ボードを書き直すこと。", None, None),
]

# The harness explainer animation: 7 scenes, one causal idea (same players, a different board).
EXPLAINER = [
    (0, "同じ選手が、ある試合では勝ち、別の試合では負けます。", None, None),
    (0, "何が違うのでしょう。", None, None),

    (1, "選手はAIのモデル。", None, None, "選手はエーアイのモデル。"),
    (1, "できるのは、次に何をするかを答えることだけ。", None, None),
    (1, "手足になるのは、クラブとスタジアム。", None, None),
    (1, "公式のハーネス、Claude Codeです。", None, None, "公式のハーネス、クロード・コードです。"),
    (1, "試合の前には、監督が書いた作戦ボードが渡されます。", None, None),

    (2, "どの試合でも勝てるように、ボードに書き足していく。", None, None),
    (2, "気づけば、最大公倍数。", None, None),
    (2, "攻撃的にしようとして、8-1-1。", None, None, "攻撃的にしようとして、はち、いち、いち。"),
    (2, "燃費がよくて、速い車のようなハーネスは幻想。", None, None),

    (3, "ボードに書いた線は、そのまま選手の動きになります。", None, None),
    (3, "確認しろと書けば止まり、", None, None),
    (3, "止まるなと書けば走る。", None, None),

    (4, "でも、相手が違えば、勝てる並びも違います。", None, None),
    (4, "ミスが許されないアプリ開発には、5-4-1。", None, None, "ミスが許されないアプリ開発には、ご、よん、いち。"),
    (4, "速さが勝負のゲーム制作には、4-3-3。", None, None, "速さが勝負のゲーム制作には、よん、さん、さん。"),

    (5, "ボードを試合ごとに分けると、両方とも勝てる。", None, None),
    (5, "とある案件（試合）で最適なハーネスは、他の試合で最適とはかぎらない。", None, None,
     "とある案件、試合で最適なハーネスは、他の試合で最適とはかぎらない。"),

    (6, "明日は、相手が変わります。", None, None),
    (6, "スタジアムも、更新で変わっていく。", None, None),
    (6, "だから監督は、毎日ボードを書き直すのです。", None, None),

    (7, "サッカーを、AIの言葉に戻してみます。", None, None, "サッカーを、エーアイの言葉に戻してみます。"),
    (7, "試合の相手は、インプット。選手は、モデル。", None, None),
    (7, "クラブとスタジアムは、ハーネス。モデルの答えを受けて、実際に読み、書き、実行します。", None, None),
    (7, "作戦ボードの中身は、コンテキストとして、毎回モデルに見せられます。", None, None),
    (7, "試合の結果が、アウトプット。", None, None),
    (7, "同じモデルでも、渡すコンテキストで、アウトプットが変わる。", None, None),
]

# page -> (script, output name, per-line cache)
PAGES = {
    "fde": (SCRIPT, "narration", CACHE_DIR),
    "harness": (HARNESS, "harness", ROOT / "output" / "narration_lines_harness"),
    "harness-explainer": (EXPLAINER, "harness-explainer", ROOT / "output" / "narration_lines_harness_explainer"),
}


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
    parser.add_argument("--page", choices=sorted(PAGES), default="fde")
    args = parser.parse_args()
    script, name, cache_dir = PAGES[args.page]
    rows = [(row[0], row[1], row[2], row[3], row[4] if len(row) > 4 else row[1]) for row in script]

    if args.dry_run:
        for chapter, text, beat, focus, spoken in rows:
            print(f"{chapter}  {text}   [beat={beat} focus={focus}]" + (f"  say={spoken}" if spoken != text else ""))
        moras = sum(len(spoken) for *_, spoken in rows)
        print(f"\n{len(rows)} lines, {moras} characters, roughly {moras / 7.4 + len(rows) * GAP_LINE:.0f}s")
        return

    for tool in ("ffmpeg", "ffprobe"):
        if not shutil.which(tool):
            sys.exit(f"{tool} not found on PATH")

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    work = pathlib.Path(tempfile.mkdtemp(prefix="narration-"))
    lines, concat, cursor = [], [], 0.0

    for index, (chapter, text, beat, focus, spoken) in enumerate(rows):
        wav = work / f"{index:03d}.wav"
        if args.only and chapter not in args.only:
            cached = cache_dir / f"{index:03d}.wav"
            if cached.exists():
                shutil.copy(cached, wav)
        if not wav.exists():
            synthesize(spoken, wav)
            print(f"  synthesized {index:03d} ch{chapter} {text[:28]}")
        seconds = duration(wav)
        gap = GAP_CHAPTER if index + 1 < len(rows) and rows[index + 1][0] != chapter else GAP_LINE
        lines.append({
            "chapter": chapter, "text": text, "beat": beat, "focus": focus,
            "start": round(cursor, 3), "end": round(cursor + seconds, 3),
        })
        concat.append((wav, gap))
        cursor += seconds + gap

    # Keep the per-line wavs so --only can re-render one chapter without touching the others.
    cache = cache_dir
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

    output = OUT_DIR / f"{name}.m4a"
    subprocess.run([
        "ffmpeg", "-y", "-f", "concat", "-safe", "0", "-i", str(list_file),
        "-af", "loudnorm=I=-18:TP=-2:LRA=11", "-ar", "44100", "-c:a", "aac", "-b:a", "96k", str(output),
    ], capture_output=True, check=True)

    (OUT_DIR / f"{name}.json").write_text(json.dumps({
        "engine": "VOICEVOX", "speaker": "離途・シリアス", "speakerId": SPEAKER,
        "credit": "VOICEVOX:離途", "audio": f"./narration/{name}.m4a",
        "duration": round(duration(output), 3), "lines": lines,
    }, ensure_ascii=False, indent=1))

    shutil.rmtree(work)
    print(f"\n{len(lines)} lines / {duration(output):.1f}s → {output.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
