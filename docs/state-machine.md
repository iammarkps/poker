## Poker Game State Machine

Mermaid state diagram of the core game lifecycle (room + hand + betting phases).

```mermaid
stateDiagram-v2
    [*] --> Waiting
    Waiting --> Playing: Host starts game (/api/room/:code/start)
    Playing --> Finished: Room manually closed or no players with chips

    state Playing {
      [*] --> Preflop
      Preflop --> Flop: Betting round complete
      Flop --> Turn: Betting round complete
      Turn --> River: Betting round complete
      River --> Showdown: Betting round complete
      Preflop --> Showdown: everyone else folds
      Flop --> Showdown: everyone else folds
      Turn --> Showdown: everyone else folds
      River --> Showdown: everyone else folds

      Showdown --> NextHandReady: Payout + 3s countdown
      NextHandReady --> Preflop: Auto deal (/api/room/:code/next-hand)
    }
```

## Player Action Flow

Flowchart showing all possible actions during a player's turn.

```mermaid
flowchart TD
    subgraph "Player's Turn"
        A[My Turn?] -->|Yes| B{Action Buttons}
        A -->|No| W[Wait for turn]

        B -->|Fold| F[POST /action<br/>action: fold]
        B -->|Check| CH[POST /action<br/>action: check]
        B -->|Call| CA[POST /action<br/>action: call<br/>amount: toCall]
        B -->|Raise| R[Show Bet Slider]
        B -->|All-In| AI[POST /action<br/>action: all_in<br/>amount: chips]

        R --> R1[Select Amount]
        R1 --> R2[POST /action<br/>action: raise<br/>amount: selected]
        R1 --> R3[Cancel]
        R3 --> B
    end

    subgraph "Server Processing (/api/room/:code/action)"
        F --> S1[is_folded = true]
        CH --> S2[No chip change]
        CA --> S3[chips -= toCall<br/>pot += toCall]
        R2 --> S4[chips -= raiseAmt<br/>pot += raiseAmt<br/>last_raise = increment]
        AI --> S5[pot += chips<br/>chips = 0<br/>is_all_in = true]

        S1 --> S6{Only 1 active?}
        S2 --> S6
        S3 --> S6
        S4 --> S6
        S5 --> S6

        S6 -->|Yes| S7[Showdown<br/>Award pot to winner]
        S6 -->|No| S8{Round complete?}

        S8 -->|Yes, was raise| S9[Reset has_acted<br/>Next player]
        S8 -->|Yes, no raise| S10{Phase?}
        S8 -->|No| S11[Next player<br/>turn_start_time = now]

        S10 -->|preflop| S12[Deal flop<br/>3 cards]
        S10 -->|flop| S13[Deal turn<br/>1 card]
        S10 -->|turn| S14[Deal river<br/>1 card]
        S10 -->|river| S15[Showdown<br/>Evaluate hands]

        S12 --> S16[Reset bets<br/>First to act after dealer]
        S13 --> S16
        S14 --> S16
        S15 --> S7
        S9 --> S11
        S16 --> S11
    end

    subgraph "Showdown"
        S7 --> SD1[Evaluate winner hands]
        SD1 --> SD2[Award chips]
        SD2 --> SD3[3 second countdown]
        SD3 --> SD4[Auto next-hand]
    end
```

## Button Visibility Logic

```mermaid
flowchart LR
    subgraph "Conditions"
        C1[isMyTurn?]
        C2[is_folded?]
        C3[is_all_in?]
        C4[toCall > 0?]
        C5[chips > minRaise?]
    end

    subgraph "Buttons Shown"
        C1 -->|No| WAIT[Waiting message]
        C2 -->|Yes| FOLDED[You folded]
        C3 -->|Yes| ALLIN_MSG[You're all in]

        C1 -->|Yes| C2
        C2 -->|No| C3
        C3 -->|No| BUTTONS[Show Buttons]

        BUTTONS --> FOLD[Fold - always]
        BUTTONS --> C4
        C4 -->|No| CHECK[Check]
        C4 -->|Yes| CALL[Call amount]
        BUTTONS --> C5
        C5 -->|Yes| RAISE[Raise - slider]
        C5 -->|No| ALLIN_BTN[All-In only]
    end
```

