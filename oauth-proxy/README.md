# GitHub OAuth PKCE Proxy (for GitHub Pages)

GitHub Pages is static, and GitHub's OAuth token endpoint (`https://github.com/login/oauth/access_token`) is **not CORS-enabled**.
So a browser-only PKCE flow cannot exchange `code` -> `access_token` directly.

This proxy performs **token exchange server-side** (still PKCE), and returns JSON with CORS enabled.

## Deploy (Cloudflare Worker)

1) Install `wrangler` (once):

```bash
npm i -g wrangler
```

2) Login and deploy:

```bash
cd oauth-proxy
wrangler login
wrangler deploy
```

3) Configure the app build env:

- Set `PUBLIC_GITHUB_OAUTH_PROXY_URL` to the deployed worker URL (e.g. `https://<name>.<account>.workers.dev/token`)
- Keep `PUBLIC_GITHUB_CLIENT_ID` as before

On GitHub Actions Pages build, you can add `PUBLIC_GITHUB_OAUTH_PROXY_URL` as a repository variable or secret and wire it into the build step.

## Optional hardening (recommended)

You can bind a GitHub OAuth app secret to the worker (kept server-side):

```bash
wrangler secret put GITHUB_CLIENT_SECRET
```

Optionally, lock the worker to a single GitHub client id:

```bash
wrangler secret put GITHUB_CLIENT_ID
```
