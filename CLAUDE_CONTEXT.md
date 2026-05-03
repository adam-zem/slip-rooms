# CLAUDE CONTEXT — SLIPROOMS

## QUICK START
- **Owner:** Jake (handle @realjake)
- **Parent company:** Pocket Basement LLC
- **Product:** SlipRooms — sports betting social chat app where rooms are tied to BETS not games
- **Stack:** iOS app (React Native/Expo), website (Vite + React + Tailwind), shared Firebase project sliprooms-279e3
- **Live:** App Store (id 6759553452), website (sliprooms.com)

## REPOS
- **Website:** `C:\Users\jakeg\Desktop\dev\slip-rooms` (this repo) — adam-zem/slip-rooms on GitHub
- **iOS app:** `C:\Users\jakeg\Desktop\dev\sliprooms-app` — sliprooms GitHub org
- Both share Firebase project `sliprooms-279e3` — backend infra (`functions/`, `firestore.rules`, `storage.rules`) lives in slip-rooms repo and serves the iOS app

## BRAND DNA — LOCKED, DO NOT DEVIATE
| Element | Value |
|---------|-------|
| Background | Pure black `#000000` |
| Primary brand color | Emerald `#047857` (defined as `primaryGreen` in iOS `constants/Colors.ts`) |
| Tinted bg | `rgba(4, 120, 87, 0.12)` |
| Borders | `rgba(4, 120, 87, 0.3)` |
| Text primary | White |
| Text secondary | `#888` |
| Text muted | `#666` |
| Headlines | Bold uppercase with periods, e.g. "JOIN A ROOM. NEVER SWEAT ALONE AGAIN." |
| Tagline | "Nobody Sweats Alone." |
| Voice | Sports-betting authentic — use "sweat, slip, room, bet, crowd, action, drop, tap in" |
| AVOID | "users, platform, gambling, leverage, revolutionize" |

## WORKFLOW RULES — NEVER BREAK THESE
1. Get explicit approval BEFORE any code changes
2. Get explicit approval BEFORE any Higgsfield credit spend
3. Production deploys gated until user explicitly says "ship to production" or "ship it"
4. Always preview locally before deploying
5. After CC commits, "push to github" syncs
6. For TestFlight (SlipRooms B): force-close + reopen TWICE to grab OTA per DEPLOY.md

## SOCIAL MEDIA STRATEGY — LOCKED

### Constraints
- NO faces on camera (no founder content)
- NOT enough app users yet to show "app working" content
- LEGAL FEAR — no game footage / no licensed content / no real player names attached to "picks"

### Solution: AI Persona Cast Strategy
- Disclosed openly as AI from day one (legally required + builds trust)
- Multiple characters with distinct betting archetypes
- Lead character SIERRA validates first, then expand cast over 90 days

**Phase 1 budget:** $200-250 over 30 days, 10 videos, kill if no traction.

## CAST OF CHARACTERS — LOCKED

### SIERRA (LEAD) — The Analyst
- **Tagline:** "Numbers don't lie. Bettors do."
- **Visual:** Late 20s, mixed-race ambiguous ethnicity, warm light-medium skin with scattered freckles across nose/under-eyes, medium-length brunette hair with subtle warm highlights and natural waves, hazel/honey-brown eyes, oversized cream button-down + minimal gold jewelry, modern home office with blurred monitors behind, warm key + cool blue rim lighting, cinematic documentary still aesthetic
- **Voice:** Calm, measured, slightly amused — Cate Blanchett doing a podcast
- **Knows ball:** References closing line value, TS%, eFG%, OPS+, DVOA, expected goals
- **Status:** V1 generated and approved May 2 2026, job `8764e3a6-24c1-4e73-bf7d-72ec8a6398d3`
- **Canon image saved to:** `1-SlipRooms/Content-Library/Sierra/` on Desktop

### LOLA — Chaos Parlay Queen
- Loud/fun, "12-leg or nothing", builds absurd parlays
- High-energy podcaster voice
- **NOT YET BUILT — Phase 2**

