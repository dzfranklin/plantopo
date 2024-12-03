# plantopo

## Setting up development

### 0. Install tooling

go, npm, just, zellij, minio, watchexec, redocly, tern, and others I haven't documented

### 1. Set up git hooks

 ```bash
 git config --local core.hooksPath .githooks/
 ```

### 2. Set up hostnames

Append to your `/etc/hosts`

 ```
 127.0.0.1 pt.internal
 127.0.0.1 api.pt.internal
 127.0.0.1 admin.pt.internal
 ```

### 3. Install app deps

```bash
cd app && npm install
```

## Development

```bash
just dev
```

## Admin

https://api.plantopo.com/admin
