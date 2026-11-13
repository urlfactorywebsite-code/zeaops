# The pinned official entrypoint supports direct non-root initialization.
FROM postgres:17.12-trixie@sha256:dbb9623d5121b5d2c2c9e2fba56e40193cbb3510d4af7f035b1ab1823aff3205
# GnuPG imports upstream repository keys during image construction, not database startup.
# A simulated removal plan confirmed these tools and orphaned libraries are unnecessary.
RUN apt-get update && apt-get install --yes --no-install-recommends zlib1g=1:1.3.dfsg+really1.3.1-1+deb13u1 \
    && apt-get purge --yes --auto-remove gnupg gnupg-l10n dirmngr gpg gpg-agent gpgconf gpgsm pinentry-curses \
    && postgres --version && pg_dump --version && rm -rf /var/lib/apt/lists/*
# gosu is only used by the entrypoint when starting as root. This image always runs as postgres.
RUN rm -f /usr/local/bin/gosu
USER 999:999
