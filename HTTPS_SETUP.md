# HTTPS Setup Guide for GitHub Pages

Your website is showing "not secure" because it's being accessed over HTTP instead of HTTPS. This guide will help you enable HTTPS on GitHub Pages.

## Files Added

I've added the following to help with HTTPS:

1. **Meta tags** - Added to `index.html` and `dashboard.html` to upgrade insecure requests
2. **JavaScript redirects** - Added to `index.html` and `dashboard.html` to redirect HTTP to HTTPS
3. **`.htaccess`** - Kept for reference (GitHub Pages doesn't use this, but it's useful if you switch hosting)

## Steps to Enable HTTPS on GitHub Pages

### Step 1: Verify Your Domain is Connected

1. Go to your GitHub repository
2. Click **Settings** → **Pages** (in the left sidebar)
3. Under **Custom domain**, verify that `listonow.com` is listed
4. Make sure your domain is properly configured in GoDaddy:
   - Go to GoDaddy DNS settings
   - Add a CNAME record pointing `listonow.com` to `yourusername.github.io` (or your GitHub Pages URL)
   - Or add A records pointing to GitHub Pages IP addresses:
     - 185.199.108.153
     - 185.199.109.153
     - 185.199.110.153
     - 185.199.111.153

### Step 2: Enable HTTPS

1. In GitHub repository **Settings** → **Pages**
2. Scroll down to the **Custom domain** section
3. Check the box that says **"Enforce HTTPS"**
   - Note: This option only appears after GitHub has verified your domain and provisioned an SSL certificate
   - This can take a few hours to a few days after you first add your custom domain

### Step 3: Wait for SSL Certificate

- GitHub automatically provisions SSL certificates via Let's Encrypt
- This process can take **24-48 hours** after you add your custom domain
- You'll know it's ready when the "Enforce HTTPS" checkbox becomes available

### Step 4: Verify HTTPS is Working

1. Clear your browser cache
2. Visit `https://listonow.com` (make sure to use `https://` not `http://`)
3. The browser should show a padlock icon 🔒
4. The "not secure" warning should disappear

## Current Status Check

To check if HTTPS is ready:

1. Go to your repository **Settings** → **Pages**
2. Look at the **Custom domain** section
3. If you see a warning icon ⚠️, GitHub is still verifying your domain
4. If you see a checkmark ✓, your domain is verified
5. If "Enforce HTTPS" checkbox is available, you can enable it

## Troubleshooting

### "Enforce HTTPS" checkbox is grayed out or missing

**Cause:** GitHub hasn't finished provisioning your SSL certificate yet.

**Solution:**
- Wait 24-48 hours after adding your custom domain
- Make sure your DNS records are correctly configured in GoDaddy
- Verify your domain is properly connected in GitHub Pages settings

### Still seeing "not secure" warning

**Possible causes:**
1. You're accessing the site via `http://` instead of `https://`
   - **Solution:** Always use `https://listonow.com`
   - The JavaScript redirect I added will help, but it's better to use HTTPS directly

2. Mixed content (HTTP resources on HTTPS page)
   - **Solution:** Check browser console for any HTTP resources
   - All external resources (Firebase, Facebook SDK, etc.) should already be using HTTPS

3. Browser cache
   - **Solution:** Clear your browser cache and try again

### Redirect loop

If you experience a redirect loop:
- The JavaScript redirect might conflict with GitHub's redirect
- Temporarily remove the JavaScript redirect from `index.html` and `dashboard.html` if needed
- GitHub Pages should handle the redirect automatically once HTTPS is enforced

## What the Code Does

The code I added includes:

1. **Meta tag** (`Content-Security-Policy: upgrade-insecure-requests`)
   - Tells the browser to automatically upgrade HTTP requests to HTTPS
   - Works as a backup if someone accesses via HTTP

2. **JavaScript redirect**
   - Automatically redirects HTTP to HTTPS
   - Only runs if not on localhost (so it doesn't break local development)

3. **Security headers** (in .htaccess)
   - Not used by GitHub Pages, but kept for reference
   - Useful if you ever switch to Apache-based hosting

## Next Steps

1. **Verify your domain in GitHub Pages settings**
2. **Wait for SSL certificate provisioning** (24-48 hours)
3. **Enable "Enforce HTTPS"** when the option becomes available
4. **Test by visiting `https://listonow.com`**

Once HTTPS is enabled, your site will be secure and the "not secure" warning will disappear!
