import io
import hashlib

# Python 3.8 OpenSSL compatibility patch for ReportLab 4.x
_orig_md5 = hashlib.md5
def _safe_md5(*args, **kwargs):
    kwargs.pop("usedforsecurity", None)
    return _orig_md5(*args, **kwargs)
hashlib.md5 = _safe_md5

from reportlab.lib.pagesizes import letter
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, HRFlowable, Table, TableStyle

def generate_agreement_pdf(title: str, content: str, agreement_type: str, agreement_id: int = None) -> io.BytesIO:
    """
    Renders an agreement draft into a professionally formatted PDF document
    using ReportLab with clean typography, draft disclaimer, and signature blocks.
    """
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=letter,
        rightMargin=54,
        leftMargin=54,
        topMargin=54,
        bottomMargin=54
    )

    styles = getSampleStyleSheet()

    # Custom styles
    header_style = ParagraphStyle(
        "LandAssistHeader",
        parent=styles["Normal"],
        fontName="Helvetica-Bold",
        fontSize=12,
        leading=14,
        textColor=colors.HexColor("#1e293b"),
        alignment=0
    )

    badge_style = ParagraphStyle(
        "DraftBadge",
        parent=styles["Normal"],
        fontName="Helvetica-Bold",
        fontSize=9,
        leading=11,
        textColor=colors.HexColor("#b45309"),
        alignment=2
    )

    title_style = ParagraphStyle(
        "AgreementTitle",
        parent=styles["Heading1"],
        fontName="Helvetica-Bold",
        fontSize=16,
        leading=20,
        textColor=colors.HexColor("#0f172a"),
        alignment=1,
        spaceAfter=12
    )

    body_style = ParagraphStyle(
        "AgreementBody",
        parent=styles["Normal"],
        fontName="Helvetica",
        fontSize=10,
        leading=15,
        textColor=colors.HexColor("#334155"),
        spaceAfter=8
    )

    disclaimer_style = ParagraphStyle(
        "DisclaimerText",
        parent=styles["Normal"],
        fontName="Helvetica-Oblique",
        fontSize=8,
        leading=11,
        textColor=colors.HexColor("#64748b")
    )

    story = []

    # Header bar
    ref_text = f"Draft Ref: LA-AGR-{agreement_id or 'NEW'}"
    header_data = [
        [
            Paragraph("<b>LandAssist</b> | Legal Document Drafting Engine", header_style),
            Paragraph(f"<b>DRAFT INSTRUMENT</b><br/>{ref_text}", badge_style)
        ]
    ]
    header_table = Table(header_data, colWidths=[320, 180])
    header_table.setStyle(TableStyle([
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
    ]))
    story.append(header_table)
    story.append(HRFlowable(width="100%", thickness=1, color=colors.HexColor("#cbd5e1"), spaceAfter=14))

    # Title
    clean_title = (title or f"{agreement_type.capitalize()} Agreement Draft").upper()
    story.append(Paragraph(clean_title, title_style))
    story.append(Spacer(1, 10))

    # Split paragraphs by lines
    paragraphs = content.split("\n\n")
    for para in paragraphs:
        trimmed = para.strip()
        if not trimmed:
            continue

        if trimmed.startswith("=" * 10) or "DISCLAIMER" in trimmed[:30]:
            # Disclaimer block
            story.append(Spacer(1, 10))
            story.append(HRFlowable(width="100%", thickness=0.75, color=colors.HexColor("#e2e8f0"), spaceAfter=6))
            story.append(Paragraph(trimmed.replace("\n", "<br/>"), disclaimer_style))
            story.append(Spacer(1, 10))
        elif trimmed.startswith("BETWEEN:") or trimmed.startswith("AND:") or trimmed.startswith("WHEREAS") or trimmed.startswith("NOW THIS"):
            # Prominent headings
            story.append(Paragraph(f"<b>{trimmed.replace(chr(10), '<br/>')}</b>", body_style))
        elif trimmed.startswith("SCHEDULE OF"):
            story.append(Spacer(1, 6))
            story.append(Paragraph(f"<b><u>{trimmed.replace(chr(10), '<br/>')}</u></b>", body_style))
        elif trimmed.startswith("IN WITNESS WHEREOF") or "VENDOR:" in trimmed or "PURCHASER:" in trimmed or "LESSOR:" in trimmed or "LESSEE:" in trimmed:
            # Execution block
            story.append(Spacer(1, 8))
            story.append(Paragraph(trimmed.replace("\n", "<br/>"), body_style))
        else:
            story.append(Paragraph(trimmed.replace("\n", "<br/>"), body_style))

    doc.build(story)
    buffer.seek(0)
    return buffer
