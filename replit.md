# GTA Heist RPG Discord Bot

A GTA Online-inspired RPG Discord bot built with discord.js, TypeScript, and canvas-rendered game UI.

## Architecture

```
src/
├── commands/          # Slash command handlers
├── systems/           # Core game logic (Player, Heist, Approval, Crew, Streaks)
├── canvas/            # Canvas card renderers (profile, leaderboard, mission, stats, crew)
├── services/          # Command loader
├── database/          # SQLite via better-sqlite3 (schema + typed queries)
├── events/            # Discord event handlers (ready, interactionCreate)
└── utils/             # Logger, constants, helpers
```

## Commands

| Command | Description |
|---------|-------------|
| `/profile` | View your canvas-rendered criminal profile card |
| `/stats` | Full criminal dossier with recent heist history |
| `/daily` | Claim daily XP + coin reward (streak system) |
| `/leaderboard` | Top 10 criminals by XP or coins |
| `/heist-log` | Submit a completed heist via modal for staff review |
| `/crew create` | Create a new crew |
| `/crew info` | View crew card with all members |
| `/crew join` | Join a crew by name |
| `/crew leave` | Leave your current crew |
| `/crew invite` | Invite a player to your crew (owner only) |
| `/inventory` | View achievements and badges |

## Setup

1. Copy `.env.example` to `.env` and fill in values
2. Run `npm install`
3. Run `npm run deploy` to register slash commands
4. Run `npm start` to start the bot

## Environment Variables

- `DISCORD_TOKEN` — Bot token from Discord Developer Portal
- `DISCORD_CLIENT_ID` — Application/Client ID
- `DISCORD_GUILD_ID` — (Optional) Guild ID for instant command registration during dev
- `REVIEW_CHANNEL_ID` — Channel where heist submissions are posted for staff
- `ADMIN_ROLE_ID` — Role required to approve/reject submissions
- `DEBUG` — Set to `true` for verbose logging

## User Preferences

- TypeScript, clean modular architecture
- Canvas rendering over Discord embeds where possible
- Game-engine mindset, no spaghetti code
- SQLite for local dev (scalable to PostgreSQL)
