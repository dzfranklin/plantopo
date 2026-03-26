# Infrastructure Setup

One-time setup for the PlanTopo server. (Assumes Ubuntu server with podman,
tailscale, and postgres).

**Secrets**: See "Infra" item in plantopo 1Password vault.

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

### 1. Create the plantopo user

```sh
useradd --system --create-home plantopo
loginctl enable-linger plantopo
```

### 2. Install the quadlet container file

```sh
mkdir -p /home/plantopo/.config/containers/systemd
cp infra/plantopo-api.container /home/plantopo/.config/containers/systemd/plantopo-api.container
chown -R plantopo:plantopo /home/plantopo/.config
```

### 3. Create the postgres user and database

```sh
DB_PASSWORD=$(openssl rand -base64 32)
echo "postgres://plantopo:$DB_PASSWORD@10.0.2.2:5432/plantopo"
sudo -u postgres psql <<SQL
CREATE USER plantopo WITH PASSWORD '$DB_PASSWORD';
CREATE DATABASE plantopo OWNER plantopo;
SQL
```

### 4. Create the environment file

```sh
mkdir -p /etc/plantopo
install -m 600 -o plantopo /dev/null /etc/plantopo/api.env
```

Copy from 1Password field to `/etc/plantopo/api.env`

### 5. Create the deploy script

```sh
mkdir -p /opt/plantopo
install -m 755 /dev/null /opt/plantopo/deploy.sh
```

Contents of `/opt/plantopo/deploy.sh`:

```sh
#!/bin/sh
set -e
[ "$(id -un)" = "plantopo" ] || { echo "Must be run as plantopo"; exit 1; }
[ -n "$1" ] || { echo "Usage: $0 <image>"; exit 1; }
IMAGE=$1
podman pull "$IMAGE"
sed -i "s|^Image=.*|Image=$IMAGE|" /home/plantopo/.config/containers/systemd/plantopo-api.container
systemctl --user daemon-reload
systemctl --user restart plantopo-api.service
systemctl --user is-active plantopo-api.service
```

### 6. Enable and start the service

```sh
sudo -u plantopo XDG_RUNTIME_DIR=/run/user/$(id -u plantopo) systemctl --user daemon-reload
sudo -u plantopo XDG_RUNTIME_DIR=/run/user/$(id -u plantopo) systemctl --user start plantopo-api.service
```

### 7. Configure Tailscale for CI deploys

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

### 8. Add remaining GitHub Actions secrets

- `DEPLOY_HOST` — box.reindeer-neon.ts.net
- `DEPLOY_USER` — `plantopo`
- `DEPLOY_SSH_KEY` — generate and install a dedicated key for CI:
  ```sh
  ssh-keygen -t ed25519 -C "github-actions" -N "" -f /tmp/plantopo-ci
  sudo -u plantopo mkdir -p /home/plantopo/.ssh
  cat /tmp/plantopo-ci.pub | sudo -u plantopo tee -a /home/plantopo/.ssh/authorized_keys
  sudo -u plantopo chmod 700 /home/plantopo/.ssh
  sudo -u plantopo chmod 600 /home/plantopo/.ssh/authorized_keys
  cat /tmp/plantopo-ci  # copy this as the secret value
  rm /tmp/plantopo-ci /tmp/plantopo-ci.pub
  ```
- `WEB_BUILD_ENV` — newline-separated `KEY=value` pairs for vars baked into the
  frontend bundle (all `VITE_*` vars)

## Rollback

To roll back to a previous version, run the deploy script manually with an older
image tag:

```sh
/opt/plantopo/deploy.sh ghcr.io/dzfranklin/plantopo-api:<previous-sha>
```

Previous image tags are available in the GitHub Container Registry:
`https://github.com/dzfranklin/plantopo/pkgs/container/plantopo-api`
