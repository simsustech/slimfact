FROM node:lts AS install-stage
RUN --mount=type=secret,id=SIMSUSTECH_NPM_TOKEN \
    echo "//npm.simsus.tech/:_authToken=$(cat /run/secrets/SIMSUSTECH_NPM_TOKEN)" >> ~/.npmrc
WORKDIR /build
RUN npm install -g pnpm
COPY . .

# Copy local packages inside the packages/* workspace glob so the workspace
# install resolves their dependencies (kysely, fastify, etc.) and the app
# build can import them.
COPY --from=linked-quasar-components ./ /build/packages/quasar-components/
COPY --from=linked-vitrify ./ /build/packages/vitrify/
COPY --from=linked-unocss-preset-quasar ./ /build/packages/unocss-preset-quasar/
COPY --from=linked-modular-api-fastify-oidc ./ /build/packages/modular-api-fastify-oidc/
COPY --from=linked-modular-api-fastify-checkout ./ /build/packages/modular-api-fastify-checkout/
COPY --from=linked-modular-api-event-bus ./ /build/packages/modular-api-event-bus/
COPY --from=linked-modular-api-quasar-components ./ /build/packages/modular-api-quasar-components/

# Rewrite the local absolute @modular-api/event-bus override (pnpm-workspace.yaml)
# to the in-build copy when the local checkout is overlaid via
# LINKED_MODULAR_API_EVENT_BUS_PATH. Without an overlay the override stays
# absolute — matching the committed lockfile — and the install stays frozen.
RUN if [ -f /build/packages/modular-api-event-bus/package.json ]; then \
      sed -i 's|link:/home/stefan/Projects/modular-api/packages/event-bus|link:packages/modular-api-event-bus|' pnpm-workspace.yaml; \
    fi

RUN rm -rf node_modules packages/*/node_modules

# Build and link any local packages provided via docker-compose additional_contexts.
# When any overlay is present the workspace no longer matches the committed
# lockfile (the event-bus override is rewritten above), so the install
# reconciles with --no-frozen-lockfile; otherwise the lockfile is verified frozen.
RUN LINKED=0; \
    for pkg in /build/packages/modular-api-* /build/packages/quasar-components /build/packages/vitrify /build/packages/unocss-preset-quasar; do \
      if [ -f "$pkg/package.json" ]; then \
        LINKED=1; \
        echo "[local] building $(basename "$pkg")..." && \
        (cd "$pkg" && pnpm install && pnpm run build) && \
        echo "[local] linking $(basename "$pkg")..." && \
        pnpm link "$pkg"; \
      fi; \
    done || true; \
    if [ "$LINKED" = "1" ]; then \
      echo "[local] linked packages present — installing with --no-frozen-lockfile"; \
      pnpm install --no-frozen-lockfile; \
    else \
      echo "[local] no linked packages — installing with --frozen-lockfile"; \
      pnpm install --frozen-lockfile; \
    fi

FROM install-stage AS build-stage
ARG VITE_API_HOST
ARG VITE_TITLE
ARG SASS_VARIABLE_PRIMARY
ARG DEBUG=false
ENV CI=true
RUN if [ "$DEBUG" = "true" ]; then pnpm run build:debug; else pnpm run build; fi

FROM build-stage AS api-deploy
RUN pnpm --filter @slimfact/api deploy api --prod
# force-legacy-deploy=true (in .npmrc) keeps the link: overrides intact in the
# deployed node_modules, so the api package resolves the local packages.
RUN rm ~/.npmrc
WORKDIR "/build/app/dist/ssr/client"
RUN find . ! -name 'logo.svg' -type f -exec gzip {} +

FROM node:lts-slim AS api
LABEL "io.stak.vendor"="simsustech"
RUN apt-get update && apt-get install -y curl
WORKDIR /app
COPY --from=api-deploy /build/api /app
COPY --from=api-deploy /build/app /packages/app
ENV HOST=0.0.0.0 PORT=80
EXPOSE 80
CMD ["npm", "start"]

# banking-api — the open-banking proxy (internal network only, zero ports).
FROM build-stage AS banking-api-deploy
RUN pnpm --filter @slimfact/banking-api build && pnpm --filter @slimfact/banking-api deploy banking-api --prod

FROM node:lts-slim AS banking-api
LABEL "io.stak.vendor"="simsustech"
WORKDIR /app
COPY --from=banking-api-deploy /build/banking-api /app
ENV HOST=0.0.0.0 PORT=80
EXPOSE 80
CMD ["sh", "-c", "node dist/src/kysely/migrate.js && node dist/src/seed/test.js && node dist/src/server.js"]
