FROM node:20-alpine

# Set working directory
WORKDIR /app

# Copy package files first (for Docker caching)
COPY package*.json ./

# Install dependencies
RUN npm install --production

# Copy the rest of the files (including .env)
COPY . .

# Expose app port
EXPOSE 3000

# Set NODE_ENV explicitly
ENV NODE_ENV=production

# Default command
CMD ["node", "server.js"]
