output "site_url" {
  description = "URL pública del sitio (HTTP, vía S3 website endpoint)."
  value       = "http://${aws_s3_bucket_website_configuration.frontend_site_website.website_endpoint}"
}

output "frontend_bucket_name" {
  description = "Nombre del bucket S3 que aloja el sitio."
  value       = aws_s3_bucket.frontend_site_bucket.id
}
