#!/bin/bash
# ECS Optimized AMI User Data Script
# Configures the instance to join the ECS cluster

# Update the system
yum update -y

# Configure ECS agent
echo ECS_CLUSTER=${cluster_name} >> /etc/ecs/ecs.config
echo ECS_BACKEND_HOST= >> /etc/ecs/ecs.config
echo ECS_ENABLE_TASK_IAM_ROLE=true >> /etc/ecs/ecs.config
echo ECS_ENABLE_TASK_IAM_ROLE_NETWORK_HOST=true >> /etc/ecs/ecs.config
echo ECS_LOGFILE=/log/ecs-agent.log >> /etc/ecs/ecs.config
echo ECS_AVAILABLE_LOGGING_DRIVERS='["json-file","awslogs","fluentd","gelf","journald","logentries","splunk","syslog"]' >> /etc/ecs/ecs.config
echo ECS_LOGLEVEL=info >> /etc/ecs/ecs.config

# Configure CloudWatch monitoring
yum install -y amazon-cloudwatch-agent
cat <<EOF > /opt/aws/amazon-cloudwatch-agent/etc/amazon-cloudwatch-agent.json
{
    "agent": {
        "metrics_collection_interval": 60,
        "run_as_user": "cwagent"
    },
    "metrics": {
        "namespace": "CWAgent",
        "metrics_collected": {
            "cpu": {
                "measurement": [
                    "cpu_usage_idle",
                    "cpu_usage_iowait",
                    "cpu_usage_user",
                    "cpu_usage_system"
                ],
                "metrics_collection_interval": 60,
                "totalcpu": false
            },
            "disk": {
                "measurement": [
                    "used_percent"
                ],
                "metrics_collection_interval": 60,
                "resources": [
                    "*"
                ]
            },
            "diskio": {
                "measurement": [
                    "io_time"
                ],
                "metrics_collection_interval": 60,
                "resources": [
                    "*"
                ]
            },
            "mem": {
                "measurement": [
                    "mem_used_percent"
                ],
                "metrics_collection_interval": 60
            },
            "netstat": {
                "measurement": [
                    "tcp_established",
                    "tcp_time_wait"
                ],
                "metrics_collection_interval": 60
            },
            "swap": {
                "measurement": [
                    "swap_used_percent"
                ],
                "metrics_collection_interval": 60
            }
        }
    },
    "logs": {
        "logs_collected": {
            "files": {
                "collect_list": [
                    {
                        "file_path": "/var/log/ecs/ecs-agent.log",
                        "log_group_name": "/ecs/${cluster_name}/agent",
                        "log_stream_name": "{instance_id}"
                    },
                    {
                        "file_path": "/var/log/messages",
                        "log_group_name": "/ecs/${cluster_name}/system",
                        "log_stream_name": "{instance_id}"
                    }
                ]
            }
        }
    }
}
EOF

# Start CloudWatch agent
/opt/aws/amazon-cloudwatch-agent/bin/amazon-cloudwatch-agent-ctl -a fetch-config -m ec2 -c file:/opt/aws/amazon-cloudwatch-agent/etc/amazon-cloudwatch-agent.json -s

# Install Docker Compose (for local development)
curl -L "https://github.com/docker/compose/releases/download/1.29.2/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
chmod +x /usr/local/bin/docker-compose

# Install SSM agent for remote access
yum install -y amazon-ssm-agent
systemctl enable amazon-ssm-agent
systemctl start amazon-ssm-agent

