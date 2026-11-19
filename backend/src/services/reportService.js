const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const PDFDocument = require('pdfkit');
const Inspection = require('../models/Inspection');
const Product = require('../models/Product');
const User = require('../models/User');

const generateReportNumber = () => {
  const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const randomHex = crypto.randomBytes(2).toString('hex').toUpperCase();
  return `REP-${dateStr}-${randomHex}`;
};

/**
 * Generates an official regulatory inspection PDF report for a completed inspection dossier.
 */
const generateInspectionPdf = async (inspectionId, generatedByUserId) => {
  const inspection = await Inspection.findById(inspectionId);
  if (!inspection) {
    throw new Error(`Inspection '${inspectionId}' not found.`);
  }

  let product = null;
  if (inspection.productId) {
    product = await Product.findById(inspection.productId);
  }

  let inspector = null;
  if (inspection.inspectorId) {
    inspector = await User.findById(inspection.inspectorId);
  }

  let generatingUser = null;
  if (generatedByUserId) {
    generatingUser = await User.findById(generatedByUserId);
  }

  const reportNumber = generateReportNumber();
  const reportsDir = path.join(process.cwd(), 'uploads', 'reports', inspection._id.toString());
  fs.mkdirSync(reportsDir, { recursive: true });

  const filename = `${reportNumber}.pdf`;
  const fullPdfPath = path.join(reportsDir, filename);
  const relativePdfPath = path.relative(process.cwd(), fullPdfPath).replace(/\\/g, '/');

  // Generate PDF in memory buffer using PDFKit
  const pdfBuffer = await new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: 'A4',
      margin: 40,
      info: {
        Title: `LabelGuard AI Inspection Report - ${inspection.inspectionNumber}`,
        Author: 'LabelGuard AI Compliance System',
        Subject: 'Legal Metrology (Packaged Commodities) Rules 2011 Compliance Audit',
      },
    });

    const buffers = [];
    doc.on('data', (chunk) => buffers.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(buffers)));
    doc.on('error', (err) => reject(err));

    // Colors
    const primaryColor = '#1e293b'; // Slate 800
    const secondaryColor = '#475569'; // Slate 600
    const accentColor = '#3b82f6'; // Blue 500
    const borderColor = '#cbd5e1'; // Slate 300

    // Header Banner
    doc.rect(40, 40, 515, 6).fill('#4f46e5'); // Indigo top accent stripe

    doc.moveDown(0.8);
    doc
      .fontSize(16)
      .fillColor(primaryColor)
      .font('Helvetica-Bold')
      .text('LABELGUARD AI — STATUTORY COMPLIANCE REPORT', 40, 55);

    doc
      .fontSize(9)
      .fillColor(secondaryColor)
      .font('Helvetica')
      .text(
        'Inspection Dossier under Legal Metrology Act, 2009 & Packaged Commodities Rules, 2011 (as amended)',
        40,
        74
      );

    doc.moveTo(40, 92).lineTo(555, 92).lineWidth(1).strokeColor(borderColor).stroke();

    // Dossier Metadata Grid
    let y = 104;
    doc.fontSize(8).font('Helvetica-Bold').fillColor(secondaryColor);
    doc.text('INSPECTION NUMBER:', 40, y);
    doc.text('REPORT NUMBER:', 210, y);
    doc.text('DATE & TIME (UTC):', 380, y);

    y += 12;
    doc.fontSize(9).font('Helvetica').fillColor(primaryColor);
    doc.text(inspection.inspectionNumber || 'N/A', 40, y);
    doc.text(reportNumber, 210, y);
    doc.text(new Date(inspection.createdAt || Date.now()).toISOString().replace('T', ' ').slice(0, 19), 380, y);

    y += 18;
    doc.fontSize(8).font('Helvetica-Bold').fillColor(secondaryColor);
    doc.text('INVESTIGATING OFFICER:', 40, y);
    doc.text('COMMODITY / PRODUCT:', 210, y);
    doc.text('GTIN / BARCODE:', 380, y);

    y += 12;
    doc.fontSize(9).font('Helvetica').fillColor(primaryColor);
    doc.text(inspector ? `${inspector.fullName} (${inspector.role})` : 'Authorized Inspector', 40, y);
    doc.text(product ? `${product.brand} - ${product.name}` : 'Unregistered / General Package', 210, y);
    doc.text(product?.barcodeGtin || 'Not Provided', 380, y);

    // Status Banner Box
    y += 24;
    const overallStatus = inspection.status || 'PROCESSING';
    let statusBg = '#f1f5f9';
    let statusTextColor = '#334155';
    let statusLabel = overallStatus;

    if (overallStatus === 'COMPLIANT') {
      statusBg = '#ecfdf5';
      statusTextColor = '#065f46';
      statusLabel = 'COMPLIANT (Statutory Declarations Verified)';
    } else if (overallStatus === 'POTENTIALLY_NON_COMPLIANT') {
      statusBg = '#fef2f2';
      statusTextColor = '#991b1b';
      statusLabel = 'POTENTIALLY NON-COMPLIANT (Mandatory Omissions / Format Breach)';
    } else if (overallStatus === 'REQUIRES_MANUAL_REVIEW') {
      statusBg = '#fffbeb';
      statusTextColor = '#92400e';
      statusLabel = 'REQUIRES MANUAL REVIEW (Ambiguous Evidence / Missing OCR Data)';
    }

    doc.rect(40, y, 515, 36).fill(statusBg);
    doc.rect(40, y, 515, 36).lineWidth(1).strokeColor(borderColor).stroke();

    doc.fontSize(8).font('Helvetica-Bold').fillColor(secondaryColor).text('OVERALL STATUTORY COMPLIANCE DETERMINATION:', 52, y + 8);
    doc.fontSize(11).font('Helvetica-Bold').fillColor(statusTextColor).text(statusLabel, 52, y + 20);

    // Manual Override Audit Callout (if applicable)
    y += 44;
    if (inspection.isManualOverride) {
      doc.rect(40, y, 515, 38).fill('#fefce8');
      doc.rect(40, y, 515, 38).lineWidth(1).strokeColor('#fde047').stroke();

      doc.fontSize(8).font('Helvetica-Bold').fillColor('#854d0e').text('AUDITED MANUAL REGULATORY OVERRIDE APPLIED', 50, y + 6);
      doc
        .fontSize(8)
        .font('Helvetica-Oblique')
        .fillColor('#713f12')
        .text(`Officer Justification: "${inspection.manualOverrideReason || 'Administrative determination'}"`, 50, y + 18, {
          width: 495,
          lineBreak: true,
        });
      y += 46;
    }

    // Packaging Panels Inspected
    doc.fontSize(10).font('Helvetica-Bold').fillColor(primaryColor).text('1. PACKAGING PANELS INSPECTED', 40, y);
    y += 14;

    const imagesCount = inspection.images ? inspection.images.length : 0;
    const totalTokensCount = (inspection.images || []).reduce((acc, img) => acc + (img.ocrTokens ? img.ocrTokens.length : 0), 0);

    doc.fontSize(8).font('Helvetica').fillColor(secondaryColor).text(
      `Total Panels Inspected: ${imagesCount}  |  Total OCR Tokens Extracted: ${totalTokensCount}`,
      40,
      y
    );
    y += 14;

    // Mini panel list
    if (inspection.images && inspection.images.length > 0) {
      inspection.images.slice(0, 4).forEach((img, idx) => {
        const panelLabel = img.panelType || `PANEL ${idx + 1}`;
        const dims = (img.widthPx && img.heightPx) ? `${img.widthPx} x ${img.heightPx} px` : 'Pending Dimensions';
        const tokensCount = img.ocrTokens ? img.ocrTokens.length : 0;
        let displayName = img.originalFilename || `panel_${idx + 1}.jpg`;
        if (displayName.length > 28) {
          const ext = path.extname(displayName) || '.jpg';
          displayName = displayName.substring(0, 20) + '...' + ext;
        }
        const ocrStatus = img.aiProcessingSuccess === false
          ? ' [AI Processing Failed]'
          : tokensCount === 0
            ? ' [0 tokens detected]'
            : ` [${tokensCount} OCR tokens]`;

        doc.fontSize(8).font('Helvetica-Bold').fillColor(primaryColor).text(`• Panel ${idx + 1} (${panelLabel}): `, 50, y, { continued: true });
        doc.font('Helvetica').fillColor(secondaryColor).text(`${dims} | File: ${displayName}${ocrStatus}`);
        y += 12;
      });
    }

    // Zero-token / OCR failure alert banner
    if (totalTokensCount === 0) {
      y += 4;
      doc.rect(40, y, 515, 28).fill('#fffbeb');
      doc.rect(40, y, 515, 28).lineWidth(1).strokeColor('#f59e0b').stroke();
      doc.fontSize(7.5).font('Helvetica-Bold').fillColor('#b45309').text(
        'NOTICE: No OCR text tokens were extracted from packaging imagery (or microservice was offline).',
        48,
        y + 5
      );
      doc.font('Helvetica').fillColor('#92400e').text(
        'In compliance with Legal Metrology Act principles, all statutory declarations have been routed to REQUIRES MANUAL REVIEW.',
        48,
        y + 15
      );
      y += 34;
    } else {
      y += 8;
    }

    // Extracted Statutory Declarations Table (Rule 6)
    doc.fontSize(10).font('Helvetica-Bold').fillColor(primaryColor).text('2. EXTRACTED STATUTORY DECLARATIONS (PCR 2011 RULE 6)', 40, y);
    y += 14;

    // Table Header
    doc.rect(40, y, 515, 16).fill('#f8fafc');
    doc.rect(40, y, 515, 16).lineWidth(0.5).strokeColor(borderColor).stroke();

    doc.fontSize(7.5).font('Helvetica-Bold').fillColor(primaryColor);
    doc.text('STATUTORY FIELD', 45, y + 4);
    doc.text('EXTRACTED VALUE / PARSED DATA', 170, y + 4);
    doc.text('CONF.', 390, y + 4);
    doc.text('EVIDENCE STATUS', 440, y + 4);
    y += 16;

    const decls = inspection.extractedDeclarations || [];
    if (decls.length === 0) {
      doc.fontSize(8).font('Helvetica-Oblique').fillColor(secondaryColor).text('No statutory declarations successfully parsed from OCR tokens.', 50, y + 6);
      y += 20;
    } else {
      decls.forEach((d) => {
        const valStr = typeof d.parsedValue === 'object' ? JSON.stringify(d.parsedValue) : String(d.parsedValue || d.rawText);
        const cleanVal = valStr.length > 45 ? `${valStr.substring(0, 45)}...` : valStr;

        doc.rect(40, y, 515, 16).lineWidth(0.5).strokeColor('#e2e8f0').stroke();
        doc.fontSize(7.5).font('Helvetica-Bold').fillColor(primaryColor).text(d.fieldType, 45, y + 4);
        doc.font('Helvetica').fillColor(secondaryColor).text(cleanVal, 170, y + 4);
        doc.text(`${Math.round((d.confidence || 1.0) * 100)}%`, 390, y + 4);
        doc.fillColor(d.primaryBbox ? '#047857' : '#64748b').text(d.primaryBbox ? 'Visual BBox' : 'Text Token', 440, y + 4);
        y += 16;
      });
    }

    y += 14;

    // Compliance Findings Summary Table
    doc.fontSize(10).font('Helvetica-Bold').fillColor(primaryColor).text('3. STATUTORY COMPLIANCE FINDINGS (PCR 2011)', 40, y);
    y += 14;

    // Findings Table Header
    doc.rect(40, y, 515, 16).fill('#f8fafc');
    doc.rect(40, y, 515, 16).lineWidth(0.5).strokeColor(borderColor).stroke();

    doc.fontSize(7.5).font('Helvetica-Bold').fillColor(primaryColor);
    doc.text('RULE CODE', 45, y + 4);
    doc.text('STATUTORY CITATION', 125, y + 4);
    doc.text('RESULT', 270, y + 4);
    doc.text('OBSERVATION / STATUTORY REASON', 380, y + 4);
    y += 16;

    const findings = inspection.findings || [];
    if (findings.length === 0) {
      doc.fontSize(8).font('Helvetica-Oblique').fillColor(secondaryColor).text('Compliance evaluation has not been executed for this inspection dossier.', 50, y + 6);
      y += 20;
    } else {
      findings.forEach((f) => {
        let fColor = '#059669';
        if (f.status === 'FAIL') fColor = '#dc2626';
        if (f.status === 'REQUIRES_MANUAL_REVIEW') fColor = '#d97706';

        const reasonShort = f.explanation && f.explanation.length > 52 ? `${f.explanation.substring(0, 50)}...` : f.explanation || 'Evaluated';

        doc.rect(40, y, 515, 15).lineWidth(0.5).strokeColor('#e2e8f0').stroke();
        doc.fontSize(7).font('Helvetica-Bold').fillColor(primaryColor).text(f.ruleCode, 45, y + 4);
        doc.font('Helvetica').fillColor(secondaryColor).text(f.legalCitation ? f.legalCitation.substring(0, 28) : 'PCR 2011', 125, y + 4);
        doc.font('Helvetica-Bold').fillColor(fColor).text(f.status, 270, y + 4);
        doc.font('Helvetica').fillColor(secondaryColor).text(reasonShort, 380, y + 4);
        y += 15;
      });
    }

    // Disclaimers & Cryptographic Integrity Section
    y += 18;
    doc.rect(40, y, 515, 48).fill('#f8fafc');
    doc.rect(40, y, 515, 48).lineWidth(1).strokeColor(borderColor).stroke();

    doc.fontSize(7.5).font('Helvetica-Bold').fillColor(primaryColor).text('LEGAL NOTICE & STATUTORY DISCLAIMER (Legal Metrology Act, 2009 Section 18):', 48, y + 6);
    doc
      .fontSize(6.5)
      .font('Helvetica')
      .fillColor(secondaryColor)
      .text(
        'This automated compliance report is generated for regulatory assistance. Under Rule 6 & Section 36 of the Legal Metrology Act, 2009, OCR non-detection alone does not constitute statutory proof of omission without physical verification. Manual overrides and determinations represent administrative assessments and do not constitute a conclusive judicial finding.',
        48,
        y + 16,
        { width: 495, lineBreak: true }
      );

    // Cryptographic Footer
    doc
      .fontSize(6.5)
      .font('Helvetica-Bold')
      .fillColor(secondaryColor)
      .text('DOCUMENT INTEGRITY VERIFICATION (SHA-256):', 40, 775);

    doc
      .fontSize(6)
      .font('Helvetica')
      .fillColor(secondaryColor)
      .text(
        `Bit-level SHA-256 hash is computed across all compiled PDF bytes and recorded in MongoDB dossier metadata. Generated by: ${generatingUser?.email || 'LabelGuard AI'} | Timestamp: ${new Date().toISOString()}`,
        40,
        785,
        { width: 515 }
      );

    doc.end();
  });

  // Calculate SHA-256 Hash of generated bytes
  const sha256Hash = crypto.createHash('sha256').update(pdfBuffer).digest('hex');

  // Write file to disk
  fs.writeFileSync(fullPdfPath, pdfBuffer);

  // Persist report metadata in MongoDB
  inspection.report = {
    reportNumber,
    pdfFilePath: relativePdfPath,
    fileSizeBytes: pdfBuffer.length,
    sha256Hash,
    generatedById: generatedByUserId || inspection.inspectorId,
  };

  await inspection.save();

  return {
    reportNumber,
    pdfFilePath: relativePdfPath,
    fileSizeBytes: pdfBuffer.length,
    sha256Hash,
    pdfBuffer,
  };
};

