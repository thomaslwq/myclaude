with open('src/services/mcp/auth.ts','r',encoding='utf-8') as f:
    data = f.read()

old = '''   * Cross-process lockfile: see below. `_refreshInProgress`
   * only dedupes within one process \u2014 two CC instances with expiring tokens
   * both fire the full 4-request XAA chain and race on storage.update().
   * Unlike inc-4829 the id_token is not single-use so both access_tokens
   * stay valid (wasted round-trips + keychain write race, not brickage),
   * but this is the shape CLAUDE.md flags under "Token/auth caching across
   * process boundaries". Mirror refreshAuthorization()'s lockfile pattern.
   */
  private async xaaRefresh(): Promise<OAuthTokens | undefined> {
    const idp = getXaaIdpSettings()
    if (!idp) return undefined // config was removed mid-session

    const idToken = getCachedIdpIdToken(idp.issuer)
    if (!idToken) {
      logMCPDebug(
        this.serverName,
        'XAA: id_token not cached, needs interactive re-auth',
      )
      return undefined
    }

    const clientId = this.serverConfig.oauth?.clientId
    const clientConfig = getMcpClientConfig(this.serverName, this.serverConfig)
    if (!clientId || !clientConfig?.clientSecret) {
      logMCPDebug(
        this.serverName,
        'XAA: missing clientId or clientSecret in config \u2014 skipping silent refresh',
      )
      return undefined // shouldn't happen if `mcp add` was correct
    }

    const idpClientSecret = getIdpClientSecret(idp.issuer)

    // Discover IdP token endpoint. Could cache (fetchCache.ts already
    // caches /.well-known/ requests), but OIDC metadata is cheap + idempotent.
    // xaaRefresh is the silent tokens() path \u2014 soft-fail to undefined so the
    // caller falls through to needs-authentication instead of throwing mid-connect.
    let oidc
    try {
      oidc = await discoverOidc(idp.issuer)
    } catch (e) {
      logMCPDebug(
        this.serverName,
        `XAA: OIDC discovery failed in silent refresh: ${errorMessage(e)}`,
      )
      return undefined
    }

    try {
      const tokens = await performCrossAppAccess('''

new = '''   * Cross-process lockfile: `_refreshInProgress` only dedupes within one
   * process. Two CC instances with expiring tokens would otherwise both fire
   * the full 4-request XAA chain and race on storage.update(). Mirrors the
   * lockfile pattern in refreshAuthorization() below.
   */
  private async xaaRefresh(): Promise<OAuthTokens | undefined> {
    const idp = getXaaIdpSettings()
    if (!idp) return undefined // config was removed mid-session

    const idToken = getCachedIdpIdToken(idp.issuer)
    if (!idToken) {
      logMCPDebug(
        this.serverName,
        'XAA: id_token not cached, needs interactive re-auth',
      )
      return undefined
    }

    const clientId = this.serverConfig.oauth?.clientId
    const clientConfig = getMcpClientConfig(this.serverName, this.serverConfig)
    if (!clientId || !clientConfig?.clientSecret) {
      logMCPDebug(
        this.serverName,
        'XAA: missing clientId or clientSecret in config \u2014 skipping silent refresh',
      )
      return undefined // shouldn't happen if `mcp add` was correct
    }

    // Acquire a cross-process lockfile so concurrent CC instances don't both
    // run the full XAA chain and race on storage.update(). Mirrors the
    // refreshAuthorization() pattern below.
    const serverKey = getServerKey(this.serverName, this.serverConfig)
    const claudeDir = getClaudeConfigHomeDir()
    await mkdir(claudeDir, { recursive: true })
    const sanitizedKey = serverKey.replace(/[^a-zA-Z0-9]/g, '_')
    const lockfilePath = join(claudeDir, `mcp-xaa-refresh-${sanitizedKey}.lock`)

    let release: (() => Promise<void>) | undefined
    for (let retry = 0; retry < MAX_LOCK_RETRIES; retry++) {
      try {
        logMCPDebug(
          this.serverName,
          `Acquiring XAA refresh lock (attempt ${retry + 1})`,
        )
        release = await lockfile.lock(lockfilePath, {
          realpath: false,
          onCompromised: () => {
            logMCPDebug(this.serverName, `XAA refresh lock was compromised`)
          },
        })
        logMCPDebug(this.serverName, `Acquired XAA refresh lock`)
        break
      } catch (e: unknown) {
        const code = getErrnoCode(e)
        if (code === 'ELOCKED') {
          logMCPDebug(
            this.serverName,
            `XAA refresh lock held by another process, waiting (attempt ${retry + 1}/${MAX_LOCK_RETRIES})`,
          )
          await sleep(1000 + Math.random() * 1000)
          continue
        }
        logMCPDebug(
          this.serverName,
          `Failed to acquire XAA refresh lock: ${code}, proceeding without lock`,
        )
        break
      }
    }
    if (!release) {
      logMCPDebug(
        this.serverName,
        `Could not acquire XAA refresh lock after ${MAX_LOCK_RETRIES} retries, proceeding without lock`,
      )
    }

    try {
      // Re-read tokens after acquiring lock \u2014 another process may have already
      // refreshed. If so, return the fresh token without firing the XAA chain.
      clearKeychainCache()
      const storage = getSecureStorage()
      const data = storage.read()
      const tokenData = data?.mcpOAuth?.[serverKey]
      if (tokenData?.accessToken) {
        const expiresIn = (tokenData.expiresAt - Date.now()) / 1000
        if (expiresIn > 300) {
          logMCPDebug(
            this.serverName,
            `Another process already refreshed XAA tokens (expires in ${Math.floor(expiresIn)}s)`,
          )
          return {
            access_token: tokenData.accessToken,
            refresh_token: tokenData.refreshToken,
            expires_in: expiresIn,
            scope: tokenData.scope,
            token_type: 'Bearer',
          }
        }
      }

      const idpClientSecret = getIdpClientSecret(idp.issuer)

      // Discover IdP token endpoint. Could cache (fetchCache.ts already
      // caches /.well-known/ requests), but OIDC metadata is cheap + idempotent.
      // xaaRefresh is the silent tokens() path \u2014 soft-fail to undefined so the
      // caller falls through to needs-authentication instead of throwing mid-connect.
      let oidc
      try {
        oidc = await discoverOidc(idp.issuer)
      } catch (e) {
        logMCPDebug(
          this.serverName,
          `XAA: OIDC discovery failed in silent refresh: ${errorMessage(e)}`,
        )
        return undefined
      }

      try {
        const tokens = await performCrossAppAccess('''

if old not in data:
    print('OLD NOT FOUND')
else:
    data = data.replace(old, new, 1)
    with open('src/services/mcp/auth.ts','w',encoding='utf-8',newline='') as f:
        f.write(data)
    print('OK')
