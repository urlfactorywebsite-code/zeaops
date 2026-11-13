FROM ghcr.io/astral-sh/uv:0.13.8@sha256:5cc1805e2426484abca4ad46ea783bab281fdb225fd82d8ce6d66a81254bac85 AS uv
FROM python:3.14.10-slim-trixie@sha256:9aaa474097d094040649f2162a627c0049b408f52138d980916788d80f04802f AS builder
RUN apt-get update && apt-get install --yes --no-install-recommends zlib1g=1:1.3.dfsg+really1.3.1-1+deb13u1 && rm -rf /var/lib/apt/lists/*
COPY --from=uv /uv /usr/local/bin/uv
ENV UV_PYTHON_DOWNLOADS=never PIP_DISABLE_PIP_VERSION_CHECK=1
WORKDIR /app
COPY pyproject.toml uv.lock ./
# Export the canonical lock, then use pip's TLS transport with mandatory artifact hashes.
# This avoids a stalled uv download path observed on the Debian 13 builder.
RUN uv export --locked --no-dev --no-emit-project --format requirements-txt --output-file /tmp/requirements.txt \
    && python -m venv /app/.venv \
    && timeout 180 /app/.venv/bin/python -m pip install --require-hashes --no-deps --no-cache-dir --timeout 30 -r /tmp/requirements.txt \
    && /app/.venv/bin/python -m pip uninstall --yes pip

FROM python:3.14.10-slim-trixie@sha256:9aaa474097d094040649f2162a627c0049b408f52138d980916788d80f04802f AS runtime
# No filesystem mounting is performed by the API. Keep essential Debian packages intact.
RUN apt-get update && apt-get install --yes --no-install-recommends zlib1g=1:1.3.dfsg+really1.3.1-1+deb13u1 \
    && apt-get purge --yes mount && rm -rf /var/lib/apt/lists/*
RUN /usr/local/bin/python -m pip uninstall --yes pip setuptools wheel
ENV PYTHONUNBUFFERED=1 PYTHONDONTWRITEBYTECODE=1 PATH="/app/.venv/bin:$PATH" PYTHONPATH=/app/apps/api/src
RUN groupadd --gid 10001 zeaops && useradd --uid 10001 --gid 10001 --no-create-home --shell /usr/sbin/nologin zeaops
WORKDIR /app
COPY --from=builder /app/.venv /app/.venv
COPY apps/api/src ./apps/api/src
COPY apps/api/alembic ./apps/api/alembic
COPY apps/api/alembic.ini ./apps/api/alembic.ini
USER 10001:10001
EXPOSE 18301
CMD ["uvicorn", "zeaops.main:create_app", "--factory", "--host", "0.0.0.0", "--port", "18301", "--no-access-log"]
