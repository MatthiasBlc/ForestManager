FROM node:18.18-alpine3.17
RUN mkdir -p /app/config /app/src
WORKDIR /app
COPY prisma ./prisma/
COPY @types ./@types/
COPY tsconfig.json /app/tsconfig.json
COPY .eslintrc.js /app/.eslintrc.js
COPY package.json /app/package.json
COPY package-lock.json /app/package-lock.json
RUN npm install
RUN npx prisma generate
CMD [  "npm", "run", "start:migrate:prod" ]