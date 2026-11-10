# Build Stage 1
FROM node:26-alpine AS appbuild
WORKDIR /app
# node:26 images ship without yarn; keep this pin in sync with package.json packageManager
RUN npm install --global --ignore-scripts yarn@1.22.21
COPY package.json yarn.lock tsconfig.json .yarnrc ./
COPY ./abi ./abi
COPY ./src ./src
RUN yarn install
RUN yarn build

# Build Stage 2 (ie just the esbuild out)
FROM node:26-alpine
ARG VERSION=unknown
ENV VERSION=$VERSION
WORKDIR /app
COPY --from=appbuild /app/dist/main.js main.js
CMD ["node", "main.js"]
