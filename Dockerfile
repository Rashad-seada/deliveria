FROM node:18

WORKDIR /deliveria

COPY package.json .

RUN npm install --force

COPY . .

EXPOSE 8550

CMD ["npm","run","start"]