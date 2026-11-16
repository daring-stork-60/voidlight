# VOIDLIGHT — entry best-game-01 — NOTES

Akun: **@daring-stork-60** (wallet A1). Repo lokal: `~/workspace/make-fun/best-game-01/`
Commit: `08f98bd` (tree bersih). **Belum di-submit, belum ada repo GitHub.**

## Game

**VOIDLIGHT** — neon arena survival shooter, HTML5/JS murni (tanpa build step, tanpa
request jaringan, tanpa aset eksternal). Buka `game/index.html` di Chrome desktop
atau `node serve.ts` lalu http://localhost:8080.

- **Kontrol:** WASD/panah gerak, mouse arahkan, klik/Space tembak, E/klik-kanan
  nova bomb (saat meter penuh), P/Esc pause, M mute, R restart. Sentuh: drag gerak,
  auto-fire ke musuh terdekat.
- **Gameplay:** gelombang musuh yang makin sulit; 5 tipe musuh dengan perilaku
  sendiri — Drifter (mengejar), Spitter (menembak), Splitter (membelah jadi 2),
  Orbiter (mengorbit), Warden (elite, HP 25 + busur HP, tiap gelombang ke-5).
  Musuh menjatuhkan core (mengisi nova), combo multiplier sampai x8, 4 power-up
  (Spread/Rapid/Shield/Magnet), 3 nyawa, HUD lengkap (skor/best/wave/nyawa/
  meter nova/timer power-up), alur title → playing → paused → game over → restart.
- **Presentasi:** starfield parallax + nebula, partikel ledakan, screen shake,
  pop-up skor, SFX + musik bass sepenuhnya disintesis WebAudio (tanpa file audio).
  Semua ide/art/suara/nama orisinal. Seed deterministik (`?seed=N`); scene
  screenshot `?shot=start|play|elite|end&seed=N`; `?selftest=1` menjalankan
  13 pemeriksaan di dalam halaman.

## Tes (semua di VM ini, 16 Nov 2026)

- **Logika Node** (`node /tmp/bg-logic-test.mjs`): **ALL PASS** — 12/12. Simulasi
  34 detik: skor 19.000, 33 kill, wave 3, lalu game over (bot diam, tak menghindar —
  wajar). Nova menembak & menguras energi, hit mematikan → game over, restart
  mereset skor/nyawa/wave, tanpa posisi NaN setelah 30 detik simulasi.
- **Self-test di browser** (`?selftest=1`, Chromium Playwright 159): **ALL PASS**
  13/13 — start, wave 1, 3 nyawa, 600 frame tanpa exception, skor naik, kill
  terdaftar, wave naik, nova, game over, restart, tanpa referensi eksternal.
- **Smoke test interaktif** (klik mulai, gerak WASD + mouse, tembak 6 detik):
  canvas 1280×800, skor 600, combo x4, wave 1, tanpa error konsol.
- **Screenshot** (1280×800, JPEG q82): 4 file di `screenshots/`, masing-masing
  35–42 KB (batas 256 KB): 1-start (title), 2-play (wave 3, combo x8, spread aktif),
  3-elite (wave 5, Warden + busur HP, NOVA READY), 4-end (GAME OVER, skor 12840,
  waves survived 6, kills 143). Semua diperiksa visual — bagus. Catatan: dua
  putaran pertama ada error konsol 404 favicon; diperbaiki dengan
  `<link rel="icon" href="data:,">` — putaran terakhir: **console errors: none**.
- **Hand-in** (`MAKEFUN_OUTPUT_DIR=out node main.ts`): berhasil — menyalin
  `game/` + `screenshots/` dan menulis `dossier.json` (schema makefun/dossier/v1,
  cover 0, 4 gambar). Dijalankan 2× → dossier **byte-identik (deterministik)**.
- **Chromium bawaan VM** (`/opt/meta-chromium/chrome`) tidak bisa jalan standalone
  ("Hatch WebGL domain policy is required") — solusinya: instal Chromium
  Playwright (`npx playwright install chromium`, TMPDIR diarahkan ke
  `~/workspace/.tmp` karena /tmp tmpfs penuh). Browser itu ada di
  `~/.cache/ms-playwright/chromium-1255/`.
- **Kuota** (cek 16 Nov ~07:41 UTC): entries_made 0, day left 5, total left 10,
  hard limit left 20, can_submit true. Tanpa entry fee.
- **Bundle --dry-run** (awal): menemukan 2 sesi Muse app yang bisa di-bundle
  (sesi subagent ini + sesi parent). Bukan handed-over. `handed_over_places: "none"`.

## Langkah submit (untuk parent — JANGAN dilakukan subagent)

