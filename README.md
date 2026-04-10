# Super Saiyan Raichu

**Mystery box** ACP offering template. Compatible with [Virtuals Protocol](https://virtuals.io) **Seller Runtime** (ACP CLI). Each job returns a random surprise outcome.

## What is in this repo

- **`virtuals-protocol-acp/`** — [openclaw-acp](https://github.com/Virtual-Protocol/openclaw-acp) clone; `npm install` has been run.
- **`virtuals-protocol-acp/src/seller/offerings/super-saiyan-raichu/mystery_box/`** — offering files (template: `seller-offering/super-saiyan-raichu/mystery_box/`). The CLI expects **`src/seller/offerings/<sanitized-agent-name>/`** (e.g. `Super Saiyan Raichu` → `super-saiyan-raichu`).

### Setup (browser login is the only step you must do yourself)

`acp setup` opens **Virtuals login in the browser**; only you can complete that. Prompts for agent name, optional token, and ACP “preferred skill” can be auto-answered with **`setup-auto`**:

```powershell
cd virtuals-protocol-acp
.\setup-auto.bat
```

Flow: terminal prints a **Login link** (or your browser opens) → **sign in or register** there → after “Login success”, the script finishes agent creation and setup.

Custom agent name:

```powershell
.\setup-auto.ps1 -AgentName "MyAgent"
```

**`npx.exe is not recognized`:** do not rely on the global `acp` shim; use `.\run-acp.cmd ...` or `.\setup-auto.bat` from this folder.

Register the offering and start the seller:

```powershell
.\run-acp.cmd sell create mystery_box
.\run-acp.cmd serve start
```

To remove the old offering name from ACP after renaming:

```powershell
.\run-acp.cmd sell delete flip_coin
```

Optional fix: install [Node.js LTS](https://nodejs.org/) with “Add to PATH”, verify with `npx --version`, then the global `acp` command may work too.

### Running 24/7 — Railway (recommended for production)

- **Local:** `acp serve start` only works while that PC is on.
- **Railway:** Same seller runtime runs in a container 24/7. Install [Railway CLI](https://docs.railway.com/guides/cli) if needed (`npm i -g @railway/cli`); `acp` can prompt to install it.

**Requirements**

- A [Railway](https://railway.com) account. **Free tier often cannot create new services** when the workspace hits resource limits — the CLI may show: *“Free plan resource provision limit exceeded”*. Fix: **upgrade to Hobby** (~$5/mo) or **delete unused Railway projects/services**, then run setup again.

**Commands** (from `virtuals-protocol-acp/`):

```powershell
.\run-acp.cmd serve deploy railway setup
```

Log in when prompted, pick workspace, confirm project name. Then:

```powershell
.\run-acp.cmd serve deploy railway
```

`LITE_AGENT_API_KEY` is pushed from your local `config.json` to Railway env vars (not baked into the image). Check:

```powershell
.\run-acp.cmd serve deploy railway status
.\run-acp.cmd serve deploy railway logs --follow
```

Full reference: [references/deploy.md](virtuals-protocol-acp/references/deploy.md).

### dgclaw subscribe (buyer job — no manual files)

After `acp setup`, subscriber address is read automatically from the **active agent** in `config.json`. You do **not** create any JSON by hand for this.

From `virtuals-protocol-acp/`:

```powershell
.\dgclaw-subscribe.cmd
```

or:

```powershell
npm run dgclaw:subscribe
```

Details: [scripts/degen/README.md](virtuals-protocol-acp/scripts/degen/README.md). Optional Degen Claw scripts (`join_leaderboard`, perps) exist under `scripts/degen/` for later; **degen join is unused for now** and needs a separate `degen_join_requirements.json` only if you turn it on.

## ACP links

| Resource | Link |
| --- | --- |
| ACP app (signup / marketplace) | [app.virtuals.io/acp](https://app.virtuals.io/acp) |
| Join / agent | [app.virtuals.io/acp/join](https://app.virtuals.io/acp/join) |
| ACP Tech Playbook | [whitepaper](https://whitepaper.virtuals.io/info-hub/builders-hub/agent-commerce-protocol-acp-builder-guide/acp-tech-playbook) |
| Developer onboarding | [Set Up Agent Profile](https://whitepaper.virtuals.io/acp-product-resources/acp-dev-onboarding-guide/set-up-agent-profile) |
| Official CLI source | [github.com/Virtual-Protocol/openclaw-acp](https://github.com/Virtual-Protocol/openclaw-acp) |

## Offering: `mystery_box`

- **Price:** `0.01` (fixed) — Virtuals ACP job fee (protocol-side).
- **Input (optional):** `wish` — short string echoed back if provided.
- **Output:** Random line from a fixed pool (`outcome`).

`handlers.ts` uses `../../../runtime/offeringTypes.js` from `src/seller/offerings/<agent-dir>/mystery_box/`.

## Example job (buyer)

```bash
acp job create "<agent-wallet>" mystery_box --requirements "{}"
```

```bash
acp job create "<agent-wallet>" mystery_box --requirements "{\"wish\":\"good vibes\"}"
```

## Note on chats

Whether this chat is kept is up to Cursor; important notes are in this `README.md`.
