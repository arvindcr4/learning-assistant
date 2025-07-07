# AWS CloudFront
module "aws_cloudfront" {
  source = "./aws"
  count  = var.cloud_provider == "aws" ? 1 : 0

  comment                = var.name
  origin_domain_name     = var.origin_domain_name
  origin_protocol_policy = var.origin_protocol
  origin_path           = var.origin_path
  aliases               = var.custom_domain_names
  viewer_certificate_arn = var.certificate_arn
  price_class           = var.price_class
  default_root_object   = var.default_root_object
  compress              = var.enable_compression
  viewer_protocol_policy = var.viewer_protocol_policy
  allowed_methods       = var.allowed_methods
  cached_methods        = var.cached_methods
  default_ttl           = var.default_ttl
  max_ttl               = var.max_ttl
  min_ttl               = var.min_ttl
  geo_restriction_type  = var.geo_restriction_type
  geo_restriction_locations = var.geo_restriction_locations
  logging_enabled       = var.enable_logging
  logging_bucket        = var.log_bucket
  web_acl_id           = var.waf_acl_id
  custom_error_responses = var.custom_error_responses
  tags                  = var.tags
}

# GCP Cloud CDN
module "gcp_cloud_cdn" {
  source = "./gcp"
  count  = var.cloud_provider == "gcp" ? 1 : 0

  name                  = var.name
  origin_domain_name    = var.origin_domain_name
  enable_cdn           = true
  compression_mode     = var.enable_compression ? "AUTOMATIC" : "DISABLED"
  cache_mode           = "CACHE_ALL_STATIC"
  default_ttl          = var.default_ttl
  max_ttl              = var.max_ttl
  negative_caching     = true
  serve_while_stale    = 86400
  ssl_certificates     = var.certificate_arn != "" ? [var.certificate_arn] : []
  cdn_policy = {
    cache_key_policy = {
      include_host        = true
      include_protocol    = true
      include_query_string = false
    }
  }
}

# Azure CDN
module "azure_cdn" {
  source = "./azure"
  count  = var.cloud_provider == "azure" ? 1 : 0

  profile_name          = "${var.name}-profile"
  endpoint_name         = var.name
  origin_host_header    = var.origin_domain_name
  origin_path          = var.origin_path
  optimization_type    = "GeneralWebDelivery"
  compression_enabled  = var.enable_compression
  content_types_to_compress = ["text/html", "text/css", "application/javascript"]
  is_http_allowed      = var.viewer_protocol_policy == "allow-all"
  is_https_allowed     = true
  tags                 = var.tags
}

# DigitalOcean CDN
module "do_cdn" {
  source = "./digitalocean"
  count  = var.cloud_provider == "digitalocean" ? 1 : 0

  origin               = var.origin_domain_name
  custom_domain        = length(var.custom_domain_names) > 0 ? var.custom_domain_names[0] : ""
  certificate_id       = var.certificate_arn
  ttl                  = var.default_ttl
}
