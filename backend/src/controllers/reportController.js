const fs = require('fs');
const path = require('path');
const Inspection = require('../models/Inspection');
const Product = require('../models/Product');
const User = require('../models/User');
const {
  generateInspectionPdf,
  verifyReportIntegrity,
  exportInspectionCsv,
  exportInspectionJson,
} = require('../services/reportService');

// @desc    Generate or regenerate official PDF inspection report
// @route   POST /api/v1/inspections/:id/report
const generateReport = async (req, res) => {
  try {
    const reportData = await generateInspectionPdf(req.params.id, req.user._id);
    return res.status(201).json({
      message: 'Official regulatory report generated successfully.',
      report: {
        report_number: reportData.reportNumber,
        pdf_file_path: reportData.pdfFilePath,
        file_size_bytes: reportData.fileSizeBytes,
        sha256_hash: reportData.sha256Hash,
      },
    });
  } catch (err) {
    console.error('Error generating inspection report:', err);
    return res.status(500).json({ detail: err.message });
  }
};

// @desc    Download generated PDF inspection report
// @route   GET /api/v1/inspections/:id/report/download
const downloadReport = async (req, res) => {
  try {
    let inspection = await Inspection.findById(req.params.id);
    if (!inspection) {
      return res.status(404).json({ detail: `Inspection '${req.params.id}' not found.` });
    }

    // Auto-generate if report has not been generated yet
    if (!inspection.report || !inspection.report.pdfFilePath) {
      await generateInspectionPdf(req.params.id, req.user._id);
      inspection = await Inspection.findById(req.params.id);
    }

    const fullPdfPath = path.resolve(process.cwd(), inspection.report.pdfFilePath);
    if (!fs.existsSync(fullPdfPath)) {
      // Re-generate if file missing on disk
      await generateInspectionPdf(req.params.id, req.user._id);
    }

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${inspection.report.reportNumber}.pdf"`
    );
    res.setHeader('X-Report-SHA256', inspection.report.sha256Hash);

    return res.sendFile(fullPdfPath);
  } catch (err) {
    console.error('Error downloading report:', err);
    return res.status(500).json({ detail: err.message });
  }
};

// @desc    Cryptographic SHA-256 integrity verification
// @route   POST /api/v1/inspections/:id/report/verify
const verifyReport = async (req, res) => {
  try {
    const verification = await verifyReportIntegrity(req.params.id);
    return res.status(200).json(verification);
  } catch (err) {
    console.error('Error verifying report integrity:', err);
    return res.status(500).json({ detail: err.message });
  }
};

// @desc    Export complete inspection dossier as JSON
// @route   GET /api/v1/inspections/:id/export/json
const exportDossierJson = async (req, res) => {
  try {
    const inspection = await Inspection.findById(req.params.id);
    if (!inspection) {
      return res.status(404).json({ detail: `Inspection '${req.params.id}' not found.` });
    }

    let product = null;
    if (inspection.productId) {
      product = await Product.findById(inspection.productId);
    }

    let inspector = null;
    if (inspection.inspectorId) {
      inspector = await User.findById(inspection.inspectorId);
    }

    const exportData = exportInspectionJson(inspection, product, inspector);

    res.setHeader('Content-Type', 'application/json');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${inspection.inspectionNumber}_dossier.json"`
    );

    return res.status(200).json(exportData);
  } catch (err) {
    console.error('Error exporting dossier JSON:', err);
    return res.status(500).json({ detail: err.message });
  }
};

// @desc    Export declarations and findings as CSV
// @route   GET /api/v1/inspections/:id/export/csv
const exportDossierCsv = async (req, res) => {
  try {
    const inspection = await Inspection.findById(req.params.id);
    if (!inspection) {
      return res.status(404).json({ detail: `Inspection '${req.params.id}' not found.` });
    }

    const csvContent = exportInspectionCsv(inspection);

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${inspection.inspectionNumber}_findings.csv"`
    );

    return res.status(200).send(csvContent);
  } catch (err) {
    console.error('Error exporting dossier CSV:', err);
    return res.status(500).json({ detail: err.message });
  }
};

module.exports = {
  generateReport,
  downloadReport,
  verifyReport,
  exportDossierJson,
  exportDossierCsv,
};
