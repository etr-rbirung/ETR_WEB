import React, { useMemo, useState } from 'react';
import '../css/PurchaseOrder.css';

const toolbarActions = [
  { id: 'create', label: 'Create', icon: 'plus', hasMenu: true },
  { id: 'new', label: 'New', icon: 'file', disabled: true },
  { id: 'copy', label: 'Copy From', icon: 'copy' },
  { id: 'edit', label: 'Edit', icon: 'file', disabled: true },
  { id: 'delete', label: 'Delete', icon: 'delete', disabled: true },
  { id: 'find', label: 'Find', icon: 'find' },
  { id: 'save', label: 'Save', icon: 'save' },
  { id: 'undo', label: 'Undo', icon: 'undo' },
  { id: 'print', label: 'Print', icon: 'print', disabled: true },
  { id: 'approve', label: 'Approve Order', icon: 'approve', disabled: true },
  { id: 'receive', label: 'Receive Order', icon: 'receive', disabled: true },
  { id: 'cancel', label: 'Cancel', icon: 'cancel' },
  { id: 'closed', label: 'Closed PO', icon: 'closed', disabled: true },
  { id: 'close', label: 'Close', icon: 'close' },
];

const purchaseItems = [
  {
    id: 'po-line-1',
    selected: false,
    itemCode: 'PM0171',
    itemDescription: 'TAMPIPI_STETHOSCOPE C...',
    free: false,
    unit: 'PIECE',
    quantity: 2,
    purchaseCost: 21,
    comments: '',
  },
];

function formatMoney(value) {
  return Number(value || 0).toFixed(4);
}

function formatShortDate(value) {
  if (!value) return '';
  const [year, month, day] = value.split('-');
  return `${Number(month)}/${Number(day)}/${year}`;
}

function ToolbarIcon({ type }) {
  const paths = {
    plus: <path d="M10 3h4v7h7v4h-7v7h-4v-7H3v-4h7V3Z" />,
    file: <path d="M6 3h9l3 3v15H6V3Zm2 2v14h8V8h-3V5H8Z" />,
    copy: <path d="M8 7h10v14H8V7Zm-3-4h10v2H7v11H5V3Z" />,
    delete: <path d="M8 4h8l1 2h4v2H3V6h4l1-2Zm1 6h2v8H9v-8Zm4 0h2v8h-2v-8Z" />,
    find: <path d="M10 4a6 6 0 1 1-4.24 10.24l-2.52 2.52-1.42-1.42 2.52-2.52A6 6 0 0 1 10 4Zm0 2a4 4 0 1 0 0 8 4 4 0 0 0 0-8Zm8 2h2v3h3v2h-3v3h-2v-3h-3v-2h3V8Z" />,
    save: <path d="M5 3h13l1 1v17H5V3Zm2 2v5h9V5H7Zm1 9v5h8v-5H8Z" />,
    undo: <path d="M9 7V3L2 10l7 7v-4h6a5 5 0 0 1 5 5v1h2v-1a7 7 0 0 0-7-7H9Z" />,
    print: <path d="M7 3h10v5H7V3Zm-2 7h14a2 2 0 0 1 2 2v6h-4v3H7v-3H3v-6a2 2 0 0 1 2-2Zm4 7v2h6v-2H9Z" />,
    approve: <path d="M9 16.6 4.8 12.4l1.4-1.4L9 13.8 17.8 5l1.4 1.4L9 16.6Z" />,
    receive: <path d="M5 4h14v14H5V4Zm2 2v10h10V6H7Zm3 2h4v2h-4V8Zm0 4h7v2h-7v-2Z" />,
    cancel: <path d="m6 4 6 6 6-6 2 2-6 6 6 6-2 2-6-6-6 6-2-2 6-6-6-6 2-2Z" />,
    closed: <path d="m6 4 14 14-2 2L4 6l2-2Zm12 0 2 2-5.2 5.2-2-2L18 4ZM9.2 12.8l2 2L6 20l-2-2 5.2-5.2Z" />,
    close: <path d="M12 2a10 10 0 1 1 0 20 10 10 0 0 1 0-20Zm-3.5 6 3.5 3.5L15.5 8 17 9.5 13.5 13 17 16.5 15.5 18 12 14.5 8.5 18 7 16.5 10.5 13 7 9.5 8.5 8Z" />,
  };

  return (
    <span className="etr-po-icon" aria-hidden="true">
      <svg viewBox="0 0 24 24">{paths[type]}</svg>
    </span>
  );
}

function Field({ label, link = false, children, className = '', error = '' }) {
  return (
    <label className={`etr-po-field ${className} ${error ? 'has-error' : ''}`}>
      <button type="button" className={link ? 'is-link-label' : ''} tabIndex={-1}>
        {label}
      </button>
      {children || <input type="text" />}
      {error ? <small>{error}</small> : null}
    </label>
  );
}

