# Multi-stage Dockerfile for Learning Assistant Backup Services
# Optimized for production backup operations with security and performance
# Version: 2.0.0

# Base stage with common dependencies
FROM ubuntu:22.04 AS base

# Set environment variables
ENV DEBIAN_FRONTEND=noninteractive
ENV TZ=UTC
ENV BACKUP_USER=backup
ENV BACKUP_UID=1001
ENV BACKUP_GID=1001

# Install base packages and security updates
RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates \
    curl \
    wget \
    gnupg \
    lsb-release \
    software-properties-common \
    apt-transport-https \
    && rm -rf /var/lib/apt/lists/*

# Add PostgreSQL official APT repository
RUN curl -fsSL https://www.postgresql.org/media/keys/ACCC4CF8.asc | gpg --dearmor -o /usr/share/keyrings/postgresql-keyring.gpg \
    && echo "deb [signed-by=/usr/share/keyrings/postgresql-keyring.gpg] http://apt.postgresql.org/pub/repos/apt $(lsb_release -cs)-pgdg main" > /etc/apt/sources.list.d/postgresql.list

# Add Node.js official repository
RUN curl -fsSL https://deb.nodesource.com/setup_18.x | bash -

# Install backup tools and dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    # Database tools
    postgresql-client-15 \
    postgresql-contrib-15 \
    redis-tools \
    # Compression and archiving
    gzip \
    bzip2 \
    xz-utils \
    pigz \
    tar \
    # Encryption and security
    openssl \
    gnupg2 \
    # Network and transfer tools
    rsync \
    openssh-client \
    # Monitoring and system tools
    htop \
    iotop \
    nethogs \
    jq \
    # Cloud CLI tools dependencies
    python3 \
    python3-pip \
    python3-venv \
    # Node.js for monitoring scripts
    nodejs \
    # Additional utilities
    cron \
    logrotate \
    supervisor \
    && rm -rf /var/lib/apt/lists/*

# Cloud CLI installation stage
FROM base AS cloud-tools

# Install AWS CLI v2
RUN curl "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o "awscliv2.zip" \
    && unzip awscliv2.zip \
    && ./aws/install \
    && rm -rf aws awscliv2.zip

# Install Azure CLI
RUN curl -sL https://aka.ms/InstallAzureCLIDeb | bash

# Install Google Cloud SDK
RUN echo "deb [signed-by=/usr/share/keyrings/cloud.google.gpg] https://packages.cloud.google.com/apt cloud-sdk main" > /etc/apt/sources.list.d/google-cloud-sdk.list \
    && curl https://packages.cloud.google.com/apt/doc/apt-key.gpg | gpg --dearmor -o /usr/share/keyrings/cloud.google.gpg \
    && apt-get update \
    && apt-get install -y google-cloud-sdk \
    && rm -rf /var/lib/apt/lists/*

# Install additional backup tools via pip
RUN python3 -m pip install --no-cache-dir \
    # Database backup tools
    pg_dump \
    # Cloud storage tools
    boto3 \
    azure-storage-blob \
    google-cloud-storage \
    # Monitoring and alerting
    prometheus-client \
    requests \
    # Configuration management
    pyyaml \
    python-dotenv

# Final production stage
FROM cloud-tools AS production

# Create backup user and group
RUN groupadd -g ${BACKUP_GID} ${BACKUP_USER} \
    && useradd -r -u ${BACKUP_UID} -g ${BACKUP_USER} -d /home/${BACKUP_USER} -s /bin/bash -c "Backup Service User" ${BACKUP_USER} \
    && mkdir -p /home/${BACKUP_USER} \
    && chown ${BACKUP_USER}:${BACKUP_USER} /home/${BACKUP_USER}

# Create directory structure
RUN mkdir -p \
    /var/backups/learning-assistant \
    /var/log/backup \
    /etc/backup \
    /opt/backup/scripts \
    /opt/backup/config \
    /opt/backup/tools \
    /tmp/backup-workspace \
    && chown -R ${BACKUP_USER}:${BACKUP_USER} \
        /var/backups/learning-assistant \
        /var/log/backup \
        /etc/backup \
        /opt/backup \
        /tmp/backup-workspace

# Copy backup scripts and configurations
COPY --chown=${BACKUP_USER}:${BACKUP_USER} scripts/backup/ /opt/backup/scripts/
COPY --chown=${BACKUP_USER}:${BACKUP_USER} scripts/recovery/ /opt/backup/scripts/recovery/
COPY --chown=${BACKUP_USER}:${BACKUP_USER} deploy/backup-config/ /opt/backup/config/

# Copy backup monitoring application
COPY --chown=${BACKUP_USER}:${BACKUP_USER} src/lib/backup-monitor.ts /opt/backup/tools/
COPY --chown=${BACKUP_USER}:${BACKUP_USER} package*.json /opt/backup/tools/

# Install Node.js dependencies for monitoring
WORKDIR /opt/backup/tools
RUN npm ci --only=production && npm cache clean --force

# Create supervisor configuration for backup services
COPY docker/backup/supervisord.conf /etc/supervisor/conf.d/backup.conf

# Create backup service entrypoint script
COPY docker/backup/entrypoint.sh /opt/backup/entrypoint.sh
RUN chmod +x /opt/backup/entrypoint.sh

# Create backup health check script
COPY docker/backup/healthcheck.sh /opt/backup/healthcheck.sh
RUN chmod +x /opt/backup/healthcheck.sh

# Create cron configuration for scheduled backups
COPY docker/backup/backup-cron /etc/cron.d/backup-schedule
RUN chmod 0644 /etc/cron.d/backup-schedule && crontab -u ${BACKUP_USER} /etc/cron.d/backup-schedule

# Set up log rotation
COPY docker/backup/backup-logrotate /etc/logrotate.d/backup
RUN chmod 644 /etc/logrotate.d/backup

# Configure backup environment variables
ENV BACKUP_DIR=/var/backups/learning-assistant
ENV LOG_DIR=/var/log/backup
ENV CONFIG_DIR=/opt/backup/config
ENV SCRIPTS_DIR=/opt/backup/scripts
ENV TOOLS_DIR=/opt/backup/tools
ENV WORKSPACE_DIR=/tmp/backup-workspace

# Default backup configuration
ENV BACKUP_SCHEDULE="0 2 * * *"
ENV RETENTION_DAYS=30
ENV RETENTION_MONTHS=12
ENV COMPRESSION_LEVEL=6
ENV ENCRYPTION_ENABLED=true
ENV PARALLEL_JOBS=4
ENV MONITORING_ENABLED=true
ENV NOTIFICATION_ENABLED=true

# Cloud storage configuration
ENV S3_BUCKET=""
ENV S3_PREFIX="backups/"
ENV AZURE_CONTAINER=""
ENV GCS_BUCKET=""

# Database configuration
ENV DB_HOST=localhost
ENV DB_PORT=5432
ENV DB_NAME=learning_assistant_db
ENV DB_USER=learning_user
ENV DB_PASSWORD=""

# Monitoring configuration
ENV MONITORING_INTERVAL=300
ENV HEALTH_CHECK_INTERVAL=900
ENV SLACK_WEBHOOK=""
ENV DISCORD_WEBHOOK=""
ENV EMAIL_ALERTS=""
ENV PAGERDUTY_INTEGRATION_KEY=""

# Security configuration
ENV ENCRYPTION_KEY_FILE=/etc/backup/encryption.key
ENV ACCESS_LOG_ENABLED=true
ENV AUDIT_LOG_ENABLED=true

# Performance configuration
ENV MAX_PARALLEL_TRANSFERS=4
ENV BACKUP_TIMEOUT=7200
ENV TRANSFER_TIMEOUT=3600
ENV BANDWIDTH_LIMIT="100M"

# Set working directory
WORKDIR /opt/backup

# Switch to backup user
USER ${BACKUP_USER}

# Health check configuration
HEALTHCHECK --interval=5m --timeout=30s --start-period=1m --retries=3 \
    CMD /opt/backup/healthcheck.sh

# Expose monitoring port (if needed)
EXPOSE 9090

# Volume definitions
VOLUME ["/var/backups/learning-assistant", "/var/log/backup", "/etc/backup"]

# Labels for container metadata
LABEL maintainer="Learning Assistant Team"
LABEL version="2.0.0"
LABEL description="Comprehensive backup and disaster recovery service for Learning Assistant"
LABEL org.opencontainers.image.title="Learning Assistant Backup Service"
LABEL org.opencontainers.image.description="Production-ready backup service with monitoring, encryption, and multi-cloud support"
LABEL org.opencontainers.image.version="2.0.0"
LABEL org.opencontainers.image.created="$(date -u +'%Y-%m-%dT%H:%M:%SZ')"
LABEL org.opencontainers.image.source="https://github.com/learning-assistant/backup"
LABEL org.opencontainers.image.licenses="MIT"

# Set entrypoint
ENTRYPOINT ["/opt/backup/entrypoint.sh"]
CMD ["backup-service"]
