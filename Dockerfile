# Node.js 18 LTS asosidagi rasmiy image
FROM node:18-alpine

# Ishchi papka
WORKDIR /usr/src/app

# Bog'liqliklarni o'rnatish
COPY package*.json ./
RUN npm install --omit=dev

# Kodlarni nusxalash
COPY . .

# Muhit o'zgaruvchilari
ENV PORT=3000
ENV NODE_ENV=production

# Portni ochish
EXPOSE 3000

# Serverni ishga tushirish
CMD ["node", "server/server.js"]