export default function PurchaseOrder() {
  const [rows, setRows] = useState(purchaseItems);
  const [formData, setFormData] = useState({
    poNumber: '',
    purchaseDate: '2026-06-19',
    vendorCode: '0000000002',
    vendorName: 'KUSUM HEALTHCARE PVT. LTD',
    vendorAddress: 'UNITS 2405 AND 2406 24/F THE ORIENT SQUARE, F. ORTIGAS JR. ROAD, ORTIGAS CENTER, PASIG CITY',
    currency: 'PHP - Philippine Peso',
    deliveryDate: '2026-06-19',
    terms: '30 DAYS',
    company: 'MASIGASIG TRANSPORT AND LOGISTICS SOLUTIONS, INC.',
    comments: '',
    deliveryAddress: 'KUSUM HEALTHCARE PVT. LTD\nUNITS 2405 AND 2406 24/F THE ORIENT SQUARE, F. ORTIGAS JR. ROAD, ORTIGAS CENTER,\nPASIG CITY',
    referenceType: '',
    referenceNo: '',
    createdBy: '',
    modifiedBy: '',
    approvedBy: '',
    cancelledBy: '',
    cancelRemarks: '',
  });

  const totals = useMemo(() => {
    const grossTotal = rows.reduce((sum, row) => sum + (Number(row.quantity) * Number(row.purchaseCost)), 0);
    return {
      grossTotal,
      grossDiscount: 0,
      vatAmount: 0,
      withholdingTax: 0,
      netTotal: grossTotal,
    };
  }, [rows]);

  const updateForm = (field, value) => {
    setFormData((current) => ({ ...current, [field]: value }));
  };

  const updateRow = (rowId, field, value) => {
    setRows((currentRows) => currentRows.map((row) =>
      row.id === rowId ? { ...row, [field]: value } : row
    ));
  };

  const deleteSelectedRows = () => {
    setRows((currentRows) => {
      const remainingRows = currentRows.filter((row) => !row.selected);
      return remainingRows.length ? remainingRows : currentRows;
    });
  };

  return (
    <div className="etr-po-entry">
      {/* Toolbar – matches withdrawal’s header layout */}
      <div className="etr-po-toolbar">
        <div>
          <p className="etr-po-kicker">Purchasing</p>
          <h1>Purchase Order</h1>
          <span>Create and manage purchase orders.</span>
        </div>
        <div className="etr-po-actions">
          {toolbarActions.map((action) => (
            <button
              type="button"
              key={action.id}
              disabled={action.disabled}
              className={action.id === 'save' ? 'is-primary' : ''}
            >
              <ToolbarIcon type={action.icon} />
              <span>{action.label}</span>
              {action.hasMenu ? <span className="etr-po-caret" aria-hidden="true" /> : null}
            </button>
          ))}
        </div>
      </div>

      {/* Form panel */}
      <section className="etr-po-form-panel">
        <div className="etr-po-form-section">
          <div className="etr-po-grid dense">
            {/* Left column – General */}
            <div className="etr-po-grid-column">
              <div className="etr-po-card-head">
                <div>
                  <p>General</p>
                  <h2>Transaction Info</h2>
                </div>
              </div>
              <Field label="PO Number">
                <input value={formData.poNumber} onChange={(e) => updateForm('poNumber', e.target.value)} />
              </Field>
              <Field label="Purchase Date">
                <input type="date" value={formData.purchaseDate} onChange={(e) => updateForm('purchaseDate', e.target.value)} />
              </Field>
              <Field label="Vendor (Supplier)" link className="is-wide">
                <div className="etr-po-split-input">
                  <input value={formData.vendorCode} onChange={(e) => updateForm('vendorCode', e.target.value)} />
                  <input value={formData.vendorName} onChange={(e) => updateForm('vendorName', e.target.value)} />
                </div>
              </Field>
              <Field label="Vendor Address" className="is-wide">
                <input value={formData.vendorAddress} onChange={(e) => updateForm('vendorAddress', e.target.value)} />
              </Field>
              <Field label="Currency">
                <select value={formData.currency} onChange={(e) => updateForm('currency', e.target.value)}>
                  <option>PHP - Philippine Peso</option>
                  <option>USD - US Dollar</option>
                </select>
              </Field>
              <Field label="Terms">
                <select value={formData.terms} onChange={(e) => updateForm('terms', e.target.value)}>
                  <option>30 DAYS</option>
                  <option>15 DAYS</option>
                  <option>COD</option>
                </select>
              </Field>
              <Field label="Company" link className="is-wide">
                <input value={formData.company} onChange={(e) => updateForm('company', e.target.value)} />
              </Field>
              <Field label="Comments" className="is-wide">
                <input value={formData.comments} onChange={(e) => updateForm('comments', e.target.value)} />
              </Field>
              <Field label="Delivery Address" link className="is-wide">
                <textarea rows="4" value={formData.deliveryAddress} onChange={(e) => updateForm('deliveryAddress', e.target.value)} />
              </Field>
            </div>

            {/* Right column – Additional Info / Properties */}
            <div className="etr-po-grid-column">
              <div className="etr-po-card-head">
                <div>
                  <p>Properties</p>
                  <h2>Additional Information</h2>
                </div>
              </div>
              <Field label="Reference Type">
                <select value={formData.referenceType} onChange={(e) => updateForm('referenceType', e.target.value)}>
                  <option value="" />
                  <option>Purchase Request</option>
                  <option>Sales Order</option>
                  <option>Manual Entry</option>
                </select>
              </Field>
              <Field label="Reference No." link>
                <input value={formData.referenceNo} onChange={(e) => updateForm('referenceNo', e.target.value)} />
              </Field>
              <Field label="Delivery Date">
                <input type="date" value={formData.deliveryDate} onChange={(e) => updateForm('deliveryDate', e.target.value)} />
              </Field>
              <Field label="Created By">
                <input value={formData.createdBy} onChange={(e) => updateForm('createdBy', e.target.value)} />
              </Field>
              <Field label="Modified By">
                <input value={formData.modifiedBy} onChange={(e) => updateForm('modifiedBy', e.target.value)} />
              </Field>
              <Field label="Approved By">
                <input value={formData.approvedBy} onChange={(e) => updateForm('approvedBy', e.target.value)} />
              </Field>
              <Field label="Cancelled By">
                <input value={formData.cancelledBy} onChange={(e) => updateForm('cancelledBy', e.target.value)} />
              </Field>
              <Field label="Cancel Remarks" className="is-remarks is-wide">
                <textarea rows="4" value={formData.cancelRemarks} onChange={(e) => updateForm('cancelRemarks', e.target.value)} />
              </Field>
            </div>
          </div>
        </div>
      </section>

      {/* Lines panel – matches withdrawal’s table panel */}
      <section className="etr-po-table-panel">
        <div className="etr-po-table-tools">
          <button type="button" onClick={deleteSelectedRows} disabled={!rows.some((row) => row.selected)}>
            Delete Selected
          </button>
          <span>Total Items: {rows.length}</span>
        </div>

        <div className="etr-po-table-wrap">
          <table className="etr-po-table">
            <thead>
              <tr>
                <th aria-label="Select row" />
                <th>Item Code</th>
                <th>Item Description</th>
                <th>Free</th>
                <th>Unit</th>
                <th>Quantity</th>
                <th>Purchase Cost</th>
                <th>Amount</th>
                <th>Comments</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const amount = Number(row.quantity) * Number(row.purchaseCost);
                return (
                  <tr key={row.id}>
                    <td>
                      <input type="checkbox" checked={row.selected} onChange={(e) => updateRow(row.id, 'selected', e.target.checked)} />
                    </td>
                    <td>{row.itemCode}</td>
                    <td>{row.itemDescription}</td>
                    <td>
                      <input type="checkbox" checked={row.free} onChange={(e) => updateRow(row.id, 'free', e.target.checked)} />
                    </td>
                    <td>{row.unit}</td>
                    <td>
                      <input type="number" value={row.quantity} onChange={(e) => updateRow(row.id, 'quantity', e.target.value)} />
                    </td>
                    <td>
                      <input type="number" step="0.0001" value={formatMoney(row.purchaseCost)} onChange={(e) => updateRow(row.id, 'purchaseCost', e.target.value)} />
                    </td>
                    <td className="is-money">{formatMoney(amount)}</td>
                    <td>
                      <input value={row.comments} onChange={(e) => updateRow(row.id, 'comments', e.target.value)} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Totals – styled as a footer inside the same card */}
        <div className="etr-po-totals">
          <div className="etr-po-total-column">
            <label>
              <span>Gross Total</span>
              <input value={formatMoney(totals.grossTotal)} readOnly />
            </label>
            <label>
              <input type="checkbox" />
              <span>Discount (%)</span>
              <input readOnly />
            </label>
            <label>
              <span>Gross Discount</span>
              <input value={formatMoney(totals.grossDiscount)} readOnly />
            </label>
          </div>
          <div className="etr-po-total-column">
            <label>
              <input type="checkbox" />
              <span>Withholding Tax</span>
              <input readOnly />
              <input value="0.00" readOnly />
            </label>
            <label>
              <span>Vat Amount</span>
              <input value={totals.vatAmount ? formatMoney(totals.vatAmount) : ''} readOnly />
            </label>
            <label>
              <span>Net Total</span>
              <input value={formatMoney(totals.netTotal)} readOnly />
            </label>
          </div>
        </div>

        <div className="etr-po-statusbar">
          <span>Purchase Date: {formatShortDate(formData.purchaseDate)}</span>
          <span>Delivery Date: {formatShortDate(formData.deliveryDate)}</span>
        </div>
      </section>
    </div>
  );
}