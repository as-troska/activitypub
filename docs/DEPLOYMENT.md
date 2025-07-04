# 🚀 Deployment Guide

This guide covers deploying the Sneaas.no ActivityPub server in various environments, from development to production.

## 📋 Table of Contents

- [Prerequisites](#prerequisites)
- [Development Setup](#development-setup)
- [Production Deployment](#production-deployment)
- [Docker Deployment](#docker-deployment)
- [Nginx Configuration](#nginx-configuration)
- [SSL/TLS Setup](#ssltls-setup)
- [Monitoring & Logging](#monitoring--logging)
- [Backup & Recovery](#backup--recovery)
- [Troubleshooting](#troubleshooting)

## 📋 Prerequisites

### System Requirements

**Minimum:**
- Node.js 18.0+
- MongoDB 6.0+
- 1GB RAM
- 10GB storage
- Linux/macOS/Windows

**Recommended:**
- Node.js 20.0+
- MongoDB 7.0+
- 4GB RAM
- 50GB storage
- Ubuntu 22.04 LTS

### Domain Requirements

ActivityPub **requires** HTTPS and a proper domain name. You cannot run this in production without:
- A registered domain name
- SSL/TLS certificate (Let's Encrypt recommended)
- DNS properly configured

## 🛠️ Development Setup

### Local Development

1. **Clone and Install**
```bash
git clone https://github.com/as-troska/activitypub.git
cd activitypub
npm install
```

2. **Set Up MongoDB**
```bash
# Ubuntu/Debian
sudo apt install mongodb

# macOS with Homebrew
brew install mongodb-community

# Start MongoDB
sudo systemctl start mongod  # Linux
brew services start mongodb-community  # macOS
```

3. **Create Environment File**
```bash
cp .env.example .env
```

Edit `.env`:
```env
# Development settings
NODE_ENV=development
MONGOURI=mongodb://localhost:27017/activitypub
PASSWORD=dev-password-change-me
LOG_LEVEL=debug
PORT=1814
```

4. **Generate Keys** (Required for ActivityPub)
```bash
# Create keys directory
mkdir -p keys

# Generate RSA key pair
openssl genrsa -out keys/private.pem 2048
openssl rsa -in keys/private.pem -pubout -out keys/public.pem
```

5. **Start Development Server**
```bash
npm run dev
```

Your server will be available at `http://localhost:1814`

### Testing Setup

```bash
# Run all tests
npm test

# Run tests with coverage
npm run test:coverage

# Run tests in watch mode
npm run test:watch
```

## 🌍 Production Deployment

### Server Setup

1. **Create User**
```bash
sudo adduser activitypub
sudo usermod -aG sudo activitypub
su - activitypub
```

2. **Install Node.js**
```bash
# Using NodeSource repository
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs
```

3. **Install MongoDB**
```bash
# Import MongoDB public key
wget -qO - https://www.mongodb.org/static/pgp/server-7.0.asc | sudo apt-key add -

# Create list file
echo "deb [ arch=amd64,arm64 ] https://repo.mongodb.org/apt/ubuntu jammy/mongodb-org/7.0 multiverse" | sudo tee /etc/apt/sources.list.d/mongodb-org-7.0.list

# Install MongoDB
sudo apt-get update
sudo apt-get install -y mongodb-org

# Start and enable MongoDB
sudo systemctl start mongod
sudo systemctl enable mongod
```

4. **Secure MongoDB**
```bash
# Connect to MongoDB
mongosh

# Create admin user
use admin
db.createUser({
  user: "admin",
  pwd: "strong-password-here",
  roles: ["userAdminAnyDatabase", "dbAdminAnyDatabase", "readWriteAnyDatabase"]
})

# Create application user
use activitypub
db.createUser({
  user: "activitypub",
  pwd: "another-strong-password",
  roles: ["readWrite"]
})
```

5. **Deploy Application**
```bash
# Clone repository
git clone https://github.com/as-troska/activitypub.git
cd activitypub

# Install dependencies
npm ci --only=production

# Create environment file
cp .env.example .env
```

Edit production `.env`:
```env
NODE_ENV=production
MONGOURI=mongodb://activitypub:password@localhost:27017/activitypub
PASSWORD=super-secure-production-password
LOG_LEVEL=info
PORT=1814
```

6. **Generate Production Keys**
```bash
mkdir -p keys
openssl genrsa -out keys/private.pem 4096
openssl rsa -in keys/private.pem -pubout -out keys/public.pem
chmod 600 keys/private.pem
chmod 644 keys/public.pem
```

### Process Management with PM2

1. **Install PM2**
```bash
sudo npm install -g pm2
```

2. **Create PM2 Configuration**
Create `ecosystem.config.js`:
```javascript
module.exports = {
  apps: [{
    name: 'activitypub',
    script: 'app.js',
    instances: 'max',
    exec_mode: 'cluster',
    env: {
      NODE_ENV: 'production',
      PORT: 1814
    },
    error_file: './logs/pm2-error.log',
    out_file: './logs/pm2-out.log',
    log_file: './logs/pm2-combined.log',
    time: true,
    max_memory_restart: '1G',
    restart_delay: 4000
  }]
};
```

3. **Start Application**
```bash
# Start with PM2
pm2 start ecosystem.config.js

# Save PM2 configuration
pm2 save

# Set up PM2 to start on boot
pm2 startup
sudo env PATH=$PATH:/usr/bin /usr/lib/node_modules/pm2/bin/pm2 startup systemd -u activitypub --hp /home/activitypub
```

## 🐳 Docker Deployment

### Dockerfile

Create `Dockerfile`:
```dockerfile
FROM node:20-alpine

# Install OpenSSL for key generation
RUN apk add --no-cache openssl

# Create app directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy application code
COPY . .

# Create directories
RUN mkdir -p logs keys

# Generate keys if they don't exist
RUN if [ ! -f keys/private.pem ]; then \
    openssl genrsa -out keys/private.pem 2048 && \
    openssl rsa -in keys/private.pem -pubout -out keys/public.pem; \
  fi

# Create non-root user
RUN addgroup -g 1001 -S nodejs
RUN adduser -S nodejs -u 1001

# Change ownership
RUN chown -R nodejs:nodejs /app
USER nodejs

# Expose port
EXPOSE 1814

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').request('http://localhost:1814/.well-known/nodeinfo', (res) => { process.exit(res.statusCode === 200 ? 0 : 1) }).end()"

# Start application
CMD ["npm", "start"]
```

### Docker Compose

Create `docker-compose.yml`:
```yaml
version: '3.8'

services:
  mongodb:
    image: mongo:7.0
    container_name: activitypub-mongo
    restart: unless-stopped
    environment:
      MONGO_INITDB_ROOT_USERNAME: admin
      MONGO_INITDB_ROOT_PASSWORD: ${MONGO_ROOT_PASSWORD}
      MONGO_INITDB_DATABASE: activitypub
    volumes:
      - mongodb_data:/data/db
      - ./mongo-init.js:/docker-entrypoint-initdb.d/mongo-init.js:ro
    networks:
      - activitypub-network

  app:
    build: .
    container_name: activitypub-app
    restart: unless-stopped
    depends_on:
      - mongodb
    environment:
      NODE_ENV: production
      MONGOURI: mongodb://activitypub:${MONGO_APP_PASSWORD}@mongodb:27017/activitypub
      PASSWORD: ${APP_PASSWORD}
      LOG_LEVEL: info
    volumes:
      - ./logs:/app/logs
      - ./keys:/app/keys
    ports:
      - "1814:1814"
    networks:
      - activitypub-network

volumes:
  mongodb_data:

networks:
  activitypub-network:
    driver: bridge
```

Create `.env` for Docker:
```env
MONGO_ROOT_PASSWORD=super-secure-root-password
MONGO_APP_PASSWORD=secure-app-password
APP_PASSWORD=your-application-password
```

Create `mongo-init.js`:
```javascript
db.createUser({
  user: 'activitypub',
  pwd: process.env.MONGO_APP_PASSWORD,
  roles: [
    {
      role: 'readWrite',
      db: 'activitypub'
    }
  ]
});
```

### Deploy with Docker

```bash
# Build and start
docker-compose up -d

# View logs
docker-compose logs -f

# Stop
docker-compose down
```

## 🌐 Nginx Configuration

### Basic Nginx Setup

Install Nginx:
```bash
sudo apt install nginx
```

Create `/etc/nginx/sites-available/activitypub`:
```nginx
server {
    listen 80;
    server_name yourdomain.com www.yourdomain.com;

    # Redirect to HTTPS
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name yourdomain.com www.yourdomain.com;

    # SSL Configuration
    ssl_certificate /etc/letsencrypt/live/yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/yourdomain.com/privkey.pem;
    
    ssl_session_timeout 1d;
    ssl_session_cache shared:MozTLS:10m;
    ssl_session_tickets off;
    
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384;
    ssl_prefer_server_ciphers off;
    
    # HSTS
    add_header Strict-Transport-Security "max-age=63072000" always;
    
    # Security headers
    add_header X-Frame-Options DENY;
    add_header X-Content-Type-Options nosniff;
    add_header X-XSS-Protection "1; mode=block";
    add_header Referrer-Policy "strict-origin-when-cross-origin";
    
    # Logging
    access_log /var/log/nginx/activitypub.access.log;
    error_log /var/log/nginx/activitypub.error.log;

    # Proxy to Node.js application
    location / {
        proxy_pass http://127.0.0.1:1814;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        
        # Timeouts
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }
    
    # Well-known paths (for ActivityPub)
    location /.well-known/ {
        proxy_pass http://127.0.0.1:1814;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # Cache well-known responses
        proxy_cache_valid 200 1h;
        add_header X-Cache-Status $upstream_cache_status;
    }
}
```

Enable the site:
```bash
sudo ln -s /etc/nginx/sites-available/activitypub /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

## 🔒 SSL/TLS Setup

### Using Let's Encrypt

1. **Install Certbot**
```bash
sudo apt install certbot python3-certbot-nginx
```

2. **Obtain Certificate**
```bash
sudo certbot --nginx -d yourdomain.com -d www.yourdomain.com
```

3. **Auto-renewal**
```bash
# Test renewal
sudo certbot renew --dry-run

# Set up auto-renewal
echo "0 12 * * * /usr/bin/certbot renew --quiet" | sudo tee -a /etc/crontab > /dev/null
```

## 📊 Monitoring & Logging

### Log Monitoring

Set up log rotation for application logs:

Create `/etc/logrotate.d/activitypub`:
```
/home/activitypub/activitypub/logs/*.log {
    daily
    missingok
    rotate 30
    compress
    delaycompress
    notifempty
    create 0644 activitypub activitypub
    postrotate
        pm2 reload activitypub
    endscript
}
```

### System Monitoring

1. **Install monitoring tools**
```bash
sudo apt install htop iotop nethogs
```

2. **Monitor PM2 processes**
```bash
pm2 monit
pm2 status
pm2 logs
```

3. **Monitor MongoDB**
```bash
# MongoDB logs
sudo tail -f /var/log/mongodb/mongod.log

# MongoDB status
mongosh --eval "db.serverStatus()"
```

### Health Checks

Create a health check endpoint by adding to your application:

```javascript
// Add to app.js
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    mongodb: 'connected' // Add actual MongoDB health check
  });
});
```

Set up monitoring with cron:
```bash
# Check health every 5 minutes
*/5 * * * * curl -f http://localhost:1814/health || echo "Health check failed" | mail -s "ActivityPub Server Down" admin@yourdomain.com
```

## 💾 Backup & Recovery

### Database Backup

Create backup script `/home/activitypub/backup.sh`:
```bash
#!/bin/bash

BACKUP_DIR="/home/activitypub/backups"
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_NAME="activitypub_backup_$DATE"

# Create backup directory
mkdir -p $BACKUP_DIR

# Backup MongoDB
mongodump --db activitypub --out $BACKUP_DIR/$BACKUP_NAME

# Backup application files
tar -czf $BACKUP_DIR/${BACKUP_NAME}_app.tar.gz \
    --exclude=node_modules \
    --exclude=logs \
    /home/activitypub/activitypub/

# Remove backups older than 30 days
find $BACKUP_DIR -name "activitypub_backup_*" -mtime +30 -exec rm -rf {} \;

echo "Backup completed: $BACKUP_NAME"
```

Make executable and schedule:
```bash
chmod +x /home/activitypub/backup.sh

# Add to crontab (daily at 2 AM)
echo "0 2 * * * /home/activitypub/backup.sh" | crontab -
```

### Recovery Process

1. **Stop application**
```bash
pm2 stop activitypub
```

2. **Restore database**
```bash
mongorestore --db activitypub /path/to/backup/activitypub
```

3. **Restore application files**
```bash
cd /home/activitypub
tar -xzf backup_app.tar.gz
```

4. **Restart application**
```bash
pm2 start activitypub
```

## 🔧 Troubleshooting

### Common Issues

#### MongoDB Connection Issues
```bash
# Check MongoDB status
sudo systemctl status mongod

# Check MongoDB logs
sudo tail -f /var/log/mongodb/mongod.log

# Test connection
mongosh "mongodb://localhost:27017/activitypub"
```

#### Application Won't Start
```bash
# Check PM2 logs
pm2 logs activitypub

# Check environment variables
pm2 show activitypub

# Restart application
pm2 restart activitypub
```

#### SSL/HTTPS Issues
```bash
# Test SSL configuration
openssl s_client -connect yourdomain.com:443

# Check certificate status
sudo certbot certificates

# Test Nginx configuration
sudo nginx -t
```

#### High Memory Usage
```bash
# Monitor memory usage
pm2 monit

# Check for memory leaks
pm2 reload activitypub

# Adjust PM2 memory limits
pm2 start ecosystem.config.js --max-memory-restart 500M
```

### Performance Optimization

1. **Enable MongoDB indexing**
```javascript
// Connect to MongoDB and create indexes
use activitypub

// Index on followers collection
db.followers.createIndex({ "id": 1 })
db.followers.createIndex({ "preferredUsername": 1 })

// Index on activities
db.create.createIndex({ "published": -1 })
db.create.createIndex({ "actor": 1 })
db.create.createIndex({ "object.inReplyTo": 1 })
```

2. **Optimize Nginx**
```nginx
# Add to nginx configuration
worker_processes auto;
worker_connections 1024;

# Enable gzip compression
gzip on;
gzip_vary on;
gzip_min_length 1000;
gzip_types text/plain application/json application/ld+json;
```

3. **Node.js Optimization**
```bash
# Set Node.js memory limit
export NODE_OPTIONS="--max-old-space-size=2048"

# Use cluster mode in PM2
pm2 start app.js -i max
```

### Security Hardening

1. **Firewall Configuration**
```bash
# UFW setup
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow ssh
sudo ufw allow 'Nginx Full'
sudo ufw enable
```

2. **SSH Hardening**
```bash
# Edit /etc/ssh/sshd_config
sudo nano /etc/ssh/sshd_config

# Add these lines:
PermitRootLogin no
PasswordAuthentication no
PubkeyAuthentication yes
Port 2222  # Change default port
```

3. **Auto-updates**
```bash
# Install unattended-upgrades
sudo apt install unattended-upgrades

# Configure auto-updates
sudo dpkg-reconfigure unattended-upgrades
```

## 📞 Support

If you encounter issues during deployment:

1. Check the logs first: `pm2 logs activitypub`
2. Verify environment configuration
3. Test database connectivity
4. Check SSL/TLS configuration
5. Review Nginx error logs: `/var/log/nginx/error.log`

For additional help:
- [GitHub Issues](https://github.com/as-troska/activitypub/issues)
- [GitHub Discussions](https://github.com/as-troska/activitypub/discussions)

---

**Remember:** ActivityPub requires HTTPS in production. Do not attempt to run this in production without proper SSL/TLS configuration!