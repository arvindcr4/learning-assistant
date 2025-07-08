# ==============================================================================
# GRAFANA CONFIGURATION
# Unified Observability Platform Configuration
# ==============================================================================

[server]
protocol = http
http_port = 3000
domain = grafana.${domain_name}
root_url = https://grafana.${domain_name}/
enforce_domain = false
enable_gzip = true
cert_file = 
cert_key = 
socket = 

[database]
type = postgres
host = postgres.${environment}.svc.cluster.local:5432
name = grafana
user = grafana
password = $__file{/etc/secrets/grafana-db-password}
ssl_mode = require
ca_cert_path = 
client_key_path = 
client_cert_path = 
server_cert_name = 
path = 
max_idle_conn = 2
max_open_conn = 0
conn_max_lifetime = 14400
log_queries = 
isolation_level = 

[remote_cache]
type = redis
connstr = redis.${environment}.svc.cluster.local:6379

[dataproxy]
logging = false
timeout = 30
dial_timeout = 10
keep_alive_seconds = 30

[analytics]
reporting_enabled = false
check_for_updates = false
google_analytics_ua_id = 
google_tag_manager_id = 
rudderstack_write_key = 
rudderstack_data_plane_url = 
rudderstack_sdk_url = 
rudderstack_config_url = 
application_insights_connection_string = 
application_insights_endpoint_url = 

[security]
disable_initial_admin_creation = false
admin_user = admin
admin_password = $__file{/etc/secrets/grafana-admin-password}
admin_email = ${notification_email}
secret_key = $__file{/etc/secrets/grafana-secret-key}
login_remember_days = 7
cookie_username = grafana_user
cookie_remember_name = grafana_remember
disable_gravatar = true
data_source_proxy_whitelist = 
disable_brute_force_login_protection = false
cookie_secure = true
cookie_samesite = lax
allow_embedding = false
strict_transport_security = true
strict_transport_security_max_age_seconds = 86400
strict_transport_security_preload = true
strict_transport_security_subdomains = true
x_content_type_options = true
x_xss_protection = true
content_security_policy = true
content_security_policy_template = """script-src 'self' 'unsafe-eval' 'unsafe-inline' 'strict-dynamic' $NONCE;object-src 'none';font-src 'self';style-src 'self' 'unsafe-inline' blob:;img-src * data:;base-uri 'self';connect-src 'self' grafana.com ws://localhost:3000 wss://localhost:3000;manifest-src 'self';media-src 'none';form-action 'self';"""

[snapshots]
external_enabled = true
external_snapshot_url = https://snapshots-origin.raintank.io
external_snapshot_name = Publish to snapshot.raintank.io
public_mode = false
snapshot_remove_expired = true

[dashboards]
versions_to_keep = 20
default_home_dashboard_path = /var/lib/grafana/dashboards/home.json

[users]
allow_sign_up = false
allow_org_create = false
auto_assign_org = true
auto_assign_org_id = 1
auto_assign_org_role = Viewer
verify_email_enabled = false
login_hint = email or username
password_hint = password
default_theme = dark
external_manage_link_url = 
external_manage_link_name = 
external_manage_info = 
viewers_can_edit = false
editors_can_admin = false
user_invite_max_lifetime_duration = 24h
hidden_users = 

[auth]
login_cookie_name = grafana_session
login_maximum_inactive_lifetime_duration = 
login_maximum_lifetime_duration = 
token_rotation_interval_minutes = 10
disable_login_form = false
disable_signout_menu = false
signout_redirect_url = 
oauth_auto_login = false
oauth_state_cookie_max_age = 60
api_key_max_seconds_to_live = -1
sigv4_auth_enabled = false

[auth.anonymous]
enabled = false
org_name = Main Org.
org_role = Viewer
hide_version = false

[auth.github]
enabled = false
allow_sign_up = false
client_id = 
client_secret = 
scopes = user:email,read:org
auth_url = https://github.com/login/oauth/authorize
token_url = https://github.com/login/oauth/access_token
api_url = https://api.github.com/user
allowed_domains = 
team_ids = 
allowed_organizations = 

[auth.google]
enabled = false
allow_sign_up = false
client_id = 
client_secret = 
scopes = https://www.googleapis.com/auth/userinfo.profile https://www.googleapis.com/auth/userinfo.email
auth_url = https://accounts.google.com/o/oauth2/auth
token_url = https://accounts.google.com/o/oauth2/token
api_url = https://www.googleapis.com/oauth2/v1/userinfo
allowed_domains = 
hosted_domain = 

[auth.azuread]
enabled = false
allow_sign_up = false
client_id = 
client_secret = 
scopes = openid email profile
auth_url = https://login.microsoftonline.com/tenant-id/oauth2/v2.0/authorize
token_url = https://login.microsoftonline.com/tenant-id/oauth2/v2.0/token
allowed_domains = 
allowed_groups = 

[auth.okta]
enabled = false
allow_sign_up = false
client_id = 
client_secret = 
scopes = openid profile email groups
auth_url = https://dev-123456.okta.com/oauth2/v1/authorize
token_url = https://dev-123456.okta.com/oauth2/v1/token
api_url = https://dev-123456.okta.com/oauth2/v1/userinfo
allowed_domains = 
allowed_groups = 