# Configure log rotation
cat <<EOF > /etc/logrotate.d/ecs
/var/log/ecs/*.log {
    daily
    rotate 7
    compress
    delaycompress
    missingok
    notifempty
    create 644 root root
}
EOF

# Set up custom metrics script
cat <<EOF > /usr/local/bin/ecs-custom-metrics.sh
#!/bin/bash
# Custom metrics collection for ECS instances

INSTANCE_ID=\$(curl -s http://169.254.169.254/latest/meta-data/instance-id)
REGION=\$(curl -s http://169.254.169.254/latest/meta-data/placement/region)

# Get ECS cluster name
CLUSTER_NAME=\$(curl -s http://localhost:51678/v1/metadata | jq -r .Cluster)

# Get container statistics
CONTAINER_STATS=\$(curl -s http://localhost:51678/v1/stats)

# Calculate custom metrics
RUNNING_TASKS=\$(echo "\$CONTAINER_STATS" | jq 'length')
TOTAL_CPU=\$(echo "\$CONTAINER_STATS" | jq '[.[] | .cpu.usage.total] | add // 0')
TOTAL_MEMORY=\$(echo "\$CONTAINER_STATS" | jq '[.[] | .memory.usage] | add // 0')

# Send metrics to CloudWatch
aws cloudwatch put-metric-data --region "\$REGION" --namespace "ECS/Custom" --metric-data \
    MetricName=RunningTasks,Value=\$RUNNING_TASKS,Unit=Count,Dimensions=InstanceId=\$INSTANCE_ID,ClusterName=\$CLUSTER_NAME \
    MetricName=TotalCPUUsage,Value=\$TOTAL_CPU,Unit=Percent,Dimensions=InstanceId=\$INSTANCE_ID,ClusterName=\$CLUSTER_NAME \
    MetricName=TotalMemoryUsage,Value=\$TOTAL_MEMORY,Unit=Bytes,Dimensions=InstanceId=\$INSTANCE_ID,ClusterName=\$CLUSTER_NAME
EOF

chmod +x /usr/local/bin/ecs-custom-metrics.sh

# Set up cron job for custom metrics
echo "*/5 * * * * /usr/local/bin/ecs-custom-metrics.sh" | crontab -

# Configure Docker daemon for better performance
cat <<EOF > /etc/docker/daemon.json
{
    "log-driver": "awslogs",
    "log-opts": {
        "awslogs-group": "/ecs/${cluster_name}",
        "awslogs-region": "$(curl -s http://169.254.169.254/latest/meta-data/placement/region)"
    },
    "storage-driver": "overlay2",
    "storage-opts": [
        "overlay2.override_kernel_check=true"
    ],
    "max-concurrent-downloads": 3,
    "max-concurrent-uploads": 3,
    "default-ulimits": {
        "nofile": {
            "name": "nofile",
            "hard": 65536,
            "soft": 65536
        }
    }
}
EOF

# Restart Docker to apply new configuration
systemctl restart docker

# Wait for Docker to be ready
while ! docker info >/dev/null 2>&1; do
    echo "Waiting for Docker to be ready..."
    sleep 5
done

# Start ECS agent
systemctl enable ecs
systemctl start ecs

# Signal CloudFormation that the instance is ready (if using CloudFormation)
# Note: This would typically use cfn-signal, but we're using Terraform
# Instead, we'll create a simple health check file
echo "Instance initialized successfully at $(date)" > /var/log/ecs-init-complete

# Additional security hardening
# Disable unused services
systemctl disable rpcbind
systemctl stop rpcbind

# Configure iptables for better security
iptables -A INPUT -m state --state ESTABLISHED,RELATED -j ACCEPT
iptables -A INPUT -p tcp --dport 22 -j ACCEPT
iptables -A INPUT -p tcp --dport 80 -j ACCEPT
iptables -A INPUT -p tcp --dport 443 -j ACCEPT
iptables -A INPUT -i lo -j ACCEPT
iptables -A INPUT -j DROP

# Save iptables rules
service iptables save

# Configure system limits for containers
echo "fs.file-max = 65536" >> /etc/sysctl.conf
echo "net.core.somaxconn = 65536" >> /etc/sysctl.conf
echo "net.ipv4.tcp_max_syn_backlog = 65536" >> /etc/sysctl.conf
sysctl -p

# Set up log forwarding for centralized logging
if command -v fluent-bit >/dev/null 2>&1; then
    cat <<EOF > /etc/fluent-bit/fluent-bit.conf
[SERVICE]
    Flush         1
    Log_Level     info
    Daemon        off
    Parsers_File  parsers.conf

[INPUT]
    Name              tail
    Path              /var/log/ecs/*.log
    Parser            docker
    Tag               ecs.*
    Refresh_Interval  5

[OUTPUT]
    Name  cloudwatch_logs
    Match *
    region $(curl -s http://169.254.169.254/latest/meta-data/placement/region)
    log_group_name /ecs/${cluster_name}/fluent-bit
    log_stream_prefix ecs-
    auto_create_group true
EOF
    
    systemctl enable fluent-bit
    systemctl start fluent-bit
fi

echo "ECS instance configuration completed successfully"