### TORI — The Fader
- Dry/contrarian, fades public consensus, deadpan
- Aubrey Plaza monotone voice
- **NOT YET BUILT — Phase 3**

### MICHELLE — The Rookie
- Sweet/lost, "wait what's a moneyline", beginner-coded
- Emma Chamberlain bright voice
- **NOT YET BUILT — Phase 4**

## HIGGSFIELD ACCOUNT
- **Plan:** Plus plan, ~507 credits as of May 2 2026
- **Email:** 45968bvn8j@privaterelay.appleid.com
- **Soul Cast:** Consistent character generation tool, ~50 credits per generation
- **RULE:** ALWAYS get user approval before burning credits

## THE 3-PILLAR CONTENT TEMPLATE SYSTEM
*(Mocked but not built)*

1. **THE PICK** — Daily slip drops (bet info, sweater count, room context)
2. **THE HOT TAKE** — Opinion content (bold quote on black, emerald accents)
3. **THE PROOF** — Community moments (chat bubbles from rooms)

**Shared design elements:**
- SR logo + wordmark top left
- Pillar tag top right
- Pure black bg
- Emerald accents only
- Inter 700-800 headlines
- "@ sliprooms.com" + "#NOBODYSWEATSALONE" footer

## DESKTOP FILE STRUCTURE
```
C:\Users\jakeg\Desktop\
├── 1-SlipRooms\
│   ├── Brand-Assets\
│   │   └── Website-Screenshots\
│   ├── Content-Library\
│   │   ├── Sierra\
│   │   ├── Lola\
│   │   ├── Tori\
│   │   ├── Michelle\
│   │   ├── Generated-Videos\
│   │   └── Unsorted-Characters\
│   ├── Business\
│   └── Archive\
├── dev\                    (code repos — DO NOT TOUCH)
└── (.lnk shortcuts)
```

## SHIPPED THIS SESSION (May 2 2026)
1. iOS multi-room slate bottom sheet — commit `b39c716`, prod EAS update
2. Complete website rebuild at sliprooms.com — replaced 2300-line React app with clean static landing page
3. Vite default favicon stripped + SR logo wired everywhere
4. Google Search Console verified + re-indexing requested (file: `google29cdc265f531ece7.html` in `public/`)
5. Base44 ghost deployment deleted
6. Sierra V1 character generated and approved
7. Desktop fully organized

## PENDING WORK
- [ ] Save Sierra V1 reference image to `1-SlipRooms/Content-Library/Sierra/`
- [ ] Test Sierra consistency variations (~50 credits each) before video generation
- [ ] Decide account strategy: Sierra gets own IG/TikTok vs post from @sliprooms
- [ ] ElevenLabs voice clone for Sierra (~$22/month)
- [ ] Phase 1 launch: 10 Sierra videos in 30 days
- [ ] Phase 2 (only after Sierra validates): build out Lola, Tori, Michelle

## IDEAS PARKED (NOT BUILDING YET)
- **"SlipRooms Content Studio"** — Internal web tool to generate post angles. Architecture spec exists but waiting until cast strategy validates first.
- **Cinematic LeBron cult video** — Needs CapCut overlays for SR chest wordmark + Nike swoosh covers (jerseys read as Lakers in generated video)

## REPO-SPECIFIC NOTES

### slip-rooms (website)
- Vite + React + Tailwind
- 10 components in `src/components/`
- `public/images/app-icon.png` is the canonical SR logo (favicon + Nav + Footer all reference this)
- `functions/` folder serves the iOS app — **DO NOT modify without explicit approval**
- `firebase.json`, `.firebaserc`, `firestore.rules`, `storage.rules` — **DO NOT TOUCH**

### sliprooms-app (iOS)
- React Native / Expo
- EAS Build for TestFlight distribution
- See `DEPLOY.md` for OTA update instructions
- `constants/Colors.ts` defines brand colors

---

*Last updated: May 2, 2026*
