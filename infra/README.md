# Infrastructure Setup

One-time setup for the PlanTopo server. (Assumes Ubuntu server with podman,
tailscale, and postgres).

## OAuth

**Google Cloud Console**

1. Go to APIs and Services -> Credentials
2. Select plantopo project
3. Create credentials -> OAuth client ID
4. Add Authorised redirect URI https://plantopo.com/api/v1/auth/callback/google

**GitHub**

1. Go to Settings -> Developer settings -> Github apps
2. Create GitHub App
3. Add callback https://plantopo.com/api/v1/auth/callback/github
4. Configure Permissions and Events > Account Permissions > Email Addresses to
   "Read-Only"
5. Where can this GitHub App be installed?: Select "Any account"
6. Select "Create Github App"
7. Select "Generate a new client secret"

## Steps

### Create the app user

```sh
root@box> useradd --system --create-home app
root@box> loginctl enable-linger app
```

### Copy infra files

```sh
dev> rsync infra/plantopo.container app@box:.config/containers/systemd/
dev> rsync infra/plantopo-deploy daniel@box:/tmp/ && ssh daniel@box "sudo mv /tmp/plantopo-deploy /usr/local/bin"
```

### Create the postgres user and database

```sh
postgres@box> DB_PASSWORD=$(openssl rand -base64 32)
postgres@box> echo "postgres://plantopo:$DB_PASSWORD@10.0.2.2:5432/plantopo"
postgres@box> psql <<SQL
CREATE USER plantopo WITH PASSWORD '$DB_PASSWORD';
CREATE DATABASE plantopo OWNER plantopo;
SQL
```

### Create the environment file

```sh
root@box> mkdir -p /etc/plantopo
root@box> install -m u=rw,go= -o app /dev/null /etc/plantopo/env
```

Populate the environment file (or restore a backup)

### Enable and start the service

```sh
app@box> systemctl --user daemon-reload && systemctl --user start plantopo
```

### Configure Tailscale for CI deploys

Add an SSH key for the `tag:ci` Tailscale tag so GitHub Actions can connect:

```sh
tailscale set --ssh
```

Then create a Tailscale OAuth client for GitHub Actions:

1. Go to
   [Tailscale Admin Console](https://login.tailscale.com/admin/settings/oauth)
   -> Settings -> Trust Credentials -> OAuth
2. Generate new client with the `devices:read` scope and tag `tag:ci`
3. Copy the client ID and secret

Add as repo secrets:

- `TS_OAUTH_CLIENT_ID`
- `TS_OAUTH_SECRET`

### Add remaining GitHub Actions secrets

- `DEPLOY_HOST` — box.reindeer-neon.ts.net
- `DEPLOY_USER` — `app`
- `DEPLOY_SSH_KEY` — generate and install a dedicated key for CI:
  ```sh
  app@box> mkdir -p ~/.ssh
  app@box> ssh-keygen -t ed25519 -C "github-actions" -N "" -f ~/.ssh/plantopo-ci
  app@box> cat ~/.ssh/plantopo-ci.pub >> ~/.ssh/authorized_keys
  app@box> chmod 700 ~/.ssh
  app@box> chmod 600 ~/.ssh/authorized_keys ~/.ssh/plantopo-ci.pub
  app@box> cat ~/.ssh/plantopo-ci  # copy this as the secret value
  app@box> rm ~/.ssh/plantopo-ci
  ```
- `WEB_BUILD_ENV` — newline-separated `KEY=value` pairs for vars baked into the
  frontend bundle (all `VITE_*` vars)

### Copy the infra files

```sh
dev> rsync -r infra box:/tmp/
root@box> chown root:root /tmp/infra/plantopo-deploy && mv /tmp/infra/plantopo-deploy /usr/local/bin/
root@box> chown app:app /tmp/infra/plantopo.container && mv /tmp/infra/plantopo.container /home/app/.config/containers/systemd
```

## Rollback

To roll back to a previous version, run the deploy script manually with an older
image tag:

```sh
plantopo-deploy ghcr.io/dzfranklin/plantopo:<previous-sha>
```

Previous image tags are available in the GitHub Container Registry:
`https://github.com/dzfranklin/plantopo/pkgs/container/plantopo`
