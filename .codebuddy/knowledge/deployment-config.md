# Deployment Configuration Guide

## Required Environment Variables

All deployment secrets are managed via the imports file:
```
https://cnb.cool/ai-alchemy-factory/project-secrets/-/blob/main/firecrawl-lite-ssh.yml
```

### Mandatory Variables

The following variables **MUST** be defined in `firecrawl-lite-ssh.yml`:

| Variable | Description | Example |
|----------|-------------|---------|
| `REMOTE_HOST` | Target server IP/hostname | `123.45.67.89` |
| `REMOTE_USERNAME` | SSH user (usually root) | `root` |
| `REMOTE_PORT` | SSH port | `22` |
| `PRIVATE_KEY` | SSH private key (full PEM format) | `-----BEGIN RSA PRIVATE KEY-----\n...\n-----END RSA PRIVATE KEY-----` |
| `REGISTRY_TOKEN` | Docker registry auth token | `cnb_xxxxxxxxxxxxx` |
| `REGISTRY_USER` | Docker registry username | `your-username` |
| **`DOMAIN`** | **Your production domain (REQUIRED)** | `firecrawl.yourdomain.com` |

### Example firecrawl-lite-ssh.yml

```yaml
REMOTE_HOST: 123.45.67.89
REMOTE_USERNAME: root
REMOTE_PORT: 22
PRIVATE_KEY: |
  -----BEGIN RSA PRIVATE KEY-----
  MIIEpAIBAAKCAQEA...
  ...
  -----END RSA PRIVATE KEY-----

REGISTRY_TOKEN: cnb_xxxxxxxxxxxxx
REGISTRY_USER: your-username

# IMPORTANT: DOMAIN is required for HTTPS certificate validation
DOMAIN: firecrawl.yourdomain.com
```

## Why DOMAIN is Required

1. **HTTPS Health Checks**: The deployment script verifies HTTPS is working by calling `https://${DOMAIN}/api/health`
2. **SSL Certificate Validation**: Caddy obtains Let's Encrypt certificates for the specified domain
3. **No Fallback Values**: Using `${DOMAIN:-your-domain.com}` is a code smell - always declare it explicitly

## Pre-Deployment Checklist

Before deploying, ensure:

- [ ] DNS points to `REMOTE_HOST` (check: `dig ${DOMAIN}`)
- [ ] Ports 80/443 are open on firewall
- [ ] SSH key has correct permissions on target server
- [ ] Docker registry credentials are valid
- [ ] `DOMAIN` variable is set in imports file

## Deployment Workflow

### Automatic (on tag push):
```bash
git tag v1.2.3
git push origin v1.2.3
# CI automatically builds and deploys to production
```

### Manual:
```bash
# In CNB UI, trigger 'deploy' operation with:
DEPLOY_VERSION=v1.2.3
```

### Rollback:
```bash
# In CNB UI, trigger 'rollback' operation with:
ROLLBACK_VERSION=v1.2.2
```

## Troubleshooting

### HTTPS fails after deployment

**Symptom**: Deployment hangs with "HTTPS not ready yet..."

**Check**:
1. DNS: `dig ${DOMAIN}` - should return `REMOTE_HOST` IP
2. Firewall: `nc -zv ${REMOTE_HOST} 443`
3. Caddy logs: `docker logs firecrawl-lite | grep -i acme`

### DOMAIN not set error

**Symptom**: `ERROR: DOMAIN environment variable not set in imports file`

**Fix**: Add `DOMAIN: your-domain.com` to `firecrawl-lite-ssh.yml`

## Philosophy (Linus Style)

- **No magic defaults**: If you need a domain, declare it. Don't hide behind fallbacks.
- **Explicit is better than implicit**: All secrets in one place (imports file).
- **Fail fast**: If DOMAIN is missing, deployment fails immediately, not 60 seconds later.
