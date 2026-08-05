FROM node:lts AS install-stage
RUN --mount=type=secret,id=SIMSUSTECH_NPM_TOKEN \
    echo "//npm.simsus.tech/:_authToken=$(cat /run/secrets/SIMSUSTECH_NPM_TOKEN)" >> ~/.npmrc
WORKDIR /build
RUN npm install -g pnpm
COPY . .
RUN rm -rf node_modules packages/*/node_modules

# Copy local packages inside the packages/* workspace glob so the workspace
# install resolves their dependencies (kysely, fastify, etc.) and the app
# build can import them.
COPY --from=linked-quasar-components ./ /build/packages/quasar-components/
COPY --from=linked-vitrify ./ /build/packages/vitrify/
COPY --from=linked-unocss-preset-quasar ./ /build/packages/unocss-preset-quasar/
COPY --from=linked-modular-api-fastify-oidc ./ /build/packages/modular-api-fastify-oidc/
COPY --from=linked-modular-api-fastify-checkout ./ /build/packages/modular-api-fastify-checkout/
COPY --from=linked-modular-api-quasar-components ./ /build/packages/modular-api-quasar-components/

# Inject link: overrides into pnpm-workspace.yaml for every local package that
# has a package.json, then install. --no-frozen-lockfile is only used when linked
# packages are present, so the lockfile records the link: entries (and the
# linked package's own deps) and pnpm deploy can resolve them.
RUN node -e "const fs=require('fs'),path=require('path'),y=fs.readFileSync('pnpm-workspace.yaml','utf8'),pkgs='/build/packages';let ov={};fs.readdirSync(pkgs).forEach(d=>{let p=path.join(pkgs,d,'package.json');if(fs.existsSync(p)){let pkg=JSON.parse(fs.readFileSync(p,'utf8'));ov[pkg.name]='link:./packages/'+d}});if(Object.keys(ov).length){let ovBlock='overrides:\\n'+Object.entries(ov).map(([k,v])=>'  \"'+k+'\": \"'+v+'\"').join('\\n')+'\\n';let n=y.replace(/^overrides:[\s\S]*?(?=\n\S|$)/m,'');fs.writeFileSync('pnpm-workspace.yaml',ovBlock+'\n'+n);fs.writeFileSync('/tmp/has-linked','')}" \
  && if [ -f /tmp/has-linked ]; then pnpm install --no-frozen-lockfile; else pnpm install --frozen-lockfile; fi

# Build any local packages so their dist/ exists for the app build and deploy
RUN for pkg in /build/packages/modular-api-* /build/packages/quasar-components /build/packages/vitrify /build/packages/unocss-preset-quasar; do \
      if [ -f "$pkg/package.json" ]; then \
        echo "[local] building $(basename "$pkg")..." && \
        (cd "$pkg" && pnpm run build); \
      fi; \
    done || true

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
