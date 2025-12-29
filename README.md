# Listo - Development Setup

## Node.js Version Requirements

This project requires **Node.js 20 LTS** (specifically 20.18.1) for Firebase Cloud Functions deployment.

### Quick Start (Windows with nvm-windows)

1. **Install nvm-windows** (if not already installed):
   - Download from: https://github.com/coreybutler/nvm-windows/releases
   - Install the latest `nvm-setup.exe`
   - Restart PowerShell/Command Prompt after installation

2. **Install and use Node 20.18.1**:
   ```powershell
   nvm install 20.18.1
   nvm use 20.18.1
   ```

3. **Verify versions**:
   ```powershell
   node -v    # Should show v20.18.1
   npm -v     # Should show npm version compatible with Node 20
   ```

4. **Reinstall Firebase CLI** (if upgrading from Node 24):
   ```powershell
   npm uninstall -g firebase-tools
   npm install -g firebase-tools
   firebase --version
   ```

5. **Restart Cursor** to pick up the new Node version in PATH

### Troubleshooting PATH Conflicts

If `where node` shows multiple Node installations:

1. **Check current Node location**:
   ```powershell
   where node
   ```

2. **Remove old Node 24 installation**:
   - Open Windows Settings → Apps → Apps & Features
   - Search for "Node.js"
   - Uninstall any Node.js 24.x installations
   - Restart your terminal/Cursor

3. **Verify nvm controls Node**:
   ```powershell
   nvm list          # Should show 20.18.1 with asterisk (*)
   nvm current       # Should show 20.18.1
   ```

### Project Structure

This project uses multiple Firebase Functions codebases:
- `functions/` - Main Cloud Functions (Node 20)
- `listo/` - Listo codebase functions (Node 20)
- `ocr/` - OCR functions (Node 20)
- `scanner/` - Scanner functions (Node 20)
- `fuctionsdefault/` - Default functions (Node 20)

All function codebases are configured to use Node 20 in their `package.json` files.

### Deployment

After setting up Node 20:

```powershell
# From project root
firebase deploy --only functions
```

### Auto-switching with .nvmrc

If you use nvm-windows with auto-switching enabled, the `.nvmrc` file in the project root will automatically switch to Node 20.18.1 when you `cd` into this directory.

