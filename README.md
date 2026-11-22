# Scribe-It

A multiplayer draw-and-guess game (like skribbl.io) that runs in any browser and installs to a phone's home screen. It's plain HTML and JavaScript with no build step. Firebase Realtime Database handles the live multiplayer, and Vercel hosts it.

## One-time setup (about 10 minutes)

### 1. Firebase
1. Go to https://console.firebase.google.com and click **Add project**. Name it (e.g. `scribe-it`). Google Analytics is optional.
2. **Build > Authentication > Get started > Sign-in method > Anonymous > Enable > Save.** Players get an invisible guest account, which is how they keep their spot and score when they rejoin.
3. **Build > Realtime Database > Create database.** Pick a location close to your players (e.g. Singapore `asia-southeast1` for India). Start in **locked mode**.
4. In the Realtime Database page, open the **Rules** tab, replace everything with the contents of `database.rules.json` from this repo, and click **Publish**.
5. **Project settings (gear icon) > General > Your apps > Web (`</>`)**. Register the app (no hosting needed) and copy the `firebaseConfig` values into `js/config.js`. Make sure `databaseURL` is filled in.
6. **Authentication > Settings > Authorized domains:** add your Vercel domain (e.g. `scribe-it.vercel.app`) and any custom domain.

### 2. Vercel
1. Push this folder to a GitHub repo.
2. At https://vercel.com/new, import the repo. Framework preset: **Other**. No build command, no output directory. Click **Deploy**.
3. Every push to the main branch deploys automatically.

## Playing
- Open the site, type a name, leave the room code blank, and press **Play** to create a room.
- Share the room link (`/r/<code>`) using Copy link, the WhatsApp button or the Share button.
- The first player in the room is the host. The host picks settings and word packs, then starts the game.
- On phones: browser menu > **Add to Home screen** installs it like an app.

## How it works
- **Data layout** (`rooms/<code>/...`): `players`, `state` (written by the host), `secret/<turn>` (the word, readable only by the host, the drawer and players who've guessed), `draw/<turn>` (stroke chunks, so late joiners see the full picture), `guesses`, `chat`, `rate`, `kick`, `pick`.
- **Host:** the earliest-joined online player runs the timer and scoring. If the host disconnects, the next player takes over automatically.
- **Grace period:** a disconnected player keeps their place and score for 60 seconds (`GRACE` in `js/app.js`). Their guest account is remembered by the browser, so they rejoin as the same player even after closing the tab.
- **Words:** edit `js/words.js` to add packs or words.
- **Demo mode:** while `js/config.js` still says `PASTE_YOUR_API_KEY`, the game runs locally with other tabs in the same browser acting as players. This is handy for testing changes.

## Run locally
```
python3 -m http.server 8080
```
Then open http://localhost:8080 (`/r/<code>` links only work on Vercel; locally use `?r=<code>`).

## Limits on the free plan
Firebase's free Spark plan allows 100 simultaneous connections (about 10–12 full rooms at once), 1 GB stored and 10 GB downloaded per month. Old turn data is deleted as games go on, so storage stays tiny. If the game grows past that, switch the project to the Blaze (pay-as-you-go) plan.
