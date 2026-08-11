import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { getToken } from '../services/authStorage';
import '../css/Dailyexpensemanager.css';

const apiBaseUrl = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/+$/, '');
const DAILY_EXPENSE_ENDPOINT = '/daily-expense';
const DAILY_EXPENSE_GENERATED_NO_ENDPOINT = `${DAILY_EXPENSE_ENDPOINT}/generated-no`;
const DAILY_EXPENSE_ER_GENERATED_NO_ENDPOINT = `${DAILY_EXPENSE_ENDPOINT}/expense-report-generated-no`;
const DAILY_EXPENSE_PDF_SUMMARY_ENDPOINT = `${DAILY_EXPENSE_ENDPOINT}/pdf-summary`;
const COST_UNITS_ENDPOINT = '/costunits';
const CURRENT_EMPLOYEE_ENDPOINT = '/employees/current';
const MANAGER_PAGE_SIZE = 8;
const MAX_VISIBLE_PAGE_BUTTONS = 8;
const REPORT_PRINT_SINGLE_PAGE_ROWS = 27;
const REPORT_PRINT_FIRST_PAGE_ROWS = 34;
const REPORT_PRINT_CONTINUATION_ROWS = 43;
const REPORT_PRINT_LAST_CONTINUATION_ROWS = 37;
const ER_FORM_FIRST_PAGE_ROWS = 21;
const ER_FORM_CONTINUATION_ROWS = 28;
const ER_FORM_LAST_PAGE_ROWS = 24;
const ER_FORM_SINGLE_PAGE_ROWS = 14;
const REPORT_VERIFIED_BY = 'ANGEL RASONABE';
const REPORT_APPROVED_BY = 'VILMA C';
const PDF_PAGE_WIDTH = 612;
const PDF_PAGE_HEIGHT = 936;
const PDF_LANDSCAPE_WIDTH = PDF_PAGE_HEIGHT;
const PDF_LANDSCAPE_HEIGHT = PDF_PAGE_WIDTH;

function buildApiUrl(path) {
  return apiBaseUrl ? `${apiBaseUrl}${path}` : path;
}

function getField(row, fieldNames) {
  for (const fieldName of fieldNames) {
    const value = row?.[fieldName];

    if (value !== undefined && value !== null && String(value).trim()) {
      return value;
    }
  }

  return '';
}

function getApiCollection(data) {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.$values)) return data.$values;
  if (Array.isArray(data?.items)) return data.items;
  if (Array.isArray(data?.data)) return data.data;
  if (Array.isArray(data?.result)) return data.result;
  if (Array.isArray(data?.records)) return data.records;

  return [];
}

function getGeneratedNoFromApi(data) {
  if (typeof data === 'string' || typeof data === 'number') {
    return String(data).trim();
  }

  return getField(data, [
    'generatedNo',
    'generateNo',
    'reportNo',
    'referenceNo',
    'no',
    'value',
    'GeneratedNo',
    'GenerateNo',
    'ReportNo',
    'ReferenceNo',
    'No',
    'Value',
  ]) || getField(data?.data, [
    'generatedNo',
    'generateNo',
    'reportNo',
    'referenceNo',
    'no',
    'value',
    'GeneratedNo',
    'GenerateNo',
    'ReportNo',
    'ReferenceNo',
    'No',
    'Value',
  ]) || getField(data?.result, [
    'generatedNo',
    'generateNo',
    'reportNo',
    'referenceNo',
    'no',
    'value',
    'GeneratedNo',
    'GenerateNo',
    'ReportNo',
    'ReferenceNo',
    'No',
    'Value',
  ]);
}

function formatDate(value) {
  if (!value) {
    return '';
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return String(value);
  }

  return date.toLocaleDateString('en-US', {
    month: '2-digit',
    day: '2-digit',
    year: 'numeric',
  });
}

function formatDateForInput(value) {
  if (!value) {
    return '';
  }

  const valueText = String(value).trim();
  const isoDateMatch = valueText.match(/^(\d{4})-(\d{2})-(\d{2})/);

  if (isoDateMatch) {
    return `${isoDateMatch[1]}-${isoDateMatch[2]}-${isoDateMatch[3]}`;
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    const [month, day, year] = valueText.split('/');

    if (year && month && day) {
      const firstNumber = Number(month);
      const secondNumber = Number(day);
      const normalizedMonth = firstNumber > 12 && secondNumber <= 12 ? day : month;
      const normalizedDay = firstNumber > 12 && secondNumber <= 12 ? month : day;

      return `${year}-${normalizedMonth.padStart(2, '0')}-${normalizedDay.padStart(2, '0')}`;
    }

    return valueText;
  }

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
}

function formatMoney(value) {
  const numberValue = Number(String(value || 0).replace(/,/g, '')) || 0;

  return numberValue.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 4,
  });
}

function parseMoney(value) {
  return Number(String(value || 0).replace(/,/g, '')) || 0;
}

function stripExpenseTypeCode(value) {
  const text = String(value || '').trim();

  if (!text) {
    return '';
  }

  const separatorIndex = text.indexOf(' - ');

  return separatorIndex >= 0 ? text.slice(separatorIndex + 3).trim() : text;
}

function formatPrintUppercase(value) {
  return String(value || '').toUpperCase();
}

