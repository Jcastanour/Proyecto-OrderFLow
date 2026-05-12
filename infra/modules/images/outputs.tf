################################################################
# modules/images/outputs.tf
# Los consume:
#   - el módulo compute → para que products_handler liste el bucket
#   - el workflow GitHub Actions → para hacer `aws s3 sync`
################################################################

output "images_bucket_name" {
  description = "Nombre del bucket de imágenes de productos."
  value       = aws_s3_bucket.products_images_bucket.id
}

output "images_bucket_arn" {
  description = "ARN del bucket (para permisos IAM en compute)."
  value       = aws_s3_bucket.products_images_bucket.arn
}

output "images_bucket_url" {
  description = "URL base pública del bucket. Concatenar con la key del objeto."
  value       = "https://${aws_s3_bucket.products_images_bucket.bucket_regional_domain_name}"
}

output "images_bucket_regional_domain" {
  description = "Dominio regional (sin esquema). Útil para CloudFront futuro."
  value       = aws_s3_bucket.products_images_bucket.bucket_regional_domain_name
}
