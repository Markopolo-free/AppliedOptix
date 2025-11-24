# Development with Dev Tunnels

## Local Development (default)

```powershell
npm run dev
```

Server runs on http://localhost:3000

## Dev Tunnel (for remote access)

### 1. Start the dev server with tunnel config:

```powershell
$env:DEV_TUNNEL_HOST='rwg3h4sh-3001.use2.devtunnels.ms'
npm run dev
```

Server runs on http://localhost:3001

### 2. Forward the port in VS Code:

1. Open the **Ports** panel (View → Ports, or click PORTS tab at bottom)
2. Click **"Forward a Port"**
3. Enter **3001** and press Enter
4. Right-click the forwarded port → **Port Visibility** → **Public**
5. Copy the forwarded URL (should match `https://rwg3h4sh-3001.use2.devtunnels.ms/`)

### 3. Share the tunnel URL:

- Public URL: `https://rwg3h4sh-3001.use2.devtunnels.ms/`
- Users can access without GitHub login (if set to Public)
- HMR (hot reload) will work correctly

## Troubleshooting

### Port 3001 already in use

```powershell
Get-NetTCPConnection -State Listen -LocalPort 3001 -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force }
```

### Check if server is running

```powershell
Test-NetConnection -ComputerName localhost -Port 3001
```

### Update tunnel hostname

If your Dev Tunnel URL changes, update `DEV_TUNNEL_HOST`:

```powershell
$env:DEV_TUNNEL_HOST='new-tunnel-hostname.devtunnels.ms'
npm run dev
```

## How it works

- When `DEV_TUNNEL_HOST` is set, Vite configures HMR to use the public tunnel hostname
- The browser connects to `wss://your-tunnel.devtunnels.ms:443` for hot reload
- All module requests go through the tunnel correctly
- Without `DEV_TUNNEL_HOST`, standard local dev settings apply (port 3000, no special HMR config)