function getTodayInputDate() {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const day = String(today.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
}

function getUserField(user, fieldNames) {
  if (!user) {
    return '';
  }

  for (const fieldName of fieldNames) {
    const value = user[fieldName];

    if (value !== undefined && value !== null && String(value).trim()) {
      return String(value).trim();
    }
  }

  return '';
}

function getReportEmployeeNo(user, rows) {
  return getUserField(user, [
    'employeeNo',
    'employeeCode',
    'employeeNumber',
    'empNo',
    'employeeId',
    'employeeID',
    'EmployeeNo',
    'EmployeeCode',
    'EmployeeNumber',
    'EmployeeId',
    'EmployeeID',
  ]) || rows.find((row) => row.employeeCode)?.employeeCode || '';
}

function getReportEmployeeName(user, rows) {
  const fullName = getUserField(user, ['employeeName', 'fullName', 'name', 'displayName', 'EmployeeName', 'FullName', 'Name']);

  if (fullName) {
    return fullName;
  }

  const lastName = getUserField(user, ['lastName', 'lastname', 'LastName', 'LASTNAME']);
  const firstName = getUserField(user, ['firstName', 'firstname', 'FirstName', 'FIRSTNAME']);

  if (lastName && firstName) {
    return `${lastName}, ${firstName}`;
  }

  return rows.find((row) => row.employeeName)?.employeeName || firstName || lastName || '';
}

function normalizeReportEmployee(row) {
  if (!row) {
    return null;
  }

  const employeeNo = getReportEmployeeNo(row, []);
  const employeeName = getReportEmployeeName(row, []);

  if (!employeeNo && !employeeName) {
    return null;
  }

  return {
    employeeNo,
    employeeName,
  };
}

function getReportEmployeeFromApi(data) {
  return normalizeReportEmployee(data)
    || normalizeReportEmployee(data?.employee)
    || normalizeReportEmployee(data?.Employee)
    || normalizeReportEmployee(data?.data)
    || normalizeReportEmployee(data?.result);
}

function getSortValue(row, column) {
  if (column.isNumber) {
    return Number(String(row[`${column.key}Value`] ?? row[column.key] ?? 0).replace(/,/g, '')) || 0;
  }

  if (column.key === 'date') {
    return row.dateInput || row.date || '';
  }

  if (column.key === 'receiptDate') {
    return row.receiptDateInput || row.receiptDate || '';
  }

  return String(row[column.key] || '').toLowerCase();
}

function getVisiblePages(currentPage, totalPages) {
  const visibleCount = Math.min(MAX_VISIBLE_PAGE_BUTTONS, totalPages);
  const half = Math.floor(visibleCount / 2);
  const start = Math.max(1, Math.min(currentPage - half, totalPages - visibleCount + 1));

  return Array.from({ length: visibleCount }, (_, index) => start + index);
}

function chunkRowsForPrint(rows) {
  if (!rows.length) {
    return [[]];
  }

  if (rows.length <= REPORT_PRINT_SINGLE_PAGE_ROWS) {
    return [rows];
  }

  const pages = [];
  let rowIndex = Math.min(REPORT_PRINT_FIRST_PAGE_ROWS, rows.length - 1);
  pages.push(rows.slice(0, rowIndex));

  while (rowIndex < rows.length) {
    const rowsLeft = rows.length - rowIndex;
    const rowsForPage = rowsLeft <= REPORT_PRINT_LAST_CONTINUATION_ROWS
      ? rowsLeft
      : Math.min(REPORT_PRINT_CONTINUATION_ROWS, rowsLeft - 1);

    pages.push(rows.slice(rowIndex, rowIndex + rowsForPage));
    rowIndex += rowsForPage;
  }

  return pages;
}

function chunkRowsForErForm(rows) {
  if (!rows.length) {
    return [[]];
  }

  if (rows.length <= ER_FORM_SINGLE_PAGE_ROWS) {
    return [rows];
  }

  if (rows.length <= ER_FORM_FIRST_PAGE_ROWS + 1) {
    return [rows, []];
  }

  const pages = [];
  let rowIndex = Math.min(ER_FORM_FIRST_PAGE_ROWS, rows.length - 1);
  pages.push(rows.slice(0, rowIndex));
  const remainingRows = rows.length - rowIndex;
  let pagesLeft = Math.ceil(Math.max(0, remainingRows - ER_FORM_LAST_PAGE_ROWS) / ER_FORM_CONTINUATION_ROWS) + 1;

  while (rowIndex < rows.length) {
    const rowsLeft = rows.length - rowIndex;
    const isLastChunk = pagesLeft <= 1;
    const laterCapacity = Math.max(0, pagesLeft - 2) * ER_FORM_CONTINUATION_ROWS + ER_FORM_LAST_PAGE_ROWS;
    const balancedRows = Math.ceil(rowsLeft / pagesLeft);
    const requiredRows = isLastChunk ? rowsLeft : Math.max(1, rowsLeft - laterCapacity);
    const pageCapacity = isLastChunk ? ER_FORM_LAST_PAGE_ROWS : ER_FORM_CONTINUATION_ROWS;
    const rowsForPage = Math.min(pageCapacity, Math.max(balancedRows, requiredRows));

    pages.push(rows.slice(rowIndex, rowIndex + rowsForPage));
    rowIndex += rowsForPage;
    pagesLeft -= 1;
  }

  return pages;
}

function getReportDateSortKey(row) {
  return getReportFilterDateInput(row) || getReportReceiptDateInput(row) || row.date || row.receiptDate || '';
}

function getErFormRows(rows) {
  let previousDateKey = '';

  return [...rows]
    .sort((first, second) => getReportDateSortKey(first).localeCompare(getReportDateSortKey(second)))
    .map((row) => {
      const dateKey = getReportDateSortKey(row);
      const date = dateKey === previousDateKey ? '' : formatDate(dateKey);
      previousDateKey = dateKey;

      return {
        date,
        activity: row.description || row.expenseType || '',
        expenseType: stripExpenseTypeCode(row.expenseType) || '',
        total: parseMoney(row.totalValue ?? row.total),
      };
    });
}

function normalizeErSummaryRows(rows, dateFrom) {
  const activityRows = new Map();

  getApiCollection(rows).forEach((row) => {
    const dateInput = formatDateForInput(getField(row, ['entryDate', 'EntryDate', 'createdDate', 'CreatedDate', 'date', 'Date']));
    const activity = getField(row, ['activity', 'Activity', 'description', 'Description']) || 'OTHERS';
    const expenseType = stripExpenseTypeCode(getField(row, ['expenseType', 'ExpenseType', 'expenseTypeDescription', 'ExpenseTypeDescription'])) || 'OTHERS';
    const total = parseMoney(getField(row, ['total', 'Total', 'amount', 'Amount']));
    const activityKey = `${dateInput || 'no-date'}|${activity}`;

    if (!activityRows.has(activityKey)) {
      activityRows.set(activityKey, {
        date: dateInput ? formatDate(dateInput) : '',
        dateInput,
        activity,
        amounts: {},
        total: 0,
      });
    }

    const activityRow = activityRows.get(activityKey);
    activityRow.amounts[expenseType] = (activityRow.amounts[expenseType] || 0) + total;
    activityRow.total += total;
  });

  return [...activityRows.values()].sort((first, second) => {
    const dateSort = String(first.dateInput || '').localeCompare(String(second.dateInput || ''));
    return dateSort || first.activity.localeCompare(second.activity);
  });
}

function escapePdfText(value) {
  return String(value ?? '')
    .replace(/\\/g, '\\\\')
    .replace(/\(/g, '\\(')
    .replace(/\)/g, '\\)')
    .replace(/[^\x20-\x7E]/g, '');
}

function estimatePdfTextWidth(text, size, font = 'F1') {
  const upperWideCharacters = new Set(['M', 'W']);
  const upperNarrowCharacters = new Set(['I', 'J']);
  const narrowCharacters = new Set(['i', 'j', 'l', 't', 'f', 'r', '.', ',', ':', ';', '|', '!', '\'']);
  const mediumCharacters = new Set([' ', '-', '/', '\\', '(', ')', '[', ']']);
  const fontWeightScale = font === 'F2' ? 1.03 : 1;

  return String(text || '').split('').reduce((sum, character) => {
    if (upperWideCharacters.has(character)) {
      return sum + (size * 0.82 * fontWeightScale);
    }

    if (upperNarrowCharacters.has(character) || narrowCharacters.has(character)) {
      return sum + (size * 0.34 * fontWeightScale);
    }

    if (mediumCharacters.has(character)) {
      return sum + (size * 0.32 * fontWeightScale);
    }

    if (/[A-Z]/.test(character)) {
      return sum + (size * 0.62 * fontWeightScale);
    }

    if (/[0-9]/.test(character)) {
      return sum + (size * 0.56 * fontWeightScale);
    }

    return sum + (size * 0.5 * fontWeightScale);
  }, 0);
}

function pdfText(page, text, x, y, size = 8, options = {}) {
  const safeText = escapePdfText(text);
  const align = options.align || 'left';
  const width = options.width || 0;
  const font = options.font || 'F1';
  const estimatedWidth = estimatePdfTextWidth(safeText, size, font);
  const textX = align === 'right' ? x + width - estimatedWidth : align === 'center' ? x + ((width - estimatedWidth) / 2) : x;
  const gray = options.gray ?? 0;

  page.push(`q ${gray} g BT /${font} ${size} Tf ${textX.toFixed(2)} ${y.toFixed(2)} Td (${safeText}) Tj ET Q`);
}

function wrapPdfText(text, width, size, maxLines = 2, charWidthFactor = 0.52) {
  const words = String(text || '').split(/\s+/).filter(Boolean);
  const maxChars = Math.max(4, Math.floor(width / (size * charWidthFactor)));
  const lines = [];
  let currentLine = '';

  words.forEach((word) => {
    if (word.length > maxChars) {
      if (currentLine) {
        lines.push(currentLine);
        currentLine = '';
      }

      for (let index = 0; index < word.length; index += maxChars) {
        lines.push(word.slice(index, index + maxChars));
      }
      return;
    }

    const candidate = currentLine ? `${currentLine} ${word}` : word;

    if (candidate.length <= maxChars || !currentLine) {
      currentLine = candidate;
      return;
    }

    lines.push(currentLine);
    currentLine = word;
  });

  if (currentLine) {
    lines.push(currentLine);
  }

  return lines.slice(0, maxLines);
}

function pdfLine(page, x1, y1, x2, y2, width = 0.6) {
  page.push(`q 0.72 G ${width} w ${x1.toFixed(2)} ${y1.toFixed(2)} m ${x2.toFixed(2)} ${y2.toFixed(2)} l S Q`);
}

function pdfRect(page, x, y, width, height) {
  page.push(`q 0.72 G 0.35 w ${x.toFixed(2)} ${y.toFixed(2)} ${width.toFixed(2)} ${height.toFixed(2)} re S Q`);
}

function pdfFillRect(page, x, y, width, height, gray = 0.96) {
  page.push(`q ${gray} g ${x.toFixed(2)} ${y.toFixed(2)} ${width.toFixed(2)} ${height.toFixed(2)} re f Q`);
}

function drawPdfCell(page, text, x, top, width, height, options = {}) {
  if (options.fill !== undefined) {
    pdfFillRect(page, x, top - height, width, height, options.fill);
  }

  pdfRect(page, x, top - height, width, height);
  pdfText(page, text, x + (options.paddingX || 6), top - (options.offsetY || 13), options.size || 7, {
    align: options.align,
    font: options.font,
    gray: options.gray,
    width: width - 10,
  });
}

function drawPdfWrappedCell(page, text, x, top, width, height, options = {}) {
  if (options.fill !== undefined) {
    pdfFillRect(page, x, top - height, width, height, options.fill);
  }

  pdfRect(page, x, top - height, width, height);

  const size = options.size || 7;
  const paddingX = options.paddingX ?? 4;
  const isCentered = options.align === 'center';
  const textX = isCentered ? x : x + paddingX;
  const textWidth = isCentered ? width : width - (paddingX * 2);
  const lines = wrapPdfText(formatPrintUppercase(text), width - (paddingX * 2), size, options.maxLines || 3, options.charWidthFactor);
  const lineHeight = options.lineHeight || size + 2;
  const blockHeight = size + ((lines.length - 1) * lineHeight);
  const startY = top - ((height - blockHeight) / 2) - size;

  lines.forEach((line, lineIndex) => {
    pdfText(page, line, textX, startY - (lineIndex * lineHeight), size, {
      align: options.align,
      font: options.font,
      gray: options.gray,
      width: textWidth,
    });
  });
}

function buildPdfBlobFromStreams(pageStreams, pageWidth = PDF_PAGE_WIDTH, pageHeight = PDF_PAGE_HEIGHT) {
  const objects = ['<< /Type /Catalog /Pages 2 0 R >>'];
  const pageObjectIds = [];
  const fontObjectId = 3 + (pageStreams.length * 2);
  const boldFontObjectId = fontObjectId + 1;

  pageStreams.forEach((stream, index) => {
    const pageObjectId = 3 + (index * 2);
    const contentObjectId = pageObjectId + 1;
    pageObjectIds.push(pageObjectId);
    objects.push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageWidth} ${pageHeight}] /Resources << /Font << /F1 ${fontObjectId} 0 R /F2 ${boldFontObjectId} 0 R >> >> /Contents ${contentObjectId} 0 R >>`);
    objects.push(`<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`);
  });

  objects.splice(1, 0, `<< /Type /Pages /Kids [${pageObjectIds.map((id) => `${id} 0 R`).join(' ')}] /Count ${pageStreams.length} >>`);
  objects.push('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>');
  objects.push('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>');

  let pdf = '%PDF-1.4\n';
  const offsets = [0];
  objects.forEach((object, index) => {
    offsets.push(pdf.length);
    pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });

  const xrefOffset = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  offsets.slice(1).forEach((offset) => {
    pdf += `${String(offset).padStart(10, '0')} 00000 n \n`;
  });
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;

  return new Blob([pdf], { type: 'application/pdf' });
}

function buildExpenseReportPdfBlob({ pages, reportNo, employeeNo, employeeName, reportDate, dateFrom, dateTo, grandTotal }) {
  const pageStreams = pages.map((pageRows, pageIndex) => {
    const isFirstPage = pageIndex === 0;
    const isLastPage = pageIndex === pages.length - 1;
    const stream = ['0.45 w', '0.45 G', '0 g'];
    const margin = 30;
    const usableWidth = PDF_PAGE_WIDTH - (margin * 2);
    const panelX = margin;
    const panelWidth = usableWidth;
    let top = PDF_PAGE_HEIGHT - 38;

    if (isFirstPage) {
      pdfText(stream, 'MASIGASIG DISTRIBUTION AND LOGISTICS INC.', panelX, top, 8, {
        align: 'center',
        width: panelWidth,
        font: 'F2',
        gray: 0.12,
      });
      top -= 16;
      pdfLine(stream, panelX, top, panelX + panelWidth, top, 0.9);
      top -= 14;

      const headerHeight = 58;
      pdfFillRect(stream, panelX, top - headerHeight, panelWidth, headerHeight, 0.985);
      pdfRect(stream, panelX, top - headerHeight, panelWidth, headerHeight);
      pdfText(stream, 'REIMBURSEMENT OF EXPENSES', panelX + 12, top - 25, 13, { font: 'F2', gray: 0.05 });
      pdfLine(stream, panelX + panelWidth - 140, top - 10, panelX + panelWidth - 140, top - 48, 0.45);
      pdfText(stream, 'GENERATE NO.', panelX + panelWidth - 128, top - 23, 5.5, { font: 'F2', gray: 0.24 });
      pdfText(stream, reportNo, panelX + panelWidth - 14, top - 38, 8, {
        align: 'right',
        width: 0,
        font: 'F2',
        gray: 0.05,
      });
      top -= headerHeight + 14;

      const infoHeight = 42;
      const employeeNoWidth = 128;
      const dateWidth = 118;
      const employeeNameWidth = panelWidth - employeeNoWidth - dateWidth;
      drawPdfCell(stream, 'EMPLOYEE NO.', panelX, top, employeeNoWidth, infoHeight, { fill: 0.98, size: 5.5, font: 'F2', gray: 0.26 });
      pdfText(stream, employeeNo, panelX + 8, top - 29, 7, { font: 'F2', gray: 0.04 });
      drawPdfCell(stream, 'NAME OF EMPLOYEE', panelX + employeeNoWidth, top, employeeNameWidth, infoHeight, { fill: 0.98, size: 5.5, font: 'F2', gray: 0.26 });
      pdfText(stream, formatPrintUppercase(employeeName), panelX + employeeNoWidth + 8, top - 29, 7, { font: 'F2', gray: 0.04 });
      drawPdfCell(stream, 'DATE', panelX + employeeNoWidth + employeeNameWidth, top, dateWidth, infoHeight, { fill: 0.98, size: 5.5, font: 'F2', gray: 0.26 });
      pdfText(stream, formatDate(reportDate), panelX + employeeNoWidth + employeeNameWidth + 8, top - 29, 7, { font: 'F2', gray: 0.04 });
      top -= infoHeight;

      const purposeHeight = 38;
      drawPdfCell(stream, 'PURPOSE', panelX, top, panelWidth, purposeHeight, { fill: 0.99, size: 5.5, font: 'F2', gray: 0.26 });
      pdfText(stream, `REIMBURSEMENT DATE FROM ${formatDate(dateFrom)} TO ${formatDate(dateTo)}`, panelX + 8, top - 26, 7, { font: 'F2', gray: 0.05 });
      top -= purposeHeight + 16;
    } else {
      top -= 8;
    }

    const tableDateWidth = 62;
    const tableRefWidth = 92;
    const tableAmountWidth = 96;
    const tableDescWidth = panelWidth - tableDateWidth - tableRefWidth - tableAmountWidth;
    const tableHeaderHeight = 28;
    const rowHeight = 18;

    drawPdfCell(stream, 'DATE', panelX, top, tableDateWidth, tableHeaderHeight, { fill: 0.955, size: 6, font: 'F2', gray: 0.14, offsetY: 17 });
    drawPdfCell(stream, 'DOCUMENT NO.', panelX + tableDateWidth, top, tableRefWidth, tableHeaderHeight, { fill: 0.955, size: 6, font: 'F2', gray: 0.14, offsetY: 17 });
    drawPdfCell(stream, 'PARTICULARS / DESCRIPTION', panelX + tableDateWidth + tableRefWidth, top, tableDescWidth, tableHeaderHeight, { fill: 0.955, size: 6, font: 'F2', gray: 0.14, offsetY: 17 });
    drawPdfCell(stream, 'TOTAL AMOUNT', panelX + tableDateWidth + tableRefWidth + tableDescWidth, top, tableAmountWidth, tableHeaderHeight, { fill: 0.955, size: 6, font: 'F2', gray: 0.14, offsetY: 17 });
    top -= tableHeaderHeight;

    if (pageRows.length > 0) {
      pageRows.forEach((row, rowIndex) => {
        const fill = rowIndex % 2 === 0 ? 1 : 0.992;
        drawPdfCell(stream, getReportReceiptDate(row), panelX, top, tableDateWidth, rowHeight, { fill, size: 6.2, gray: 0.16, offsetY: 12 });
        drawPdfCell(stream, row.documentNo, panelX + tableDateWidth, top, tableRefWidth, rowHeight, { fill, size: 6.2, gray: 0.16, offsetY: 12 });
        drawPdfCell(stream, formatPrintUppercase(row.description || row.expenseType).slice(0, 76), panelX + tableDateWidth + tableRefWidth, top, tableDescWidth, rowHeight, { fill, size: 6.2, gray: 0.12, offsetY: 12 });
        drawPdfCell(stream, formatMoney(row.totalValue ?? row.total), panelX + tableDateWidth + tableRefWidth + tableDescWidth, top, tableAmountWidth, rowHeight, {
          align: 'right',
          fill,
          size: 6.2,
          gray: 0.08,
          offsetY: 12,
        });
        top -= rowHeight;
      });
    } else {
      drawPdfCell(stream, 'NO TRANSACTIONS FOUND FOR THE SELECTED DATE RANGE.', panelX, top, panelWidth, rowHeight, {
        align: 'center',
        fill: 1,
        size: 6.5,
        font: 'F2',
        gray: 0.26,
        offsetY: 12,
      });
      top -= rowHeight;
    }

    if (isLastPage) {
      const totalHeight = 34;
      pdfFillRect(stream, panelX, top - totalHeight, panelWidth, totalHeight, 0.95);
      pdfRect(stream, panelX, top - totalHeight, tableDateWidth + tableRefWidth + tableDescWidth, totalHeight);
      pdfText(stream, 'TOTAL', panelX + 10, top - 21, 8, { font: 'F2', gray: 0.05 });
      pdfRect(stream, panelX + tableDateWidth + tableRefWidth + tableDescWidth, top - totalHeight, tableAmountWidth, totalHeight);
      pdfText(stream, formatMoney(grandTotal), panelX + tableDateWidth + tableRefWidth + tableDescWidth + 8, top - 22, 7, {
        align: 'right',
        width: tableAmountWidth - 16,
        font: 'F2',
        gray: 0.02,
      });
      top -= totalHeight + 18;
      const signatureHeight = 70;
      const signatureHeaderHeight = 24;
      const signatureWidth = panelWidth / 3;
      ['SUBMITTED BY', 'VERIFIED BY', 'APPROVED BY'].forEach((label, index) => {
        const x = panelX + (signatureWidth * index);
        pdfFillRect(stream, x, top - signatureHeaderHeight, signatureWidth, signatureHeaderHeight, 0.965);
        pdfRect(stream, x, top - signatureHeaderHeight, signatureWidth, signatureHeaderHeight);
        pdfText(stream, label, x + 8, top - 15, 5.8, { align: 'center', width: signatureWidth - 16, font: 'F2', gray: 0.22 });
        pdfRect(stream, x, top - signatureHeight, signatureWidth, signatureHeight - signatureHeaderHeight);
        const name = index === 0 ? formatPrintUppercase(employeeName) : index === 1 ? REPORT_VERIFIED_BY : REPORT_APPROVED_BY;
        pdfText(stream, name, x + 8, top - 52, 7, { align: 'center', width: signatureWidth - 16, font: 'F2', gray: 0.05 });
      });
    } else {
      top -= 18;
    }

    if (pages.length > 1) {
      pdfText(stream, `PAGE ${pageIndex + 1} OF ${pages.length}`, panelX, 34, 6, {
        align: 'right',
        width: panelWidth,
        font: 'F2',
        gray: 0.45,
      });
    }

    return stream.join('\n');
  });

  return buildPdfBlobFromStreams(pageStreams);
}

function buildErFormPdfBlob({ rows, reportNo, employeeNo, employeeName, purpose, reportDate, dateFrom, dateTo, grandTotal }) {
  const pages = chunkRowsForErForm(rows);
  const expenseTypes = [...new Set(rows.flatMap((row) => {
    const amountTypes = Object.keys(row.amounts || {});
    return amountTypes.length ? amountTypes : [row.expenseType || 'OTHERS'];
  }))];
  const expenseTotals = expenseTypes.reduce((totals, expenseType) => ({
    ...totals,
    [expenseType]: rows.reduce((sum, row) => {
      if (row.amounts) {
        return sum + (row.amounts[expenseType] || 0);
      }

      return (row.expenseType || 'OTHERS') === expenseType ? sum + row.total : sum;
    }, 0),
  }), {});
  const lastDataPageIndex = pages.reduce((lastIndex, pageRows, index) => (
    pageRows.length ? index : lastIndex
  ), 0);
  const pageStreams = pages.map((pageRows, pageIndex) => {
    const isFirstPage = pageIndex === 0;
    const isLastPage = pageIndex === pages.length - 1;
    const isLastDataPage = pageIndex === lastDataPageIndex;
    const isApprovalOnlyPage = isLastPage && !pageRows.length && pageIndex > lastDataPageIndex;
    const stream = ['0.45 w', '0.45 G', '0 g'];
    const margin = 34;
    const panelX = margin;
    const panelWidth = PDF_LANDSCAPE_WIDTH - (margin * 2);
    let top = PDF_LANDSCAPE_HEIGHT - 42;

    const infoHeight = 24;
    const infoTextOffsetY = 15;
    const labelWidth = 92;
    const valueWidth = (panelWidth - (labelWidth * 2)) / 2;

    if (isFirstPage) {
      pdfText(stream, 'MASIGASIG DISTRIBUTION AND LOGISTICS INC.', panelX, top, 8, {
        align: 'center',
        width: panelWidth,
        font: 'F2',
        gray: 0.12,
      });
      top -= 18;
      pdfLine(stream, panelX, top, panelX + panelWidth, top, 0.45);
      top -= 22;

      pdfText(stream, 'EXPENSE REPORT', panelX, top, 16, {
        align: 'center',
        width: panelWidth,
        font: 'F2',
        gray: 0.02,
      });
      top -= 30;

      drawPdfCell(stream, 'EMPLOYEE NO.', panelX, top, labelWidth, infoHeight, { fill: 0.955, size: 6, font: 'F2', gray: 0.18, offsetY: infoTextOffsetY });
      drawPdfCell(stream, employeeNo, panelX + labelWidth, top, valueWidth, infoHeight, { fill: 1, size: 7.2, font: 'F2', gray: 0.04, offsetY: infoTextOffsetY });
      drawPdfCell(stream, 'DATE', panelX + labelWidth + valueWidth, top, labelWidth, infoHeight, { fill: 0.955, size: 6, font: 'F2', gray: 0.18, offsetY: infoTextOffsetY });
      drawPdfCell(stream, formatDate(reportDate), panelX + labelWidth + valueWidth + labelWidth, top, valueWidth, infoHeight, { fill: 1, size: 7.2, font: 'F2', gray: 0.04, offsetY: infoTextOffsetY });
      top -= infoHeight;

      drawPdfCell(stream, 'EMPLOYEE NAME', panelX, top, labelWidth, infoHeight, { fill: 0.955, size: 6, font: 'F2', gray: 0.18, offsetY: infoTextOffsetY });
      drawPdfCell(stream, formatPrintUppercase(employeeName), panelX + labelWidth, top, valueWidth, infoHeight, { fill: 1, size: 7.2, font: 'F2', gray: 0.04, offsetY: infoTextOffsetY });
      drawPdfCell(stream, 'PERIOD COVERED', panelX + labelWidth + valueWidth, top, labelWidth, infoHeight, { fill: 0.955, size: 6, font: 'F2', gray: 0.18, offsetY: infoTextOffsetY });
      drawPdfCell(stream, `${formatDate(dateFrom)} - ${formatDate(dateTo)}`, panelX + labelWidth + valueWidth + labelWidth, top, valueWidth, infoHeight, { fill: 1, size: 7.2, font: 'F2', gray: 0.04, offsetY: infoTextOffsetY });
      top -= infoHeight;

      const descriptionLabelWidth = 136;
      const descriptionValueWidth = labelWidth + valueWidth - descriptionLabelWidth;
      drawPdfCell(stream, 'DESCRIPTION OF CASH ADVANCES', panelX, top, descriptionLabelWidth, infoHeight, { fill: 0.955, size: 6, font: 'F2', gray: 0.18, offsetY: infoTextOffsetY, paddingX: 4 });
      drawPdfCell(stream, formatPrintUppercase(purpose), panelX + descriptionLabelWidth, top, descriptionValueWidth, infoHeight, { fill: 1, size: 7.2, font: 'F2', gray: 0.04, offsetY: infoTextOffsetY });
      drawPdfCell(stream, 'ER #', panelX + labelWidth + valueWidth, top, labelWidth, infoHeight, { fill: 0.955, size: 6, font: 'F2', gray: 0.18, offsetY: infoTextOffsetY });
      drawPdfCell(stream, reportNo || '', panelX + labelWidth + valueWidth + labelWidth, top, valueWidth, infoHeight, { fill: 1, size: 7.2, font: 'F2', gray: 0.04, offsetY: infoTextOffsetY });
      top -= infoHeight + 20;
    }

    const dateWidth = 56;
    const totalWidth = 72;
    const minimumActivityWidth = 190;
    const maxExpenseTypesWidth = panelWidth - dateWidth - totalWidth - minimumActivityWidth;
    const uniformExpenseTypeWidth = expenseTypes.length
      ? Math.max(46, Math.min(92, maxExpenseTypesWidth / expenseTypes.length))
      : 0;
    const expenseTypeWidths = expenseTypes.map(() => uniformExpenseTypeWidth);
    const expenseTypesWidth = expenseTypeWidths.reduce((sum, width) => sum + width, 0);
    const activityWidth = panelWidth - dateWidth - totalWidth - expenseTypesWidth;
    const headerHeight = 28;
    const bodyFontSize = expenseTypes.length > 6 ? 5 : 5.5;
    const headerFontSize = bodyFontSize;
    const headerLineHeight = expenseTypes.length > 6 ? 5.4 : 6;
    const rowHeight = 14;

    if (!isApprovalOnlyPage) {
      drawPdfWrappedCell(stream, 'DATE', panelX, top, dateWidth, headerHeight, { align: 'center', fill: 0.94, size: headerFontSize, font: 'F2', gray: 0.08, maxLines: 2, lineHeight: headerLineHeight, paddingX: 3, charWidthFactor: 0.68 });
      drawPdfWrappedCell(stream, 'ACTIVITY', panelX + dateWidth, top, activityWidth, headerHeight, { align: 'center', fill: 0.94, size: headerFontSize, font: 'F2', gray: 0.08, maxLines: 2, lineHeight: headerLineHeight, paddingX: 3, charWidthFactor: 0.68 });
      let expenseTypeX = panelX + dateWidth + activityWidth;
      expenseTypes.forEach((expenseType, expenseIndex) => {
        const expenseTypeWidth = expenseTypeWidths[expenseIndex];
        drawPdfWrappedCell(stream, expenseType, expenseTypeX, top, expenseTypeWidth, headerHeight, {
          align: 'center',
          fill: 0.94,
          size: headerFontSize,
          font: 'F2',
          gray: 0.08,
          maxLines: 4,
          lineHeight: headerLineHeight,
          paddingX: 3,
          charWidthFactor: 0.72,
        });
        expenseTypeX += expenseTypeWidth;
      });
      drawPdfWrappedCell(stream, 'TOTAL', panelX + panelWidth - totalWidth, top, totalWidth, headerHeight, { align: 'center', fill: 0.94, size: headerFontSize, font: 'F2', gray: 0.08, maxLines: 2, lineHeight: headerLineHeight, paddingX: 3, charWidthFactor: 0.68 });
      top -= headerHeight;

      if (pageRows.length > 0) {
        pageRows.forEach((row, rowIndex) => {
          const fill = rowIndex % 2 === 0 ? 1 : 0.992;
          drawPdfCell(stream, row.date, panelX, top, dateWidth, rowHeight, { align: 'center', fill, size: bodyFontSize, font: 'F2', gray: 0.08, offsetY: 9.5 });
          drawPdfCell(stream, formatPrintUppercase(row.activity).slice(0, Math.max(38, Math.floor(activityWidth / 3.6))), panelX + dateWidth, top, activityWidth, rowHeight, { fill, size: bodyFontSize, gray: 0.1, offsetY: 9.5 });
          let amountX = panelX + dateWidth + activityWidth;
          expenseTypes.forEach((expenseType, expenseIndex) => {
            const expenseTypeWidth = expenseTypeWidths[expenseIndex];
            const rawAmount = row.amounts ? row.amounts[expenseType] : ((row.expenseType || 'OTHERS') === expenseType ? row.total : 0);
            const amount = rawAmount ? formatMoney(rawAmount) : '';
            drawPdfCell(stream, amount, amountX, top, expenseTypeWidth, rowHeight, {
              align: 'right',
              fill,
              size: bodyFontSize,
              gray: 0.06,
              offsetY: 9.5,
              paddingX: 5,
            });
            amountX += expenseTypeWidth;
          });
          drawPdfCell(stream, formatMoney(row.total), panelX + panelWidth - totalWidth, top, totalWidth, rowHeight, {
            align: 'right',
            fill,
            size: bodyFontSize,
            gray: 0.06,
            offsetY: 9.5,
            paddingX: 5,
          });
          top -= rowHeight;
        });
      } else {
        drawPdfCell(stream, 'NO TRANSACTIONS FOUND FOR THE SELECTED DATE RANGE.', panelX, top, panelWidth, rowHeight, {
          align: 'center',
          fill: 1,
          size: 6.5,
          font: 'F2',
          gray: 0.26,
          offsetY: 12,
        });
        top -= rowHeight;
      }
    }

    if (isLastDataPage) {
      const totalHeight = 20;
      top -= 4;
      pdfFillRect(stream, panelX, top - totalHeight, panelWidth, totalHeight, 0.925);
      pdfRect(stream, panelX, top - totalHeight, dateWidth + activityWidth, totalHeight);
      pdfLine(stream, panelX, top, panelX + panelWidth, top, 0.75);
      pdfLine(stream, panelX, top - totalHeight, panelX + panelWidth, top - totalHeight, 0.75);
      pdfText(stream, 'TOTALS', panelX + 8, top - 12.5, bodyFontSize, { font: 'F2', gray: 0.04 });
      let totalX = panelX + dateWidth + activityWidth;
      expenseTypes.forEach((expenseType, expenseIndex) => {
        const expenseTypeWidth = expenseTypeWidths[expenseIndex];
        const x = totalX;
        pdfRect(stream, x, top - totalHeight, expenseTypeWidth, totalHeight);
        pdfText(stream, formatMoney(expenseTotals[expenseType]), x + 4, top - 12.5, bodyFontSize, {
          align: 'right',
          width: expenseTypeWidth - 8,
          font: 'F2',
          gray: 0.02,
        });
        totalX += expenseTypeWidth;
      });
      pdfRect(stream, panelX + panelWidth - totalWidth, top - totalHeight, totalWidth, totalHeight);
      pdfText(stream, formatMoney(grandTotal), panelX + panelWidth - totalWidth + 5, top - 12.5, bodyFontSize, {
        align: 'right',
        width: totalWidth - 10,
        font: 'F2',
        gray: 0.02,
      });
      top -= totalHeight + 22;
    }

    if (isLastPage) {
      if (isApprovalOnlyPage) {
        top -= 118;
      }

      const approvalsLabelX = panelX + 28;
      const approvalsLineX = panelX + 112;
      const approvalsLineWidth = 170;
      pdfText(stream, 'APPROVALS', panelX, top, 9, { font: 'F2', gray: 0.05 });
      pdfLine(stream, panelX, top - 6, panelX + panelWidth, top - 6, 0.35);
      top -= 22;
      [
        ['SUBMITTED BY:', formatPrintUppercase(employeeName)],
        ['CHECKED BY:', ''],
        ['APPROVED BY:', ''],
      ].forEach(([label, name]) => {
        pdfText(stream, label, approvalsLabelX, top, 7.2, { font: 'F2', gray: 0.08 });
        if (name) {
          pdfText(stream, name, approvalsLineX, top, 7.2, { align: 'center', width: approvalsLineWidth, font: 'F2', gray: 0.05 });
        }
        pdfLine(stream, approvalsLineX, top - 3, approvalsLineX + approvalsLineWidth, top - 3, 0.45);
        top -= 18;
      });
    }

    if (pages.length > 1) {
      pdfText(stream, `PAGE ${pageIndex + 1} OF ${pages.length}`, panelX, 18, 6, {
        align: 'right',
        width: panelWidth,
        font: 'F2',
        gray: 0.45,
      });
    }

    return stream.join('\n');
  });

  return buildPdfBlobFromStreams(pageStreams, PDF_LANDSCAPE_WIDTH, PDF_LANDSCAPE_HEIGHT);
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function normalizeCostUnit(row) {
  const costUnitId = getField(row, ['costUnitID', 'costUnitId', 'CostUnitID', 'CostUnitId', 'id', 'Id']);
  const code = getField(row, ['code', 'Code']);
  const description = getField(row, ['description', 'Description']);

  if (!costUnitId || !code || !description) {
    return null;
  }

  return {
    costUnitId: String(costUnitId),
    display: `${code} - ${description}`,
  };
}

function normalizeExpenseStatusValue(value) {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  const normalized = String(value || '').trim().toLowerCase();

  if (normalized === 'approved' || normalized === '1') {
    return 1;
  }

  if (normalized === 'rejected' || normalized === '2') {
    return 2;
  }

  return 0;
}

function getExpenseStatusLabel(value) {
  const normalizedValue = normalizeExpenseStatusValue(value);

  if (normalizedValue === 1) {
    return 'Approved';
  }

  if (normalizedValue === 2) {
    return 'Rejected';
  }

  return 'Pending';
}

function getExpenseStatusClassName(value) {
  const normalizedValue = normalizeExpenseStatusValue(value);

  if (normalizedValue === 1) {
    return 'approved';
  }

  if (normalizedValue === 2) {
    return 'rejected';
  }

  return 'pending';
}

function getReportReceiptDateInput(row) {
  return row.receiptDateInput || formatDateForInput(row.receiptDate) || row.dateInput || formatDateForInput(row.date);
}

function getReportReceiptDate(row) {
  return row.receiptDate || formatDate(row.receiptDateInput) || row.date || formatDate(row.dateInput);
}

function getReportFilterDateInput(row) {
  return row.dateInput || formatDateForInput(row.date);
}

function normalizeDailyExpense(row, subsidiaryById = new Map()) {
  const expenseDate = getField(row, ['expenseDate', 'ExpenseDate', 'date', 'Date']);
  const receiptDate = getField(row, [
    'receiptDate',
    'ReceiptDate',
    'receiptdate',
    'Receipt_Date',
    'receipt_Date',
    'receipt_date',
    'Receipt_Date',
    'dateReceipt',
    'DateReceipt',
  ]);
  const subsidiaryId = getField(row, ['costUnitID', 'costUnitId', 'CostUnitID', 'CostUnitId', 'subsidiaryId', 'SubsidiaryId']);
  const expenseId = getField(row, ['expenseID', 'expenseId', 'ExpenseID', 'ExpenseId', 'id', 'Id']);
  const attachmentValue = getField(row, ['attachment', 'Attachment']);
  const attachmentName = String(attachmentValue || '')
    .split(/[\\/]/)
    .filter(Boolean)
    .pop() || '';

  const expenseTypeDisplay =
    getField(row, ['expenseTypeDisplay', 'ExpenseTypeDisplay'])
    || [
      getField(row, ['expenseTypeCode', 'ExpenseTypeCode']),
      getField(row, ['expenseTypeDescription', 'ExpenseTypeDescription']),
    ].filter(Boolean).join(' - ')
    || getField(row, ['expenseType', 'ExpenseType']);
  const subsidiaryDisplay =
    getField(row, ['subsidiaryDisplay', 'SubsidiaryDisplay'])
    || [
      getField(row, ['subsidiaryCode', 'SubsidiaryCode', 'costUnitCode', 'CostUnitCode']),
      getField(row, ['subsidiaryDescription', 'SubsidiaryDescription', 'costUnitDescription', 'CostUnitDescription']),
    ].filter(Boolean).join(' - ')
    || subsidiaryById.get(String(subsidiaryId))
    || getField(row, ['subsidiary', 'Subsidiary', 'costUnit', 'CostUnit']);

  const statusValue = getField(row, ['statusValue', 'StatusValue', 'status', 'Status']);

  return {
    expenseId,
    status: getExpenseStatusLabel(statusValue),
    statusValue: normalizeExpenseStatusValue(statusValue),
    employeeCode: getField(row, ['employeeCode', 'EmployeeCode', 'employeeNo', 'EmployeeNo']),
    employeeName: getField(row, ['employeeName', 'EmployeeName', 'name', 'Name']),
    date: formatDate(expenseDate),
    dateInput: formatDateForInput(expenseDate),
    referenceNo: getField(row, ['referenceNo', 'ReferenceNo']),
    receiptDate: formatDate(receiptDate),
    receiptDateInput: formatDateForInput(receiptDate),
    expenseType: expenseTypeDisplay,
    expenseTypeId: getField(row, ['expenseType', 'ExpenseType']),
    subsidiary: subsidiaryDisplay,
    subsidiaryId,
    tinNo: getField(row, ['tin', 'TIN', 'tinNo', 'TinNo', 'TINNo']),
    orSiNo: getField(row, ['orSINo', 'orsiNo', 'orSiNo', 'orSI_No', 'or_si_no', 'ORSINo', 'ORSI_No', 'OrSiNo']),
    documentNo: getField(row, ['documentNo', 'DocumentNo']),
    description: getField(row, ['description', 'Description']),
    amount: formatMoney(getField(row, ['amount', 'Amount'])),
    amountValue: getField(row, ['amount', 'Amount']),
    vat: formatMoney(getField(row, ['vat', 'Vat', 'VAT'])),
    vatValue: getField(row, ['vat', 'Vat', 'VAT']),
    total: formatMoney(getField(row, ['total', 'Total'])),
    totalValue: getField(row, ['total', 'Total']),
    attachment: attachmentName || attachmentValue,
    attachmentUrl: expenseId ? `${DAILY_EXPENSE_ENDPOINT}/${expenseId}/attachment` : getField(row, ['attachmentUrl', 'AttachmentUrl', 'attachmentURL', 'AttachmentURL', 'attachmentPath', 'AttachmentPath', 'fileUrl', 'FileUrl', 'url', 'Url']),
  };
}

const columns = [
  { key: 'status', label: 'Status' },
  { key: 'employeeCode', label: 'Employee Code' },
  { key: 'employeeName', label: 'Employee Name' },
  { key: 'date', label: 'Date' },
  { key: 'referenceNo', label: 'Reference No' },
  { key: 'receiptDate', label: 'Receipt Date' },
  { key: 'expenseType', label: 'Expense Type' },
  { key: 'subsidiary', label: 'Subsidiary' },
  { key: 'tinNo', label: 'TIN No' },
  { key: 'orSiNo', label: 'OR/SI No' },
  { key: 'documentNo', label: 'Document No' },
  { key: 'description', label: 'Description' },
  { key: 'amount', label: 'Amount', isNumber: true },
  { key: 'vat', label: 'Vat', isNumber: true },
  { key: 'total', label: 'Total', isNumber: true },
  { key: 'attachment', label: 'Attachment' },
];

function ExpenseReportView({ rows, user, isLoading = false, loadError = '', onBack, onRefresh }) {
  const [employeeNo, setEmployeeNo] = useState(() => getReportEmployeeNo(user, rows));
  const [employeeName, setEmployeeName] = useState(() => getReportEmployeeName(user, rows));
  const [employeeLoadError, setEmployeeLoadError] = useState('');
  const [hasCurrentEmployee, setHasCurrentEmployee] = useState(false);
  const reportDate = getTodayInputDate();
  const [purpose, setPurpose] = useState('Reimbursement');
  const [dateFrom, setDateFrom] = useState(getTodayInputDate);
  const [dateTo, setDateTo] = useState(getTodayInputDate);
  const [reportNo, setReportNo] = useState('');
  const [reportNoError, setReportNoError] = useState('');
  const [isGeneratingNo, setIsGeneratingNo] = useState(false);
  const approvedRows = useMemo(() => rows.filter((row) => normalizeExpenseStatusValue(row.statusValue ?? row.status) === 1), [rows]);
  const filteredReportRows = useMemo(() => {
    return approvedRows.filter((row) => {
      const rowDate = getReportFilterDateInput(row);

      if (!rowDate) {
        return false;
      }

      if (dateFrom && rowDate < dateFrom) {
        return false;
      }

      if (dateTo && rowDate > dateTo) {
        return false;
      }

      return true;
    });
  }, [approvedRows, dateFrom, dateTo]);
  const grandTotal = filteredReportRows.reduce((sum, row) => sum + parseMoney(row.totalValue ?? row.total), 0);
  const dateRangeLabel = `${dateFrom ? formatDate(dateFrom) : 'Start'} - ${dateTo ? formatDate(dateTo) : 'End'}`;
  const printReportPages = useMemo(() => chunkRowsForPrint(filteredReportRows), [filteredReportRows]);

  useEffect(() => {
    if (hasCurrentEmployee) {
      return;
    }

    setEmployeeNo(getReportEmployeeNo(user, rows));
    setEmployeeName(getReportEmployeeName(user, rows));
  }, [hasCurrentEmployee, rows, user]);

  useEffect(() => {
    const token = getToken();
    const controller = new AbortController();

    const loadCurrentEmployee = async () => {
      setEmployeeLoadError('');

      try {
        const response = await fetch(buildApiUrl(CURRENT_EMPLOYEE_ENDPOINT), {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
          signal: controller.signal,
        });
        const data = await response.json().catch(() => ({}));

        if (!response.ok) {
          throw new Error(data?.message || 'Unable to load current employee information.');
        }

        const employee = getReportEmployeeFromApi(data);

        if (employee) {
          setEmployeeNo(employee.employeeNo);
          setEmployeeName(employee.employeeName);
          setHasCurrentEmployee(true);
        }
      } catch (error) {
        if (error.name !== 'AbortError') {
          setEmployeeLoadError(error.message || 'Unable to load current employee information.');
        }
      }
    };

    loadCurrentEmployee();

    return () => controller.abort();
  }, []);

  const loadGeneratedNo = async (endpoint = DAILY_EXPENSE_GENERATED_NO_ENDPOINT) => {
    const token = getToken();
    setIsGeneratingNo(true);
    setReportNoError('');

    try {
      const response = await fetch(buildApiUrl(endpoint), {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data?.message || 'Unable to generate report number.');
      }

      const generatedNo = getGeneratedNoFromApi(data);

      if (!generatedNo) {
        throw new Error('Generated report number was not returned by the API.');
      }

      setReportNo(generatedNo);
      return generatedNo;
    } catch (error) {
      setReportNoError(error.message || 'Unable to generate report number.');
      return '';
    } finally {
      setIsGeneratingNo(false);
    }
  };

  const loadErSummaryRows = async () => {
    const token = getToken();
    const query = new URLSearchParams({
      fromDate: dateFrom,
      toDate: dateTo,
    });

    const response = await fetch(buildApiUrl(`${DAILY_EXPENSE_PDF_SUMMARY_ENDPOINT}?${query.toString()}`), {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(data?.message || 'Unable to load expense report PDF summary.');
    }

    return normalizeErSummaryRows(data, dateFrom);
  };

  const handleGenerateReport = async () => {
    if (isLoading || loadError || isGeneratingNo) {
      return;
    }

    if (filteredReportRows.length === 0) {
      setReportNoError('No transactions found for the selected date range.');
      return;
    }

    const generatedNo = await loadGeneratedNo();

    if (!generatedNo) {
      return;
    }

    const pdfBlob = buildExpenseReportPdfBlob({
      pages: printReportPages,
      reportNo: generatedNo,
      employeeNo,
      employeeName,
      reportDate,
      dateFrom,
      dateTo,
      grandTotal,
    });

    downloadBlob(pdfBlob, `ReimbursementReport-${reportDate}.pdf`);
  };

  const handleGenerateErForm = async () => {
    if (isLoading || loadError || isGeneratingNo) {
      return;
    }

    if (filteredReportRows.length === 0) {
      setReportNoError('No transactions found for the selected date range.');
      return;
    }

    setReportNoError('');

    try {
      const generatedNo = await loadGeneratedNo(DAILY_EXPENSE_ER_GENERATED_NO_ENDPOINT);

      if (!generatedNo) {
        return;
      }

      const summaryRows = await loadErSummaryRows();
      const summaryGrandTotal = summaryRows.reduce((sum, row) => sum + row.total, 0);

      const pdfBlob = buildErFormPdfBlob({
        rows: summaryRows,
        reportNo: generatedNo,
        employeeNo,
        employeeName,
        purpose,
        reportDate,
        dateFrom,
        dateTo,
        grandTotal: summaryGrandTotal,
      });

      downloadBlob(pdfBlob, `ExpenseReport-${reportDate}.pdf`);
    } catch (error) {
      setReportNoError(error.message || 'Unable to generate ER form.');
    }
  };

  return (
    <div className="etr-report-workspace">
      <div className="etr-expense-toolbar etr-report-screen-toolbar">
        <div>
          <p className="etr-expense-kicker">Finance</p>
          <h1>Generate Expense Report</h1>
          <span>Set the report details, then download the PDF form directly.</span>
        </div>

        <div className="etr-expense-actions">
          <button type="button" onClick={onBack}>Back</button>
        </div>
      </div>

      <section className="etr-report-control-panel etr-report-screen-toolbar">
        <div className="etr-report-control-head">
          <div>
            <p>Report Builder</p>
            <h2>Approved expense reimbursement form</h2>
          </div>   
        </div>

        {loadError ? <div className="etr-expense-save-message is-error">{loadError}</div> : null}
        {employeeLoadError ? <div className="etr-expense-save-message is-error">{employeeLoadError}</div> : null}
        {reportNoError ? <div className="etr-expense-save-message is-error">{reportNoError}</div> : null}

        <div className="etr-report-builder-layout">
          <div className="etr-report-control-grid">
            <label>
              <span>Employee No</span>
              <input value={employeeNo} onChange={(event) => setEmployeeNo(event.target.value)} />
            </label>
            <label>
              <span>Employee Name</span>
              <input value={employeeName} onChange={(event) => setEmployeeName(event.target.value)} />
            </label>
            <label>
              <span>Date</span>
              <input type="date" value={reportDate} readOnly aria-readonly="true" />
            </label>
            <label className="is-wide">
              <span>Purpose</span>
              <input value={purpose} onChange={(event) => setPurpose(event.target.value)} />
            </label>
            <div className="etr-report-date-range-panel">
              <label>
                <span>Date From</span>
                <input type="date" value={dateFrom} onChange={(event) => setDateFrom(event.target.value)} />
              </label>
              <label>
                <span>Date To</span>
                <input type="date" value={dateTo} onChange={(event) => setDateTo(event.target.value)} />
              </label>
              <div className="etr-report-total-preview">
                <span>Total Reimbursement</span>
                <strong>PHP {formatMoney(grandTotal)}</strong>
              </div>
            </div>
          </div>

          <aside className="etr-report-filter-card">
            <span>Generate No</span>
            <strong>{reportNo || 'Ready to generate'}</strong>
            <p>{dateRangeLabel}</p>
            <div className="etr-report-action-buttons">
              <button type="button" className="etr-report-generate-button" onClick={handleGenerateReport} disabled={isLoading || isGeneratingNo || !!loadError}>
                {isLoading ? 'Loading Expenses...' : isGeneratingNo ? 'Generating No...' : 'Reimbursement Report'}
              </button>
              <button type="button" className="etr-report-generate-button" onClick={handleGenerateErForm} disabled={isLoading || isGeneratingNo || !!loadError}>
                {isLoading ? 'Loading Expenses...' : isGeneratingNo ? 'Generating ER #...' : 'Expense Report'}
              </button>
            </div>
          </aside>
        </div>

        <section className="etr-report-preview-panel" aria-label="Reimbursement preview">
          <div className="etr-report-preview-head">
            <span>{isLoading ? 'Refreshing list...' : `${filteredReportRows.length} approved transaction${filteredReportRows.length === 1 ? '' : 's'}`}</span>
            <button type="button" onClick={onRefresh} disabled={isLoading} aria-label="Refresh expense report list" title="Refresh expense report list">
              &#8635;
            </button>
          </div>
          <div className="etr-report-preview-table-wrap">
            <table className="etr-report-preview-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Document No</th>
                  <th>Description</th>
                  <th className="is-number">Total</th>
                </tr>
              </thead>
              <tbody>
                {filteredReportRows.length > 0 ? filteredReportRows.map((row) => (
                  <tr key={row.expenseId || row.referenceNo || `${row.receiptDateInput || row.dateInput}-${row.total}`}>
                    <td>{getReportReceiptDate(row)}</td>
                    <td>{row.documentNo}</td>
                    <td>{row.description || row.expenseType}</td>
                    <td className="is-number">PHP {formatMoney(row.totalValue ?? row.total)}</td>
                  </tr>
                )) : (
                  <tr>
                    <td colSpan="4">No reimbursements found for the selected date range.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </section>

    </div>
  );
}

export default function DailyExpenseManager({ user, onNewEntry, onOpenExpense }) {
  const [rows, setRows] = useState([]);
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const [sortConfig, setSortConfig] = useState({ key: '', direction: 'asc' });
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [isReportOpen, setIsReportOpen] = useState(false);

  const loadDailyExpenses = useCallback(async (signal) => {
    const token = getToken();
    setIsLoading(true);
    setLoadError('');

    try {
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      const [expenseResponse, costUnitResponse] = await Promise.all([
        fetch(buildApiUrl(DAILY_EXPENSE_ENDPOINT), {
          headers,
          signal,
        }),
        fetch(buildApiUrl(COST_UNITS_ENDPOINT), {
          headers,
          signal,
        }),
      ]);

      const expenseData = await expenseResponse.json().catch(() => ({}));
      const costUnitData = await costUnitResponse.json().catch(() => ({}));

      if (!expenseResponse.ok) {
        throw new Error(expenseData?.message || 'Unable to load daily expense transactions.');
      }

      if (!costUnitResponse.ok) {
        throw new Error(costUnitData?.message || 'Unable to load subsidiaries.');
      }

      const subsidiaryById = new Map(
        getApiCollection(costUnitData)
          .map(normalizeCostUnit)
          .filter(Boolean)
          .map((item) => [item.costUnitId, item.display])
      );

      setRows(getApiCollection(expenseData).map((row) => normalizeDailyExpense(row, subsidiaryById)));
    } catch (error) {
      if (error.name !== 'AbortError') {
        setRows([]);
        setLoadError(error.message || 'Unable to load daily expense transactions.');
      }
    } finally {
      if (!signal?.aborted) {
        setIsLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();

    loadDailyExpenses(controller.signal);

    return () => controller.abort();
  }, [loadDailyExpenses]);

  const filteredRows = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    if (!normalizedQuery) {
      return rows;
    }

    return rows.filter((row) => columns
      .map((column) => row[column.key])
      .join(' ')
      .toLowerCase()
      .includes(normalizedQuery));
  }, [query, rows]);

  const sortedRows = useMemo(() => {
    if (!sortConfig.key) {
      return filteredRows;
    }

    const column = columns.find((item) => item.key === sortConfig.key);

    if (!column) {
      return filteredRows;
    }

    return [...filteredRows].sort((first, second) => {
      const firstValue = getSortValue(first, column);
      const secondValue = getSortValue(second, column);

      if (firstValue < secondValue) {
        return sortConfig.direction === 'asc' ? -1 : 1;
      }

      if (firstValue > secondValue) {
        return sortConfig.direction === 'asc' ? 1 : -1;
      }

      return 0;
    });
  }, [filteredRows, sortConfig]);

  const totalPages = Math.max(1, Math.ceil(sortedRows.length / MANAGER_PAGE_SIZE));
  const visiblePages = getVisiblePages(page, totalPages);
  const pagedRows = sortedRows.slice((page - 1) * MANAGER_PAGE_SIZE, page * MANAGER_PAGE_SIZE);

  useEffect(() => {
    setPage(1);
  }, [query, sortConfig.key, sortConfig.direction]);

  useEffect(() => {
    setPage((current) => Math.min(current, totalPages));
  }, [totalPages]);

  const handleSort = (columnKey) => {
    setSortConfig((current) => ({
      key: columnKey,
      direction: current.key === columnKey && current.direction === 'asc' ? 'desc' : 'asc',
    }));
  };

  if (isReportOpen) {
    return (
      <ExpenseReportView
        rows={rows}
        user={user}
        isLoading={isLoading}
        loadError={loadError}
        onBack={() => setIsReportOpen(false)}
        onRefresh={() => loadDailyExpenses()}
      />
    );
  }

  return (
    <div className="etr-expense-entry">
      <div className="etr-expense-toolbar">
        <div>
          <p className="etr-expense-kicker">Finance</p>
          <h1>Daily Expense Manager</h1>
          <span>Review daily expense transactions and open the full entry details.</span>
        </div>

        <div className="etr-expense-actions">
          <button type="button" onClick={() => setIsReportOpen(true)}>Generate Expense Report</button>
          <button type="button" className="etr-expense-save-button" onClick={onNewEntry}>New Entry</button>
        </div>
      </div>

      {loadError ? <div className="etr-expense-save-message is-error">{loadError}</div> : null}

      <section className="etr-expense-table-panel">
        <div className="etr-expense-table-head">
          <div>
            <h2>Daily Expense Transactions</h2>
            <span>{isLoading ? 'Loading transactions...' : `${sortedRows.length} transaction${sortedRows.length === 1 ? '' : 's'} found`}</span>
          </div>

          <label className="etr-expense-manager-search">
            <span>Search</span>
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Reference, employee, status, or document no"
            />
          </label>
        </div>

        <div className="etr-expense-table-wrap">
          <table className="etr-expense-table etr-expense-manager-table">
            <thead>
              <tr>
                {columns.map((column) => (
                  <th
                    key={column.key}
                    aria-sort={sortConfig.key === column.key ? (sortConfig.direction === 'asc' ? 'ascending' : 'descending') : 'none'}
                  >
                    <button
                      type="button"
                      className={`etr-expense-sort-button ${sortConfig.key === column.key ? 'is-active' : ''}`}
                      onClick={() => handleSort(column.key)}
                    >
                      <span>{column.label}</span>
                      <span className={`etr-expense-sort-indicator ${sortConfig.key === column.key ? `is-${sortConfig.direction}` : ''}`} aria-hidden="true" />
                    </button>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {!isLoading && sortedRows.length === 0 ? (
                <tr>
                  <td colSpan={columns.length}>No daily expense transactions found.</td>
                </tr>
              ) : null}

              {pagedRows.map((row) => (
                <tr
                  key={row.expenseId || row.referenceNo}
                  className="etr-expense-clickable-row"
                  onClick={() => onOpenExpense(row)}
                >
                  {columns.map((column) => (
                    <td key={column.key} className={column.isNumber ? 'is-number' : ''}>
                      {column.key === 'status' ? (
                        <span className={`etr-expense-status ${getExpenseStatusClassName(row.statusValue)}`}>
                          {row.status}
                        </span>
                      ) : row[column.key]}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {sortedRows.length > 0 ? (
          <div className="etr-expense-pagination" aria-label="Daily expense pagination">
            <span>
              Showing {(page - 1) * MANAGER_PAGE_SIZE + 1}-{Math.min(page * MANAGER_PAGE_SIZE, sortedRows.length)} of {sortedRows.length}
            </span>
            <button type="button" onClick={() => setPage((current) => Math.max(1, current - 1))} disabled={page === 1}>
              Previous
            </button>
            <div className="etr-expense-page-numbers">
              {visiblePages.map((pageNumber) => (
                <button
                  type="button"
                  key={pageNumber}
                  className={pageNumber === page ? 'is-active' : ''}
                  onClick={() => setPage(pageNumber)}
                  aria-current={pageNumber === page ? 'page' : undefined}
                >
                  {pageNumber}
                </button>
              ))}
            </div>
            <button type="button" onClick={() => setPage((current) => Math.min(totalPages, current + 1))} disabled={page === totalPages}>
              Next
            </button>
          </div>
        ) : null}
      </section>
    </div>
  );
}
