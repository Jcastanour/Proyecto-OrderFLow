################################################################
# modules/images/main.tf
#
# Bucket S3 PÚBLICO dedicado a imágenes de productos.
# Separado del bucket del sitio para que crezca sin mezclarse.
#
# NO sube archivos. El workflow de GitHub Actions (Etapa H)
# hace `aws s3 sync infra/seed/images/ s3://<bucket>/`.
#
# La Lambda products_handler lista este bucket para resolver
# imageUrl por matching de slug (ver Etapa D).
################################################################

################################################################
# 1) Bucket S3 que aloja las imágenes
################################################################
resource "aws_s3_bucket" "products_images_bucket" {
  bucket = "${var.resource_prefix}-images"
}

# Permitimos policies públicas (las ACLs siguen bloqueadas).
resource "aws_s3_bucket_public_access_block" "products_images_bucket" {
  bucket                  = aws_s3_bucket.products_images_bucket.id
  block_public_acls       = true
  block_public_policy     = false # permite policy pública
  ignore_public_acls      = true
  restrict_public_buckets = false # permite acceso público vía policy
}

# Best practice 2023+: ACLs deshabilitadas, dueño = quien sube.
resource "aws_s3_bucket_ownership_controls" "products_images_bucket" {
  bucket = aws_s3_bucket.products_images_bucket.id

  rule {
    object_ownership = "BucketOwnerEnforced"
  }
}

################################################################
# 2) Bucket policy: lectura pública (s3:GetObject) para CUALQUIERA
################################################################
data "aws_iam_policy_document" "products_images_public_read_doc" {
  statement {
    sid       = "PublicReadGetObject"
    effect    = "Allow"
    actions   = ["s3:GetObject"]
    resources = ["${aws_s3_bucket.products_images_bucket.arn}/*"]

    principals {
      type        = "*"
      identifiers = ["*"]
    }
  }
}

resource "aws_s3_bucket_policy" "products_images_public_read" {
  bucket = aws_s3_bucket.products_images_bucket.id
  policy = data.aws_iam_policy_document.products_images_public_read_doc.json

  depends_on = [aws_s3_bucket_public_access_block.products_images_bucket]
}

################################################################
# 3) CORS: el navegador del cliente carga estas imágenes desde
#    el dominio del sitio (otro origen), así que necesitamos
#    permitir GET cross-origin.
################################################################
resource "aws_s3_bucket_cors_configuration" "products_images_bucket" {
  bucket = aws_s3_bucket.products_images_bucket.id

  cors_rule {
    allowed_methods = ["GET", "HEAD"]
    allowed_origins = ["*"]
    allowed_headers = ["*"]
    max_age_seconds = 3600
  }
}
