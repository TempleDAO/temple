# Build Stage 1
FROM node:20-alpine AS appbuild
WORKDIR /app
COPY package.json yarn.lock tsconfig.json ./
COPY ./src ./src
RUN yarn install
RUN yarn build

# Build Stage 2 (ie just the esbuild out)
FROM node:20-alpine
ARG VERSION=unknown
ENV VERSION=$VERSION
WORKDIR /app
COPY --from=appbuild /app/dist/main.js main.js
CMD ["node", "main.js"]
