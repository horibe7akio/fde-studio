# FDE Studio

FDE（Forward Deployed Engineer）の仕事を、スクロール型の3D解説として表現するプロトタイプです。

## 画像アセット

工程全体と、各工程の詳細インフォグラフィックを `assets/fde-explainer/` に整理しています。

| 工程 | インフォグラフィック | 場面イメージ |
| --- | --- | --- |
| 全体 | `assets/fde-explainer/00-overview/overview-infographic.png` | — |
| 1. 現場を知る | `assets/fde-explainer/01-understand-the-field/infographic.png` | `scene.png` |
| 2. 業務を整理する | `assets/fde-explainer/02-structure-the-work/infographic.png` | `scene.png` |
| 3. 仕組みにする | `assets/fde-explainer/03-build-the-system/infographic.png` | `scene.png` |
| 4. 使われるまで改善する | `assets/fde-explainer/04-adopt-and-improve/infographic.png` | `scene.png` |

## ローカル起動

```bash
npm install
npm run dev
```

## 構成

- `src/`：Three.jsによる3D解説本体
- `assets/fde-explainer/`：FDE解説用の画像アセット
- `public/`：公開用の静的アセット

画像の説明・使い分け・Obsidian上の整理は、調査ノート `FDE解説3D_LP_画像アセット整理_20260911.md` にまとめています。
