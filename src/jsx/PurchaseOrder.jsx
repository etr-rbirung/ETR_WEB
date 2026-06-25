import React, { useMemo, useState } from 'react';
import '../css/PurchaseOrder.css';

const toolbarActions = [
  { id: 'new', label: 'New', disabled: true },
  { id: 'edit', label: 'Edit', disabled: true },
  { id: 'delete', label: 'Delete', disabled: true },
  { id: 'save', label: 'Save' },
  { id: 'undo', label: 'Undo' },
  { id: 'print', label: 'Print', disabled: true },
  { id: 'approve', label: 'Approve Order', disabled: true },
  { id: 'receive', label: 'Receive Order', disabled: true },
  { id: 'cancel', label: 'Cancel' },
  { id: 'closed', label: 'Closed PO', disabled: true },
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
              <span>{action.label}</span>
              {action.hasMenu ? <span className="etr-po-caret" aria-hidden="true" /> : null}
            </button>
          ))}
        </div>
      </div>

      <section className="etr-po-form-panel">
        <div className="etr-po-form-shell">
          <div className="etr-po-content-column">
            <div className="etr-po-main-stack">
              <div className="etr-po-column">
                <section className="etr-po-card">
                  <div className="etr-po-card-head">
                    <div>
                      <p>General</p>
                      <h2>Transaction Info</h2>
                    </div>
                  </div>
                  <div className="etr-po-form-grid two">
                    <Field label="PO Number">
                      <input value={formData.poNumber} onChange={(e) => updateForm('poNumber', e.target.value)} />
                    </Field>
                    <Field label="Purchase Date">
                      <input type="date" value={formData.purchaseDate} onChange={(e) => updateForm('purchaseDate', e.target.value)} />
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
                  </div>
                </section>

                <section className="etr-po-card">
                  <div className="etr-po-card-head">
                    <div>
                      <p>Vendor</p>
                      <h2>Supplier Info</h2>
                    </div>
                  </div>
                  <div className="etr-po-form-grid two">
                    <Field label="Vendor (Supplier)" link className="is-wide">
                      <div className="etr-po-split-input">
                        <input value={formData.vendorCode} onChange={(e) => updateForm('vendorCode', e.target.value)} />
                        <input value={formData.vendorName} onChange={(e) => updateForm('vendorName', e.target.value)} />
                      </div>
                    </Field>
                    <Field label="Vendor Address" className="is-wide">
                      <input value={formData.vendorAddress} onChange={(e) => updateForm('vendorAddress', e.target.value)} />
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
                </section>
              </div>

              <div className="etr-po-column etr-po-column-narrow">
                <section className="etr-po-card">
                  <div className="etr-po-card-head">
                    <div>
                      <p>Reference</p>
                      <h2>Source Info</h2>
                    </div>
                  </div>
                  <div className="etr-po-form-grid two">
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
                    <Field label="Delivery Date" className="is-wide">
                      <input type="date" value={formData.deliveryDate} onChange={(e) => updateForm('deliveryDate', e.target.value)} />
                    </Field>
                  </div>
                </section>

                <section className="etr-po-card">
                  <div className="etr-po-card-head">
                    <div>
                      <p>System Logs</p>
                      <h2>Audit Trail</h2>
                    </div>
                  </div>
                  <div className="etr-po-audit-grid">
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
                    <Field label="Cancel Remarks" className="is-wide">
                      <textarea rows="3" value={formData.cancelRemarks} onChange={(e) => updateForm('cancelRemarks', e.target.value)} />
                    </Field>
                  </div>
                </section>
              </div>
            </div>
          </div>

          <aside className="etr-po-side-stack">
            <section className="etr-po-card etr-po-status-card">
              <div className="etr-po-card-head">
                <div>
                  <p>Status</p>
                  <h2>Current PO State</h2>
                </div>
              </div>
              <input value="Open" readOnly />
            </section>

            <section className="etr-po-card etr-po-summary-card">
              <div className="etr-po-card-head">
                <div>
                  <p>Amount</p>
                  <h2>Auto-computed Totals</h2>
                </div>
              </div>
              <Field label="Gross Total">
                <input value={formatMoney(totals.grossTotal)} readOnly />
              </Field>
              <Field label="Gross Discount">
                <input value={formatMoney(totals.grossDiscount)} readOnly />
              </Field>
              <Field label="Vat Amount">
                <input value={totals.vatAmount ? formatMoney(totals.vatAmount) : ''} readOnly />
              </Field>
              <Field label="Net Total">
                <input value={formatMoney(totals.netTotal)} readOnly />
              </Field>
            </section>
          </aside>
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
      </section>
    </div>
  );
}