import React, { useCallback, useMemo, useState, useRef, useEffect } from 'react';
import { getToken } from '../services/authStorage';
import '../css/WithdrawalEntry.css';

const apiBaseUrl = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/+$/, '');
const WITHDRAWALS_ENDPOINT = '/api/withdrawals';
const COST_UNITS_ENDPOINT = '/api/costunits';
const WITHDRAWAL_DRAFT_STORAGE_KEY = 'etr.withdrawalEntry.draft';
const defaultWithdrawalTypes = [
  { id: '1', code: '001', description: 'WITHRAWAL' },
  { id: '2', code: '002', description: 'PULL-OUT' },
  { id: '3', code: '003', description: 'SUPPLIER RETURN' },
];

const todayIso = new Date().toISOString().slice(0, 10);
const emptyForm = {
  transactionNo: '',
  transactionDate: todayIso,
  withdrawalType: '',
  withdrawalTypeId: '',
  recipientId: '',
  recipientCode: '',
  recipientName: '',
  address: '',
  reasonId: '',
  reasonCode: '',
  reasonDescription: '',
  remarks: '',
  warehouse: '',
  warehouseKey: '',
  chargeToId: '',
  chargeToCode: '',
  chargeToName: '',
  company: '',
  companyKey: '',
  referenceTypeId: '',
  referenceType: '',
  referenceId: '',
  referenceNo: '',
  createdBy: '',
  createdDate: todayIso,
  lastModifiedBy: '',
  lastModifiedDate: todayIso,
  approvedBy: '',
  approvedDate: todayIso,
  deliveryInstructions: '',
  podNo: '',
  targetDelivery: todayIso,
  noOfPallets: '0',
  declareValue: '0.0000',
  rejectReasonID: '',
  rejectDescription: '',
  deliveryStatus: 0,
  modificationHistory: [],
};

const detailTabs = [
  { id: 'details', label: 'Details' },
  { id: 'allocation', label: 'Stock Allocation' },
  { id: 'insufficient', label: 'Insufficient Stocks' },
];

const actionLabels = ['New', 'Edit', 'Save', 'Approve', 'Reject', 'Print'];
const printOptions = [
  { id: 'delivery-receipt', label: 'Delivery Receipt' },
  { id: 'withdrawal-form', label: 'Withdrawal Form' },
];

function buildApiUrl(path) {
  return apiBaseUrl ? `${apiBaseUrl}${path}` : path;
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

function getCurrentUserDisplayName(user) {
  const lastName = getUserField(user, ['lastName', 'lastname', 'LastName', 'LASTNAME']);
  const firstName = getUserField(user, ['firstName', 'firstname', 'FirstName', 'FIRSTNAME']);

  if (lastName && firstName) {
    return `${lastName}, ${firstName}`;
  }

  if (lastName) {
    return lastName;
  }

  if (firstName) {
    return firstName;
  }

  return getUserField(user, ['displayName', 'DisplayName', 'username', 'Username']) || 'Current User';
}

function formatAuditDate(value) {
  if (!value) {
    return '';
  }

  const date = value instanceof Date ? value : new Date(value);

  if (Number.isNaN(date.getTime())) {
    return String(value);
  }

  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function formatAuditDateTime(value) {
  if (!value) {
    return '';
  }

  const date = value instanceof Date ? value : new Date(value);

  if (Number.isNaN(date.getTime())) {
    return String(value);
  }

  return date.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
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

function getField(row, fieldNames) {
  for (const fieldName of fieldNames) {
    const value = row?.[fieldName];

    if (value !== undefined && value !== null && String(value).trim()) {
      return String(value).trim();
    }
  }

  return '';
}

function toApiDate(value) {
  return value || '1900-01-01';
}

function toNumberOrDefault(value, fallback = -1) {
  const numberValue = Number(String(value ?? '').replace(/,/g, ''));
  return Number.isFinite(numberValue) && numberValue !== 0 ? numberValue : fallback;
}

function createBlankDetailRow() {
  return {
    id: crypto.randomUUID?.() || String(Date.now()),
    selected: false,
    itemCode: '',
    itemDescription: '',
    unit: '',
    quantity: '0',
    insufficientQuantity: '0',
    withdrawalQuantity: '0',
    withdrawableQuantity: '0',
    remarks: '',
    itemKey: null,
    unitKey: null,
  };
}

function createBlankAllocationRow(item = null) {
  return {
    id: crypto.randomUUID?.() || String(Date.now()),
    itemCode: item?.code || '',
    itemDescription: item?.description || '',
    itemKey: item?.itemKey || null,
    warehouse: '',
    warehouseKey: null,
    location: '',
    locationKey: null,
    lot: '',
    manufacturingDate: '',
    expiryDate: '',
    quantity: '0',
    unit: '',
    unitKey: null,
  };
}

function createBlankInsufficientRow(item = null) {
  return {
    id: crypto.randomUUID?.() || String(Date.now()),
    itemCode: item?.code || '',
    itemDescription: item?.description || '',
    itemKey: item?.itemKey || null,
    quantity: '0',
    unit: '',
    unitKey: null,
  };
}

function parseNumber(value) {
  return Number(String(value || 0).replace(/,/g, '')) || 0;
}

function normalizeNonNegativeInput(value) {
  if (value === '') return '';
  const numericValue = Number(String(value).replace(/,/g, ''));
  if (!Number.isFinite(numericValue)) return '0';
  return numericValue < 0 ? '0' : value;
}

function isSameStockSource(left, right) {
  return String(left.itemKey ?? '') === String(right.itemKey ?? '')
    && String(left.unitKey ?? '') === String(right.unitKey ?? '')
    && String(left.warehouseKey ?? '') === String(right.warehouseKey ?? '')
    && String(left.locationKey ?? '') === String(right.locationKey ?? '')
    && String(left.lot ?? '').trim().toLowerCase() === String(right.lot ?? '').trim().toLowerCase()
    && String(left.expiryDate ?? '').slice(0, 10) === String(right.expiryDate ?? '').slice(0, 10);
}

function Field({ label, children, link = false, className = '', error = '', onLabelClick }) {
  return (
    <label className={`etr-withdrawal-field ${className} ${error ? 'has-error' : ''}`}>
      <button type="button" className={link ? 'is-link-label' : ''} onClick={onLabelClick} disabled={!onLabelClick}>
        {label}
      </button>
      {children || <input type="text" />}
      {error ? <small>{error}</small> : null}
    </label>
  );
}

function LookupModal({ title, rows, isLoading = false, error = '', onClose, onSearch, onSelect }) {
  const [query, setQuery] = useState('');
  const onSearchRef = useRef(onSearch);
  onSearchRef.current = onSearch;
  const normalizedQuery = query.trim().toLowerCase();
  const filteredRows = rows.filter((row) => `${row.code} ${row.description}`.toLowerCase().includes(normalizedQuery));
  const showLoading = isLoading && filteredRows.length === 0;

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      onSearchRef.current?.(query.trim());
    }, query ? 300 : 0);

    return () => window.clearTimeout(timeoutId);
  }, [query]);

  return (
    <div className="etr-withdrawal-modal-backdrop" role="presentation">
      <section className="etr-withdrawal-modal" role="dialog" aria-modal="true" aria-label={title}>
        <div className="etr-withdrawal-modal-head">
          <div>
            <p className="etr-expense-kicker">Lookup</p>
            <h2>{title}</h2>
          </div>
          <button type="button" onClick={onClose}>Close</button>
        </div>
        <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search code or description" />
        <div className="etr-withdrawal-lookup-list">
          {showLoading ? <span>Loading...</span> : null}
          {!showLoading && error ? <span>{error}</span> : null}
          {!showLoading && !error && filteredRows.length === 0 ? <span>No records found.</span> : null}
          {!showLoading && filteredRows.map((row) => (
            <button type="button" key={`${row.id ?? row.code}-${row.code}-${row.description}`} onClick={() => onSelect(row)}>
              <strong>{row.code}</strong>
              <span>{row.description}</span>
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}

function ReferenceLookupModal({ rows, isLoading = false, error = '', referenceTypeLabel = '', onClose, onSearch, onSelect }) {
  const [query, setQuery] = useState('');
  const onSearchRef = useRef(onSearch);
  onSearchRef.current = onSearch;

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      onSearchRef.current?.(query.trim());
    }, query ? 300 : 0);

    return () => window.clearTimeout(timeoutId);
  }, [query]);

  const showLoading = isLoading && rows.length === 0;
  const emptyMessage = referenceTypeLabel.toLowerCase().includes('withdrawal')
    ? 'No withdrawal records found.'
    : `Reference lookup for "${referenceTypeLabel || 'this type'}" is not available yet.`;

  return (
    <div className="etr-withdrawal-modal-backdrop" role="presentation">
      <section className="etr-withdrawal-modal etr-withdrawal-reference-modal" role="dialog" aria-modal="true" aria-label="Select Reference Number">
        <div className="etr-withdrawal-modal-head">
          <div>
            <p className="etr-expense-kicker">Lookup</p>
            <h2>Select Reference Number</h2>
          </div>
          <button type="button" onClick={onClose}>Close</button>
        </div>
        <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search transaction no., recipient, or remarks" />
        <div className="etr-withdrawal-reference-table-wrap">
          {showLoading ? <span>Loading...</span> : null}
          {!showLoading && error ? <span>{error}</span> : null}
          {!showLoading && !error && rows.length === 0 ? <span>{emptyMessage}</span> : null}
          {!showLoading && !error && rows.length > 0 ? (
            <table className="etr-withdrawal-reference-table">
              <thead>
                <tr>
                  <th>Transaction No.</th>
                  <th>Trans. Date</th>
                  <th>Recipient</th>
                  <th>Remarks</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id} onClick={() => onSelect(row)} className="is-clickable">
                    <td>{row.transactionNumber}</td>
                    <td>{formatAuditDate(row.transactionDate)}</td>
                    <td>{row.recipient}</td>
                    <td>{row.remarks}</td>
                    <td>{row.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : null}
        </div>
      </section>
    </div>
  );
}

