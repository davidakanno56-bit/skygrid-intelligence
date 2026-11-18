import io
import hmac
import hashlib
import datetime
from typing import Dict, Any, Optional
from fastapi import HTTPException, status

from backend.config import settings
from backend.database import db
from backend.auth import COMMERCIAL_TIERS, create_api_key

from reportlab.lib.pagesizes import letter
from reportlab.lib import colors
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, HRFlowable
)
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle

# Indicative Multi-Currency Conversion Table (USD base for provisional quotes)
CURRENCY_RATES = {
    "USD": {"symbol": "$", "rate": 1.0, "name": "US Dollar (Global Standard)"},
    "AED": {"symbol": "AED", "rate": 3.6725, "name": "UAE Dirham (Dubai / GCC)"},
    "EUR": {"symbol": "€", "rate": 0.9250, "name": "Euro (European Cargo Hubs)"},
    "GBP": {"symbol": "£", "rate": 0.7920, "name": "British Pound (Heathrow Cargo)"},
    "NGN": {"symbol": "₦", "rate": 1550.0, "name": "Nigerian Naira (West Africa Hub)"}
}


def get_currency_spec(currency: str) -> Dict[str, Any]:
    c = currency.upper().strip()
    return CURRENCY_RATES.get(c, CURRENCY_RATES["USD"])


def log_billing_audit(
    event_type: str,
    provider: str,
    reference: str,
    payload_bytes: bytes,
    verified: bool,
    actor: str,
    details: str
) -> None:
    payload_hash = hashlib.sha256(payload_bytes).hexdigest()
    now = datetime.datetime.now(datetime.timezone.utc).isoformat()
    try:
        db.execute_write("""
            INSERT INTO billing_audit_events
            (event_type, provider, reference, payload_hash, verified, actor, details, created_at)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s);
        """, (
            event_type, provider, reference, payload_hash, 1 if verified else 0, actor, details, now
        ))
    except Exception as e:
        print(f"[BILLING AUDIT ERROR] {e}")


def get_billing_status() -> Dict[str, Any]:
    """Returns transparent server-side billing activation status without exposing secrets."""
    live_enabled = settings.BILLING_LIVE_ENABLED
    return {
        "live_payments_enabled": live_enabled,
        "billing_mode": "LIVE_VERIFIED_GATEWAY" if live_enabled else "PROVISIONAL_ENQUIRY_ONLY",
        "configured_provider": settings.PAYMENT_GATEWAY.lower(),
        "merchant_account_verified": live_enabled,
        "supported_currencies": CURRENCY_RATES,
        "corporate_entity": settings.CORPORATE_BENEFICIARY_NAME,
        "notice": (
            "Live commercial payment processing is active."
            if live_enabled
            else "Live enterprise payments are not yet enabled. Commercial pricing is provisional and handled via enterprise enquiry."
        )
    }


def verify_paystack_signature(body_bytes: bytes, signature_header: Optional[str]) -> bool:
    """Verifies Paystack x-paystack-signature using HMAC-SHA512 with server secret."""
    secret = (settings.PAYSTACK_SECRET_KEY or "").strip()
    if not secret or not signature_header:
        return False
    expected = hmac.new(secret.encode("utf-8"), body_bytes, hashlib.sha512).hexdigest()
    return hmac.compare_digest(expected, signature_header.strip())


def verify_flutterwave_signature(verif_hash_header: Optional[str]) -> bool:
    """Verifies Flutterwave verif-hash webhook header using constant-time comparison."""
    secret_hash = (settings.FLUTTERWAVE_WEBHOOK_HASH or "").strip()
    if not secret_hash or not verif_hash_header:
        return False
    return hmac.compare_digest(secret_hash, verif_hash_header.strip())


