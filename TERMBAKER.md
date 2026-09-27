# Termbaker environment

You are running inside **Termbaker**, a desktop hub of terminals for AI CLIs. This project has extra
capabilities wired up for you. Use them proactively.

## Embedded browser (free)
There is an embedded Chromium browser you drive via the **chrome-devtools** MCP (already configured,
pointed at `http://127.0.0.1:9333`). Use it to open and inspect the app/route you are
building. Navigate, read the console and network, take screenshots.

## Seeing the page (free)
The **termbaker-mcp** MCP drives the embedded browser without any external tool:
- `browser_open(url)`. Reveal the pane and load a URL. It reports the real outcome (final URL,
  HTTP status, title, viewport, load time), so you never have to guess from server logs. Call it
  again to RETRY after starting a dev server: a pane opened while the server was down stays blank.
- `browser_screenshot(fullPage?, nativeScale?)`. A PNG of the pane. `fullPage` captures the
  whole scrollable page instead of just the fold; capture is at real CSS pixels by default.
- `browser_eval(js)`. Run JS in the page and get the value back. This is how you MEASURE rather
  than guess (`scrollWidth` vs `clientWidth`, computed styles, `matchMedia`), and how you
  interact: `window.scrollTo(0, 1200)`, `document.querySelector(sel).click()`.
- `browser_responsive(mode, landscape?, reload?)`. Switch to a device (phones, tablets and
  desktop widths up to 1920) or back to `off`. Check responsiveness whenever you can.
  **It changes the CSS viewport only**. The real breakpoints fire, but the user agent, touch
  events and `pointer: coarse` are NOT emulated. Verify with `browser_eval` if your code
  branches on those.
- `browser_status()` / `browser_restart()`. Diagnose and recover. `browser_status` also
  reports `appVersion`/`toolsVersion`, so you can confirm which build you are talking to.
- `browser_downloads({ limit? })`. What the page DOWNLOADED, newest first, with `savePath`: the
  file on disk. When a page exports something (a report, a .pptx, a CSV), take that path and open
  the file with your own tools instead of reimplementing the format inside the page.
- `browser_upload({ selector, files })`. Fill an `<input type="file">` as if the person had
  picked the files, so an upload form can be tested end to end. Only from this project's folder and
  from the downloads folder; anything else is refused, and the refusal says which folders are
  allowed.

## Running this project (free)
Do NOT start dev servers, watchers or any long-running process of this project in your own terminal.
Start them through the **termbaker-mcp** Runner tools, and they become cards in the app's Runner
pane: the person using Termbaker sees them, stops or restarts them, and reads their console and
error counts. A process you start in your terminal is invisible to them, they cannot stop it, and it
holds your own session hostage because it never exits. The embedded browser is pointed at the URL a
server prints, but it is not brought to the screen when YOU started the run: call
`browser_open(url)` when you actually want the page shown.
- `runner_list()`. The project's commands with live state: what is up, its pid, since when, who
  started it (`user` or `ai`) and how many errors/warnings it printed. **Call this first**: what
  you were about to start may already be running.
- `runner_start({ id })` for something on the list, or `runner_start({ command, cwd?, name? })`
  for anything else, which shows up as a temporary card the user can keep with one click. If that
  command is already running it is NOT restarted: you get its state and log tail instead.
- `runner_logs({ id, lines? })`. The last lines it printed, ANSI already stripped, with its status
  and counters. This is how you check that a server really came up, or read a compile error.
- `runner_stop({ id })`. Only what you started, or what the user asked you to stop. `runner_list`
  tells you who started each one, and killing the server someone is watching is rarely welcome.

## Passwords, tokens and API keys (free)
The person keeps this project's credentials in the Termbaker vault (the padlock on the right rail),
encrypted on their machine. You use them WITHOUT seeing them, in commands and in the embedded
browser, so never ask anyone to paste a password into this chat and never read them out of a
`.env`: what you see becomes part of this conversation, its log and its history.
- `secrets_list()`. The names and notes of the secrets this project has, never the values, plus
  the syntax the shell uses to read a variable. **Call this first** whenever a task needs a
  credential (a database, a deploy, an authenticated API). Two kinds: a **token** (one value,
  variable `NAME`) and a **credential** (user + password; the user name is shown to you, the
  variables are `NAME_USER` and `NAME_PASSWORD`). Each entry lists its `env` names.
- `secrets_run({ command, cwd?, secrets?, timeoutSec? })`. Runs ONE command in a process
  Termbaker owns, with the secrets in its environment. Reference them as the shell reads variables:
  `$env:DB_PASSWORD` in PowerShell (the default on Windows), `"$DB_PASSWORD"` in bash. The
  output comes back with every value replaced by `[REDACTED:NAME]`, in raw, base64, URL-encoded,
  hex and JSON forms, and the run is logged for the person with its command line. Do not try to
  print, encode or copy a value to read it. Not for dev servers: those go through
  `runner_start`, and a secret the person marked for the Runner is already in their environment.
- **Signing in to a page in the embedded browser.** When the person says "log in with the vault"
  (or the password is in the vault), do not look for the value: call `secrets_list`, pick the
  credential of that site (its `url`, name or note says which) and call
  `browser_login({ secret?, url? })`. Termbaker opens the page if you pass `url`, finds the login
  form, types the user name and the password itself, sends it and reports the outcome
  (`navigated` or `password-gone` is success; `error-shown` carries the page message; `unchanged`
  means take a screenshot: wrong password, captcha or a second factor, which only the person can
  finish). Two-step logins (e-mail first, password next) are handled. If it cannot find the form,
  locate the fields with `browser_eval` (no secret involved) and use
  `browser_type_secret({ secret, part?, selector, submit? })` field by field. Never read a field
  back or inspect the login request: browser tool answers come back with the values redacted, and
  every login is logged for the person.
- If the vault has nothing you need, say which secret is missing and ask the person to add it there
  (name it the way the command will read it, e.g. `DB_PASSWORD`; for a website, a user-and-password
  credential with its login page), instead of asking for the value.

### When the browser seems stuck
Call `browser_status()` first, and read two fields.

`health` is about THIS pane. `health.unresponsive: true` means the page itself is hung (a script
that never returns): nothing you send it will be answered, so stop retrying and call
`browser_restart()`. It kills the hung page process, drops the app's own CDP session (there is only
one debugger slot per page, and a stuck session is what makes the external `chrome-devtools` MCP
hang too) and reopens the pane at the same URL. It answers with `did`, the list of what it actually
did, so you know which of those was the problem. Then call `browser_open(url)` again.

`cdpAlive: false` is a different, bigger problem: the external `chrome-devtools` MCP endpoint is
dead. Do NOT keep waiting on it, and note that `browser_restart` cannot fix it either: that port is
a process-wide Chromium switch, so only restarting the Termbaker app rebinds it. Say that to the
person. Meanwhile `browser_open`, `browser_eval`, `browser_screenshot` and
`browser_responsive` all keep working, because the app drives and captures its own pane.

---
Managed by Termbaker; it regenerates this file, so don't rely on hand-edits here.
