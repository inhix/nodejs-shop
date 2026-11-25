# Getting started from zero

This guide takes a machine with nothing installed to a running API and storefront. It was
tested end to end on macOS (Apple silicon) and on a clean Debian 13 container (Linux steps,
without Docker-based parts). Claude Code is not required; if you use it, ask it to follow
this file.

Every version that matters is pinned in the repository, so you only install the tools that
read those pins:

| What               | Pinned in                            | Value (check the file, not this table) |
| ------------------ | ------------------------------------ | -------------------------------------- |
| Node.js            | `.nvmrc`                             | 26.13.1                                |
| pnpm               | `packageManager` in `package.json`   | 12.21.0                                |
| Dependencies       | `pnpm-lock.yaml`                     |                                        |
| Postgres and Redis | image tags in `docker-compose.yml`   | postgres 18.7, redis 7.2.17            |

## 1. Install the tools

You need four things: Git, Docker, a Node version manager that reads `.nvmrc`, and pnpm.
The examples use [fnm](https://github.com/Schniz/fnm); nvm, Volta, or mise work too.

### macOS

```sh
xcode-select --install                 # Git (skip if `git --version` works)
# Homebrew, if missing: https://brew.sh
brew install fnm
brew install --cask docker             # Docker Desktop; OrbStack or Colima also work
```

Add fnm to your shell (zsh shown), then open a new terminal:

```sh
echo 'eval "$(fnm env --use-on-cd --shell zsh)"' >> ~/.zshrc
```

Start Docker Desktop once from Applications and finish its setup. Check that `docker` is on
your `PATH` with `docker version`. If it is not found, Docker Desktop installed its CLI only in
`~/.docker/bin`: add `export PATH="$HOME/.docker/bin:$PATH"` to `~/.zshrc`, or enable
"Install symlinks" in Docker Desktop settings (Advanced).

### Linux (Debian/Ubuntu)

```sh
sudo apt-get update
sudo apt-get install -y curl ca-certificates git unzip libatomic1
curl -fsSL https://fnm.vercel.app/install | bash
```

`libatomic1` is required by the official Node 26 binaries; without it `node` fails with
`libatomic.so.1: cannot open shared object file`. Minimal and container images often lack it.

Open a new terminal so fnm is on your `PATH`. Install Docker Engine with the Compose plugin
from <https://docs.docker.com/engine/install/>, then let your user run it without `sudo`
(<https://docs.docker.com/engine/install/linux-postinstall/>).

### Windows

Use WSL2: install Ubuntu with `wsl --install`, then follow the Linux steps inside it. Install
Docker Desktop for Windows and enable WSL integration for your Ubuntu distribution. Clone the
repository inside the WSL file system (`~/...`), not under `/mnt/c`, or installs and file
watching will be very slow.

## 2. Get the code and the pinned toolchain

```sh
git clone https://github.com/inhix/nodejs-shop.git
cd nodejs-shop
fnm install                            # reads .nvmrc and installs that Node version
fnm use
node -v                                # must print the version from .nvmrc
npm install -g pnpm@12.21.0            # the version from "packageManager" in package.json
pnpm -v
```

Corepack does not ship with Node 25 and later, so `corepack enable` is not an option.
`pnpm install` refuses to run on a Node version outside `engines` in `package.json`.

## 3. Install dependencies and configure

```sh
pnpm install                           # also installs the git hooks (husky)
cp .env.example .env                   # local-only values; never commit .env
```

The API and the storefront dev servers both read this root `.env`. The defaults work as they
are.

## 4. Start the infrastructure

```sh
pnpm infra:up                          # Postgres and Redis, waits until both are healthy
```

The first run downloads the images. Data persists in a Docker volume between runs.

## 5. Run the apps

```sh
pnpm dev
```

This starts every app in watch mode. Usually the links are:

| App        | URL                     |
| ---------- | ----------------------- |
| API        | <http://127.0.0.1:3000> |
| Storefront | <http://127.0.0.1:3001> |

**If those links do not work, try <http://127.0.0.1:3100> (API) and <http://127.0.0.1:3101>
(storefront), or check the console for the links.** `pnpm dev` picks free ports by itself: when
3000 or 3001 is already taken (often by another copy of this app you forgot to stop), it moves
both apps to 3100/3101, then 3200/3201, and so on. The console then shows which process holds
the default ports, and once both apps answer it prints:

```text
[dev] Ready:
  API         http://127.0.0.1:3100
  Storefront  http://127.0.0.1:3101
```

To see the links again at any time, run this in another terminal in the same folder:

```sh
pnpm dev:urls
# pnpm dev (PID 5682), started 2026-11-25T20:47:03.208Z:
#   api         http://127.0.0.1:3100  (up)
#   storefront  http://127.0.0.1:3101  (up)
```

Ports in `.env` (`PORT`, `API_URL`) apply only when you run a single app on its own, for example
`pnpm --filter @shop/api dev`. Postgres and Redis always use the ports from `.env`.

## 6. Check that it works

Use the API and storefront links from step 5 (the examples below assume the default ports):

```sh
curl http://127.0.0.1:3000/health/ready
# {"status":"ok","checks":{"postgres":"up","redis":"up"}}
```

Open the storefront link (<http://127.0.0.1:3001>): the page shows «API працює» when the
storefront can reach the API.

Then run the same checks as CI (needs Docker running; integration tests start their own
containers with Testcontainers, separate from `infra:up`):

```sh
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

## Daily use

```sh
pnpm infra:up       # after a reboot
pnpm dev            # Ctrl+C stops all apps
pnpm dev:urls       # links of the running pnpm dev (from another terminal)
pnpm infra:down     # stop containers, keep data
pnpm infra:reset    # stop containers and DELETE local data
```

After pulling changes, run `pnpm install` again; if `.nvmrc` changed, run `fnm install` too.

## Troubleshooting

| Symptom                                                    | Fix                                                                                                                                                    |
| ---------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `pnpm install` fails with an engine or Node version error  | Run `fnm use` in the repository root; `node -v` must match `.nvmrc`.                                                                                   |
| `libatomic.so.1: cannot open shared object file` (Linux)   | `sudo apt-get install -y libatomic1`.                                                                                                                  |
| `docker: command not found` (macOS)                        | Start Docker Desktop and put `~/.docker/bin` on your `PATH` (see step 1).                                                                              |
| `pnpm infra:up` fails with "port is already allocated"     | Another Postgres or Redis is running. Stop it, or change `POSTGRES_PORT` / `REDIS_PORT` and the matching `DATABASE_URL` / `REDIS_URL` in `.env`.      |
| Links on 3000/3001 do not work, or show an old version     | `pnpm dev` moved to free ports: try 3100/3101, check the console, or run `pnpm dev:urls`. The `[dev] Port … is in use by …` line names the process on the default port; stop it if it is a forgotten copy. |
| `[dev] No free ports between 3000 and 3901`                | Ten copies' worth of ports are busy. Stop old dev servers and run `pnpm dev` again.                                                                    |
| `EADDRINUSE` when running a single app (`pnpm --filter …`) | Single apps use fixed ports. Stop the other server, or change `PORT` and `API_URL` in `.env` (API) or run `STOREFRONT_PORT=<port> pnpm --filter @shop/storefront dev`. |
| API exits with a list of invalid variables                 | `.env` is missing or incomplete. Compare it with `.env.example`.                                                                                       |
| `/health/ready` returns 503                                | Postgres is down: run `pnpm infra:up` and check `docker compose ps`.                                                                                   |