## Bet Slider Presets

```mermaid
flowchart TD
    subgraph "Preset Buttons (post-flop when facing bet)"
        P1["33% pot"]
        P2["50% pot"]
        P3["100% pot"]
        P4["All-In"]
    end

    subgraph "Preset Buttons (preflop or no bet)"
        P5["Min raise"]
        P6["1/2 Pot"]
        P7["Pot"]
        P8["All-In"]
    end

    subgraph "Slider"
        SL[Range: minRaise to maxRaise]
        SL --> STEP["Step: small_blind"]
    end
```

## Add-on Request Flow

```mermaid
sequenceDiagram
    participant P as Player
    participant S as Server
    participant H as Host
    participant DB as Database

    P->>S: POST /addon {sessionId, amount}
    S->>DB: Insert addon_request (pending)
    S-->>P: Success

    Note over H: Realtime subscription notifies

    H->>S: PATCH /addon {requestId, approve: true}
    S->>DB: Update request status
    S->>DB: Update player chips
    S-->>H: Approved

    Note over P: Realtime subscription updates chips
```

### Notes
- Actions inside phases are processed server-side (`/api/room/:code/action`) to keep authoritative turn order, chips, and pot splits.
- A betting round completes when all active players have acted and matched the current bet or are all-in.
- If only one active player remains, transition to `Showdown` immediately and award the pot.
- Blinds and new decks are dealt on `start` (first hand) and `next-hand` (subsequent hands); `turn_start_time` and `total_contributed` reset per hand.
- Add-ons do not change phase; they only adjust a player’s chip stack when approved.

## Data Model (key fields)
- `rooms`: `code`, `status`, `host_session_id`, `small_blind`, `big_blind`, `starting_chips`, `hand_count`.
- `players`: `room_id`, `session_id`, `name`, `seat`, `chips`, `time_bank`, `is_connected`.
- `hands`: `room_id`, `dealer_seat`, `community_cards`, `pot`, `current_bet`, `current_seat`, `phase`, `deck`, `version`, `last_raise`, `turn_start_time`.
- `player_hands`: `hand_id`, `player_id`, `hole_cards`, `current_bet`, `total_contributed`, `has_acted`, `is_folded`, `is_all_in`.
- `actions`: `hand_id`, `player_id`, `action`, `amount`, `created_at`.
- `addon_requests`: `room_id`, `player_id`, `amount`, `status`.

## API Surface (server routes)
- `POST /api/room/create` — Body `{ sessionId, name, startingChips?, smallBlind?, bigBlind? }`  
  - Side effects: create room, host player seated at 0 with starting chips.
- `POST /api/room/[code]/join` — Body `{ sessionId, name }`  
  - Valid only when room.status=`waiting`. Seats next open seat, sets chips to `starting_chips`.
- `POST /api/room/[code]/start` — Body `{ sessionId }` (host only)  
  - Creates hand v1, shuffles deck, posts blinds, sets `room.status=playing`, seeds `total_contributed` with blinds.
- `POST /api/room/[code]/action` — Body `{ sessionId, action, amount? }`  
  - Updates player bet/contribution/chips, logs action, advances turn/phase or ends hand with payouts.
- `POST /api/room/[code]/next-hand` — Body `{ sessionId }` (host only)  
  - Increments hand version/count, rotates dealer, deals new hand, posts blinds, resets per-hand state.
- `POST /api/room/[code]/addon` — Body `{ sessionId, amount }`  
  - Creates pending add-on request.
- `PATCH /api/room/[code]/addon` — Body `{ sessionId, requestId, approve }` (host only)  
  - Approves/rejects request; on approve, adds chips to player.
- `GET /api/room/[code]/addon` — (now unused in UI) Returns pending requests for host view.

## Client Data Flow
- Session: `lib/session.ts` issues a local UUID stored in `localStorage` (no email required).
- State fetch: `hooks/use-game-state` uses Supabase client to load `room`, `players`, `hands` (latest), `player_hands` (per current hand).
- Realtime: subscriptions on `rooms` (by code), `players`/`hands` filtered by `room_id`, and `player_hands` filtered by `hand_id`. Add-on panel listens to `addon_requests` by `room_id`.
- Presence: `use-presence` joins `presence:roomCode` channel; marks `players.is_connected` true/false.
- UI-only derivations: `PokerGame` computes display-only winner info; authoritative payouts come from the server action route.