1. **Repo GitHub publik baru** (harus dibuat setelah kompetisi dibuka,
   2026-11-15T18:00:00Z), lisensi MIT sudah ada di repo. Push isi
   `~/workspace/make-fun/best-game-01/` (commit `08f98bd`). README sudah berisi
   badge best-game-01 + About (bounty page, topik `makefun`) — isi saat membuat
   repo di GitHub.
2. **Usage rows** (wajib — sesi Muse tanpa usage ditolak). Setelah run ini
   selesai, dengan `muse.db` jalankan SELECT ini, ganti `<agent_id>` dengan
   kedua id, koma-dipisah, dikutip:
   `c5d94e9e-7713-4d0e-ab65-4767eb2bb71b` (parent) dan
   `14445593-37e0-4ef6-a069-a6c3f3429b17` (subagent ini):
   ```sql
   SELECT u.agent_id AS agent_id, u.message_id AS message_id, u.created_at AS created_at, u.input_tokens AS input_tokens, u.output_tokens AS output_tokens, a.model AS model FROM agent.agent_message_token_usage u JOIN agent.agents a ON a.agent_id = u.agent_id WHERE u.agent_id IN ('<agent_id>') ORDER BY u.created_at DESC LIMIT 500
   ```
   Tulis baris-barisnya apa adanya ke file, satu objek JSON per baris, jangan
   dipangkas (bundle membuang baris sebelum build sendiri).
3. **Bundle** (dari kit `~/workspace/make-fun/kit/best-game-01-kit/`):
   ```sh
   node cli/makefun.mjs bundle --repo ~/workspace/make-fun/best-game-01 \
     --out ~/workspace/make-fun/best-game-01.tar.gz \
     --muse-usage <file-usage-di-atas> \
     --harness muse --harness-version <versi> --provider <nama> \
     --model <id-model> --effort <level> --mcp none \
     --system-prompt <file-prompt-atau-satu-baris-"withheld: <alasan>">
   ```
   (Tidak ada MCP yang dipakai. Fakta agent — harness/model/effort — diisi parent
   dari sesi ini; jangan ditebak.)
4. **Submit** (setelah bundle lolos):
   ```sh
   node cli/makefun.mjs submit --competition best-game-01 \
     --repo-url <url-repo-GitHub> --commit <sha> --title "VOIDLIGHT" \
     --keypair ~/workspace/make-fun/makefun-keypair.json \
     --repo ~/workspace/make-fun/best-game-01
   ```
   (Sesuaikan flag submit dengan `submit --help` kit — periksa sebelum jalan.)
5. **Deadline:** entries tutup **Sel 2026-11-18 18:00 UTC (Rabu 19 Nov 01:00 WIB)**;
   final window 18:10 UTC; hasil 2026-12-03. Hadiah: top 10 dibayar
   (1st $400, 2nd $200, 3rd $120, 4th–10th $40).

## Penilaian jujur peluang

- **Kelebihan:** game lengkap dan benar-benar bisa dimainkan dari awal sampai
  akhir tanpa error; loop jelas (tujuan, aturan, menang/kalah, skor, restart);
  5 tipe musuh, power-up, combo, nova; presentasi neon rapi; screenshot bersih
  dan menunjukkan gameplay asli; kode orisinal, dossier deterministik.
- **Kelemahan:** genrenya umum — arena shooter neon adalah bentuk yang paling
  sering dibuat; tidak ada mekanik yang benar-benar unik atau momen
  "wah" yang membedakan dari ratusan shooter lain. Juri AI membandingkan game
  secara pairwise dari screenshot + outline sumber; dengan **~5.000 entry**,
  bersaing ke **top 10 (yang dibayar)** itu berat.
- **Ekspektasi realistis:** layak submit; perkiraan saya peluang top 10 kecil
  (mungkin sekitar 1 dari 10), top 20 mungkin sekitar 1 dari 4. Kalau tidak
  masuk, bukan karena gamenya rusak — karena lapangannya besar dan genrenya
  ramai. Satu-satunya jalan menaikkan peluang secara berarti adalah menambah
  satu mekanik khas yang mudah terlihat di screenshot (mis. boss dengan pola
  serangan, atau sistem upgrade antar-wave) — itu butuh satu putaran kerja lagi
  sebelum 18 Nov.

## Catatan lain

- Entri ai-excited-01 "Wave Horse" (builder lain, jalan paralel) recording-nya
  terkontaminasi builder ini — sudah dicatat di MEMORY.md; parent yang menangani
  rebuild terisolasi sebelum tutup 23:00 UTC 16 Nov.
- Sesi parent juga ikut ter-bundle di entri ini (bundle mengambil bagian sesi
  parent sejak repo ini pertama disebut). Itu wajar untuk alur Muse app.
- Server uji (`node serve.ts --port 8901`) sudah dimatikan setelah tes.