function SelectStockModal({ context, rows, isLoading = false, error = '', onToggleRow, onSelectAll, onClearSelection, onConfirm, onClose }) {
  const warehouseOptions = Array.from(new Set([
    context?.warehouse || '',
    ...rows.map((row) => row.warehouse || ''),
  ].filter(Boolean)));
  const [filters, setFilters] = useState({
    warehouse: context?.warehouse || '',
    location: '',
    item: context?.itemCode || '',
    lot: '',
    unit: context?.unit || '',
  });

  const updateFilter = (field, value) => {
    setFilters((current) => ({
      ...current,
      [field]: value,
      ...(field === 'warehouse' ? { location: '' } : {}),
    }));
  };

  const locationOptions = Array.from(new Set(
    rows
      .filter((row) => !filters.warehouse || row.warehouse === filters.warehouse)
      .map((row) => row.location || '')
      .filter(Boolean)
  ));

  const hasWarehouseAndLocation = Boolean(filters.warehouse.trim() && filters.location.trim());
  const filteredRows = hasWarehouseAndLocation ? rows.filter((row) => {
    const warehouse = filters.warehouse.trim().toLowerCase();
    const location = filters.location.trim().toLowerCase();
    const item = filters.item.trim().toLowerCase();
    const lot = filters.lot.trim().toLowerCase();
    const unit = filters.unit.trim().toLowerCase();

    return !row.isAllocated
      && (row.warehouse || '').toLowerCase() === warehouse
      && (row.location || '').toLowerCase() === location
      && (!item || `${context?.itemCode || ''} ${context?.itemDescription || ''}`.toLowerCase().includes(item))
      && (!lot || (row.lot || '').toLowerCase().includes(lot))
      && (!unit || (row.unit || '').toLowerCase().includes(unit));
  }) : [];
  const emptyStockMessage = hasWarehouseAndLocation
    ? 'No available stock found.'
    : 'Select a warehouse and location first.';

  return (
    <div className="etr-withdrawal-modal-backdrop" role="presentation">
      <section className="etr-withdrawal-modal etr-withdrawal-stock-modal" role="dialog" aria-modal="true" aria-label="Select Stock">
        <div className="etr-withdrawal-modal-head">
          <div>
            <p className="etr-expense-kicker">Stock</p>
            <h2>Select Stock</h2>
          </div>
          <button type="button" onClick={onClose}>Close</button>
        </div>

        <div className="etr-withdrawal-stock-filters">
          <Field label="Warehouse">
            <select value={filters.warehouse} onChange={(event) => updateFilter('warehouse', event.target.value)}>
              <option value="" />
              {warehouseOptions.map((warehouse) => (
                <option key={warehouse} value={warehouse}>{warehouse}</option>
              ))}
            </select>
          </Field>
          <Field label="Location">
            <select value={filters.location} onChange={(event) => updateFilter('location', event.target.value)}>
              <option value="" />
              {locationOptions.map((location) => (
                <option key={location} value={location}>{location}</option>
              ))}
            </select>
          </Field>
          <Field label="Item">
            <input value={filters.item} onChange={(event) => updateFilter('item', event.target.value)} />
          </Field>
          <Field label="Lot">
            <input value={filters.lot} onChange={(event) => updateFilter('lot', event.target.value)} />
          </Field>
          <Field label="Unit of Measure">
            <input value={filters.unit} onChange={(event) => updateFilter('unit', event.target.value)} />
          </Field>
        </div>

        <div className="etr-withdrawal-stock-toolbar">
          <button
            type="button"
            onClick={() => onSelectAll(filteredRows.map((row) => row.id))}
            disabled={!hasWarehouseAndLocation || filteredRows.length === 0}
          >
            Select All
          </button>
          <button
            type="button"
            onClick={() => onClearSelection(filteredRows.map((row) => row.id))}
            disabled={!hasWarehouseAndLocation || filteredRows.length === 0}
          >
            Unselect All
          </button>
        </div>

        <div className="etr-withdrawal-stock-table-wrap">
          {isLoading ? <span className="etr-withdrawal-muted">Loading stocks...</span> : null}
          {!isLoading && error ? <span className="etr-withdrawal-muted">{error}</span> : null}
          {!isLoading && !error && filteredRows.length === 0 ? <span className="etr-withdrawal-muted">{emptyStockMessage}</span> : null}
          {!isLoading && filteredRows.length > 0 ? (
            <table className="etr-withdrawal-stock-table">
              <thead>
                <tr>
                  <th aria-label="Select stock" />
                  <th>Unit of Measure</th>
                  <th>Lot</th>
                  <th>Expiry</th>
                  <th>Qty</th>
                  <th>Warehouse</th>
                  <th>Location</th>
                </tr>
              </thead>
              <tbody>
                {filteredRows.map((row) => (
                  <tr key={row.id}>
                    <td>
                      <input type="checkbox" checked={row.selected} onChange={(event) => onToggleRow(row.id, event.target.checked)} />
                    </td>
                    <td>{row.unit}</td>
                    <td>{row.lot}</td>
                    <td>{row.expiryDate || '1900-01-01'}</td>
                    <td>{row.quantity}</td>
                    <td>{row.warehouse}</td>
                    <td>{row.location}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : null}
        </div>

        <div className="etr-withdrawal-modal-actions">
          <button type="button" onClick={onConfirm}>Ok</button>
          <button type="button" onClick={onClose}>Cancel</button>
        </div>
      </section>
    </div>
  );
}

function RejectReasonModal({ onClose, onConfirm }) {
  const [reason, setReason] = useState('');
  const [remarks, setRemarks] = useState('');

  return (
    <div className="etr-withdrawal-modal-backdrop" role="presentation">
      <section className="etr-withdrawal-modal" role="dialog" aria-modal="true" aria-label="Rejection Reason">
        <div className="etr-withdrawal-modal-head">
          <div>
            <p className="etr-expense-kicker">Confirmation</p>
            <h2>Select Rejection Reason</h2>
          </div>
          <button type="button" onClick={onClose}>Close</button>
        </div>
        <Field label="Reason">
          <input type="text" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Enter rejection reason" />
        </Field>
        <Field label="Remarks">
          <textarea rows="3" value={remarks} onChange={(e) => setRemarks(e.target.value)} placeholder="Additional remarks" />
        </Field>
        <div className="etr-withdrawal-modal-actions">
          <button type="button" onClick={() => onConfirm({ reason, remarks })}>Confirm Rejection</button>
        </div>
      </section>
    </div>
  );
}

function PrintOptionsModal({ onClose, onSelect }) {
  return (
    <div className="etr-withdrawal-modal-backdrop" role="presentation">
      <section className="etr-withdrawal-modal etr-withdrawal-print-modal" role="dialog" aria-modal="true" aria-label="Print Options">
        <div className="etr-withdrawal-modal-head">
          <div>
            <p className="etr-expense-kicker">Print</p>
            <h2>Select document</h2>
          </div>
          <button type="button" onClick={onClose}>Close</button>
        </div>
        <div className="etr-withdrawal-print-options">
          {printOptions.map((option) => (
            <button type="button" key={option.id} onClick={() => onSelect(option)}>
              {option.label}
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}

export default function WithdrawalEntry({ user }) {
  const currentUserName = getCurrentUserDisplayName(user);
  const [activeTab, setActiveTab] = useState('details');
  const [isEditing, setIsEditing] = useState(true);
  const [formData, setFormData] = useState(emptyForm);
  const [details, setDetails] = useState([createBlankDetailRow()]);
  const [allocations, setAllocations] = useState([]);
  const [insufficientStocks, setInsufficientStocks] = useState([]);
  const [message, setMessage] = useState('');
  const [errors, setErrors] = useState({});
  const [lookup, setLookup] = useState(null);
  const [showPrintModal, setShowPrintModal] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [pendingItemLookupRow, setPendingItemLookupRow] = useState(null);
  const [withdrawalId, setWithdrawalId] = useState(-1);
  const [withdrawalTypeRows, setWithdrawalTypeRows] = useState(defaultWithdrawalTypes);
  const [referenceTypeRows, setReferenceTypeRows] = useState([]);
  const [referenceRows, setReferenceRows] = useState([]);
  const [showReferenceLookup, setShowReferenceLookup] = useState(false);
  const [isReferenceLookupLoading, setIsReferenceLookupLoading] = useState(false);
  const [referenceLookupError, setReferenceLookupError] = useState('');
  const [selectStockContext, setSelectStockContext] = useState(null);
  const [selectStockRows, setSelectStockRows] = useState([]);
  const [isSelectStockLoading, setIsSelectStockLoading] = useState(false);
  const [selectStockError, setSelectStockError] = useState('');
  const [lookupRows, setLookupRows] = useState({
    recipient: [],
    reason: [],
    warehouse: [],
    chargeTo: [],
    company: [],
    item: [],
  });
  const [lookupError, setLookupError] = useState('');
  const [isLookupLoading, setIsLookupLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const tableBodyRef = useRef(null);
  const hasRestoredDraftRef = useRef(false);

  useEffect(() => {
    try {
      const rawDraft = window.sessionStorage.getItem(WITHDRAWAL_DRAFT_STORAGE_KEY);
      if (!rawDraft) {
        hasRestoredDraftRef.current = true;
        return;
      }

      const draft = JSON.parse(rawDraft);
      if (draft?.formData) setFormData({ ...emptyForm, ...draft.formData });
      if (Array.isArray(draft?.details) && draft.details.length > 0) setDetails(draft.details);
      if (Array.isArray(draft?.allocations)) setAllocations(draft.allocations);
      if (Array.isArray(draft?.insufficientStocks)) setInsufficientStocks(draft.insufficientStocks);
      if (typeof draft?.withdrawalId !== 'undefined') setWithdrawalId(draft.withdrawalId);
      if (typeof draft?.isEditing === 'boolean') setIsEditing(draft.isEditing);
      if (draft?.activeTab) setActiveTab(draft.activeTab);
    } catch {
      window.sessionStorage.removeItem(WITHDRAWAL_DRAFT_STORAGE_KEY);
    } finally {
      hasRestoredDraftRef.current = true;
    }
  }, []);

  useEffect(() => {
    if (!hasRestoredDraftRef.current) return;

    try {
      window.sessionStorage.setItem(WITHDRAWAL_DRAFT_STORAGE_KEY, JSON.stringify({
        formData,
        details,
        allocations,
        insufficientStocks,
        withdrawalId,
        isEditing,
        activeTab,
      }));
    } catch {
      // Ignore storage write errors; the form should still work normally.
    }
  }, [formData, details, allocations, insufficientStocks, withdrawalId, isEditing, activeTab]);

  const totals = useMemo(() => ({
    quantity: details.reduce((sum, row) => sum + parseNumber(row.quantity), 0),
    withdrawalQuantity: allocations.reduce((sum, row) => sum + parseNumber(row.quantity), 0),
    insufficientQuantity: insufficientStocks.reduce((sum, row) => sum + parseNumber(row.quantity), 0),
  }), [details, allocations, insufficientStocks]);
  const hasPodNumber = formData.podNo.trim() !== '';
  const hasSelectedDetails = details.some((row) => row.selected);

  const getCreatedInfo = () => {
    if (formData.createdBy && formData.createdDate) {
      return `${formData.createdBy} on ${formatAuditDateTime(formData.createdDate)}`;
    }
    return 'Not created yet';
  };

  const getLastModifiedInfo = () => {
    const parts = [];
    if (formData.lastModifiedBy && formData.lastModifiedDate) {
      parts.push(`${formData.lastModifiedBy} on ${formatAuditDateTime(formData.lastModifiedDate)}`);
    }
    if (formData.modificationHistory && formData.modificationHistory.length > 0) {
      formData.modificationHistory.forEach(hist => {
        if (hist.modifiedBy !== formData.lastModifiedBy) {
          parts.push(`${hist.modifiedBy} on ${formatAuditDateTime(hist.modifiedDate)}`);
        }
      });
    }
    return parts.join(' | ') || 'Not modified yet';
  };

  const getApprovedInfo = () => {
    if (formData.approvedBy && formData.approvedDate) {
      return `${formData.approvedBy} on ${formatAuditDateTime(formData.approvedDate)}`;
    }
    return 'Not approved yet';
  };

  useEffect(() => {
    if (!isEditing) return;
    
    const lastRow = details[details.length - 1];
    const hasItemCode = lastRow.itemCode && lastRow.itemCode.trim() !== '';
    const hasEmptyRow = details.some(row => !row.itemCode || row.itemCode.trim() === '');
    
    if (hasItemCode && !hasEmptyRow) {
      setDetails(current => [...current, createBlankDetailRow()]);
    }
    
    const nonEmptyRows = details.filter(row => row.itemCode && row.itemCode.trim() !== '');
    const emptyRows = details.filter(row => !row.itemCode || row.itemCode.trim() === '');
    
    if (emptyRows.length > 1) {
      const keepEmptyRow = emptyRows[emptyRows.length - 1];
      setDetails([...nonEmptyRows, keepEmptyRow]);
    }
  }, [details, isEditing]);

  useEffect(() => {
    const controller = new AbortController();

    const loadInitialData = async () => {
      const token = getToken();
      const headers = token ? { Authorization: `Bearer ${token}` } : {};

      try {
        const [typeResponse, warehouseResponse, companyResponse, costUnitResponse, recipientResponse, referenceTypeResponse] = await Promise.all([
          fetch(buildApiUrl(`${WITHDRAWALS_ENDPOINT}/types`), { headers, signal: controller.signal }),
          fetch(buildApiUrl(`${WITHDRAWALS_ENDPOINT}/warehouses`), { headers, signal: controller.signal }),
          fetch(buildApiUrl(`${WITHDRAWALS_ENDPOINT}/companies`), { headers, signal: controller.signal }),
          fetch(buildApiUrl(COST_UNITS_ENDPOINT), { headers, signal: controller.signal }),
          fetch(buildApiUrl(`${WITHDRAWALS_ENDPOINT}/recipients`), { headers, signal: controller.signal }),
          fetch(buildApiUrl(`${WITHDRAWALS_ENDPOINT}/reference-types`), { headers, signal: controller.signal }),
        ]);

        const [typeData, warehouseData, companyData, costUnitData, recipientData, referenceTypeData] = await Promise.all([
          typeResponse.json().catch(() => ({})),
          warehouseResponse.json().catch(() => ({})),
          companyResponse.json().catch(() => ({})),
          costUnitResponse.json().catch(() => ({})),
          recipientResponse.json().catch(() => ({})),
          referenceTypeResponse.json().catch(() => ({})),
        ]);

        if (!typeResponse.ok) throw new Error(typeData?.message || 'Unable to load withdrawal types.');
        if (!warehouseResponse.ok) throw new Error(warehouseData?.message || 'Unable to load warehouses.');
        if (!companyResponse.ok) throw new Error(companyData?.message || 'Unable to load companies.');
        if (!costUnitResponse.ok) throw new Error(costUnitData?.message || 'Unable to load cost units.');
        if (!recipientResponse.ok) throw new Error(recipientData?.message || 'Unable to load recipients.');
        if (!referenceTypeResponse.ok) throw new Error(referenceTypeData?.message || 'Unable to load reference types.');

        const costUnits = getApiCollection(costUnitData).map((row) => ({
          id: getField(row, ['costUnitID', 'costUnitId', 'id', 'Id']),
          code: getField(row, ['code', 'Code']),
          description: getField(row, ['description', 'Description']),
        })).filter((row) => row.id && row.code && row.description);

        const withdrawalTypes = getApiCollection(typeData).map((row) => ({
          id: getField(row, ['id', 'Id']),
          code: getField(row, ['code', 'Code']),
          description: getField(row, ['description', 'Description']),
        })).filter((row) => row.id && row.description);

        setWithdrawalTypeRows(withdrawalTypes.length ? withdrawalTypes : defaultWithdrawalTypes);
        setReferenceTypeRows(getApiCollection(referenceTypeData).map((row) => ({
          id: getField(row, ['id', 'Id']),
          code: getField(row, ['code', 'Code']),
          description: getField(row, ['description', 'Description']),
        })).filter((row) => row.id && row.description));
        setLookupRows((current) => ({
          ...current,
          recipient: getApiCollection(recipientData).map((row) => ({
            id: getField(row, ['id', 'Id']),
            code: getField(row, ['code', 'Code']),
            description: getField(row, ['description', 'Description']),
            address: getField(row, ['address', 'Address', 'addressString', 'AddressString']),
          })).filter((row) => row.id && row.code && row.description),
          chargeTo: costUnits,
          warehouse: getApiCollection(warehouseData).map((row) => ({
            id: getField(row, ['id', 'Id']),
            code: getField(row, ['code', 'Code']),
            description: getField(row, ['description', 'Description']),
          })).filter((row) => row.id && row.description),
          company: getApiCollection(companyData).map((row) => ({
            id: getField(row, ['id', 'Id']),
            code: getField(row, ['code', 'Code']),
            description: getField(row, ['description', 'Description']),
          })).filter((row) => row.id && row.description),
        }));
      } catch (error) {
        if (error.name !== 'AbortError') {
          setMessage(error.message || 'Unable to load withdrawal setup data.');
        }
      }
    };

    loadInitialData();

    return () => controller.abort();
  }, []);

  const loadReferenceRows = useCallback(async (searchQuery = '') => {
    const referenceTypeId = formData.referenceTypeId;

    if (!referenceTypeId) {
      setReferenceRows([]);
      setReferenceLookupError('');
      setIsReferenceLookupLoading(false);
      return;
    }

    const token = getToken();
    setIsReferenceLookupLoading(true);
    setReferenceLookupError('');

    try {
      const params = new URLSearchParams({
        referenceTypeId: String(referenceTypeId),
        excludeStockWithdrawalId: String(withdrawalId),
      });

      if (searchQuery) {
        params.set('query', searchQuery);
      }

      const response = await fetch(buildApiUrl(`${WITHDRAWALS_ENDPOINT}/references?${params.toString()}`), {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data?.message || 'Unable to load reference numbers.');
      }

      setReferenceRows(getApiCollection(data).map((row) => ({
        id: getField(row, ['stockWithdrawalID', 'stockWithdrawalId', 'StockWithdrawalID', 'StockWithdrawalId', 'id', 'Id']),
        transactionNumber: getField(row, ['transactionNumber', 'TransactionNumber']),
        transactionDate: getField(row, ['transactionDate', 'TransactionDate']),
        recipient: getField(row, ['recipient', 'Recipient']),
        remarks: getField(row, ['remarks', 'Remarks']),
        status: getField(row, ['status', 'Status']),
      })).filter((row) => row.id && row.transactionNumber));
    } catch (error) {
      setReferenceLookupError(error.message || 'Unable to load reference numbers.');
      setReferenceRows([]);
    } finally {
      setIsReferenceLookupLoading(false);
    }
  }, [formData.referenceTypeId, withdrawalId]);

  const openReferenceLookup = () => {
    if (!isEditing || !formData.referenceTypeId) {
      return;
    }

    setReferenceRows([]);
    setReferenceLookupError('');
    setShowReferenceLookup(true);
  };

  const loadLookupRows = useCallback(async (type, searchQuery = '') => {
    if (!['recipient', 'reason', 'item'].includes(type)) {
      return;
    }

    const token = getToken();
    setIsLookupLoading(true);
    setLookupError('');

    try {
      const endpoint = type === 'reason'
        ? `${WITHDRAWALS_ENDPOINT}/reasons`
        : type === 'recipient'
          ? `${WITHDRAWALS_ENDPOINT}/recipients`
          : `${WITHDRAWALS_ENDPOINT}/items`;
      const queryString = searchQuery ? `?${new URLSearchParams({ query: searchQuery }).toString()}` : '';
      const response = await fetch(buildApiUrl(`${endpoint}${queryString}`), {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data?.message || `Unable to load ${type} options.`);
      }

      setLookupRows((current) => ({
        ...current,
        [type]: getApiCollection(data).map((row) => ({
          id: getField(row, ['id', 'Id']),
          code: getField(row, ['code', 'Code']),
          description: getField(row, ['description', 'Description']),
          address: getField(row, ['address', 'Address', 'addressString', 'AddressString']),
          unitId: getField(row, ['unitID', 'unitId', 'UnitID', 'UnitId']),
          unit: getField(row, ['unit', 'Unit']),
        })).filter((row) => row.id && (row.description || row.code)),
      }));
    } catch (error) {
      setLookupError(error.message || `Unable to load ${type} options.`);
    } finally {
      setIsLookupLoading(false);
    }
  }, []);

  const handleLookupSearch = useCallback((searchQuery) => {
    if (lookup) {
      loadLookupRows(lookup, searchQuery);
    }
  }, [lookup, loadLookupRows]);

  const openLookup = (type) => {
    setLookup(type);
    setLookupError('');
  };

  const updateForm = (field, value) => {
    setFormData((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: '' }));
  };

  const updateDetail = (rowId, field, value) => {
    setDetails((current) => current.map((row) => (row.id === rowId ? { ...row, [field]: value } : row)));
  };

  const addModificationHistory = (modifiedBy, modifiedDate) => {
    setFormData(prev => ({
      ...prev,
      modificationHistory: [
        ...(prev.modificationHistory || []),
        { modifiedBy, modifiedDate }
      ]
    }));
  };

  const preallocateStocks = async (itemKey, unitKey, quantity, warehouseKey, locationKey) => {
    const token = getToken();
    const response = await fetch(buildApiUrl(`${WITHDRAWALS_ENDPOINT}/preallocate`), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({
        itemID: toNumberOrDefault(itemKey),
        packagingUnitID: toNumberOrDefault(unitKey),
        quantity,
        warehouseID: toNumberOrDefault(warehouseKey),
        warehouseLocationID: toNumberOrDefault(locationKey),
      }),
    });
    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(data?.message || 'Unable to preallocate stocks.');
    }

    return data;
  };

  const processQuantityChange = async (itemKey, newQuantity) => {
    const detailRow = details.find(d => String(d.itemKey) === String(itemKey));
    if (!detailRow) return;

    const remainingAllocations = allocations.filter(a => String(a.itemKey) !== String(itemKey));
    const remainingInsufficient = insufficientStocks.filter(i => String(i.itemKey) !== String(itemKey));
    const requestedQuantity = parseNumber(newQuantity);

    if (requestedQuantity <= 0) {
      setAllocations(remainingAllocations);
      setInsufficientStocks(remainingInsufficient);
      updateDetail(detailRow.id, 'withdrawableQuantity', '0');
      updateDetail(detailRow.id, 'insufficientQuantity', '0');
      updateDetail(detailRow.id, 'withdrawalQuantity', '0');
      return;
    }
    
    const warehouseKey = formData.warehouseKey || -1;
    const locationKey = -1;
    
    try {
      const result = await preallocateStocks(itemKey, detailRow.unitKey, requestedQuantity, warehouseKey, locationKey);
    
      const newAllocations = getApiCollection(result.preallocated).map((stock) => ({
        ...createBlankAllocationRow({
          code: detailRow.itemCode,
          description: detailRow.itemDescription,
          itemKey,
        }),
        warehouse: stock.warehouse || stock.Warehouse || '',
        warehouseKey: stock.warehouseID ?? stock.warehouseId ?? stock.WarehouseID ?? stock.WarehouseId ?? null,
        location: stock.warehouseLocation || stock.WarehouseLocation || '',
        locationKey: stock.warehouseLocationID ?? stock.warehouseLocationId ?? stock.WarehouseLocationID ?? stock.WarehouseLocationId ?? null,
        lot: stock.lot || stock.Lot || '',
        manufacturingDate: String(stock.manufacturingDate || stock.ManufacturingDate || '').slice(0, 10),
        expiryDate: String(stock.expiryDate || stock.ExpiryDate || '').slice(0, 10),
        quantity: String(stock.quantity ?? stock.Quantity ?? 0),
        unit: stock.packagingUnit || stock.PackagingUnit || detailRow.unit,
        unitKey: stock.packagingUnitID ?? stock.packagingUnitId ?? stock.PackagingUnitID ?? stock.PackagingUnitId ?? detailRow.unitKey,
      }));
      
      let newInsufficient = [...remainingInsufficient];
      const unallocatedQuantity = parseNumber(result.unallocatedQuantity ?? result.UnallocatedQuantity);
      if (unallocatedQuantity > 0) {
        const insufficientRow = createBlankInsufficientRow({
          code: detailRow.itemCode,
          description: detailRow.itemDescription,
          itemKey: itemKey,
        });
        insufficientRow.quantity = unallocatedQuantity.toString();
        insufficientRow.unit = detailRow.unit;
        insufficientRow.unitKey = detailRow.unitKey;
        newInsufficient.push(insufficientRow);
      }
      
      setAllocations([...remainingAllocations, ...newAllocations]);
      setInsufficientStocks(newInsufficient);
      
      const totalAllocated = [...remainingAllocations, ...newAllocations]
        .filter(a => String(a.itemKey) === String(itemKey))
        .reduce((sum, a) => sum + parseNumber(a.quantity), 0);
      
      updateDetail(detailRow.id, 'withdrawableQuantity', totalAllocated.toString());
      updateDetail(detailRow.id, 'insufficientQuantity', unallocatedQuantity.toString());
      updateDetail(detailRow.id, 'withdrawalQuantity', totalAllocated.toString());
    } catch (error) {
      setMessage(error.message || 'Unable to preallocate stocks.');
    }
  };

  const openSelectStockModal = async (row) => {
    setSelectStockContext({
      ...row,
      warehouse: formData.warehouse,
    });
    setSelectStockRows([]);
    setSelectStockError('');
    setIsSelectStockLoading(true);

    try {
      const token = getToken();
      const response = await fetch(buildApiUrl(`${WITHDRAWALS_ENDPOINT}/stocks?${new URLSearchParams({ itemId: String(row.itemKey) }).toString()}`), {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      const result = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(result?.message || 'Unable to load available stocks.');
      }

      const stockRows = getApiCollection(result).map((stock) => {
        const stockRow = {
          id: crypto.randomUUID?.() || `${stock.lot || stock.Lot}-${stock.warehouseLocationID || stock.WarehouseLocationID}-${Date.now()}`,
          selected: false,
          itemKey: stock.itemID ?? stock.itemId ?? stock.ItemID ?? row.itemKey,
          itemCode: stock.itemCode || stock.ItemCode || row.itemCode || '',
          itemDescription: stock.itemDescription || stock.ItemDescription || row.itemDescription || '',
          unitKey: stock.packagingUnitID ?? stock.packagingUnitId ?? stock.PackagingUnitID ?? row.unitKey,
          unit: stock.packagingUnit || stock.PackagingUnit || row.unit || '',
          lot: stock.lot || stock.Lot || '',
          manufacturingDate: String(stock.manufacturingDate || stock.ManufacturingDate || '').slice(0, 10),
          expiryDate: String(stock.expiryDate || stock.ExpiryDate || '').slice(0, 10),
          quantity: String(stock.quantity ?? stock.Quantity ?? 0),
          warehouseKey: stock.warehouseID ?? stock.warehouseId ?? stock.WarehouseID ?? null,
          warehouse: stock.warehouse || stock.Warehouse || formData.warehouse || '',
          locationKey: stock.warehouseLocationID ?? stock.warehouseLocationId ?? stock.WarehouseLocationID ?? null,
          location: stock.warehouseLocation || stock.WarehouseLocation || '',
        };

        return {
          ...stockRow,
          isAllocated: allocations.some((allocation) => isSameStockSource(allocation, stockRow)),
        };
      });

      setSelectStockRows(stockRows);
      if (stockRows.length === 0) {
        setSelectStockError('No available stock found for this item.');
      }
    } catch (error) {
      setSelectStockError(error.message || 'Unable to load available stocks.');
    } finally {
      setIsSelectStockLoading(false);
    }
  };

  const toggleSelectStockRow = (rowId, selected) => {
    setSelectStockRows((current) => current.map((row) => (row.id === rowId ? { ...row, selected } : row)));
  };

  const selectAllStockRows = (rowIds = []) => {
    const idSet = new Set(rowIds);
    setSelectStockRows((current) => current.map((row) => (
      idSet.size === 0 || idSet.has(row.id) ? { ...row, selected: true } : row
    )));
  };

  const clearSelectedStockRows = (rowIds = []) => {
    const idSet = new Set(rowIds);
    setSelectStockRows((current) => current.map((row) => (
      idSet.size === 0 || idSet.has(row.id) ? { ...row, selected: false } : row
    )));
  };

  const closeSelectStockModal = () => {
    setSelectStockContext(null);
    setSelectStockRows([]);
    setSelectStockError('');
  };

  const applySelectedStocks = () => {
    if (!selectStockContext) {
      return;
    }

    const selectedRows = selectStockRows.filter((row) => row.selected && parseNumber(row.quantity) > 0);
    if (selectedRows.length === 0) {
      setSelectStockError('Select at least one stock row.');
      return;
    }

    const detailRow = details.find((row) => String(row.itemKey) === String(selectStockContext.itemKey));
    const detailQuantity = parseNumber(detailRow?.quantity);
    const alreadyAllocatedQuantity = allocations
      .filter((row) => String(row.itemKey) === String(selectStockContext.itemKey))
      .reduce((sum, row) => sum + parseNumber(row.quantity), 0);
    let remainingInsufficient = Math.min(
      parseNumber(selectStockContext.quantity),
      Math.max(detailQuantity - alreadyAllocatedQuantity, 0)
    );

    if (remainingInsufficient <= 0) {
      setSelectStockError('This item is already fully allocated.');
      return;
    }

    const newAllocations = [];

    selectedRows.forEach((stock) => {
      if (remainingInsufficient <= 0) {
        return;
      }

      if (allocations.some((allocation) => isSameStockSource(allocation, stock))) {
        return;
      }

      const availableQuantity = parseNumber(stock.quantity);
      const allocationQuantity = Math.min(availableQuantity, remainingInsufficient);
      if (allocationQuantity <= 0) {
        return;
      }

      newAllocations.push({
        ...createBlankAllocationRow({
          code: selectStockContext.itemCode || stock.itemCode,
          description: selectStockContext.itemDescription || stock.itemDescription,
          itemKey: selectStockContext.itemKey || stock.itemKey,
        }),
        itemCode: selectStockContext.itemCode || stock.itemCode,
        itemDescription: selectStockContext.itemDescription || stock.itemDescription,
        itemKey: selectStockContext.itemKey || stock.itemKey,
        warehouse: stock.warehouse,
        warehouseKey: stock.warehouseKey,
        location: stock.location,
        locationKey: stock.locationKey,
        lot: stock.lot,
        manufacturingDate: stock.manufacturingDate,
        expiryDate: stock.expiryDate,
        quantity: allocationQuantity.toString(),
        unit: stock.unit || selectStockContext.unit,
        unitKey: stock.unitKey || selectStockContext.unitKey,
      });

      remainingInsufficient -= allocationQuantity;
    });

    if (newAllocations.length === 0) {
      setSelectStockError('Selected stock has no available quantity.');
      return;
    }

    const nextAllocations = [...allocations, ...newAllocations];
    setAllocations(nextAllocations);

    setInsufficientStocks((current) => current.flatMap((row) => {
      if (row.id !== selectStockContext.id) {
        return [row];
      }

      return remainingInsufficient > 0
        ? [{ ...row, quantity: remainingInsufficient.toString() }]
        : [];
    }));

    if (detailRow) {
      const allocatedQuantity = nextAllocations
        .filter((row) => String(row.itemKey) === String(selectStockContext.itemKey))
        .reduce((sum, row) => sum + parseNumber(row.quantity), 0);
      const nextInsufficient = Math.max(detailQuantity - allocatedQuantity, 0);

      updateDetail(detailRow.id, 'withdrawableQuantity', allocatedQuantity.toString());
      updateDetail(detailRow.id, 'withdrawalQuantity', allocatedQuantity.toString());
      updateDetail(detailRow.id, 'insufficientQuantity', nextInsufficient.toString());
    }

    setMessage(remainingInsufficient > 0
      ? 'Selected stock was applied. Some quantity is still insufficient.'
      : 'Selected stock was applied.');
    closeSelectStockModal();
  };

  const validateEntries = () => {
    const nextErrors = {};
    let hasError = false;
    
    if (!formData.withdrawalTypeId) {
      nextErrors.withdrawalType = 'Withdrawal Type is required.';
      hasError = true;
    }
    if (!formData.recipientId) {
      nextErrors.recipient = 'Recipient is required.';
      hasError = true;
    }
    if (!formData.reasonId) {
      nextErrors.reason = 'Reason is required.';
      hasError = true;
    }
    if (!formData.chargeToId) {
      nextErrors.chargeTo = 'Charge To is required.';
      hasError = true;
    }
    if (!formData.companyKey) {
      nextErrors.company = 'Company is required.';
      hasError = true;
    }
    
    if (details.filter(d => d.itemCode && parseNumber(d.quantity) > 0).length === 0) {
      nextErrors.details = 'At least one detail is needed to save this record';
      hasError = true;
    }
    
    if (insufficientStocks.length > 0 && insufficientStocks.some(i => parseNumber(i.quantity) > 0)) {
      setActiveTab('insufficient');
      nextErrors.insufficientStock = 'There are items with Insufficient stock';
    }
    
    const hasQuantityError = details.some(detail => {
      const quantity = parseNumber(detail.quantity);
      const insufficient = parseNumber(detail.insufficientQuantity);
      const withdrawal = parseNumber(detail.withdrawalQuantity);
      return withdrawal !== (quantity - insufficient);
    });
    
    if (hasQuantityError) {
      setActiveTab('details');
      nextErrors.quantityMismatch = 'There are items with unequal allocated stock and withdrawable stocks';
      hasError = true;
    }
    
    setErrors(nextErrors);
    return !hasError;
  };

  const handleAction = (action) => {
    if (action === 'New') {
      newRecord();
      return;
    }
    if (action === 'Edit') {
      setIsEditing(true);
      setMessage('Edit mode enabled.');
      return;
    }
    if (action === 'Save') {
      handleSave();
      return;
    }
    if (action === 'Approve') {
      handleApprove();
      return;
    }
    if (action === 'Reject') {
      if (withdrawalId === -1) {
        setMessage('Please save the record first');
        return;
      }
      setShowRejectModal(true);
      return;
    }
    if (action === 'Print') {
      handlePrint();
      return;
    }
  };

  const newRecord = () => {
    window.sessionStorage.removeItem(WITHDRAWAL_DRAFT_STORAGE_KEY);
    setFormData({
      ...emptyForm,
      transactionDate: todayIso,
      createdDate: todayIso,
      lastModifiedDate: todayIso,
      modificationHistory: [],
    });
    setDetails([createBlankDetailRow()]);
    setAllocations([]);
    setInsufficientStocks([]);
    setWithdrawalId(-1);
    setIsEditing(true);
    setMessage('New withdrawal entry started.');
    setErrors({});
    setShowPrintModal(false);
    setShowRejectModal(false);
    setShowReferenceLookup(false);
    setLookup(null);
    setPendingItemLookupRow(null);
    closeSelectStockModal();

    const token = getToken();
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), 8000);

    fetch(buildApiUrl(`${WITHDRAWALS_ENDPOINT}/generated-no`), {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      signal: controller.signal,
    })
      .then(async (response) => {
        const data = await response.json().catch(() => ({}));

        if (!response.ok) {
          throw new Error(data?.message || 'Unable to generate withdrawal number.');
        }

        return data.transactionNumber || data.generatedNo || data.TransactionNumber || data.GeneratedNo || '';
      })
      .then((transactionNo) => {
        if (transactionNo) {
          setFormData((current) => ({ ...current, transactionNo }));
          setMessage('New withdrawal entry started.');
        } else {
          setMessage('New withdrawal entry started, but transaction number was not generated.');
        }
      })
      .catch((error) => {
        if (error?.name === 'AbortError') {
          setMessage('New withdrawal entry started, but transaction number generation timed out.');
          return;
        }

        setMessage('New withdrawal entry started, but transaction number was not generated.');
      })
      .finally(() => window.clearTimeout(timeoutId));
  };
  const handlePrint = () => {
    if (withdrawalId === -1) {
      setMessage('Please save the record first.');
      return;
    }

    setShowPrintModal(true);
  };

  const escapePrintValue = (value) => String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

  const escapePrintUpper = (value) => escapePrintValue(String(value ?? '').toUpperCase());

  const generateCode128Svg = (text, barHeight = 40, barWidth = 1.5) => {
    if (!text) return '';
    const CODE128_START_B = 104;
    const CODE128_STOP = 106;
    const PATTERNS = [
      '11011001100','11001101100','11001100110','10010011000','10010001100',
      '10001001100','10011001000','10011000100','10001100100','11001001000',
      '11001000100','11000100100','10110011100','10011011100','10011001110',
      '10111001100','10011101100','10011100110','11001110010','11001011100',
      '11001001110','11011100100','11001110100','11100101100','11100100110',
      '11101100100','11100110100','11100110010','11011011000','11011000110',
      '11000110110','10100011000','10001011000','10001000110','10110001000',
      '10001101000','10001100010','11010001000','11000101000','11000100010',
      '10110111000','10110001110','10001101110','10111011000','10111000110',
      '10001110110','11101110110','11010001110','11000101110','11011101000',
      '11011100010','11011101110','11101011000','11101000110','11100010110',
      '11101101000','11101100010','11100011010','11101111010','11001000010',
      '11110001010','10100110000','10100001100','10010110000','10010000110',
      '10000101100','10000100110','10110010000','10110000100','10011010000',
      '10011000010','10000110100','10000110010','11000010010','11001010000',
      '11110111010','11000010100','10001111010','10100111100','10010111100',
      '10010011110','10111100100','10011110100','10011110010','11110100100',
      '11110010100','11110010010','11011011110','11011110110','11110110110',
      '10101111000','10100011110','10001011110','10111101000','10111100010',
      '10001111010','11110101000','11110100010','10111011110','10111101110',
      '11101011110','11110101110','11010000100','11010010000','11010011100',
      '1100011101011',
    ];
    const values = [CODE128_START_B];
    for (let i = 0; i < text.length; i++) {
      values.push(text.charCodeAt(i) - 32);
    }
    let checksum = values[0];
    for (let i = 1; i < values.length; i++) {
      checksum += values[i] * i;
    }
    values.push(checksum % 103);
    values.push(CODE128_STOP);
    let binary = '';
    for (const v of values) {
      binary += PATTERNS[v];
    }
    const svgWidth = binary.length * barWidth + 20;
    let bars = '';
    for (let i = 0; i < binary.length; i++) {
      if (binary[i] === '1') {
        bars += `<rect x="${10 + i * barWidth}" y="0" width="${barWidth}" height="${barHeight}" fill="#000"/>`;
      }
    }
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${svgWidth}" height="${barHeight}" viewBox="0 0 ${svgWidth} ${barHeight}">${bars}</svg>`;
  };

  const formatPrintQuantity = (value) => {
    const quantity = parseNumber(value);
    return Number.isFinite(quantity) ? quantity.toFixed(6) : String(value ?? '');
  };

  const formatPrintDateTime = (value) => {
    if (!value) return '';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return String(value);
    return date.toLocaleString('en-US', {
      month: '2-digit',
      day: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatPrintDate = (value) => {
    if (!value) return '';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return String(value);
    return date.toLocaleDateString('en-US', {
      month: '2-digit',
      day: '2-digit',
      year: 'numeric',
    });
  };

  const getPrintableRows = () => {
    if (allocations.length > 0) {
      return allocations.map((row) => ({
        itemCode: row.itemCode,
        itemDescription: row.itemDescription,
        lot: row.lot,
        expiryDate: row.expiryDate,
        unit: row.unit,
        quantity: row.quantity,
        warehouse: row.warehouse,
        location: row.location,
      }));
    }

    return details
      .filter((row) => row.itemCode)
      .map((row) => ({
        itemCode: row.itemCode,
        itemDescription: row.itemDescription,
        lot: '',
        expiryDate: '',
        unit: row.unit,
        quantity: row.withdrawalQuantity || row.quantity,
        warehouse: formData.warehouse,
        location: '',
      }));
  };

  const getRecipientLine = () => `${formData.recipientCode || ''} - ${formData.recipientName || ''}`.replace(/^\s*-\s*/, '').trim();
  const getReasonLine = () => `${formData.reasonCode || ''} - ${formData.reasonDescription || ''}`.replace(/^\s*-\s*/, '').trim();
  const getChargeToLine = () => `${formData.chargeToCode || ''} - ${formData.chargeToName || ''}`.replace(/^\s*-\s*/, '').trim();

  const buildWithdrawalFormHtml = () => {
    const rows = getPrintableRows();
    const bodyRows = rows.length ? rows.map((row) => `
      <tr>
        <td>${escapePrintUpper(row.itemCode)}</td>
        <td>${escapePrintUpper(row.itemDescription)}</td>
        <td>${escapePrintUpper(row.unit)}</td>
        <td>${escapePrintUpper(row.lot)}</td>
        <td>${escapePrintUpper(row.expiryDate)}</td>
        <td class="qty">${escapePrintUpper(formatPrintQuantity(row.quantity))}</td>
        <td>${escapePrintUpper(row.warehouse)}</td>
        <td>${escapePrintUpper(row.location)}</td>
      </tr>
    `).join('') : '<tr><td colspan="8">&nbsp;</td></tr>';
    const fillerRows = Array.from({ length: Math.max(0, 10 - rows.length) }, () => '<tr class="wf-blank-row"><td>&nbsp;</td><td></td><td></td><td></td><td></td><td></td><td></td><td></td></tr>').join('');

    return `
      <div class="page wf-page">
        <div class="wf-company">
          <strong>MASIGASIG TRANSPORT AND LOGISTICS SOLUTIONS, INC.</strong>
          <span>Bay 5 Cervantes Compound, Km 17 W Service Rd, Paranaque</span>
          <span>Metro Manila</span>
        </div>
        <div class="wf-title">WITHDRAWAL FORM</div>
        <div class="wf-info">
          <div><span>Recipient</span><b>${escapePrintUpper(getRecipientLine())}</b></div>
          <div><span>Transaction No.</span><b>${escapePrintUpper(formData.transactionNo)}</b></div>
          <div><span>Withdrawal Reason</span><b>${escapePrintUpper(getReasonLine())}</b></div>
          <div><span>Transaction Date</span><b>${escapePrintUpper(formatPrintDate(formData.transactionDate))}</b></div>
          <div class="full"><span>Remarks</span><b>${escapePrintUpper(formData.remarks)}</b></div>
          <div class="full"><span>Address</span><b>${escapePrintUpper(formData.address)}</b></div>
        </div>
        <table class="wf-items">
          <thead>
            <tr>
              <th>ITEM CODE</th>
              <th>DESCRIPTION</th>
              <th>UOM</th>
              <th>LOT NO.</th>
              <th>EXPIRY DATE</th>
              <th>QUANTITY</th>
              <th>WAREHOUSE</th>
              <th>LOCATION</th>
            </tr>
          </thead>
          <tbody>${bodyRows}${fillerRows}</tbody>
        </table>
        <div class="wf-note">PLEASE SIGN OVER PRINTED NAME</div>
        <table class="wf-approval">
          <thead><tr><th>ENCODED BY:</th><th>APPROVED BY:</th><th>RECEIVED BY:</th></tr></thead>
          <tbody>
            <tr><td>${escapePrintUpper(formData.createdBy || currentUserName)}</td><td>${escapePrintUpper(formData.approvedBy)}</td><td>&nbsp;</td></tr>
            <tr><td>${escapePrintValue(formatPrintDateTime(formData.createdDate))}</td><td>${escapePrintValue(formatPrintDateTime(formData.approvedDate))}</td><td>&nbsp;</td></tr>
          </tbody>
        </table>
        <footer>Page 1 of 1</footer>
      </div>
    `;
  };

  const buildDeliveryReceiptHtml = () => {
    const rows = getPrintableRows();
    const totalQty = rows.reduce((sum, row) => sum + parseNumber(row.quantity), 0);
    const bodyRows = rows.length ? rows.map((row) => `
      <tr>
        <td>${escapePrintValue(row.itemCode)}</td>
        <td>${escapePrintValue(row.itemDescription)}</td>
        <td>${escapePrintValue(row.lot)}</td>
        <td>${escapePrintValue(row.expiryDate)}</td>
        <td class="qty">${escapePrintValue(row.quantity)}</td>
      </tr>
    `).join('') : '<tr><td colspan="5">&nbsp;</td></tr>';


    return `
      <div class="page dr-page">
        <div class="dr-head">
          <div class="dr-company">
            <strong>MASIGASIG TRANSPORT AND LOGISTICS SOLUTIONS, INC.</strong>
            <span>Bay 16 Cervantes Compound, KM 17 W Service Rd, Paranaque, 1700</span>
            <span>Metro Manila</span>
            <span>VAT REG. TIN. 008-222-291-000</span>
          </div>
          <div class="dr-doc-title">
            <h1>DELIVERY RECEIPT</h1>
            <div class="barcode" aria-label="Transaction barcode">${generateCode128Svg(formData.transactionNo || '', 48, 1.75)}</div>
            <strong class="dr-barcode-number">${escapePrintValue(formData.recipientName || getRecipientLine())}</strong>
          </div>
        </div>
        <div class="dr-meta">
          <div class="dr-info">
            <div><span>DR No.</span><b>${escapePrintValue(formData.podNo || formData.transactionNo)}</b></div>
            <div><span>DR Date</span><b>${escapePrintValue(formatPrintDateTime(formData.transactionDate))}</b></div>
            <div><span>Customer</span><b>${escapePrintValue(getRecipientLine())}</b></div>
            <div class="dr-wrap"><span>Address</span><b>${escapePrintValue(formData.address)}</b></div>
            <div><span>Sales</span><b>${escapePrintValue(getChargeToLine())}</b></div>
            <div class="dr-wrap"><span>Remarks</span><b>${escapePrintValue(formData.remarks)}</b></div>
          </div>
          <div class="dr-header-fields">
            <div><span>Invoice No.</span><b>${escapePrintValue(formData.referenceNo)}</b></div>
            <div><span>PO #</span><b>${escapePrintValue(formData.referenceNo)}</b></div>
            <div><span>No. of Boxes</span><b>${escapePrintValue(formData.noOfPallets)}</b></div>
          </div>
        </div>
        <table class="dr-items">
          <thead><tr><th>Item Code</th><th>Description</th><th>Lot</th><th>Expiry Date</th><th>Qty</th></tr></thead>
          <tbody>${bodyRows}</tbody>
        </table>
        <div class="dr-additional">Additional Instructions :</div>
        <div class="dr-total"><span>Total Qty</span><b>${escapePrintValue(totalQty.toFixed(2))}</b></div>
        <div class="dr-signatures">
          <div>Prepared By/Date</div>
          <div>Stock Checked By/Date</div>
          <div>Receiver Signature Over Printed<br/>Name/Date &amp; Time/Relationship</div>
          <div>Guard on Duty/Date</div>
          <div>Delivered By/Date</div>
        </div>
        <footer><span>${escapePrintValue(formatPrintDateTime(new Date()))} &nbsp; ${escapePrintValue(currentUserName)} (Stock Withdrawal)</span><b>Page 1 of 1</b></footer>
      </div>
    `;
  };

  const buildPrintDocumentHtml = (option) => {
    const isDeliveryReceipt = option.id === 'delivery-receipt';
    const body = isDeliveryReceipt ? buildDeliveryReceiptHtml() : buildWithdrawalFormHtml();

    return `
      <!doctype html>
      <html>
        <head>
          <title>${escapePrintValue(option.label)} - ${escapePrintValue(formData.transactionNo)}</title>
          <style>
            @page { size: ${isDeliveryReceipt ? 'letter portrait' : 'letter landscape'}; margin: 0.25in; }
            * { box-sizing: border-box; }
            body { margin: 0; background: #8f8f8f; color: #000; font-family: ${isDeliveryReceipt ? '"Courier New", Courier, monospace' : 'Arial, Helvetica, sans-serif'}; font-size: 9px; }
            .page { background: #fff; margin: 16px auto; box-shadow: 0 0 0 1px #555; position: relative; }
            .wf-page { width: 10.5in; min-height: 7.5in; padding: .12in .9in .34in; border: 0; box-shadow: none; font-family: Arial, Helvetica, sans-serif; }
            .wf-page * { font-family: Arial, Helvetica, sans-serif; }
            .dr-page { width: 7.85in; min-height: 10.45in; padding: .25in .32in .34in; border: 0; box-shadow: none; font-family: "Courier New", Courier, monospace; }
            b, strong { font-weight: 700; }
            table { width: 100%; border-collapse: collapse; }
            th, td { border: 1px solid #777; padding: 3px 4px; vertical-align: top; font-weight: normal; }
            th { text-align: center; }
            .qty { text-align: right; }
            .blank-row td { height: 26px; }
            footer { position: absolute; left: .32in; right: .32in; bottom: .18in; }
            .wf-company { display: grid; gap: 1px; width: 58%; margin-bottom: 9px; font-size: 10px; }
            .wf-company strong { font-size: 14px; font-weight: 700; text-transform: uppercase; }
            .wf-title { border: 1px solid #222; text-align: center; font-weight: 700; width: 100%; padding: 2px 0; font-size: 12px; }
            .wf-info { display: grid; grid-template-columns: 1.25fr .75fr; gap: 2px 32px; margin-top: 5px; font-size: 10px; }
            .wf-info div { display: grid; grid-template-columns: 118px 1fr; gap: 0; }
            .wf-info b { font-weight: 400; }
            .wf-info .left-only { grid-column: 1 / 2; }
            .wf-info .full { grid-column: 1 / -1; }
            .wf-items { margin-top: 30px; table-layout: fixed; font-size: 8px; border: 1px solid #555; border-collapse: collapse; text-transform: uppercase; }
            .wf-items th:nth-child(1) { width: 9%; }
            .wf-items th:nth-child(2) { width: 28%; }
            .wf-items th:nth-child(3) { width: 8%; }
            .wf-items th:nth-child(4) { width: 11%; }
            .wf-items th:nth-child(5) { width: 11%; }
            .wf-items th:nth-child(6) { width: 11%; }
            .wf-items th:nth-child(7) { width: 11%; }
            .wf-items th:nth-child(8) { width: 11%; }
            .wf-items th { border: 1px solid #555; font-size: 8px; font-weight: 700; padding: 3px 4px; text-transform: uppercase; }
            .wf-items td { border-left: 1px solid #555; border-right: 1px solid #555; border-top: 0; border-bottom: 0; height: 22px; padding: 4px; }
            .wf-items td:nth-child(3), .wf-items td:nth-child(4), .wf-items td:nth-child(5), .wf-items td:nth-child(6), .wf-items td:nth-child(8) { text-align: center; }
            .wf-items tbody tr:last-child td { height: 210px; }
            .wf-items .wf-blank-row td { height: 22px; }
            .wf-note { border: 0; padding: 4px 0 2px; min-height: 16px; font-size: 8px; text-transform: uppercase; }
            .wf-approval { border-collapse: collapse; font-size: 8px; text-transform: uppercase; border-left: 1px solid #555; border-right: 1px solid #555; border-bottom: 1px solid #555; }
            .wf-approval th { border-top: 1px solid #555; border-bottom: 1px solid #555; border-left: 0; border-right: 0; height: 16px; text-align: center; font-weight: 400; padding: 2px 4px; }
            .wf-approval td { border: 0; text-align: center; padding: 4px; }
            .wf-approval tbody tr:first-child td { height: 42px; vertical-align: bottom; padding-bottom: 1px; }
            .wf-approval tbody tr:nth-child(2) td { height: 16px; vertical-align: top; padding-top: 0; }
            .wf-page footer { text-align: right; }
            .dr-head { display: grid; grid-template-columns: minmax(0, 1fr) 240px; gap: 18px; align-items: start; }
            .dr-company { display: grid; gap: 2px; font-size: 9px; padding-top: 0; }
            .dr-company strong { font-size: 12px; }
            .dr-doc-title { text-align: center; padding-top: 0; justify-self: end; width: 240px; }
            .dr-doc-title h1 { font-size: 18px; margin: 0 0 6px; letter-spacing: .05em; white-space: nowrap; }
            .barcode { display: block; text-align: center; margin: 0 auto 6px; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
            .barcode svg { height: 48px; width: auto; max-width: 220px; }
            .dr-barcode-number { display: block; font-size: 9px; margin-top: 2px; font-weight: 700; letter-spacing: 0.02em; text-align: center; }
            .dr-header-fields { display: grid; gap: 8px; margin-top: 0; text-align: left; padding-left: 22px; }
            .dr-header-fields > div { display: grid; grid-template-columns: 90px 1fr; gap: 10px; font-size: 10px; justify-content: stretch; align-items: baseline; }
            .dr-header-fields > div b { text-align: left; font-weight: 700; font-size: 10px; }
            .dr-meta { display: grid; grid-template-columns: minmax(0, 1fr) 240px; gap: 18px; align-items: start; margin-top: 4px; }
            .dr-info { display: grid; grid-template-columns: 1fr; gap: 5px; margin-top: 0; font-size: 9px; max-width: none; }
            .dr-info > div { display: grid; grid-template-columns: 78px 1fr; gap: 8px; min-height: 12px; align-items: start; min-width: 0; }
            .dr-wrap b { word-wrap: break-word; overflow-wrap: break-word; word-break: break-all; white-space: normal; line-height: 1.4; min-width: 0; }
            .dr-items { margin-top: 12px; table-layout: fixed; font-size: 9px; border-top: 1px solid #333; border-bottom: 1px solid #333; }
            .dr-items th, .dr-items td { border-left: 0; border-right: 0; border-top: 0; border-bottom: 0; padding: 3px 4px; white-space: nowrap; }
            .dr-items th:nth-child(1), .dr-items td:nth-child(1) { width: 13%; text-align: left; }
            .dr-items th:nth-child(2), .dr-items td:nth-child(2) { width: 49%; text-align: left; white-space: normal; }
            .dr-items th:nth-child(3), .dr-items td:nth-child(3) { width: 15%; text-align: center; }
            .dr-items th:nth-child(4), .dr-items td:nth-child(4) { width: 15%; text-align: center; }
            .dr-items th:nth-child(5), .dr-items td:nth-child(5) { width: 8%; text-align: right; }
            .dr-items thead th { border-bottom: 1px solid #333; font-weight: 700; }
            .dr-items tbody tr:last-child td { border-bottom: 0; }

            .dr-additional { padding-top: 4px; min-height: 245px; font-size: 9px; }
            .dr-total { position: absolute; left: .32in; right: .32in; bottom: 1.62in; display: grid; grid-template-columns: 1fr 70px; gap: 12px; border-bottom: 1px solid #333; padding-bottom: 4px; text-align: right; }
            .dr-signatures { position: absolute; left: .32in; right: .32in; bottom: .48in; display: grid; grid-template-columns: 1fr 1fr 1.45fr; gap: 20px 26px; font-size: 8px; }
            .dr-signatures div { border-top: 1px solid #333; min-height: 28px; padding-top: 4px; text-align: center; }
            .dr-signatures div:nth-child(4), .dr-signatures div:nth-child(5) { grid-column: span 1; }
            .dr-page footer { display: flex; justify-content: space-between; bottom: .12in; }
            @media print {
              body { background: #fff; }
              .page { margin: 0; box-shadow: none; }
            }
          </style>
        </head>
        <body>
          ${body}
          <script>
            window.addEventListener('load', () => {
              window.focus();
              window.print();
            });
          </script>
        </body>
      </html>
    `;
  };

  const openPrintableDocument = (option) => {
    const printWindow = window.open('', '_blank', 'width=1100,height=780');
    if (!printWindow) {
      setMessage('Unable to open print window. Please allow pop-ups for this site.');
      return;
    }

    printWindow.document.write(buildPrintDocumentHtml(option));
    printWindow.document.close();
    setShowPrintModal(false);
    setMessage(`${option.label} print preview opened.`);
  };
  const handleGeneratePod = async () => {
    if (withdrawalId === -1) {
      setMessage('Please save the record first.');
      return;
    }

    if (hasPodNumber) {
      return;
    }

    if (!formData.targetDelivery) {
      setMessage('Target delivery date is required before generating POD.');
      setErrors((current) => ({ ...current, targetDelivery: 'Target delivery is required.' }));
      return;
    }

    const token = getToken();
    setIsSaving(true);

    try {
      const response = await fetch(buildApiUrl(`${WITHDRAWALS_ENDPOINT}/${withdrawalId}/pod`), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ dateNeeded: formData.targetDelivery }),
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data?.message || 'Unable to generate POD.');
      }

      updateForm('podNo', data.podNumber || data.PODNumber || '');

      if (data.dateNeeded) {
        updateForm('targetDelivery', String(data.dateNeeded).slice(0, 10));
      }

      setMessage('POD number generated successfully.');
      setErrors((current) => ({ ...current, targetDelivery: '' }));
    } catch (error) {
      setMessage(error.message || 'Unable to generate POD.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleApprove = () => {
    if (withdrawalId === -1) {
      setMessage('Please save the record first');
      return;
    }
    
    if (!validateEntries()) {
      return;
    }
    
    if (insufficientStocks.length > 0 && insufficientStocks.some(i => parseNumber(i.quantity) > 0)) {
      setMessage('There is insufficient stock in one of the items. Please check.');
      setActiveTab('insufficient');
      return;
    }
    
    if (window.confirm('Are you sure you want to approve this record?')) {
      const approve = async () => {
        const token = getToken();
        setIsSaving(true);
        try {
          const response = await fetch(buildApiUrl(`${WITHDRAWALS_ENDPOINT}/${withdrawalId}/approve`), {
            method: 'POST',
            headers: token ? { Authorization: `Bearer ${token}` } : {},
          });
          const data = await response.json().catch(() => ({}));

          if (!response.ok) {
            throw new Error(data?.message || 'Unable to approve withdrawal.');
          }

          setIsEditing(false);
          const nowStamp = new Date().toISOString();
          setFormData(prev => ({
            ...prev,
            approvedBy: currentUserName,
            approvedDate: nowStamp,
            lastModifiedBy: currentUserName,
            lastModifiedDate: nowStamp,
          }));
          setMessage('Record approved successfully');
        } catch (error) {
          setMessage(error.message || 'Unable to approve withdrawal.');
        } finally {
          setIsSaving(false);
        }
      };

      approve();
    }
  };

  const handleRejectConfirm = ({ reason, remarks }) => {
    const reject = async () => {
      const token = getToken();
      setIsSaving(true);
      try {
        const response = await fetch(buildApiUrl(`${WITHDRAWALS_ENDPOINT}/${withdrawalId}/reject`), {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({
            rejectReasonID: Number(reason) || 1,
            rejectDescription: remarks || reason || 'Rejected',
          }),
        });
        const data = await response.json().catch(() => ({}));

        if (!response.ok) {
          throw new Error(data?.message || 'Unable to reject withdrawal.');
        }

        setShowRejectModal(false);
        setIsEditing(false);
        const nowStamp = new Date().toISOString();
        setFormData(prev => ({
          ...prev,
          rejectReasonID: reason,
          rejectDescription: remarks,
          lastModifiedBy: currentUserName,
          lastModifiedDate: nowStamp,
        }));
        setMessage(`Record rejected. Reason: ${reason}`);
      } catch (error) {
        setMessage(error.message || 'Unable to reject withdrawal.');
      } finally {
        setIsSaving(false);
      }
    };

    reject();
  };

  const buildSavePayload = () => {
    const detailRows = [
      ...allocations.map((row) => ({
        itemID: toNumberOrDefault(row.itemKey),
        packagingUnitID: toNumberOrDefault(row.unitKey),
        quantity: parseNumber(row.quantity),
        warehouseID: toNumberOrDefault(row.warehouseKey),
        warehouseLocationID: toNumberOrDefault(row.locationKey),
        lot: row.lot || '',
        expiryDate: toApiDate(row.expiryDate),
        manufacturingDate: toApiDate(row.manufacturingDate),
        remarks: details.find((detail) => detail.itemKey === row.itemKey)?.remarks || '',
        detailType: 0,
        referenceID: -1,
        status: false,
      })),
      ...insufficientStocks.map((row) => ({
        itemID: toNumberOrDefault(row.itemKey),
        packagingUnitID: toNumberOrDefault(row.unitKey),
        quantity: parseNumber(row.quantity),
        warehouseID: -1,
        warehouseLocationID: -1,
        lot: '',
        expiryDate: '1900-01-01',
        manufacturingDate: '1900-01-01',
        remarks: details.find((detail) => detail.itemKey === row.itemKey)?.remarks || '',
        detailType: 1,
        referenceID: -1,
        status: false,
      })),
    ].filter((row) => row.itemID > 0 && row.packagingUnitID > 0 && row.quantity > 0);

    return {
      stockWithdrawalID: withdrawalId,
      transactionNumber: formData.transactionNo,
      transactionDate: toApiDate(formData.transactionDate),
      withdrawalType: toNumberOrDefault(formData.withdrawalTypeId, 0),
      recipientID: toNumberOrDefault(formData.recipientId, 0),
      reasonID: toNumberOrDefault(formData.reasonId, 0),
      remarks: formData.remarks,
      status: 0,
      referenceID: toNumberOrDefault(formData.referenceId, -1),
      referenceType: toNumberOrDefault(formData.referenceTypeId, 0),
      referenceNo: formData.referenceNo,
      deliveryInstructions: formData.deliveryInstructions,
      podNumber: formData.podNo,
      confirmationStatus: false,
      confirmationDate: '1900-01-01',
      isDRPrinted: false,
      isPrinted: false,
      dateNeeded: toApiDate(formData.targetDelivery),
      declareValue: parseNumber(formData.declareValue),
      isDownloaded: false,
      chargeTo: toNumberOrDefault(formData.chargeToId, 0),
      companyID: toNumberOrDefault(formData.companyKey, 0),
      noOfPallets: parseNumber(formData.noOfPallets),
      deliveryStatus: formData.deliveryStatus || 0,
      details: detailRows,
    };
  };

  const handleSave = async () => {
    if (!validateEntries()) {
      return;
    }

    const token = getToken();
    const payload = buildSavePayload();
    setIsSaving(true);
    setMessage('');

    try {
      const endpoint = withdrawalId === -1
        ? WITHDRAWALS_ENDPOINT
        : `${WITHDRAWALS_ENDPOINT}/${withdrawalId}`;
      const response = await fetch(buildApiUrl(endpoint), {
        method: withdrawalId === -1 ? 'POST' : 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(payload),
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data?.message || 'Unable to save withdrawal.');
      }

      const savedId = data.stockWithdrawalId ?? data.StockWithdrawalId ?? data.stockWithdrawalID ?? data.StockWithdrawalID;
      const isNewRecord = withdrawalId === -1;
      const nowStamp = new Date().toISOString();

      if (savedId) {
        setWithdrawalId(savedId);
      }

      if (!isNewRecord && formData.lastModifiedBy && formData.lastModifiedDate) {
        addModificationHistory(formData.lastModifiedBy, formData.lastModifiedDate);
      }

      setFormData(prev => ({
        ...prev,
        transactionNo: prev.transactionNo || data.transactionNumber || data.TransactionNumber || prev.transactionNo,
        createdBy: isNewRecord ? currentUserName : prev.createdBy,
        createdDate: isNewRecord ? nowStamp : prev.createdDate,
        lastModifiedBy: currentUserName,
        lastModifiedDate: nowStamp,
      }));
      setIsEditing(false);
      setMessage('Record saved successfully');
    } catch (error) {
      setMessage(error.message || 'Unable to save withdrawal.');
    } finally {
      setIsSaving(false);
    }
  };

  const loadRecipientAddress = async (recipient) => {
    const token = getToken();
    const recipientCode = recipient?.code || recipient?.Code || '';
    const recipientId = String(recipient?.id || recipient?.Id || '');
    const query = new URLSearchParams({ query: recipientCode });
    const response = await fetch(buildApiUrl(`${WITHDRAWALS_ENDPOINT}/recipients?${query.toString()}`), {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      return '';
    }

    const match = getApiCollection(data).find((item) => (
      String(getField(item, ['id', 'Id'])) === recipientId
      || getField(item, ['code', 'Code']).toLowerCase() === String(recipientCode || '').toLowerCase()
    )) || getApiCollection(data)[0];

    return getField(match, ['address', 'Address', 'addressString', 'AddressString']);
  };

  const handleLookupSelect = async (row) => {
    if (lookup === 'recipient') {
      const selectedAddress = row.address || row.Address || row.addressString || row.AddressString || '';
      const resolvedAddress = await loadRecipientAddress(row) || selectedAddress;
      setFormData((current) => ({ 
        ...current, 
        recipientId: row.id,
        recipientCode: row.code, 
        recipientName: row.description, 
        address: resolvedAddress,
      }));
      setErrors((current) => ({ ...current, recipient: '' }));
    }
    if (lookup === 'reason') {
      setFormData((current) => ({ ...current, reasonId: row.id, reasonCode: row.code, reasonDescription: row.description }));
      setErrors((current) => ({ ...current, reason: '' }));
    }
    if (lookup === 'warehouse') {
      setFormData((current) => ({ ...current, warehouse: row.description, warehouseKey: row.id }));
      details.forEach(detail => {
        if (detail.itemKey) {
          processQuantityChange(detail.itemKey, detail.quantity);
        }
      });
    }
    if (lookup === 'chargeTo') {
      setFormData((current) => ({ ...current, chargeToId: row.id, chargeToCode: row.code, chargeToName: row.description }));
      setErrors((current) => ({ ...current, chargeTo: '' }));
    }
    if (lookup === 'company') {
      setFormData((current) => ({ ...current, company: row.description, companyKey: row.id }));
      setErrors((current) => ({ ...current, company: '' }));
    }
    if (lookup === 'item' && pendingItemLookupRow) {
      updateDetail(pendingItemLookupRow.id, 'itemCode', row.code);
      updateDetail(pendingItemLookupRow.id, 'itemDescription', row.description);
      updateDetail(pendingItemLookupRow.id, 'unit', row.unit);
      updateDetail(pendingItemLookupRow.id, 'itemKey', row.id);
      updateDetail(pendingItemLookupRow.id, 'unitKey', row.unitId);
      processQuantityChange(row.id, 0);
      setPendingItemLookupRow(null);
    }
    setLookup(null);
  };

  const handleItemLookupClick = (row) => {
    if (!isEditing) return;
    setPendingItemLookupRow(row);
    openLookup('item');
  };

  const deleteSelectedDetails = () => {
    if (!hasSelectedDetails) {
      return;
    }

    if (window.confirm('Are you sure you want to remove the selected items?')) {
      const selectedIds = details.filter(row => row.selected).map(row => row.id);
      const selectedItemKeys = details.filter(row => row.selected).map(row => row.itemKey);
      const remainingAllocations = allocations.filter(a => !selectedItemKeys.includes(a.itemKey));
      const remainingInsufficient = insufficientStocks.filter(i => !selectedItemKeys.includes(i.itemKey));
      
      setAllocations(remainingAllocations);
      setInsufficientStocks(remainingInsufficient);
      
      const remainingDetails = details.filter(row => !row.selected);
      setDetails(remainingDetails.length ? remainingDetails : [createBlankDetailRow()]);
    }
  };

  const actionDisabled = (action) => {
    if (isSaving) return true;
    if (action === 'Edit') return isEditing;
    if (action === 'Save') return !isEditing;
    if (action === 'Approve') return isEditing || withdrawalId === -1;
    if (action === 'Reject') return isEditing || withdrawalId === -1;
    if (action === 'Print') return false;
    return false;
  };

  const duplicateAllocationRow = (row) => {
    const newRow = { ...row, id: crypto.randomUUID?.() || String(Date.now()) };
    setAllocations([...allocations, newRow]);
  };

  const deleteAllocationRow = (rowId) => {
    if (window.confirm('Are you sure you want to remove this line?')) {
      const remaining = allocations.filter(a => a.id !== rowId);
      setAllocations(remaining);
      
      const affectedRow = allocations.find(a => a.id === rowId);
      if (affectedRow) {
        const remainingForItem = remaining.filter(a => a.itemKey === affectedRow.itemKey);
        const totalAllocated = remainingForItem.reduce((sum, a) => sum + parseNumber(a.quantity), 0);
        const detailRow = details.find(d => d.itemKey === affectedRow.itemKey);
        if (detailRow) {
          updateDetail(detailRow.id, 'withdrawableQuantity', totalAllocated.toString());
          updateDetail(detailRow.id, 'withdrawalQuantity', totalAllocated.toString());
        }
      }
    }
  };

  return (
    <div className="etr-withdrawal-entry">
      <div className="etr-expense-toolbar">
        <div>
          <p className="etr-expense-kicker">Inventory</p>
          <h1>Withdrawal Entry</h1>
          <span>Create and review stock withdrawal transactions.</span>
        </div>
        <div className="etr-withdrawal-actions">
          {actionLabels.map((action) => (
            <button
              type="button"
              key={action}
              className={action === 'Save' ? 'etr-expense-save-button' : ''}
              disabled={actionDisabled(action)}
              onClick={() => handleAction(action)}
            >
              {action}
            </button>
          ))}
        </div>
      </div>

      {message ? <div className="etr-expense-save-message">{message}</div> : null}

      <section className="etr-withdrawal-form-panel">
        <div className="etr-withdrawal-form-section">
          <div className="etr-withdrawal-grid dense">
            <div className="etr-withdrawal-grid-column">
              <div className="etr-withdrawal-card-head">
                <div>
                  <p>General</p>
                  <h2>Transaction Info</h2>
                </div>
              </div>
              <Field label="Transaction No.">
                <input type="text" value={formData.transactionNo} onChange={(event) => updateForm('transactionNo', event.target.value)} readOnly={!isEditing} />
              </Field>
              <Field label="Transaction Date">
                <input type="date" value={formData.transactionDate} onChange={(event) => updateForm('transactionDate', event.target.value)} disabled={!isEditing} />
              </Field>
              <Field label="Type" className="is-wide" error={errors.withdrawalType}>
                <select
                  value={formData.withdrawalTypeId}
                  onChange={(event) => {
                    const selectedType = withdrawalTypeRows.find((row) => String(row.id) === event.target.value);
                    setFormData((current) => ({
                      ...current,
                      withdrawalTypeId: event.target.value,
                      withdrawalType: selectedType?.description || '',
                    }));
                    setErrors((current) => ({ ...current, withdrawalType: '' }));
                  }}
                  disabled={!isEditing}
                >
                  <option value="" />
                  {withdrawalTypeRows.map((row) => (
                    <option key={row.id} value={row.id}>{row.description}</option>
                  ))}
                </select>
              </Field>
              <Field
                label="Recipient"
                link
                className="is-wide"
                error={errors.recipient}
                onLabelClick={() => isEditing && openLookup('recipient')}
              >
                <div className="etr-withdrawal-split-input">
                  <input type="text" value={formData.recipientCode} readOnly />
                  <input type="text" value={formData.recipientName} readOnly />
                </div>
              </Field>
              <Field label="Address" className="is-wide">
                <input type="text" value={formData.address} onChange={(event) => updateForm('address', event.target.value)} readOnly={!isEditing} />
              </Field>
              <Field
                label="Reason"
                link
                className="is-wide"
                error={errors.reason}
                onLabelClick={() => isEditing && openLookup('reason')}
              >
                <div className="etr-withdrawal-split-input">
                  <input type="text" value={formData.reasonCode} readOnly />
                  <input type="text" value={formData.reasonDescription} readOnly />
                </div>
              </Field>
              <Field label="Remarks" className="is-wide">
                <textarea rows="3" value={formData.remarks} onChange={(event) => updateForm('remarks', event.target.value)} readOnly={!isEditing} />
              </Field>
              <Field
                label="Warehouse"
                link
                className="is-wide"
                onLabelClick={() => isEditing && openLookup('warehouse')}
              >
                <input type="text" value={formData.warehouse} readOnly />
              </Field>
              <Field
                label="Charge To"
                link
                className="is-wide"
                error={errors.chargeTo}
                onLabelClick={() => isEditing && openLookup('chargeTo')}
              >
                <div className="etr-withdrawal-split-input">
                  <input type="text" value={formData.chargeToCode} readOnly />
                  <input type="text" value={formData.chargeToName} readOnly />
                </div>
              </Field>
              <Field
                label="Company"
                link
                className="is-wide"
                error={errors.company}
                onLabelClick={() => isEditing && openLookup('company')}
              >
                <input type="text" value={formData.company} readOnly />
              </Field>
            </div>

            <div className="etr-withdrawal-grid-column etr-withdrawal-stocks-column">
              <div className="etr-withdrawal-card-head">
                <div>
                  <p aria-hidden="true">&nbsp;</p>
                  <h2>Withdrawing Stocks At</h2>
                </div>
              </div>
              <Field label="Reference Type">
                <select
                  value={formData.referenceTypeId}
                  onChange={(event) => {
                    const selectedType = referenceTypeRows.find((row) => String(row.id) === event.target.value);
                    setFormData((current) => ({
                      ...current,
                      referenceTypeId: event.target.value,
                      referenceType: selectedType?.description || '',
                      referenceId: '',
                      referenceNo: '',
                    }));
                  }}
                  disabled={!isEditing}
                >
                  <option value="" />
                  {referenceTypeRows.map((row) => (
                    <option key={row.id} value={row.id}>{row.description}</option>
                  ))}
                </select>
              </Field>
              <Field
                label="Reference No."
                link={Boolean(formData.referenceTypeId && isEditing)}
                onLabelClick={formData.referenceTypeId && isEditing ? () => openReferenceLookup() : undefined}
              >
                <input type="text" value={formData.referenceNo} readOnly />
              </Field>
              
              <Field label="Created By" className="is-wide">
                <input type="text" value={getCreatedInfo()} readOnly />
              </Field>
              <Field label="Last Modified By" className="is-wide">
                <input type="text" value={getLastModifiedInfo()} readOnly />
              </Field>
              <Field label="Approved By" className="is-wide">
                <input type="text" value={getApprovedInfo()} readOnly />
              </Field>

              <Field label="Del. Instructions">
                <input type="text" value={formData.deliveryInstructions} onChange={(event) => updateForm('deliveryInstructions', event.target.value)} readOnly={!isEditing} />
              </Field>
              <div className="etr-withdrawal-row-pair etr-withdrawal-pod-inline">
                <Field label="POD No.">
                  <input type="text" value={formData.podNo} readOnly />
                </Field>
                <button
                  type="button"
                  disabled={withdrawalId === -1 || hasPodNumber || isSaving}
                  onClick={handleGeneratePod}
                >
                  Generate POD
                </button>
              </div>
              <div className="etr-withdrawal-row-pair">
                <Field label="Target Delivery" error={errors.targetDelivery}>
                  <input
                    type="date"
                    value={formData.targetDelivery}
                    onChange={(event) => updateForm('targetDelivery', event.target.value)}
                    disabled={hasPodNumber || !isEditing}
                  />
                </Field>
                <Field label="No. of Pallets">
                  <input type="number" min="0" value={formData.noOfPallets} onChange={(event) => updateForm('noOfPallets', normalizeNonNegativeInput(event.target.value))} readOnly={!isEditing} />
                </Field>
              </div>
              <Field label="Declare Value">
                <input type="number" min="0" step="0.0001" value={formData.declareValue} onChange={(event) => updateForm('declareValue', normalizeNonNegativeInput(event.target.value))} readOnly={!isEditing} />
              </Field>
            </div>
          </div>
        </div>
      </section>

      <section className="etr-withdrawal-table-panel">
        <div className="etr-withdrawal-tabs">
          {detailTabs.map((tab) => (
            <button type="button" key={tab.id} className={activeTab === tab.id ? 'is-active' : ''} onClick={() => setActiveTab(tab.id)}>
              {tab.label}
            </button>
          ))}
        </div>

        <div className="etr-withdrawal-table-tools">
          {activeTab === 'details' && (
            <button type="button" onClick={deleteSelectedDetails} disabled={!isEditing || !hasSelectedDetails}>
              Delete Selected
            </button>
          )}
          <span>Total Qty: {totals.quantity.toFixed(2)}</span>
          <span>Total W. Qty.: {totals.withdrawalQuantity.toFixed(2)}</span>
          <span>Total Insfnt. Qty.: {totals.insufficientQuantity.toFixed(2)}</span>
        </div>
        {errors.details && <div className="etr-withdrawal-table-error">{errors.details}</div>}
        {errors.insufficientStock && <div className="etr-withdrawal-table-error">{errors.insufficientStock}</div>}
        {errors.quantityMismatch && <div className="etr-withdrawal-table-error">{errors.quantityMismatch}</div>}

        <div className="etr-withdrawal-table-wrap">
          {activeTab === 'details' && (
            <table className="etr-withdrawal-table">
              <thead>
                <tr>
                  <th aria-label="Select row" />
                  <th>Item Code</th>
                  <th>Item Description</th>
                  <th>Unit</th>
                  <th>Quantity</th>
                  <th>Insfnt.Qty</th>
                  <th>W.Quantity</th>
                  <th>Remarks</th>
                </tr>
              </thead>
              <tbody ref={tableBodyRef}>
                {details.map((row) => (
                  <tr key={row.id}>
                    <td>
                      <input 
                        type="checkbox" 
                        checked={row.selected} 
                        onChange={(event) => updateDetail(row.id, 'selected', event.target.checked)} 
                        disabled={!isEditing}
                      />
                    </td>
                    <td>
                      <button 
                        type="button" 
                        className="etr-withdrawal-link" 
                        onClick={() => handleItemLookupClick(row)}
                        disabled={!isEditing}
                      >
                        {row.itemCode || 'Click to Select'}
                      </button>
                    </td>
                    <td>
                      <button 
                        type="button" 
                        className="etr-withdrawal-link" 
                        onClick={() => handleItemLookupClick(row)}
                        disabled={!isEditing}
                      >
                        {row.itemDescription || 'Click to Select'}
                      </button>
                    </td>
                    <td>
                      <input 
                        value={row.unit} 
                        onChange={(event) => updateDetail(row.id, 'unit', event.target.value)} 
                        readOnly={!isEditing} 
                      />
                    </td>
                    <td>
                      <input 
                        type="number" 
                        min="0"
                        value={row.quantity} 
                        onChange={(event) => {
                          const newQty = normalizeNonNegativeInput(event.target.value);
                          updateDetail(row.id, 'quantity', newQty);
                          if (row.itemKey) {
                            processQuantityChange(row.itemKey, newQty);
                          }
                        }} 
                        readOnly={!isEditing} 
                      />
                    </td>
                    <td>
                      <input 
                        type="number" 
                        value={row.insufficientQuantity} 
                        readOnly 
                      />
                    </td>
                    <td>
                      <input 
                        type="number" 
                        value={row.withdrawalQuantity} 
                        readOnly 
                      />
                    </td>
                    <td>
                      <input 
                        value={row.remarks} 
                        onChange={(event) => updateDetail(row.id, 'remarks', event.target.value)} 
                        readOnly={!isEditing} 
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {activeTab === 'allocation' && (
            <table className="etr-withdrawal-table">
              <thead>
                <tr>
                  <th>Item Code</th>
                  <th>Item Description</th>
                  <th>Warehouse</th>
                  <th>Location</th>
                  <th>Lot</th>
                  <th>Mfg Date</th>
                  <th>Expiry Date</th>
                  <th>Unit</th>
                  <th>Quantity</th>
                </tr>
              </thead>
              <tbody>
                {allocations.map((row) => (
                  <tr key={row.id}>
                    <td>{row.itemCode}</td>
                    <td>{row.itemDescription}</td>
                    <td>{row.warehouse}</td>
                    <td>{row.location}</td>
                    <td>{row.lot}</td>
                    <td>{row.manufacturingDate}</td>
                    <td>{row.expiryDate}</td>
                    <td>{row.unit}</td>
                    <td>
                      <input 
                        type="number" 
                        min="0"
                        value={row.quantity} 
                        readOnly
                      />
                    </td>
                  </tr>
                ))}
                {allocations.length === 0 && (
                  <tr>
                    <td colSpan="9" style={{ textAlign: 'center' }}>No stock allocations. Add items in the Details tab.</td>
                  </tr>
                )}
              </tbody>
            </table>
          )}

          {activeTab === 'insufficient' && (
            <table className="etr-withdrawal-table">
              <thead>
                <tr>
                  <th>Item Code</th>
                  <th>Item Description</th>
                  <th>Unit</th>
                  <th>Quantity</th>
                </tr>
              </thead>
              <tbody>
                {insufficientStocks.map((row) => (
                  <tr key={row.id}>
                    <td>{row.itemCode}</td>
                    <td>{row.itemDescription}</td>
                    <td>{row.unit}</td>
                    <td>
                      <button
                        type="button"
                        className="etr-withdrawal-stock-qty-button"
                        onClick={() => openSelectStockModal(row)}
                      >
                        {row.quantity}
                      </button>
                    </td>
                  </tr>
                ))}
                {insufficientStocks.length === 0 && (
                  <tr>
                    <td colSpan="4" style={{ textAlign: 'center' }}>No insufficient stock items.</td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
        </div>
      </section>

      {lookup && (
        <LookupModal
          key={lookup}
          title={`Select ${lookup.replace(/([A-Z])/g, ' $1')}`}
          rows={lookupRows[lookup] || []}
          isLoading={isLookupLoading}
          error={lookupError}
          onSearch={handleLookupSearch}
          onClose={() => {
            setLookup(null);
            setPendingItemLookupRow(null);
          }}
          onSelect={handleLookupSelect}
        />
      )}

      {showReferenceLookup && (
        <ReferenceLookupModal
          key={formData.referenceTypeId}
          rows={referenceRows}
          isLoading={isReferenceLookupLoading}
          error={referenceLookupError}
          referenceTypeLabel={formData.referenceType}
          onSearch={loadReferenceRows}
          onClose={() => setShowReferenceLookup(false)}
          onSelect={(row) => {
            setFormData((current) => ({
              ...current,
              referenceId: row.id,
              referenceNo: row.transactionNumber,
            }));
            setShowReferenceLookup(false);
          }}
        />
      )}

      {selectStockContext && (
        <SelectStockModal
          context={selectStockContext}
          rows={selectStockRows}
          isLoading={isSelectStockLoading}
          error={selectStockError}
          onToggleRow={toggleSelectStockRow}
          onSelectAll={selectAllStockRows}
          onClearSelection={clearSelectedStockRows}
          onConfirm={applySelectedStocks}
          onClose={closeSelectStockModal}
        />
      )}

      {showPrintModal && (
        <PrintOptionsModal
          onClose={() => setShowPrintModal(false)}
          onSelect={openPrintableDocument}
        />
      )}

      {showRejectModal && (
        <RejectReasonModal onClose={() => setShowRejectModal(false)} onConfirm={handleRejectConfirm} />
      )}
    </div>
  );
}