## Server Action Execution (high level)
1) **Validate** session and turn ownership (`/action` checks `hand.current_seat` vs player seat).  
2) **Mutate**: adjust `current_bet`, `total_contributed`, `chips`, `pot`, `last_raise`, `current_bet`.  
3) **Log**: insert into `actions`.  
4) **Advance**:
   - If one active player remains → `showdown`, pay pot.
   - Else if betting round complete → deal next community cards or showdown, reset `has_acted/current_bet` as needed, set `current_seat`.
   - Else → move `current_seat` to next active.
5) **Timing**: updates `turn_start_time` on seat change/phase change.

## Security Notes
- Joining still requires only room code + name; no email/auth needed.  
- Integrity relies on server-side validation and (recommended) RLS: do not trust client-sent `sessionId` without policies tying rows to it.  
- Authoritative game logic stays server-side; client calculations never change DB state.

## Performance Notes
- Parallel fetch for room/players/hand; `total_contributed` avoids recomputing pot from logs.
- Supabase realtime is filtered per room/hand to reduce fan-out.
- Winner calc uses precomputed contributions; avoids scanning `actions` at showdown.

## Player Action Flow (UI ➜ API ➜ DB)
- **Fold button** (`ActionButtons`): POST `/api/room/:code/action` `{ action:"fold", sessionId }`  
  - Server: marks `player_hands.is_folded=true`, `has_acted=true`; advances turn or ends hand if one remains; no chip change.
- **Check button**: POST `/action` `{ action:"check" }` (only if `toCall=0`)  
  - Server: `has_acted=true`; advances turn/phase.
- **Call button**: POST `/action` `{ action:"call", amount: toCall }`  
  - Server: moves `toCall` from `players.chips` → `player_hands.current_bet/total_contributed` and `hands.pot`; sets `has_acted=true`; may mark all-in.
- **Raise (slider)**: Opens `BetSlider`; on confirm POST `/action` `{ action:"raise", amount }`  
  - Server: increases `current_bet`, `last_raise`, `player_hands.current_bet/total_contributed`, deducts chips, resets others’ `has_acted` where needed, sets next seat or advances phase.
- **All In button**: POST `/action` `{ action:"all_in", amount:maxBet }`  
  - Server: pushes all remaining chips to `current_bet/total_contributed`, updates pot, may update `last_raise` if it’s a raise, marks `is_all_in=true`, advances turn/phase logic.
- **Turn timer auto-fold**: `TurnTimer` triggers `handleTimeout` ➜ POST `/action` `{ action:"fold" }` when timebank exhausted.
- **Start Game** (host in lobby): POST `/api/room/:code/start`  
  - Server: shuffles deck (CSPRNG), posts blinds (updates `current_bet` + `total_contributed`), sets `status=playing`, seeds `hands` + `player_hands`, sets `current_seat`.
- **Next Hand** (host after showdown): POST `/api/room/:code/next-hand`  
  - Server: rotates dealer, shuffles, posts blinds, increments hand version/count, resets per-hand state.
- **Add-on Request**: POST `/api/room/:code/addon` `{ amount }` from `AddonPanel`  
  - Server: inserts pending `addon_requests`.  
  - Host Approve/Reject: PATCH `/addon` `{ requestId, approve }`; on approve chips are added to `players.chips`.

### Data mutations per action (server)
- Bets: `players.chips` decreases; `player_hands.current_bet` and `player_hands.total_contributed` increase; `hands.pot` increases.
- Turn/phase: `hands.current_seat`, `hands.current_bet`, `hands.last_raise`, `hands.phase`, `hands.community_cards`, `hands.turn_start_time` update.
- Hand end: winnings distributed to `players.chips`; `hands.pot` set to 0; `hands.phase="showdown"`, `current_seat=null`.
- Logs: every action inserted into `actions`.

### Client feedback
- UI disables buttons while `isSubmitting`.
- `TurnTimer` counts down and auto-folds.
- Realtime channels refresh local state after DB changes; no manual polling needed for actions.
