# Use a smaller, production-ready base image
FROM node:18-alpine

# Set environment variables
ENV NODE_ENV=production

# Set working directory
WORKDIR /deliveria

# Copy package files first to leverage Docker layer caching
COPY package.json package-lock.json ./

# Install dependencies (clean install for production)
# Using --omit=dev to skip devDependencies and --force if necessary (though ci is better, sticking to robust install if lockfile has issues, but ci is best practice. Let's use ci)
RUN npm ci --omit=dev && npm cache clean --force

# Copy the rest of the application code
COPY . .

# Use a non-root user for security
USER node

# Expose the application port
EXPOSE 8550

# Start the application directly (bypass nodemon for production)
CMD ["node", "index.js"]