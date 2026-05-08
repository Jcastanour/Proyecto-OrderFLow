################################################################
# modules/messaging/main.tf
#
# Pipeline de eventos:
#
#   Lambda orders ──► EventBridge bus ──► Regla ──► SQS ──► Lambda notifier ──► SNS ──► email
#
# Crea:
#   1) EventBridge: bus custom "orderflow-bus"
#   2) SQS: cola "notifications-queue"
#   3) EventBridge → SQS: regla + permiso
#   4) SNS: topic "admin-alerts" + suscripción por email (opcional)
################################################################

################################################################
# 1) EventBridge custom bus
#    - Por defecto AWS tiene un bus "default" pero crear uno nuestro
#      aísla nuestros eventos de los de AWS y otros servicios.
################################################################
resource "aws_cloudwatch_event_bus" "orderflow_event_bus" {
  name = "${var.resource_prefix}-bus"
}

################################################################
# 2) SQS queue: cola de notificaciones
#    - visibility_timeout: tiempo que un mensaje queda "invisible"
#      mientras la Lambda lo procesa. Si la Lambda tarda más, el
#      mensaje vuelve y se procesa otra vez.
#    - message_retention_seconds: cuánto guardar mensajes no consumidos.
################################################################
resource "aws_sqs_queue" "notifications_queue" {
  name                       = "${var.resource_prefix}-notifications"
  visibility_timeout_seconds = 30     # Lambda timeout 10s + margen
  message_retention_seconds  = 345600 # 4 días
}

################################################################
# 3) Regla EventBridge: filtra eventos y los manda a SQS
#    - Patrón: cualquier evento con source = "orderflow.orders"
################################################################
resource "aws_cloudwatch_event_rule" "orders_events_rule" {
  name           = "${var.resource_prefix}-orders-events"
  description    = "Captura eventos publicados por la Lambda orders y los enruta a SQS"
  event_bus_name = aws_cloudwatch_event_bus.orderflow_event_bus.name

  event_pattern = jsonencode({
    source = ["orderflow.orders"]
  })
}

# Target: a dónde manda los eventos la regla (en este caso, SQS)
resource "aws_cloudwatch_event_target" "orders_events_to_sqs" {
  rule           = aws_cloudwatch_event_rule.orders_events_rule.name
  event_bus_name = aws_cloudwatch_event_bus.orderflow_event_bus.name
  target_id      = "send-to-notifications-queue"
  arn            = aws_sqs_queue.notifications_queue.arn
}

# Permiso: la SQS necesita permitir que EventBridge le escriba
data "aws_iam_policy_document" "notifications_queue_policy_doc" {
  statement {
    sid       = "AllowEventBridgeToSendMessages"
    effect    = "Allow"
    actions   = ["sqs:SendMessage"]
    resources = [aws_sqs_queue.notifications_queue.arn]

    principals {
      type        = "Service"
      identifiers = ["events.amazonaws.com"]
    }

    condition {
      test     = "ArnEquals"
      variable = "aws:SourceArn"
      values   = [aws_cloudwatch_event_rule.orders_events_rule.arn]
    }
  }
}

resource "aws_sqs_queue_policy" "notifications_queue_policy" {
  queue_url = aws_sqs_queue.notifications_queue.id
  policy    = data.aws_iam_policy_document.notifications_queue_policy_doc.json
}

################################################################
# 4) SNS topic + suscripción por email (opcional)
################################################################
resource "aws_sns_topic" "admin_alerts_topic" {
  name = "${var.resource_prefix}-admin-alerts"
}

# count = 0 si no hay email, count = 1 si lo hay (truco condicional)
resource "aws_sns_topic_subscription" "admin_alerts_email" {
  count = var.notification_email != "" ? 1 : 0

  topic_arn = aws_sns_topic.admin_alerts_topic.arn
  protocol  = "email"
  endpoint  = var.notification_email
}
