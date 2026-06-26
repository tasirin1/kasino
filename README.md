# 🎰 777 Kasino — Premium Slot Machine

Aplikasi web slot 3 reel dengan admin panel, sistem akun, dan real-time sync via WebSocket.

## Fitur

- **Slot 3 Reel** — real spinning dengan requestAnimationFrame + translateY
- **Sistem Akun** — register/login dengan bcrypt + JWT
- **Admin Dashboard** — kelola pemain, konfigurasi game, jackpot
- **Real-time Sync** — perubahan admin langsung terlihat di semua browser
- **JSON Storage** — penyimpanan file JSON (siap migrasi ke SQL/PostgreSQL)

## Deploy ke Koyeb

```bash
git push origin main
# Koyeb auto-deploy dari GitHub
```

## Cara Install & Jalankan

```bash
git clone https://github.com/tasirin1/kasino.git
cd kasino
npm install
npm start
```

Buka `http://localhost:3000`

### Login Admin
- Username: `tasirin`
- Password: `255280`

## API

| Method | Path | Auth | Deskripsi |
|--------|------|------|-----------|
| POST | /api/register | - | Registrasi akun |
| POST | /api/login | - | Login |
| GET | /api/user | ✓ | Data user |
| POST | /api/spin | ✓ | Spin slot |
| GET | /api/config | - | Konfigurasi game |
| POST | /api/admin/config | Admin | Update config |
| GET | /api/admin/users | Admin | List semua user |
| POST | /api/admin/users | Admin | Tambah user |
| PUT | /api/admin/users/:user | Admin | Edit user |
| DELETE | /api/admin/users/:user | Admin | Hapus user |

## Tech Stack

- **Backend**: Node.js, Express, ws, bcryptjs, jsonwebtoken
- **Frontend**: HTML5, CSS3, Vanilla JS
- **Storage**: JSON files
- **Realtime**: WebSocket
