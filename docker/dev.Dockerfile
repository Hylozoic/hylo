FROM node:24-bookworm

# bcrypt and sharp fall back to a source build when prebuilt binaries
# do not match this Node version.
RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 make g++ \
  && rm -rf /var/lib/apt/lists/*

# Yarn 4.9.2 comes from the repo packageManager field. Never prompt for it.
ENV COREPACK_ENABLE_DOWNLOAD_PROMPT=0
RUN corepack enable

WORKDIR /app

CMD ["node", "scripts/dev-setup.js"]