[auth.ldap]
enabled = false
config_file = /etc/grafana/ldap.toml
allow_sign_up = false
sync_cron = "0 0 1 * * *"
active_sync_enabled = false

[auth.proxy]
enabled = false
header_name = X-WEBAUTH-USER
header_property = username
auto_sign_up = false
sync_ttl = 60
whitelist = 
headers = 
headers_encoded = false
enable_login_token = false

[auth.basic]
enabled = true

[auth.jwt]
enabled = false
header_name = 
email_claim = 
username_claim = 
jwk_set_url = 
jwk_set_file = 
cache_ttl = 60m
expected_claims = {}
key_file = 
role_attribute_path = 
role_attribute_strict = false
auto_sign_up = false
url_login = false
allow_assign_grafana_admin = false
skip_org_role_sync = false

[smtp]
enabled = true
host = smtp.gmail.com:587
user = ${notification_email}
password = $__file{/etc/secrets/smtp-password}
cert_file = 
key_file = 
skip_verify = false
from_address = ${notification_email}
from_name = Grafana
ehlo_identity = 
startTLS_policy = 

[emails]
welcome_email_on_sign_up = false
templates_pattern = emails/*.html, emails/*.txt
content_types = text/html

[log]
mode = console
level = info
filters = 
format = console

[log.console]
level = 
format = console

[log.file]
level = 
format = text
log_rotate = true
max_lines = 1000000
max_size_shift = 28
daily_rotate = true
max_days = 7

[log.syslog]
level = 
format = text
network = 
address = 
facility = 
tag = 

[quota]
enabled = false
org_user = 10
org_dashboard = 100
org_data_source = 10
org_api_key = 10
org_alert_rule = 100
user_org = 10
global_user = -1
global_org = -1
global_dashboard = -1
global_api_key = -1
global_session = -1
global_alert_rule = -1

[unified_alerting]
enabled = true
ha_peers = 
ha_listen_address = "0.0.0.0:9094"
ha_advertise_address = 
ha_gossip_interval = 200ms
ha_push_pull_interval = 60s
ha_redis_addr = redis.${environment}.svc.cluster.local:6379
execute_alerts = true
evaluation_timeout = 30s
max_attempts = 3
min_interval = 10s
admin_config_poll_interval = 60s
alertmanager_config_poll_interval = 60s
ha_peer_timeout = 15s
ha_gossip_interval = 200ms
ha_push_pull_interval = 60s
ha_redis_addr = 
disabled_orgs = 
upgrade_on_start = false

[alerting]
enabled = false
execute_alerts = true
error_or_timeout = alerting
nodata_or_nullvalues = no_data
concurrent_render_limit = 5
evaluation_timeout_seconds = 30
notification_timeout_seconds = 30
max_attempts = 3
min_interval_seconds = 1
max_annotation_age = 

[metrics]
enabled = true
interval_seconds = 10
disable_total_stats = false
basic_auth_username = 
basic_auth_password = 
graphite_address = 
graphite_prefix = prod.grafana.%(instance_name)s.

[grafana_net]
url = https://grafana.net

[tracing.jaeger]
address = jaeger-agent.${environment}.svc.cluster.local:6831
always_included_tag = 
sampler_type = const
sampler_param = 1
zipkin_propagation = false
disable_shared_zipkin_spans = false

[tracing.opentelemetry.jaeger]
address = jaeger-collector.${environment}.svc.cluster.local:14268
propagation = jaeger

[external_image_storage]
provider = s3

[external_image_storage.s3]
endpoint = 
bucket = 
region = 
path = 
access_key = 
secret_key = 

[rendering]
server_url = http://grafana-image-renderer.${environment}.svc.cluster.local:8081/render
callback_url = http://grafana.${environment}.svc.cluster.local:3000/
concurrent_render_request_limit = 30
rendering_timeout = 20s
rendering_ignore_https_errors = false

[panels]
enable_alpha = false
disable_sanitize_html = false

[plugins]
enable_alpha = false
app_tls_skip_verify_insecure = false
allow_loading_unsigned_plugins = 
plugin_admin_enabled = true
plugin_admin_external_manage_enabled = false
plugin_catalog_url = https://grafana.com/grafana/plugins/
plugin_catalog_hidden_plugins = 

[plugin.grafana-image-renderer]
rendering_timezone = 
rendering_language = 
rendering_viewport_device_scale_factor = 
rendering_ignore_https_errors = false
rendering_verbose_logging = false
rendering_dumpio = false
rendering_args = 
rendering_chrome_bin = 
rendering_mode = 
rendering_clustering_mode = 
rendering_clustering_max_concurrency = 
rendering_clustering_timeout = 
rendering_viewport_max_width = 
rendering_viewport_max_height = 
rendering_viewport_max_device_scale_factor = 
grpc_host = 
grpc_port = 

[date_formats]
full_date = MMM Do, YYYY
interval_second = HH:mm:ss
interval_minute = HH:mm
interval_hour = MM/DD HH:mm
interval_day = MM/DD
interval_month = YYYY-MM
interval_year = YYYY
use_browser_locale = false
default_timezone = browser

[expressions]
enabled = true