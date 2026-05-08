################################################################
# modules/frontend/main.tf
# - Bucket S3 PÚBLICO con website hosting
# - Sirve los archivos del frontend directamente por HTTP
# - Genera un env.js con la URL del API
#
# Nota: solo HTTP, sin HTTPS (sin CloudFront).
# Para producción real, usar CloudFront. Para estudio, S3 alcanza.
################################################################

################################################################
# 1) Bucket S3 que aloja el sitio
################################################################
resource "aws_s3_bucket" "frontend_site_bucket" {
  bucket = "${var.resource_prefix}-frontend"
}

# Permitimos políticas públicas (necesario porque haremos el bucket
# público vía bucket policy más abajo).
# Las ACLs siguen bloqueadas porque no las usamos.
resource "aws_s3_bucket_public_access_block" "frontend_site_bucket" {
  bucket                  = aws_s3_bucket.frontend_site_bucket.id
  block_public_acls       = true
  block_public_policy     = false # permite policy pública
  ignore_public_acls      = true
  restrict_public_buckets = false # permite acceso público vía policy
}

# Propiedad del bucket: dueño = quien sube. ACLs deshabilitadas (best practice).
resource "aws_s3_bucket_ownership_controls" "frontend_site_bucket" {
  bucket = aws_s3_bucket.frontend_site_bucket.id

  rule {
    object_ownership = "BucketOwnerEnforced"
  }
}

################################################################
# 2) Configuración de website hosting
#    - index_document: la página por defecto.
#    - error_document: si alguien pide una ruta inexistente.
################################################################
resource "aws_s3_bucket_website_configuration" "frontend_site_website" {
  bucket = aws_s3_bucket.frontend_site_bucket.id

  index_document {
    suffix = "index.html"
  }

  error_document {
    key = "index.html"
  }
}

################################################################
# 3) Bucket policy: permite a CUALQUIERA leer los objetos
################################################################
data "aws_iam_policy_document" "frontend_public_read_policy_doc" {
  statement {
    sid       = "PublicReadGetObject"
    effect    = "Allow"
    actions   = ["s3:GetObject"]
    resources = ["${aws_s3_bucket.frontend_site_bucket.arn}/*"]

    principals {
      type        = "*"
      identifiers = ["*"]
    }
  }
}

resource "aws_s3_bucket_policy" "frontend_public_read_policy" {
  bucket = aws_s3_bucket.frontend_site_bucket.id
  policy = data.aws_iam_policy_document.frontend_public_read_policy_doc.json

  # La policy depende de que el public access block ya permita policies públicas
  depends_on = [aws_s3_bucket_public_access_block.frontend_site_bucket]
}

################################################################
# 4) Subir TODOS los archivos del frontend al bucket
################################################################
locals {
  # Mapa de extensión → MIME type. El navegador necesita este header
  # bien puesto para interpretar bien cada archivo.
  mime_types_by_extension = {
    "html" = "text/html"
    "css"  = "text/css"
    "js"   = "application/javascript"
    "json" = "application/json"
    "svg"  = "image/svg+xml"
    "png"  = "image/png"
    "jpg"  = "image/jpeg"
    "jpeg" = "image/jpeg"
    "ico"  = "image/x-icon"
    "txt"  = "text/plain"
  }
}

resource "aws_s3_object" "frontend_static_files" {
  # `fileset` recorre la carpeta y nos da una lista de archivos.
  # `for_each` crea un aws_s3_object por cada uno.
  for_each = fileset(var.frontend_source_dir, "**/*")

  bucket = aws_s3_bucket.frontend_site_bucket.id
  key    = each.value
  source = "${var.frontend_source_dir}/${each.value}"

  # Si el archivo cambia en disco, su hash cambia y Terraform lo re-sube.
  etag = filemd5("${var.frontend_source_dir}/${each.value}")

  content_type = lookup(
    local.mime_types_by_extension,
    lower(regex("\\.([^.]+)$", each.value)[0]),
    "application/octet-stream"
  )
}

################################################################
# 5) Generar env.js con la URL del API
#    El frontend lo carga ANTES que app.js para tener window.ENV
################################################################
resource "aws_s3_object" "frontend_env_js" {
  bucket       = aws_s3_bucket.frontend_site_bucket.id
  key          = "assets/scripts/env.js"
  content      = "window.ENV = { API_URL: \"${var.api_url}\" };\n"
  content_type = "application/javascript"
  etag         = md5("window.ENV = { API_URL: \"${var.api_url}\" };\n")

  # Se aplica DESPUÉS de la subida masiva: si frontend/assets/scripts/env.js
  # existe localmente como placeholder, este lo sobrescribe con la URL real.
  depends_on = [aws_s3_object.frontend_static_files]
}
