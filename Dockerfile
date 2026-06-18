# NEXO Landing Page Creator v3.0 - Production Dockerfile
# Builds the Svelte frontend and serves everything from the Node/Express backend.

FROM node:20-slim

# Install Chrome dependencies + Chrome for the Kimi bridge
RUN apt-get update && apt-get install -y \
    wget \
    gnupg \
    ca-certificates \
    fonts-liberation \
    libappindicator3-1 \
    libasound2 \
    libatk-bridge2.0-0 \
    libatk1.0-0 \
    libc6 \
    libcairo2 \
    libcups2 \
    libdbus-1-3 \
    libexpat1 \
    libfontconfig1 \
    libgbm1 \
    libgcc1 \
    libglib2.0-0 \
    libgtk-3-0 \
    libnspr4 \
    libnss3 \
    libpango-1.0-0 \
    libpangocairo-1.0-0 \
    libstdc++6 \
    libx11-6 \
    libx11-xcb1 \
    libxcb1 \
    libxcomposite1 \
    libxcursor1 \
    libxdamage1 \
    libxext6 \
    libxfixes3 \
    libxi6 \
    libxrandr2 \
    libxrender1 \
    libxss1 \
    libxtst6 \
    lsb-release \
    xdg-utils \
    --no-install-recommends \
    && wget -q -O - https://dl-ssl.google.com/linux/linux_signing_key.pub | apt-key add - \
    && echo "deb [arch=amd64] http://dl.google.com/linux/chrome/deb/ stable main" >> /etc/apt/sources.list.d/google.list \
    && apt-get update \
    && apt-get install -y google-chrome-stable --no-install-recommends \
    && rm -rf /var/lib/apt/lists/*

# Tell Puppeteer/Playwright where Chrome is
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/google-chrome-stable
ENV PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/google-chrome-stable

WORKDIR /app

# Copy root package files and install root deps
COPY package.json ./
RUN npm install --production=false

# Copy frontend package files and install frontend deps
COPY nexo-lp-web/package.json ./nexo-lp-web/
RUN cd nexo-lp-web && npm install --production=false

# Copy source code
COPY . .

# Build frontend
RUN cd nexo-lp-web && npm run build

# Ensure runtime directories exist
RUN mkdir -p data logs uploads

# Expose the port used by the backend
EXPOSE 3460

# Start the backend (serves API + built frontend)
CMD ["node", "nexo-lp-server/nexo-lp-server.js"]
