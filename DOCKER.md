# JobFinder Docker submission

Repository: https://github.com/aizukiontop/Jobfinder

Image repository: https://hub.docker.com/r/gabmagat/jobfinder

Live site (separate deployment): https://jobfinderangeles.site

The Docker Hub repository is usable only after a successful publishing workflow
has created an image tag. Creating the empty repository is not a completed release.
This package does not migrate or modify the live site.

## Run the published image

The evaluator needs a working Docker Engine or Docker Desktop with Linux containers.
The initial image targets Linux AMD64 (x86-64); ARM hosts may require emulation.
After an image has been published, run:

```sh
docker pull gabmagat/jobfinder:latest
docker run -d --name jobfinder --cap-drop ALL --security-opt no-new-privileges:true -p 127.0.0.1:8080:8080 -v jobfinder-data:/data gabmagat/jobfinder:latest
```

Open **http://localhost:8080** (use this exact hostname for the configured origin).
The API is available through the same origin at /api/health. It remains on loopback
inside the container behind Nginx. Do not publish API port 3210.

Alternatively, download this repository and run:

```sh
docker compose up -d
```

Use either the single-container command or Compose, not both on port 8080.
Compose uses its own project-prefixed data volume.

## What is included

- Built frontend, ontology logic and road-network assets.
- Backend, schema/migrations, and the repository's external job-posting dataset.
- A fresh SQLite database initialized on first start, with no pre-created accounts.
- Persistent database and uploaded files in the Docker volume mounted at /data.

The image does **not** include the live database, local accounts, resumes, private
environment files, API keys, TLS keys, VPS configuration, or thesis documents.
The bundled recruitment records are study data, not a guarantee of current vacancies.
Map tiles and external job links may require internet access.

Register a new job-seeker or employer account in the website. If an administrator
is needed for evaluation, create one explicitly:

```sh
docker exec -it jobfinder npm run admin:create -- reviewer@example.com "PESO Evaluation"
```

For Compose, use `docker compose exec jobfinder npm run admin:create -- reviewer@example.com "PESO Evaluation"`.
The existing CLI prompts for a new password twice; input may be visible in the terminal.
Do not record or share the screen while entering it. No default administrator password
is supplied. Email delivery is disabled, so password-reset emails are not delivered.

## Stop and preserve data

```sh
docker stop jobfinder
docker start jobfinder
```

For Compose use `docker compose stop` and `docker compose start`.
Do not delete the named data volume or run `docker compose down -v` unless you intend
to permanently delete the evaluator's accounts and uploads. A Docker image is not
a backup of data accumulated after the container starts.

## Build locally (optional)

```sh
docker build -t jobfinder:local .
docker run -d --name jobfinder-local -p 127.0.0.1:8080:8080 -v jobfinder-local-data:/data jobfinder:local
```

The build context is allowlisted in .dockerignore. Never add real databases, personal
uploads or credentials to the image. Keep secrets in runtime configuration, not build args.

## Build and publish through GitHub Actions

Docker Desktop is not needed on the author's PC when GitHub's hosted runner builds it.
The GitHub repository must contain all the final source changes and these Docker files.

1. Repository Settings > Secrets and variables > Actions:
   - Secret `DOCKER_PASSWORD`: Docker Hub access token with Read and Write permissions.
   - Variable `DOCKER_USERNAME`: `gabmagat`.
2. Actions > **Docker package** > Run workflow on **main**.
3. First leave **Publish the tested image to Docker Hub** unchecked.
4. Require a successful build and all smoke checks. This tests a fresh install,
   authentication, origin protection, uploads and persistence after container replacement.
   The optional VPS systemd-template test is explicitly skipped when the private,
   Git-ignored deploy/ directory is absent; runtime networking is always tested.
5. Run again on the same reviewed main commit with publishing checked.
6. Confirm Docker Hub shows `latest` and `sha-<full Git commit>`.

Publication is manual; ordinary pushes do not publish images or deploy the website.
The tests create synthetic accounts only in a disposable CI volume, never in the image.
Record the successful workflow URL, Git commit, image tag and registry digest in the
submission evidence. Prefer the immutable digest over the movable `latest` tag for
long-term reproduction.

## Local evaluation versus internet hosting

This default configuration binds the host port to 127.0.0.1 and permits HTTP cookies
only for a localhost origin. It is an evaluation package, not an instruction to replace
the production VPS. Public deployment needs a separately reviewed HTTPS reverse proxy,
an HTTPS JOBFINDER_APP_ORIGIN, backups, capacity planning and runtime secrets.
The existing small database-replica VPS must not be used for this Docker build.
