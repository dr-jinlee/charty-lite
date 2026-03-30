FROM node:20-alpine

WORKDIR /app

COPY package.json ./
RUN npm install --production

COPY . .

# 데이터 디렉토리 생성
RUN mkdir -p /app/data

EXPOSE 8080

CMD ["node", "server.js"]