def initiate_order(
    organization_name: str,
    billing_email: str,
    license_type: str,
    currency: str = "USD",
    payment_method: str = "card"
) -> Dict[str, Any]:
    """
    Creates a server-side billing checkout session ONLY when live billing is explicitly enabled
    with verified provider credentials. Never simulates live payments.
    """
    if not settings.BILLING_LIVE_ENABLED:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Live commercial checkout is not enabled yet. Please submit an Enterprise Access enquiry on the landing page."
        )

    license_type = license_type.lower().strip()
    if license_type not in COMMERCIAL_TIERS:
        raise HTTPException(status_code=400, detail=f"Unknown commercial tier: '{license_type}'.")

    tier_info = COMMERCIAL_TIERS[license_type]
    amount_usd = float(tier_info["monthly_fee_usd"])
    curr_spec = get_currency_spec(currency)
    amount_charged = round(amount_usd * curr_spec["rate"], 2)

    order_ref = f"ORD-SKY-{int(datetime.datetime.now().timestamp() * 1000) % 900000 + 100000}"
    gateway = settings.PAYMENT_GATEWAY.lower()
    now = datetime.datetime.now(datetime.timezone.utc).isoformat()

    db.execute_write("""
        INSERT INTO billing_orders
        (order_ref, organization_name, billing_email, license_type, amount_usd, amount_charged, currency, payment_gateway, payment_method, payment_status, created_at)
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s);
    """, (
        order_ref, organization_name, billing_email, license_type, amount_usd, amount_charged,
        currency.upper(), gateway, payment_method, "PENDING", now
    ))

    log_billing_audit(
        event_type="ORDER_INITIATED",
        provider=gateway,
        reference=order_ref,
        payload_bytes=f"{order_ref}:{organization_name}:{license_type}:{amount_charged}".encode("utf-8"),
        verified=True,
        actor=billing_email,
        details=f"Pending checkout created for {license_type} ({amount_charged} {currency.upper()})"
    )

    return {
        "order_ref": order_ref,
        "license_type": license_type,
        "tier_name": tier_info["name"],
        "amount_usd": amount_usd,
        "amount_charged": amount_charged,
        "currency": currency.upper(),
        "currency_symbol": curr_spec["symbol"],
        "payment_method": payment_method,
        "payment_gateway": gateway,
        "status": "PENDING_VERIFIED_PAYMENT"
    }


def verify_and_activate_order(
    order_ref: str,
    gateway_ref: str,
    provider: str,
    verified_by_webhook: bool = False
) -> Dict[str, Any]:
    """
    Activates a paid enterprise subscription ONLY when invoked by a cryptographically verified
    provider webhook or server-side admin verification.
    """
    if not settings.BILLING_LIVE_ENABLED or not verified_by_webhook or not gateway_ref:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Subscription activation requires a cryptographically verified server-side payment webhook."
        )

    rows = db.execute_query(
        "SELECT * FROM billing_orders WHERE order_ref = %s;",
        (order_ref,)
    )
    if not rows:
        raise HTTPException(status_code=404, detail=f"Order reference '{order_ref}' not located.")

    order = rows[0]
    if order.get("payment_status") == "PAID" and order.get("api_key_id"):
        key_rows = db.execute_query("SELECT key_prefix FROM api_keys WHERE id = %s;", (order["api_key_id"],))
        return {
            "status": "ALREADY_ACTIVE",
            "order_ref": order_ref,
            "key_prefix": key_rows[0]["key_prefix"] if key_rows else "sk_live_...",
            "message": "Order already verified and activated."
        }

    key_info = create_api_key(
        name=order["organization_name"],
        license_type=order["license_type"],
        billing_email=order["billing_email"],
        is_paid_enterprise=True,
        verified_payment_ref=f"{provider}:{gateway_ref}",
        expires_in_days=30
    )

    now_dt = datetime.datetime.now(datetime.timezone.utc)
    now = now_dt.isoformat()
    period_end = (now_dt + datetime.timedelta(days=30)).isoformat()

    key_rows = db.execute_query(
        "SELECT id FROM api_keys WHERE license_id = %s;",
        (key_info["license_id"],)
    )
    key_id = key_rows[0]["id"] if key_rows else None

    db.execute_write("""
        UPDATE billing_orders
        SET payment_status = 'PAID', gateway_reference = %s, api_key_id = %s, paid_at = %s
        WHERE order_ref = %s;
    """, (gateway_ref, key_id, now, order_ref))

    db.execute_write("""
        INSERT INTO subscriptions
        (org_id, license_type, provider, provider_subscription_id, status, current_period_start, current_period_end, cancel_at_period_end, created_at, updated_at)
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s);
    """, (
        None, order["license_type"], provider, gateway_ref, "ACTIVE", now, period_end, 0, now, now
    ))

    log_billing_audit(
        event_type="SUBSCRIPTION_ACTIVATED",
        provider=provider,
        reference=order_ref,
        payload_bytes=f"{order_ref}:{gateway_ref}:{key_info['license_id']}".encode("utf-8"),
        verified=True,
        actor=f"WEBHOOK:{provider}",
        details=f"Verified payment activated {key_info['license_id']}"
    )

    return {
        "status": "PAYMENT_VERIFIED_AND_ACTIVATED",
        "order_ref": order_ref,
        "key_prefix": key_info["key_prefix"],
        "license_id": key_info["license_id"],
        "license_name": key_info["tier_name"],
        "is_paid_enterprise": True,
        "expires_at": key_info["expires_at"]
    }


