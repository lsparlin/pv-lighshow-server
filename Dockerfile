FROM node:8-alpine
RUN apk add shadow
RUN apk add dumb-init
RUN groupadd -r apprunner && useradd -m -r -g apprunner -s /bin/ash apprunner

WORKDIR /home/nodejs/app
COPY package.json .
RUN npm install --production
COPY . .

USER apprunner

ENV NODE_ENV production
CMD ["node", "index.js"]
ENTRYPOINT ["/usr/bin/dumb-init", "--"]
