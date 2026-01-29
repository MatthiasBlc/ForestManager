# ========================================
# Stage: Development
# ========================================
FROM node:22-alpine AS development

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci

# Copy source
COPY . .

# Expose Vite dev port
EXPOSE 3000

# Start dev server
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]

# ========================================
# Stage: Build
# ========================================
FROM node:22-alpine AS build

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci

# Copy source
COPY . .

# Build args for environment variables
ARG VITE_BACKEND_URL
ENV VITE_BACKEND_URL=${VITE_BACKEND_URL}

# Build the application
RUN npm run build

# ========================================
# Stage: Production
# ========================================
FROM nginx:alpine AS production

# Copy custom nginx config
COPY --from=build /app/dist /usr/share/nginx/html

# Create nginx config for SPA with API proxy
# Note: X-Forwarded-Proto is passed from Traefik, not redefined here
RUN echo 'server { \
    listen 80; \
    location / { \
        root /usr/share/nginx/html; \
        index index.html; \
        try_files $uri $uri/ /index.html; \
    } \
    location /api/ { \
        proxy_pass http://forestmanager-backend:3001/api/; \
        proxy_http_version 1.1; \
        proxy_set_header Host $host; \
        proxy_set_header X-Real-IP $remote_addr; \
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for; \
        proxy_set_header X-Forwarded-Proto $http_x_forwarded_proto; \
        proxy_set_header X-Forwarded-Host $host; \
    } \
}' > /etc/nginx/conf.d/default.conf

# Install wget for health checks
RUN apk add --no-cache wget

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
