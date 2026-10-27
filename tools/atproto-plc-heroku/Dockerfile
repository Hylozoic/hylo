# Staging PLC directory for Heroku: a thin layer over Bluesky's own PLC server image.
# BASE is built from upstream source at a pinned commit by deploy.sh (see README.md).
ARG BASE=hylo-plc-upstream:latest
FROM ${BASE}

WORKDIR /app/packages/server

# Heroku Postgres requires SSL but its certificates don't verify against a public CA, and
# Heroku owns DATABASE_URL so we can't add ?sslmode to it. The PLC server's pg client reads
# this instead. (Hylo's backend does the same: rejectUnauthorized: false in knexfile.js.)
ENV PGSSLMODE=no-verify
ENV LOG_ENABLED=true

# bin.js reads DATABASE_URL and PORT (both set by Heroku), runs migrations on boot and runs the
# sequencer in-process, so one web dyno is the whole service. Leave ADMIN_SECRET unset: it only
# enables the admin takedown route, which staging doesn't need.
CMD ["node", "--enable-source-maps", "dist/bin.js"]
