# Frontend Files

This directory contains the web UI for Firecrawl Lite.

## Deployment

The backend API no longer serves these static files.
Frontend should be deployed separately to Cloudflare Pages.

See [DEPLOYMENT.md](../DEPLOYMENT.md) for complete deployment instructions.

## Local Development

For local testing, you can run a simple HTTP server:

```bash
# Option 1: Using npx serve
npx serve public

# Option 2: Using Python
python3 -m http.server 8080 --directory public

# Option 3: Using Node.js http-server
npx http-server public -p 8080
```

Then set the API base URL in browser console:

```javascript
window.API_BASE = 'http://localhost:3000/api';
```

## Files

- `index.html` - Main UI entry point
- `app.js` - Frontend application logic
- `config.js` - Application configuration
- `styles.css` - UI styles
- `icons.svg` - SVG icons
- `image.png` - Logo/image assets
