FROM node:lts AS install-stage
RUN --mount=type=secret,id=SIMSUSTECH_NPM_TOKEN \
    echo "//npm.simsus.tech/:_authToken=$(cat /run/secrets/SIMSUSTECH_NPM_TOKEN)" >> ~/.npmrc

WORKDIR /build
RUN npm install -g pnpm
COPY . .
RUN rm -rf node_modules

COPY --from=linked-quasar-components ./ /build/packages/quasar-components/
COPY --from=linked-vitrify ./ /build/packages/vitrify/
COPY --from=linked-modular-api-fastify-oidc ./ /build/packages/modular-api-fastify-oidc/
COPY --from=linked-modular-api-fastify-checkout ./ /build/packages/modular-api-fastify-checkout/
COPY --from=linked-modular-api-quasar-components ./ /build/packages/modular-api-quasar-components/

# Add override to pnpm-workspace.yaml
RUN node -e "const fs=require('fs');let y=fs.readFileSync('pnpm-workspace.yaml','utf8');y=y.replace('overrides: {}','overrides: { \"@modular-api/fastify-checkout\": \"link:./packages/modular-api-fastify-checkout\" }');fs.writeFileSync('pnpm-workspace.yaml',y)"

RUN pnpm install --no-frozen-lockfile \
  && pnpm --filter ./packages/modular-api-fastify-checkout run build

FROM install-stage AS build-stage
ARG VITE_API_HOST
ARG VITE_TITLE
ARG SASS_VARIABLE_PRIMARY
ARG DEBUG=false
ENV CI=true
RUN if [ "$DEBUG" = "true" ]; then pnpm run build:debug; else pnpm run build; fi

FROM build-stage AS api-deploy
RUN pnpm --filter @slimfact/api deploy api --prod
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