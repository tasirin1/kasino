# 🎰 SlotCasino Tasirin — Platform Kasino Online Mini

> **Proyek ini dibangun dari nol dengan arsitektur bersih, keamanan ketat, dan gameplay yang adil.**
> Seluruh keputusan permainan (RNG, Win Rate, RTP, Payout) dihitung **eksklusif di server**.
> Client hanya menampilkan animasi — tidak pernah menentukan hasil.

---

## 📋 Daftar Isi

- [Apa Itu Proyek Ini?](#apa-itu-proyek-ini)
- [Fitur Utama](#fitur-utama)
- [Arsitektur](#arsitektur)
- [Game Engine (Paling Penting)](#game-engine-paling-penting)
- [Cara Kerja Win Rate & RTP](#cara-kerja-win-rate--rtp)
- [Sistem Keamanan](#sistem-keamanan)
- [Cara Install & Jalankan](#cara-install--jalankan)
- [Login Admin](#login-admin)
- [Struktur Folder](#struktur-folder)
- [API Endpoints](#api-endpoints)
- [Game yang Tersedia](#game-yang-tersedia)
- [Teknologi](#teknologi)

---

## Apa Itu Proyek Ini?

**SlotCasino Tasirin** adalah platform kasino online mini berbasis web yang terdiri dari:

1. **Casino Lobby** — halaman utama dengan daftar game, jackpot live, dan statistik
2. **Game Slot 3 Reel** — mesin slot klasik dengan animasi reel sungguhan (translateY + requestAnimationFrame)
3. **Coin Flip** — tebak kepala atau ekor
4. **Plinko** — jatuhkan bola, dapatkan multiplier
5. **Admin Dashboard** — kelola pemain, konfigurasi game, pantau statistik real-time
6. **Sistem Akun** — register, login, profile, wallet, riwayat permainan
7. **WebSocket Real-time** — semua perubahan admin langsung terlihat di browser pemain

Semua game menggunakan **satu Game Engine yang sama** di server.
Tidak ada game yang punya logika RNG sendiri — semua hasil dari server.

---

## Fitur Utama

### 🎮 Gameplay
- **3 Reel sungguhan** — reel benar-benar berputar dari atas ke bawah dengan translateY + requestAnimationFrame
- **Animasi real** — bukan flip card, bukan blur palsu, bukan grid statis
- **Reel berhenti satu per satu** — kiri → tengah → kanan (staggered stop)
- **Efek partikel** — burst saat menang
- **Auto Spin** & **Turbo Mode** — permainan otomatis dan cepat

### 👤 Sistem Akun
- Register dengan validasi password (min 8 karakter, huruf besar, huruf kecil, angka)
- Login dengan JWT (24 jam expiry + nonce anti-fixation)
- Profile lengkap: edit username, ganti password, riwayat permainan
- Setelan tema (Dark Purple, Gold, Blue, Green, Classic Casino)
- Multi bahasa (Indonesia, English) — siap dikembangkan

### 🔧 Admin Dashboard
- Statistik real-time: total pemain, saldo, spin, RTP, jackpot
- Kelola akun: tambah, edit, hapus, reset saldo
- Konfigurasi game: Win Rate, Payout Multiplier, Jackpot Rate, Min/Max Bet
- Per-game settings: setiap game punya konfigurasi sendiri
- Override per akun: prioritas tertinggi (admin override > game config > global)
- Debug mode: lihat hasil RNG, roll, dan threshold

### 📡 Real-time Sync (WebSocket)
Semua perubahan dari Admin Dashboard langsung dikirim ke semua browser pemain:
- Konfigurasi berubah → semua pemain langsung pakai nilai baru
- Jackpot berubah → counter langsung update
- Balance berubah → saldo langsung sinkron
- Maintenance mode → game berhenti semua

Tidak perlu refresh. Tidak ada polling. Delay < 100ms.

---

## Arsitektur

```
┌─────────────────────────────────────────────────────────────┐
│                    BROWSER (CLIENT)                         │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌───────────┐  │
│  │  Lobby   │  │  Game    │  │  Profile │  │  Admin    │  │
│  │  (HTML)  │  │  (HTML)  │  │  (HTML)  │  │  (HTML)   │  │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘  └─────┬─────┘  │
│       │             │             │              │         │
│  ┌────▼─────────────▼─────────────▼──────────────▼─────┐   │
│  │              JavaScript (API + WS)                  │   │
│  │  api.js  │  ws.js  │  router.js  │  nav.js         │   │
│  └───────────────────────┬─────────────────────────────┘   │
└──────────────────────────┼─────────────────────────────────┘
                           │ HTTP REST + WebSocket
                           ▼
┌─────────────────────────────────────────────────────────────┐
│                   SERVER (NODE.JS)                          │
│  ┌─────────┐  ┌──────────┐  ┌──────────┐  ┌────────────┐  │
│  │  Express │  │WebSocket │  │  Auth    │  │   Logger   │  │
│  │  Routes  │  │  Server  │  │ (JWT+bc) │  │  (Audit)   │  │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘  └─────┬──────┘  │
│       │             │             │              │         │
│  ┌────▼─────────────▼─────────────▼──────────────▼─────┐   │
│  │              Game Engine (UNIFIED)                   │   │
│  │  generateResult() / calculatePayout()               │   │
│  └───────────────────────┬─────────────────────────────┘   │
│                          │                                 │
│  ┌───────────────────────▼─────────────────────────────┐   │
│  │              Storage (JSON Files)                    │   │
│  │  users.json │ config.json │ games.json │ spins.json │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

### Alur Spin

```
Player klik SPIN
       │
       ▼
Browser → POST /api/spin (dengan token + bet)
       │
       ▼
Server: validasi token → cek saldo → kurangi bet
       │
       ▼
Server: ambil KONFIGURASI TERBARU (global + game + user)
       │
       ▼
Server: RNG → roll = Math.random()
       │
       ▼
Server: isWin = (roll < winRate) ← INI KUNCI
       │
       ▼
Server: calculatePayout(bet, winRate, multiplier)
       │  payout = bet * (RTP_TARGET / winRate) * variance
       ▼
Server: generateResult(isWin, bet, winRate, mult)
       │  → grid visual, wins array, payout amount
       ▼
Server: updateBalance → addSpinHistory → response
       │
       ▼
Browser: animasi reel → tampilkan hasil → update UI
```

---

## Game Engine (Paling Penting)

Semua game menggunakan **satu fungsi** di `server/services/game.js`:

### `generateResult(isWin, bet, winRate, mult)`

| Param | Tipe | Deskripsi |
|-------|------|-----------|
| `isWin` | boolean | Apakah spin ini menang? (ditentukan oleh RNG + winRate) |
| `bet` | number | Jumlah taruhan |
| `winRate` | float | Win rate dari admin config (0.0 - 1.0) |
| `mult` | float | Payout multiplier dari admin config |

### `calculatePayout(bet, winRate, mult)`

```
payout = bet × (RTP_TARGET ÷ winRate) × variance × mult
```

Dimana:
- **RTP_TARGET** = 0.90 (90% — house edge 10%)
- **variance** = random 0.5x - 1.5x (rata-rata 1.0x, tidak bias)
- **mult** = payoutMultiplier dari admin config

**Tidak ada game yang punya Math.random() sendiri.**
Coin Flip dan Plinko juga menggunakan `calculatePayout()` yang sama.

---

## Cara Kerja Win Rate & RTP

### Prinsip

| Konsep | Arti | Contoh |
|--------|------|--------|
| **Win Rate** | Seberapa sering menang | 15% = menang 15 dari 100 spin |
| **RTP** | Return to Player (%) | 90% = dari Rp100 taruhan, kembali Rp90 |
| **House Edge** | Keuntungan kasino | 10% = kasino untung Rp10 dari Rp100 |

### Hubungan Win Rate dan RTP

```
RTP = WinRate × Rata-rata Payout Multiplier (saat menang)
```

Karena RTP tetap ~90%, maka:

| Win Rate | Rata-rata Payout saat Menang |
|----------|-----------------------------|
| 0.1% (Impossible) | ~900x bet (jarang tapi besar) |
| 1% (Very Hard) | ~90x bet |
| 15% (Medium) | ~6x bet |
| 30% (Easy) | ~3x bet |
| 50% (Very Easy) | ~1.8x bet |
| 100% (Max) | ~0.9x bet (selalu menang tapi kecil) |

### Verifikasi

Test dengan 100 spin di 30% win rate:
- **Wins:** ~25-35 (sesuai win rate)
- **RTP aktual:** ~85-95% (sesuai target)

---

## Sistem Keamanan

### Lapisan 1: Authentication
- Password di-hash dengan **bcrypt** (10 rounds)
- JWT dengan **24 jam expiry**
- Setiap token memiliki **nonce unik** (cegah session fixation)
- Token wajib dikirim via header `Authorization: Bearer`

### Lapisan 2: Authorization
- Semua route admin dilindungi `authenticate + adminOnly`
- `isAdmin` dicek di server, bukan di client
- Username "tasirin" tidak bisa dipalsukan lewat localStorage

### Lapisan 3: Rate Limiting
- Login: maksimal **5 percobaan per menit** per IP
- Register: maksimal **3 akun per menit** per IP
- Spin: maksimal **10 spin per detik** per IP

### Lapisan 4: Input Validation
- Semua input numerik divalidasi: tolak NaN, Infinity, null, negatif
- Username: hanya huruf, angka, underscore (dibersihkan dari HTML)
- Avatar: path traversal dicegah
- Config: range divalidasi per field

### Lapisan 5: Server Authority
- **Client tidak pernah dipercaya** untuk keputusan game
- Balance cuma diubah server
- Win/loss cuma ditentukan server
- Payout cuma dihitung server
- Client cuma menampilkan hasil

### Lapisan 6: Security Headers
- `helmet` middleware
- `X-Frame-Options: DENY`
- `X-Content-Type-Options: nosniff`
- `Cache-Control: no-store`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Permissions-Policy: camera=(), microphone=(), geolocation=()`
- Body size limit: 100kb (cegah DOS)

### Lapisan 7: Audit Logging
Semua event penting dicatat ke `data/audit.log`:
- Login / logout
- Register
- Admin login
- Perubahan konfigurasi
- Pembuatan/penghapusan akun
- Reset saldo
- Kemenangan besar

---

## Cara Install & Jalankan

### Prasyarat
- Node.js v18+
- npm

### Install

```bash
git clone https://github.com/tasirin1/kasino.git
cd kasino
cp .env.example .env    # opsional, untuk kustomisasi
npm install
npm start
```

Buka `http://localhost:3000`

### Environment Variables (.env)

| Variable | Default | Deskripsi |
|----------|---------|-----------|
| `PORT` | 3000 | Port server |
| `JWT_SECRET` | auto-generate | Secret key JWT |
| `ADMIN_USERNAME` | tasirin | Username admin |
| `ADMIN_PASSWORD` | 255280 | Password admin |

---

## Login Admin

| Role | Username | Password |
|------|----------|----------|
| **Super Admin** | `tasirin` | `255280` |

Setelah login sebagai admin, otomatis redirect ke `/admin`.

---

## Struktur Folder

```
kasino/
├── client/                      # Frontend (HTML, CSS, JS)
│   ├── *.html                   # Halaman SPA
│   ├── css/
│   │   ├── style.css            # Global style
│   │   └── nav.css              # Page transitions
│   ├── js/
│   │   ├── api.js               # HTTP client (fetch wrapper)
│   │   ├── ws.js                # WebSocket client
│   │   ├── game.js              # Game manager (Classic777 entry)
│   │   ├── game-loader.js       # Dynamic game module loader
│   │   ├── reel-engine.js       # Reel animation engine
│   │   ├── lobby.js             # Casino lobby UI
│   │   ├── profile.js           # Profile page UI
│   │   ├── admin.js             # Admin dashboard UI
│   │   ├── router.js            # SPA router
│   │   └── nav.js               # Navigation transitions
│   └── games/                   # Game modules
│       ├── classic777/          # Slot 3 reel
│       ├── luckyfruits/         # Slot buah
│       ├── plinko/              # Plinko
│       └── coinflip/            # Coin Flip
├── server/                      # Backend (Node.js)
│   ├── index.js                 # Entry point
│   ├── app.js                   # Express app + middleware
│   ├── routes/
│   │   ├── auth.js              # Login/register endpoints
│   │   ├── game.js              # Spin + game data endpoints
│   │   ├── admin.js             # Admin CRUD endpoints
│   │   ├── games.js             # Public game list endpoints
│   │   └── profile.js           # Profile management endpoints
│   ├── services/
│   │   ├── auth.js              # JWT + bcrypt + password policy
│   │   ├── game.js              # UNIFIED GAME ENGINE ★
│   │   ├── games.js             # Games registry
│   │   ├── storage.js           # JSON file storage
│   │   ├── ws.js                # WebSocket server (broadcast)
│   │   └── logger.js            # Audit logging
│   ├── middleware/
│   │   ├── auth.js              # authenticate() + adminOnly()
│   │   └── rateLimit.js         # Rate limiter (login/register/spin)
│   └── utils/
│       ├── constants.js         # Symbols, paylines, difficulties
│       └── helpers.js           # randomSymbol, clamp
├── data/                        # JSON file storage
│   ├── users.json
│   ├── config.json
│   ├── games.json
│   ├── spins.json
│   ├── jackpot.json
│   ├── sessions.json
│   └── audit.log
├── .env.example
├── package.json
├── README.md
└── Dockerfile
```

---

## API Endpoints

### Public (tanpa auth)

| Method | Path | Deskripsi |
|--------|------|-----------|
| GET | `/api/config` | Konfigurasi global |
| GET | `/api/jackpot` | Nilai jackpot |
| GET | `/api/games` | Daftar semua game |
| GET | `/api/games/:gameId` | Detail game |
| GET | `/api/lobby` | Data lobby (jackpot, player count, games) |

### Auth (tanpa token)

| Method | Path | Deskripsi |
|--------|------|-----------|
| POST | `/api/register` | Registrasi akun baru |
| POST | `/api/login` | Login, dapat token |

### User (wajib token)

| Method | Path | Deskripsi |
|--------|------|-----------|
| GET | `/api/user` | Data user (balance, stats) |
| POST | `/api/spin` | Spin! (rate limited) |
| GET | `/api/history` | Riwayat spin |
| GET | `/api/games/:gameId/config` | Config efektif untuk user |

### Profile (wajib token)

| Method | Path | Deskripsi |
|--------|------|-----------|
| GET | `/api/profile` | Data profil lengkap |
| POST | `/api/profile/update` | Update username/avatar/settings |
| POST | `/api/profile/password` | Ganti password |
| POST | `/api/profile/theme` | Ganti tema |
| POST | `/api/profile/language` | Ganti bahasa |
| POST | `/api/profile/notifications` | Setelan notifikasi |
| POST | `/api/profile/logout` | Logout dari perangkat ini |
| POST | `/api/profile/logout-all` | Logout dari semua perangkat |
| POST | `/api/profile/reset-stats` | Reset statistik |
| DELETE | `/api/profile/delete` | Hapus akun |

### Admin (wajib token + role admin)

| Method | Path | Deskripsi |
|--------|------|-----------|
| GET | `/api/admin/stats` | Statistik dashboard |
| GET | `/api/admin/users` | Daftar semua user |
| POST | `/api/admin/users` | Tambah user |
| PUT | `/api/admin/users/:username` | Edit user (balance/password) |
| DELETE | `/api/admin/users/:username` | Hapus user |
| POST | `/api/admin/config` | Update konfigurasi global |
| POST | `/api/admin/jackpot` | Update jackpot |
| POST | `/api/admin/reset-balances` | Reset saldo semua user |
| GET | `/api/admin/games` | Daftar game (termasuk disabled) |
| POST | `/api/admin/games` | Tambah game baru |
| PUT | `/api/admin/games/:gameId` | Edit game meta |
| PUT | `/api/admin/games/:gameId/config` | Edit game config |
| POST | `/api/admin/games/:gameId/toggle` | Enable/disable game |
| DELETE | `/api/admin/games/:gameId` | Hapus game |
| GET | `/api/admin/users/:username/settings` | Settings user |
| PUT | `/api/admin/users/:username/settings` | Override settings user |
| POST | `/api/admin/users/:username/reset-balance` | Reset saldo user |

---

## Game yang Tersedia

### 1. Classic 777 🎰
- Slot 3 reel dengan simbol klasik
- BAR, 7, Cherry, Lemon, Bell, Orange, Plum, Grapes, Watermelon, Diamond
- 5 paylines
- Animasi reel real dengan translateY

### 2. Lucky Fruits 🍒
- Slot buah-buahan
- Jackpot progresif
- Tema warna-warni

### 3. Plinko ⬇️
- Jatuhkan bola melalui paku
- Pilih risiko: Low (1.5x), Medium (3x), High (6x)
- Multiplier acak di bagian bawah

### 4. Coin Flip 🪙
- Tebak Heads 👑 atau Tails 🦅
- Fair 50:50 dalam win rate

---

## Teknologi

### Backend
| Teknologi | Versi | Fungsi |
|-----------|-------|--------|
| Node.js | v22+ | Runtime |
| Express | ^4.18 | HTTP server + routing |
| ws | ^8.16 | WebSocket server (real-time) |
| bcryptjs | ^2.4 | Password hashing |
| jsonwebtoken | ^9.0 | JWT authentication |
| helmet | ^8.2 | Security headers |
| cookie-parser | ^1.4 | Cookie parser (cadangan) |
| dotenv | ^16 | Environment variables |

### Frontend
| Teknologi | Fungsi |
|-----------|--------|
| HTML5 | Struktur halaman |
| CSS3 | Layout + animasi (Flexbox, Grid, custom properties) |
| Vanilla JS | Logika frontend (no framework, no bloat) |
| Canvas API | Plinko board rendering |
| WebSocket API | Real-time client |
| Fetch API | REST client |

### Storage
| File | Fungsi |
|------|--------|
| `data/users.json` | Data akun |
| `data/config.json` | Konfigurasi global |
| `data/games.json` | Definisi game |
| `data/spins.json` | Riwayat spin |
| `data/jackpot.json` | Nilai jackpot |
| `data/sessions.json` | Session aktif |
| `data/audit.log` | Log keamanan |

> **Catatan:** Storage JSON dirancang agar mudah diganti ke SQLite atau PostgreSQL.
> Cukup ganti fungsi di `server/services/storage.js` — arsitektur sudah dipisah.

---

## Lisensi

© 2026 SlotCasino Tasirin. All rights reserved.

---

## Catatan untuk Developer AI

Proyek ini memiliki arsitektur yang bersih dan modular. Jika Anda adalah AI yang ditugaskan mengembangkan proyek ini:

1. **Jangan membuat game engine sendiri** — semua game WAJIB menggunakan `server/services/game.js`
2. **Jangan taruh RNG di client** — client hanya menampilkan hasil dari server
3. **Jangan percaya input client** — validasi semua input di server dengan `sanitizeNumeric()`
4. **Jangan bypass auth** — semua route admin WAJIB pakai `authenticate + adminOnly`
5. **Keamanan adalah prioritas** — setiap perubahan harus melewati security review
6. **Satu engine untuk semua** — jika ada game baru, gunakan `calculatePayout()` yang sama
7. **Config selalu fresh** — jangan cache config, baca dari storage setiap spin
