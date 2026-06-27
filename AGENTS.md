# SlotCasino Tasirin — Project Overview for AI Agents

## Quick Start
```bash
cd /root/proyek/kasino
PORT=3007 node server/index.js
# Open http://localhost:3007
```

## Architecture

### Tech Stack
- **Backend**: Node.js + Express + NanoHTTPD (Android) + WebSocket
- **Frontend**: HTML + CSS + Vanilla JS (SPA-like router)
- **Storage**: JSON files in `data/` directory (no database)
- **Auth**: JWT tokens with bcrypt password hashing
- **Admin Account**: `tasirin` / `255280` (hardcoded super admin)

### Directory Structure
```
kasino/
├── client/                  # Frontend
│   ├── index.html           # Lobby / landing page
│   ├── admin.html           # Admin dashboard
│   ├── login.html           # Login page
│   ├── register.html        # Register page
│   ├── profile.html         # Profile page
│   ├── game.html            # Game page (loaded by router)
│   ├── wallet.html          # Wallet page
│   ├── css/                 # Stylesheets
│   │   ├── style.css        # Global styles
│   │   ├── mobile.css       # Mobile-specific responsive fixes
│   │   └── admin.css        # Admin panel styles
│   └── js/                  # JavaScript modules
│       ├── router.js        # SPA client-side router
│       ├── api.js           # API client (fetch wrapper with JWT)
│       ├── ws.js            # WebSocket client
│       ├── game.js          # Game manager / slot engine
│       ├── reel-engine.js   # Reel spinning animation engine
│       ├── game-loader.js   # Game page initializer
│       ├── admin.js         # Admin dashboard logic
│       ├── lobby.js         # Lobby page logic
│       ├── profile.js       # Profile page logic
│       ├── nav.js           # Navigation bar
│       ├── fouc.js          # Anti-FOUC splash screen
│       └── games/           # Individual game modules
│           └── classic777/  # Classic 777 slot game
│               └── index.js
├── server/                  # Backend
│   ├── index.js             # Express + WebSocket server entry
│   ├── services/
│   │   ├── auth.js          # JWT + bcrypt authentication
│   │   ├── storage.js       # JSON file storage (CRUD)
│   │   ├── game.js          # Game logic / RNG engine
│   │   └── logger.js        # Audit logging
│   └── routes/
│       ├── auth.js          # Login / Register / Logout endpoints
│       ├── game.js          # Spin / Config endpoints
│       ├── admin.js         # Admin CRUD endpoints
│       └── profile.js       # Profile update endpoints
├── data/                    # JSON storage files
│   ├── users.json           # User accounts
│   ├── config.json          # Global game configuration
│   └── games.json           # Game definitions
└── AGENTS.md                # This file
```

## Key Concepts

### Authentication
- JWT-based with `jsonwebtoken` library
- Token stored in `sessionStorage` (browser) or `localStorage` (fallback)
- Admin role checked via `isAdmin: true` in JWT payload
- All `/api/admin/*` routes require valid admin token
- Password hashed with `bcrypt` (10 rounds)

### Game Engine (server/services/game.js)
- Single unified game engine for ALL games
- Results determined ENTIRELY on SERVER
- RNG flow:
  1. Read effective config (user override > game override > global)
  2. Generate random number (0-100)
  3. Compare against `winRate` threshold
  4. If WIN → build winning reel + calculate payout
  5. If LOSE → build losing reel (near-miss logic)
- Client ONLY displays animation; server decides outcome
- Debug mode logs `winRate`, `randomRoll`, `result` for each spin

### Win Rate Logic (CRITICAL)
- `winRate` 0.0 - 1.0 (0% - 100%)
- Admin slider maps to 0-200 range (value/200)
- Example: slider at 10 → winRate = 0.05 (5%)
- Server generates `Math.random() * 100` and compares to `winRate * 100`
- **CRITICAL**: Server is the ONLY source of truth for win/lose decisions

### Real-Time Sync (WebSocket)
- All browsers connect via WebSocket to server
- Server broadcasts on config changes (`configChanged`, `jackpotChanged`, `balanceChanged`, etc.)
- Clients update state immediately without page refresh
- Auto-reconnect with exponential backoff (max 5s delay)

