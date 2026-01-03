FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
COPY pnpm-lock.yaml* ./

RUN npm install -g pnpm && pnpm install

COPY . .

RUN npm run build

EXPOSE 3000

CMD ["npm", "run", "dev"]
