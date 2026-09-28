// 「3Dでわかる」シリーズの一覧。資料を1本足したら、ここに1件足す（ポータルに自動で並ぶ）。
export const series = [
  {
    path: 'fde/',
    title: 'FDE',
    question: 'FDEは、何をする仕事？',
    summary: '分断された業務・データ・AIがつながっていく様子を3Dで見ながら、現場での役割を読み解く。',
    tags: ['仕事', 'AI導入'],
    extras: [
      { label: '4つの工程と20の作業', path: 'fde/tasks.html' },
      { label: 'なぜ現場に深く入り込むのか', path: 'fde/field.html' },
    ],
  },
  {
    path: 'harness/',
    title: 'ハーネス',
    question: 'ハーネスは、なぜ毎日組み直すのか？',
    summary: '公式のハーネス（Claude Code）と、自分で書く作戦ボード。その違いを、サッカーのフォーメーションで見る。',
    tags: ['Claude Code', 'AI開発'],
  },
];
