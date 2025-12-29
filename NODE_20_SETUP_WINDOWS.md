# Node 20 LTS Setup Guide for Windows

## Overview

This project requires **Node.js 20.18.1 LTS** for reliable Firebase CLI and Cloud Functions deployment. This guide will help you switch from Node 24 to Node 20 on Windows.

## Step-by-Step Instructions

### Step 1: Install nvm-windows

1. **Download nvm-windows**:
   - Visit: https://github.com/coreybutler/nvm-windows/releases
   - Download the latest `nvm-setup.exe` (e.g., `nvm-setup-v1.1.12.exe`)
   - Run the installer as Administrator
   - Follow the installation wizard

2. **Restart PowerShell** after installation completes

3. **Verify nvm installation**:
   ```powershell
   nvm version
   ```
   Should show: `1.1.12` (or similar)

### Step 2: Install Node 20.18.1

```powershell
# Install Node 20.18.1
nvm install 20.18.1

# Switch to Node 20.18.1
nvm use 20.18.1

# Verify installation
node -v    # Should show: v20.18.1
npm -v     # Should show: 10.x.x (npm version for Node 20)
```

### Step 3: Fix PATH Conflicts (if needed)

If you have Node 24 installed separately, it may conflict with nvm:

1. **Check for multiple Node installations**:
   ```powershell
   where node
   ```

2. **If multiple paths are shown**, remove the old Node 24 installation:
   - Open Windows Settings (Win + I)
   - Go to: Apps → Apps & Features
   - Search for "Node.js"
   - Uninstall any "Node.js 24.x" entries
   - Keep nvm-windows installed

3. **Verify nvm is controlling Node**:
   ```powershell
   nvm list
   ```
   Should show:
   ```
   * 20.18.1 (Currently using 64-bit executable)
   ```

4. **If Node 24 still appears**, restart your terminal/Cursor completely

### Step 4: Reinstall Firebase CLI

Firebase CLI must be reinstalled under Node 20:

```powershell
# Uninstall global Firebase CLI
npm uninstall -g firebase-tools

# Reinstall under Node 20
npm install -g firebase-tools

# Verify installation
firebase --version
```

### Step 5: Restart Cursor

**IMPORTANT**: Close and restart Cursor completely so it picks up the new Node version in PATH.

### Step 6: Verify Everything Works

From the project root (`C:\Users\Danny\Documents\listo`):

```powershell
# Check Node version
node -v
# Expected: v20.18.1

# Check npm version
npm -v
# Expected: 10.x.x

# Check Firebase CLI version
firebase --version
# Expected: 13.x.x or 14.x.x

# Test deployment (dry run)
firebase deploy --only functions --dry-run
```

## Project Configuration

### Files Updated

1. **`.nvmrc`** - Created with `20.18.1` for auto-switching
2. **`functions/package.json`** - Already set to `"node": "20"`
3. **`listo/package.json`** - Updated from `"24"` to `"20"`
4. **`ocr/package.json`** - Updated from `"24"` to `"20"`
5. **`scanner/package.json`** - Updated from `"24"` to `"20"`
6. **`fuctionsdefault/package.json`** - Updated from `"24"` to `"20"`

### Auto-Switching with .nvmrc

If you have nvm-windows auto-switching enabled, when you `cd` into this project directory, nvm will automatically switch to Node 20.18.1 based on the `.nvmrc` file.

To enable auto-switching (optional):
1. Create/edit `%USERPROFILE%\.nvmrc` (if it doesn't exist)
2. Or use nvm-windows settings to enable auto-switching

## Troubleshooting

### Issue: `nvm` command not found

**Solution**: 
- Restart PowerShell/Command Prompt
- If still not found, reinstall nvm-windows
- Check that nvm is in your PATH: `$env:PATH -split ';' | Select-String nvm`

### Issue: `node -v` still shows v24.x

**Solution**:
1. Check which Node is active: `nvm current`
2. If not 20.18.1, run: `nvm use 20.18.1`
3. Check PATH: `where node` - should point to `%APPDATA%\nvm\v20.18.1\`
4. Restart Cursor/terminal completely
5. If still showing v24, uninstall Node 24 from Apps & Features

### Issue: Firebase CLI errors after switching

**Solution**:
1. Uninstall and reinstall Firebase CLI:
   ```powershell
   npm uninstall -g firebase-tools
   npm install -g firebase-tools
   ```
2. Verify: `firebase --version`

### Issue: Cursor terminal still uses Node 24

**Solution**:
1. Close Cursor completely (not just the window)
2. Reopen Cursor
3. Open a new terminal in Cursor
4. Verify: `node -v` should show v20.18.1

## Verification Checklist

Before deploying, ensure all of these pass:

- [ ] `node -v` shows `v20.18.1`
- [ ] `npm -v` shows a version compatible with Node 20 (10.x.x)
- [ ] `firebase --version` shows a recent version
- [ ] `nvm current` shows `20.18.1`
- [ ] `where node` points to nvm directory (not Program Files)
- [ ] All `package.json` files have `"node": "20"` in engines field

## Next Steps

Once Node 20 is set up:

```powershell
# From project root
firebase deploy --only functions
```

This should now work reliably without Node version conflicts.