def generate_proforma_invoice_pdf(order_ref: str) -> bytes:
    """Generates a provisional commercial quotation PDF without fabricated bank details."""
    rows = db.execute_query("SELECT * FROM billing_orders WHERE order_ref = %s;", (order_ref,))
    if not rows:
        raise HTTPException(status_code=404, detail="Order not found")

    order = rows[0]
    tier = COMMERCIAL_TIERS.get(order["license_type"], COMMERCIAL_TIERS["global_cargo_carrier"])

    buf = io.BytesIO()
    doc = SimpleDocTemplate(buf, pagesize=letter, rightMargin=36, leftMargin=36, topMargin=36, bottomMargin=36)
    styles = getSampleStyleSheet()

    title_style = ParagraphStyle('InvoiceTitle', parent=styles['Normal'], fontName='Helvetica-Bold', fontSize=20, leading=24, textColor=colors.HexColor('#030712'))
    subtitle_style = ParagraphStyle('InvoiceSubtitle', parent=styles['Normal'], fontName='Helvetica', fontSize=9, leading=12, textColor=colors.HexColor('#64748b'))
    body_style = ParagraphStyle('InvoiceBody', parent=styles['Normal'], fontName='Helvetica', fontSize=9, leading=13, textColor=colors.HexColor('#1e293b'))
    bold_style = ParagraphStyle('InvoiceBold', parent=styles['Normal'], fontName='Helvetica-Bold', fontSize=9, leading=13, textColor=colors.HexColor('#0f172a'))

    elements = []
    header_data = [[
        Paragraph(f"<b>{settings.CORPORATE_BENEFICIARY_NAME.upper()}</b><br/><font color='#64748b' size='8'>SkyGrid Intelligence — Aviation Risk Evaluation Platform</font>", title_style),
        Paragraph(f"<b>PROVISIONAL QUOTATION</b><br/><font color='#0e7490' size='10'>{order['order_ref']}</font><br/><font color='#64748b' size='8'>DATE: {str(order['created_at'])[:10]}</font>", subtitle_style)
    ]]
    header_table = Table(header_data, colWidths=[340, 200])
    header_table.setStyle(TableStyle([('VALIGN', (0, 0), (-1, -1), 'TOP'), ('ALIGN', (1, 0), (1, 0), 'RIGHT')]))
    elements.append(header_table)
    elements.append(Spacer(1, 15))
    elements.append(HRFlowable(width="100%", thickness=1.5, color=colors.HexColor('#06b6d4'), spaceBefore=5, spaceAfter=15))

    settlement_text = (
        f"<b>{settings.CORPORATE_BENEFICIARY_NAME}</b><br/>"
        f"Bank: {settings.CORPORATE_BANK_NAME}<br/>"
        f"Account: {settings.CORPORATE_ACCOUNT_NUMBER}<br/>"
        f"SWIFT/BIC: {settings.CORPORATE_SWIFT_BIC}"
        if settings.CORPORATE_BANK_NAME and settings.CORPORATE_ACCOUNT_NUMBER
        else f"<b>{settings.CORPORATE_BENEFICIARY_NAME}</b><br/>Verified corporate settlement instructions are issued directly upon executed Enterprise Master Services Agreement (MSA)."
    )

    billing_data = [
        [Paragraph("<b>PREPARED FOR:</b>", bold_style), Paragraph("<b>ISSUED BY:</b>", bold_style)],
        [
            Paragraph(f"<b>{order['organization_name']}</b><br/>Email: {order['billing_email']}<br/>Proposed Tier: {tier['name']}", body_style),
            Paragraph(settlement_text, body_style)
        ]
    ]
    billing_table = Table(billing_data, colWidths=[270, 270])
    billing_table.setStyle(TableStyle([
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('BACKGROUND', (0, 0), (-1, -1), colors.HexColor('#f8fafc')),
        ('BOX', (0, 0), (-1, -1), 0.5, colors.HexColor('#cbd5e1')),
        ('INNERGRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#e2e8f0')),
        ('PADDING', (0, 0), (-1, -1), 8)
    ]))
    elements.append(billing_table)
    elements.append(Spacer(1, 15))

    curr_sym = CURRENCY_RATES.get(order['currency'], {}).get('symbol', '$')
    items_data = [
        [
            Paragraph("<b>DESCRIPTION</b>", bold_style),
            Paragraph("<b>TARGET SLA</b>", bold_style),
            Paragraph("<b>PROPOSED USD</b>", bold_style),
            Paragraph(f"<b>ESTIMATE ({order['currency']})</b>", bold_style)
        ],
        [
            Paragraph(f"<b>SkyGrid Intelligence {tier['name']}</b><br/><font size='7' color='#64748b'>{tier['description']}</font>", body_style),
            Paragraph(f"{tier['sla_uptime']}", body_style),
            Paragraph(f"${order['amount_usd']:,.2f}", body_style),
            Paragraph(f"<b>{curr_sym}{order['amount_charged']:,.2f}</b>", bold_style)
        ]
    ]
    items_table = Table(items_data, colWidths=[250, 110, 90, 90])
    items_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#0f172a')),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#cbd5e1')),
        ('PADDING', (0, 0), (-1, -1), 6)
    ]))
    elements.append(items_table)
    doc.build(elements)
    return buf.getvalue()
