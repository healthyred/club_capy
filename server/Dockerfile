FROM node:alpine AS node-builder

WORKDIR /backend

COPY package*.json .
RUN npm install

COPY tsconfig.json .
COPY src/main.ts src/main.ts
COPY src/capy_rpc.ts src/capy_rpc.ts
COPY src/match_handler.ts src/match_handler.ts
COPY src/messages.ts src/messages.ts 
RUN npx tsc

FROM registry.heroiclabs.com/heroiclabs/nakama:3.9.0

COPY --from=node-builder /backend/build/*.js /nakama/data/modules/build/
COPY local.yml /nakama/data/local.yml

# FROM heroiclabs/nakama-pluginbuilder:3.15.0 AS builder

# ENV GO111MODULE on
# ENV CGO_ENABLED 1
# ENV GOPRIVATE "github.com/heroiclabs/nakama-project-template"

# WORKDIR /backend
# COPY . .

# FROM heroiclabs/nakama:3.15.0

# COPY --from=builder /backend/build/*.js /nakama/data/modules/build/
# COPY local.yml /nakama/data/local.yml
# COPY tsconfig.json .