/**
 * Re-reads generated PDF file from disk and verifies whether its SHA-256 hash matches the recorded hash.
 */
const verifyReportIntegrity = async (inspectionId) => {
  const inspection = await Inspection.findById(inspectionId);
  if (!inspection) {
    throw new Error(`Inspection '${inspectionId}' not found.`);
  }

  if (!inspection.report || !inspection.report.pdfFilePath) {
    return {
      verified: false,
      status: 'NO_REPORT_GENERATED',
      message: 'No official report has been generated for this inspection dossier yet.',
    };
  }

  const fullPdfPath = path.resolve(process.cwd(), inspection.report.pdfFilePath);
  if (!fs.existsSync(fullPdfPath)) {
    return {
      verified: false,
      status: 'FILE_MISSING_ON_DISK',
      stored_hash: inspection.report.sha256Hash,
      message: `The report file was not found on server disk at: ${inspection.report.pdfFilePath}`,
    };
  }

  const fileBytes = fs.readFileSync(fullPdfPath);
  const calculatedHash = crypto.createHash('sha256').update(fileBytes).digest('hex');
  const storedHash = inspection.report.sha256Hash;
  const isMatch = calculatedHash.toLowerCase() === storedHash.toLowerCase();

  return {
    verified: isMatch,
    status: isMatch ? 'VERIFIED_INTACT' : 'TAMPERED_OR_CORRUPT',
    stored_hash: storedHash,
    calculated_hash: calculatedHash,
    algorithm: 'SHA-256',
    file_size_bytes: fileBytes.length,
    report_number: inspection.report.reportNumber,
    message: isMatch
      ? 'Cryptographic integrity verified. PDF bytes match the authoritative hash recorded at generation.'
      : 'Cryptographic hash mismatch! The PDF file has been altered, corrupted, or replaced since initial generation.',
  };
};

