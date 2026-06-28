FROM node:22-alpine

WORKDIR /app

# Copy package files first (for layer caching)
COPY package*.json ./

# Install ALL dependencies (prisma generate needs prisma package)
RUN npm install

# Copy the entire project
COPY . .

# Generate Prisma client ONLY if schema exists
RUN test -f prisma/schema.prisma && npx prisma generate || echo "No Prisma schema found, skipping generate"

EXPOSE 3000

CMD ["npm", "start"]
