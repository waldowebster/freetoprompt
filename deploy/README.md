# Self-Hosting

Free to Prompt is a static website.
Any static host can serve it, including GitHub Pages, Nginx, Apache, or Caddy.
Only `index.html`, `styles.css`, `app.js`, `favicon.svg`, `favicon.ico`, `robots.txt`, and `sitemap.xml` are needed at runtime.
Do not expose the repository's `.git` directory or server credentials.

## AWS Lightsail and Caddy

The public installation uses Ubuntu 24.04 on an AWS Lightsail Linux instance in `us-east-1`.
It uses a static IPv4 address, a Lightsail DNS zone, and Caddy for TLS issuance and renewal.
The `nano_3_0` plan costs $5/month before applicable taxes and usage overages at initial setup.
Visitors can use the app for free.

1. Create an Ubuntu instance and attach a static IP.
2. Allow incoming TCP 80 and 443; restrict SSH to your administration IP.
3. Install Caddy and enable operating-system security updates.
4. Create A records for your domain pointing to the static IP and a `www` CNAME pointing to the apex domain.
5. Delegate the domain to the DNS zone's nameservers at your registrar.
6. Copy a release into `/srv/freetoprompt/releases/COMMIT_SHA` and point `/srv/freetoprompt/current` to it.
7. Adapt `Caddyfile` to your domain, install it at `/etc/caddy/Caddyfile`, validate it with `caddy validate`, and reload Caddy.
8. Verify HTTPS, redirects, security headers, and browser behavior.

Caddy requests and renews certificates automatically once public DNS resolves to the server.
No AWS or GitHub credentials are needed by the running website.

## Releases and Rollback

Deploy only a reviewed, committed source revision.
Use `git archive` to package the runtime files from that revision.
Keep previous release directories and atomically replace the `current` symlink with the new release.
To roll back, point `current` at a previous verified release.

The initial deployment is manual; GitHub Actions validates changes but does not automatically deploy them.
Preserve the server's verified SSH host key, use strict host checking, and keep private keys outside this repository.