/**
 * Generates an RFC 4180 compliant CSV export containing extracted declarations and compliance findings.
 */
const exportInspectionCsv = (inspection) => {
  const escapeCell = (val) => {
    if (val === null || val === undefined) return '""';
    const str = String(val).replace(/"/g, '""');
    return `"${str}"`;
  };

  const lines = [];

  // Section 1: Header & Metadata
  lines.push(['LABELGUARD AI STATUTORY COMPLIANCE INSPECTION EXPORT']);
  lines.push(['Inspection Number', inspection.inspectionNumber || inspection.id]);
  lines.push(['Overall Status', inspection.status]);
  lines.push(['Overall Score (%)', inspection.overallScore ?? 0]);
  lines.push(['Is Manual Override', inspection.isManualOverride ? 'YES' : 'NO']);
  if (inspection.isManualOverride) {
    lines.push(['Override Reason', inspection.manualOverrideReason || '']);
  }
  lines.push(['Export Timestamp', new Date().toISOString()]);
  lines.push([]);

  // Section 2: Statutory Declarations (PCR 2011 Rule 6)
  lines.push(['--- EXTRACTED STATUTORY DECLARATIONS (PCR 2011 RULE 6) ---']);
  lines.push(['Field Type', 'Parsed Value', 'Confidence', 'Raw OCR Text', 'Has Visual Evidence']);

  const decls = inspection.extractedDeclarations || [];
  decls.forEach((d) => {
    const parsedVal = typeof d.parsedValue === 'object' ? JSON.stringify(d.parsedValue) : String(d.parsedValue || '');
    lines.push([
      d.fieldType,
      parsedVal,
      d.confidence ? Math.round(d.confidence * 100) / 100 : 1.0,
      d.rawText || '',
      d.primaryBbox ? 'YES' : 'NO',
    ]);
  });

  lines.push([]);

  // Section 3: Compliance Findings
  lines.push(['--- STATUTORY COMPLIANCE RULE FINDINGS ---']);
  lines.push(['Rule Code', 'Field Name', 'Result Status', 'Legal Citation', 'Explanation', 'Detected Evidence', 'Manual Review Recommendation']);

  const findings = inspection.findings || [];
  findings.forEach((f) => {
    lines.push([
      f.ruleCode,
      f.fieldName,
      f.status,
      f.legalCitation || '',
      f.explanation || '',
      f.detectedEvidence || '',
      f.manualReviewRecommendation || '',
    ]);
  });

  return lines.map((row) => row.map(escapeCell).join(',')).join('\r\n');
};

/**
 * Returns full JSON dossier payload for clean export.
 */
const exportInspectionJson = (inspection, product = null, inspector = null) => {
  const json = inspection.toJSON();
  return {
    export_schema_version: '1.0.0',
    export_timestamp: new Date().toISOString(),
    dossier: {
      id: json.id,
      inspection_number: json.inspection_number,
      status: json.status,
      overall_score: json.overall_score,
      notes: json.notes,
      is_manual_override: json.is_manual_override,
      manual_override_reason: inspection.manualOverrideReason,
      created_at: json.created_at,
      product: product
        ? {
            id: product._id ? product._id.toString() : product.id,
            name: product.name,
            brand: product.brand,
            category: product.category,
            barcode_gtin: product.barcodeGtin,
          }
        : null,
      inspector: inspector
        ? {
            id: inspector._id ? inspector._id.toString() : inspector.id,
            email: inspector.email,
            full_name: inspector.fullName,
            role: inspector.role,
          }
        : null,
      report: json.report,
      images_count: json.images ? json.images.length : 0,
      extracted_declarations: json.extracted_declarations,
      findings: json.findings,
    },
  };
};

module.exports = {
  generateInspectionPdf,
  verifyReportIntegrity,
  exportInspectionCsv,
  exportInspectionJson,
};
