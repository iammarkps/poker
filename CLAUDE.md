# Poker App - Claude Code Context

## Project Overview
A real-time multiplayer Texas Hold'em poker app for friends. Players join via 6-character room codes without registration.

## Tech Stack
- **Framework**: Next.js 16 + React 19
- **Styling**: Tailwind CSS v4
- **UI Components**: shadcn/ui
- **Backend**: Supabase (PostgreSQL + Realtime)
- **Package Manager**: bun

## Key Commands
```bash
bun dev          # Start development server
bun run build    # Build for production
bun run lint     # Run ESLint
supabase db push # Push database migrations
```

## Project Structure
```
app/
  page.tsx                    # Home - create/join room forms
  room/[code]/                # Game room pages
    page.tsx                  # Room page wrapper
    room-content.tsx          # Main room content
    lobby.tsx                 # Waiting room before game starts
    poker-game.tsx            # Active game UI
  api/room/
    create/route.ts           # POST: Create room
    [code]/join/route.ts      # POST: Join room
    [code]/start/route.ts     # POST: Start game
    [code]/action/route.ts    # POST: Player action (fold/check/call/raise)
    [code]/next-hand/route.ts # POST: Deal next hand
    [code]/addon/route.ts     # Add-on chip requests

components/
  poker/                      # Poker-specific components
    table.tsx                 # Oval table with 9 seats
    seat.tsx                  # Player seat position
    playing-card.tsx          # Card visual (face/back)
    community-cards.tsx       # 5 board cards
    pot-display.tsx           # Pot amount display
    action-buttons.tsx        # Fold/Check/Call/Raise buttons
    bet-slider.tsx            # Raise amount slider
    turn-timer.tsx            # 30-second turn timer
    session-timer.tsx         # Session duration display
    addon-panel.tsx           # Chip add-on UI
  game/
    game-provider.tsx         # React context for game state
  lobby/                      # Lobby components
  ui/                         # shadcn/ui components

lib/
  supabase/
    client.ts                 # Browser Supabase client
    server.ts                 # Server Supabase client
    types.ts                  # TypeScript types for DB
  poker/
    deck.ts                   # Create/shuffle/deal deck
    hand-evaluator.ts         # Evaluate poker hands
    game-rules.ts             # Valid actions logic
    winner.ts                 # Determine winner(s)
  session.ts                  # localStorage session ID

hooks/
  use-session.ts              # Get/create session ID
  use-game-state.ts           # Subscribe to game state
  use-presence.ts             # Track online players
```

## Database Schema
- **rooms**: Game rooms with code, host, blinds, status
- **players**: Players in rooms with chips, seat, time_bank
- **hands**: Active hand state (deck, community cards, pot, phase)
- **player_hands**: Player's hole cards and betting state per hand
- **actions**: Action log
- **addon_requests**: Chip add-on requests

## Environment Variables
```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
SUPABASE_SECRET_KEY=
```

## Game Flow
1. Host creates room → gets 6-char code
2. Players join with code + name
3. Host starts game → cards dealt, blinds posted
4. Players take turns: fold/check/call/raise
5. Betting rounds: preflop → flop → turn → river → showdown
6. Winner determined, chips awarded
7. Auto-deal next hand after 3 seconds

## Key Features
- 30-second turn timer with time bank (3s initial, +1 per 10 hands, max 5)
- Min raise = previous raise increment (not just big blind)
- Pot percentage bet buttons (33%, 50%, 100%) when facing post-flop bet
- Bet slider increments by small blind
- Auto-fold on timeout
- Chip add-on with host approval
- Only winner's cards shown at showdown (losers muck)

## Conventions
- Use `sessionId` from localStorage for player identification
- Realtime subscriptions via Supabase channels
- Server actions via API routes (not Server Actions)
- Types defined in `lib/supabase/types.ts`