### Slider Conversion Reference
| Slider ID | Range | Raw Value | Actual Value | Formula |
|-----------|-------|-----------|-------------|---------|
| `sWinRate` | 0-200 | e.g. 10 | 0.05 (5%) | `/200` |
| `sPayoutMult` | 1-200 | e.g. 20 | 10x | `/2` |
| `sJackpotRate` | 0-200 | e.g. 5 | 0.025 (2.5%) | `/200` |
| `sMinBet` | 100-1M | e.g. 1000 | 1000 (direct) | `parseInt` |
| `sMaxBet` | 100-10M | e.g. 100000 | 100000 (direct) | `parseInt` |

## Known Issues & Caveats

### Storage
- JSON file-based, not thread-safe
- No database migration path yet
- `data/users.json` can grow large over time

### Authentication
- JWT secret is hardcoded (change in production)
- No refresh token mechanism
- Token expiry: 24 hours

### Admin
- Super admin `tasirin` created automatically on first run
- Admin status determined by username match to hardcoded value
- Admin panel has per-user settings override system

### Games
- Classic 777 is the primary slot game
- Reels use `transform: translateY` with `requestAnimationFrame`
- New games can be added via admin panel (UI) but need frontend module
- Game modules live in `client/js/games/<gameId>/`

### Mobile
- Designed for Android Chrome / WebView
- Uses `100dvh` for viewport height
- Horizontal orientation preferred for game
- Android 6+ compatibility targeted

## Debug Mode
- Admin dashboard has "Debug Mode" toggle
- Shows: WinRate, Random Roll, Result (WIN/LOSE), Threshold
- Useful for verifying win rate configuration takes effect

## Testing API
```bash
# Login as admin
curl -X POST http://localhost:3007/api/login \
  -H "Content-Type: application/json" \
  -d '{"username":"tasirin","password":"255280"}'

# Get config
curl http://localhost:3007/api/config

# Spin (requires auth token)
curl -X POST http://localhost:3007/api/spin \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"bet":100,"gameId":"classic777"}'

# Admin: get users
curl http://localhost:3007/api/admin/users \
  -H "Authorization: Bearer <token>"

# Admin: set per-user settings
curl -X PUT http://localhost:3007/api/admin/users/<username>/settings \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"winRate":0.1,"payoutMultiplier":5}'
```

## Frontend Router
- Simple hash-based SPA router in `client/js/router.js`
- Routes: `#home`, `#login`, `#register`, `#profile`, `#wallet`, `#admin`, `#game/<id>`
- Page content loaded into `<main>` element
- CSS transitions between pages (fade 200ms)

## If You Need to Add a New Game
1. Create folder `client/js/games/<gameId>/index.js`
2. Register game via admin panel (name + category)
3. The game module must export `init(container, config)` function
4. Game logic must use server API for outcomes
5. Add game thumbnail in admin panel

## Deployment
- Ready for Koyeb / any Node.js host
- `npm install && npm start`
- Set `PORT` env var for custom port
- No database setup needed (uses JSON files)

## Common Task Patterns

### Fixing Slider Issues
1. Check `sWinRate` value → divide by 200 for actual winRate
2. Labels use `sliderPct()`, `sliderMult()`, `sliderRupiah()` helpers
3. Event listeners: `input.addEventListener('input', handler)`
4. Submit handler uses `getSliderVal(id, divisor)` helper

### Fixing Win Rate Not Working
1. Check `server/services/game.js` → `generateResult()` function
2. Verify config is loaded fresh each spin (not cached)
3. Check slider value → `winRate = parseInt(sliderValue) / 200`
4. Enable debug mode in admin to see actual values

### Fixing WebSocket Issues
1. Server: `server/index.js` creates WebSocket on same port
2. Client: `client/js/ws.js` connects and auto-reconnects
3. Events: `configChanged`, `balanceChanged`, `jackpotChanged`
4. Check server logs for WebSocket connections

## File Size Limits
- Keep individual JS files under 500 lines when possible
- `admin.js` is the largest file (~450 lines)
- Use modular functions, not monolithic code
