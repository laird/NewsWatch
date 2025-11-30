# Use Node.js LTS
FROM node:20-slim

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --omit=dev

# Copy application code
COPY backend ./backend
COPY public ./public
# Remove index.html to prevent express.static from serving it (we use GCS redirect)
RUN rm public/index.html
COPY *.js ./
COPY styles.css ./

# Expose port
EXPOSE 8080

# Set production environment
ENV NODE_ENV=production
ENV PORT=8080

# Start the application
CMD ["node", "backend/server.js"]
