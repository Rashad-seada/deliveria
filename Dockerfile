# Use a smaller, production-ready base image
FROM node:18-alpine

# Set environment variables
ENV NODE_ENV=production

# Set working directory
WORKDIR /deliveria

# Copy package files first to leverage Docker layer caching
COPY package.json package-lock.json ./

# Install dependencies (clean install for production)
RUN npm ci --omit=dev && npm cache clean --force

# Copy the rest of the application code
COPY . .

# Create upload directories and set ownership to node user
RUN mkdir -p deliveria_upload uploads && \
    chown -R node:node /deliveria

# Use a non-root user for security
USER node

# Expose the application port
EXPOSE 8550

# Start the application directly (bypass nodemon for production)
CMD ["node", "index.js"]