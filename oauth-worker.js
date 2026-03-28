/**
 * Cloudflare Worker — NicZero GitHub OAuth proxy
 *
 * Required Worker environment variables (set via wrangler secret or dashboard):
 *   GITHUB_CLIENT_ID     — your OAuth App client ID
 *   GITHUB_CLIENT_SECRET — your OAuth App client secret
 *   APP_ORIGIN           — e.g. https://niczero.pages.dev (no trailing slash)
 *
 * Deploy:
 *   npx wrangler deploy oauth-worker.js --name niczero-oauth --compatibility-date 2024-01-01
 *   npx wrangler secret put GITHUB_CLIENT_SECRET --name niczero-oauth
 *
 * Then set in your production .env / CI:
 *   VITE_OAUTH_PROXY_URL=https://niczero-oauth.<your-subdomain>.workers.dev
 */

export default {
  async fetch(request, env) {
    const url = new URL(request.url)

    if (url.pathname === '/authorize') {
      const params = new URLSearchParams({
        client_id:    env.GITHUB_CLIENT_ID,
        redirect_uri: `${url.origin}/callback`,
        scope:        'gist',
        state:        crypto.randomUUID(),
      })
      return Response.redirect(
        `https://github.com/login/oauth/authorize?${params}`, 302
      )
    }

    if (url.pathname === '/callback') {
      const code = url.searchParams.get('code')
      if (!code) return new Response('Missing code', { status: 400 })

      const res = await fetch('https://github.com/login/oauth/access_token', {
        method:  'POST',
        headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
        body: JSON.stringify({
          client_id:     env.GITHUB_CLIENT_ID,
          client_secret: env.GITHUB_CLIENT_SECRET,
          code,
          redirect_uri:  `${url.origin}/callback`,
        }),
      })

      const data = await res.json()
      if (!data.access_token) {
        return new Response('Authorization failed — please try again', { status: 400 })
      }

      // Send token to the opener window and close the popup.
      // postMessage target is '*' — the client validates event.origin instead.
      const message = JSON.stringify({ type: 'github-oauth', token: data.access_token })
      return new Response(
        `<!doctype html><meta charset=utf-8><script>
          window.opener?.postMessage(${message}, '*')
          window.close()
        <\/script><p>Done — you can close this window.</p>`,
        { headers: { 'Content-Type': 'text/html; charset=utf-8' } }
      )
    }

    return new Response('Not found', { status: 404 })
  },
}
