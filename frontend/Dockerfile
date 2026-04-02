# CVSU Alumni System Frontend Dockerfile
FROM node:18-alpine

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies with legacy peer deps to resolve conflicts
RUN npm ci --legacy-peer-deps

# Copy source code
COPY . .

# Build the application
RUN npm run build

# Install serve to run the production build
RUN npm install -g serve

# Expose port
EXPOSE 3000

# Health check (use Node to avoid adding curl)
HEALTHCHECK --interval=30s --timeout=30s --start-period=5s --retries=3 \
    CMD node -e "require('http').get('http://localhost:3000', r=>process.exit(r.statusCode<400?0:1)).on('error',()=>process.exit(1))"

# Run the application
CMD ["serve", "-s", "dist", "-l", "3000"]


