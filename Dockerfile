FROM node:22-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies (including devDeps for prisma generate)
RUN npm install

# Generate Prisma client (needed even if not using DB — keeps schema available)
RUN npx prisma generate

# Copy application
COPY . .

EXPOSE 3000

CMD ["npm", "start"]
