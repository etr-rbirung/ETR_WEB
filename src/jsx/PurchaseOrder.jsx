import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { getToken } from '../services/authStorage';
import '../css/PurchaseOrder.css';

const apiBaseUrl = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/+$/, '');
const PURCHASE_ORDERS_ENDPOINT = '/api/purchase-orders';
const VENDORS_ENDPOINT = `${PURCHASE_ORDERS_ENDPOINT}/vendors`;
const COMPANIES_ENDPOINT = `${PURCHASE_ORDERS_ENDPOINT}/companies`;
const VENDOR_ADDRESSES_ENDPOINT = `${PURCHASE_ORDERS_ENDPOINT}/vendor-addresses`;
const TERMS_ENDPOINT = `${PURCHASE_ORDERS_ENDPOINT}/terms`;
const ITEMS_ENDPOINT = `${PURCHASE_ORDERS_ENDPOINT}/items`;

// ---------- Constants ----------
const toolbarActions = [
  { id: 'new', label: 'New', disabled: true },
  { id: 'edit', label: 'Edit', disabled: true },
  { id: 'delete', label: 'Delete', disabled: true },
  { id: 'save', label: 'Save' },
  { id: 'undo', label: 'Undo' },
  { id: 'print', label: 'Print', disabled: true },
  { id: 'approve', label: 'Approve', disabled: true },
  { id: 'cancel', label: 'Cancel' },
  { id: 'closed', label: 'Closed PO', disabled: true },
];

const createBlankRow = () => ({
  id: `po-line-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`,
  selected: false,
  itemCode: '',
  itemDescription: '',
  free: false,
  unit: '',
  quantity: 0,
  purchaseCost: 0,
  comments: '',
});

// ---------- Helpers ----------
const getStatusLabel = (status) => {
  const s = Number(status);
  const map = {
    0: 'Deleted',
    1: 'Open',
    2: 'Approved',
    3: 'Cancelled',
    4: 'Received',
    5: 'Partially Paid',
    6: 'Paid',
    7: 'Closed',
  };
  return map[s] || 'Open';
};

const buildApiUrl = (path) => (apiBaseUrl ? `${apiBaseUrl}${path}` : path);

const getApiCollection = (data) => {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.items)) return data.items;
  if (Array.isArray(data?.data)) return data.data;
  if (Array.isArray(data?.result)) return data.result;
  if (Array.isArray(data?.records)) return data.records;
  if (data && typeof data === 'object') return data;
  console.warn('Unexpected API response shape:', data);
  return [];
};

const formatMoney = (value) => Number(value || 0).toFixed(4);

const formatShortDate = (value) => {
  if (!value) return '';
  const dateStr = value.split('T')[0];
  const [year, month, day] = dateStr.split('-');
  return `${Number(month)}/${Number(day)}/${year}`;
};

const ensureEmptyRow = (rows) => {
  const hasEmpty = rows.some((r) => !r.itemCode || r.itemCode.trim() === '');
  if (hasEmpty) return rows;
  return [...rows, createBlankRow()];
};

// ---------- Subcomponents ----------
const Field = ({ label, link = false, children, className = '', error = '', onLabelClick }) => (
  <label className={`etr-po-field ${className} ${error ? 'has-error' : ''}`}>
    <button
      type="button"
      className={link ? 'is-link-label' : ''}
      onClick={onLabelClick}
      disabled={!onLabelClick}
      tabIndex={-1}
    >
      {label}
    </button>
    {children || <input type="text" />}
    {error && <small>{error}</small>}
  </label>
);

// Reusable lookup field that renders a clickable area to open the modal
const LookupField = ({
  label,
  value,
  code,
  onLookup,
  error,
  isTextarea = false,
  split = false,
}) => (
  <Field label={label} link className="is-wide" onLabelClick={onLookup} error={error}>
    <div className="etr-po-lookup-wrapper">
      {split ? (
        <div className="etr-po-split-input">
          <input value={code || ''} readOnly />
          <input value={value || ''} readOnly />
        </div>
      ) : isTextarea ? (
        <textarea rows="4" value={value || ''} readOnly />
      ) : (
        <input value={value || ''} readOnly />
      )}
      <button
        type="button"
        className="etr-po-lookup-overlay"
        onClick={onLookup}
        aria-label={`Search ${label}`}
      />
    </div>
  </Field>
);

// Search Modal (unchanged but with duplicate error removed)
const SearchModal = ({
  title,
  type,
  rows,
  filters,
  selectedRow,
  onFilterChange,
  onSelect,
  onClose,
  onRefresh,
  error,
  onRowSelect,
}) => {
  const [sortField, setSortField] = useState('code');
  const [sortDirection, setSortDirection] = useState('asc');
  const selectedRowId = selectedRow?.id;

  const getSortValue = (row, field) => {
    if (field === 'code') return String(row.code ?? row.name ?? '').toLowerCase();
    if (field === 'name') {
      if (type === 'address') return String(row.name || '').toLowerCase();
      if (type === 'po') return String(row.vendorName || '').toLowerCase();
      return String(row.name ?? row.description ?? '').toLowerCase();
    }
    if (field === 'third') {
      if (type === 'vendor') return String(row.classificationType || '').toLowerCase();
      if (type === 'item') return String(row.unit || '').toLowerCase();
      if (type === 'company') return String(row.address || '').toLowerCase();
      if (type === 'po') return String(row.total || '').toLowerCase();
      return String(row.address || '').toLowerCase();
    }
    return '';
  };

  const filteredRows = rows.filter((row) => {
    const code = String(row.code ?? row.name ?? '').toLowerCase();
    const name = (() => {
      if (type === 'address') return String(row.name || '').toLowerCase();
      if (type === 'po') return String(row.vendorName || '').toLowerCase();
      return String(row.name ?? row.description ?? '').toLowerCase();
    })();
    const third = (() => {
      if (type === 'vendor') return String(row.classificationType || '').toLowerCase();
      if (type === 'item') return String(row.unit || '').toLowerCase();
      if (type === 'company') return String(row.address || '').toLowerCase();
      if (type === 'po') return String(row.total || '').toLowerCase();
      return String(row.address || '').toLowerCase();
    })();
    const q = (v) => v.trim().toLowerCase();
    return (
      code.includes(q(filters.code)) &&
      name.includes(q(filters.name)) &&
      third.includes(q(filters.third))
    );
  });

  const sortedRows = [...filteredRows].sort((a, b) => {
    const va = getSortValue(a, sortField);
    const vb = getSortValue(b, sortField);
    if (va === vb) return 0;
    const result = va < vb ? -1 : 1;
    return sortDirection === 'asc' ? result : -result;
  });

  const toggleSort = (field) => {
    if (sortField === field) {
      setSortDirection((cur) => (cur === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const renderSortIcon = (field) =>
    sortField === field ? (sortDirection === 'asc' ? ' ▲' : ' ▼') : '';

  const columns = (() => {
    if (type === 'po') {
      return {
        headers: [
          { key: 'code', label: 'PO Number', sortable: true },
          { key: 'date', label: 'Date' },
          { key: 'name', label: 'Vendor Name', sortable: true },
          { key: 'total', label: 'Total' },
          { key: 'status', label: 'Status' },
        ],
        filters: ['code', 'name'],
        render: (row) => (
          <>
            <td>{row.code}</td>
            <td>{formatShortDate(row.date ? row.date.split('T')[0] : '')}</td>
            <td>{row.vendorName}</td>
            <td>{formatMoney(row.total)}</td>
            <td>{getStatusLabel(row.status)}</td>
          </>
        ),
        colSpan: 5,
      };
    }
    if (type === 'company') {
      return {
        headers: [
          { key: 'name', label: 'Company Name', sortable: true },
          { key: 'address', label: 'Address', sortable: true },
        ],
        filters: ['name', 'third'],
        render: (row) => (
          <>
            <td>{row.description}</td>
            <td>{row.address}</td>
          </>
        ),
        colSpan: 2,
      };
    }
    // vendor, item, address
    const thirdLabel =
      type === 'vendor' ? 'Classification Type' : type === 'item' ? 'Unit' : 'Address';
    return {
      headers: [
        { key: 'code', label: 'Code', sortable: true },
        { key: 'name', label: 'Name', sortable: true },
        { key: 'third', label: thirdLabel, sortable: true },
      ],
      filters: ['code', 'name', 'third'],
      render: (row) => (
        <>
          <td>{row.code ?? row.name ?? ''}</td>
          <td>
            {type === 'address' ? row.name : type === 'item' ? row.description : row.name ?? row.description}
          </td>
          <td>
            {type === 'vendor'
              ? row.classificationType
              : type === 'item'
              ? row.unit
              : row.address}
          </td>
        </>
      ),
      colSpan: 3,
    };
  })();

  return (
    <div className="etr-po-modal-backdrop" role="presentation">
      <section className="etr-po-modal" role="dialog" aria-modal="true" aria-label={title}>
        <div className="etr-po-modal-head">
          <div>
            <p className="etr-po-kicker">Search</p>
            <h2>{title}</h2>
          </div>
          <button type="button" onClick={onClose}>Close</button>
        </div>

        <div className="etr-po-search-table-wrap">
          <table className="etr-po-search-table">
            <thead>
              <tr>
                {columns.headers.map((h) => (
                  <th key={h.key} onClick={h.sortable ? () => toggleSort(h.key) : undefined}>
                    {h.label}
                    {h.sortable && renderSortIcon(h.key)}
                  </th>
                ))}
              </tr>
              <tr className="etr-po-search-filter-row">
                {columns.headers.map((h) => (
                  <th key={`filter-${h.key}`}>
                    {columns.filters.includes(h.key) && (
                      <input
                        type="search"
                        value={filters[h.key] || ''}
                        onChange={(e) => onFilterChange(h.key, e.target.value)}
                        placeholder=""
                      />
                    )}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sortedRows.map((row) => (
                <tr
                  key={row.id ?? `${row.code ?? row.name}-${row.description ?? row.address}`}
                  className={String(row.id) === String(selectedRowId) ? 'selected' : ''}
                  onClick={() => (onRowSelect ? onRowSelect(row) : onSelect(row))}
                  onDoubleClick={() => onSelect(row)}
                >
                  {columns.render(row)}
                </tr>
              ))}
              {sortedRows.length === 0 && (
                <tr>
                  <td colSpan={columns.colSpan}>No records found.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="etr-po-modal-actions">
          <button type="button" onClick={onRefresh}>Refresh List</button>
          <div>
            <button type="button" onClick={onClose}>Cancel</button>
            <button type="button" onClick={() => onSelect(selectedRow)} disabled={!selectedRow}>
              Ok
            </button>
          </div>
        </div>
        {error && <div className="etr-po-search-error">{error}</div>}
      </section>
    </div>
  );
};

// ---------- Main Component ----------
export default function PurchaseOrder() {
  // ---- State ----
  const [formData, setFormData] = useState({
    id: '',
    status: 1,
    poNumber: '',
    purchaseDate: new Date().toISOString().slice(0, 10),
    vendorId: '',
    vendorCode: '',
    vendorName: '',
    vendorAddress: '',
    currency: 'PHP - Philippine Peso',
    deliveryDate: new Date().toISOString().slice(0, 10),
    terms: '',
    companyId: '',
    company: '',
    comments: '',
    deliveryAddressId: '',
    deliveryAddress: '',
    referenceType: '',
    referenceNo: '',
    createdBy: 'Current User',
    modifiedBy: '',
    approvedBy: '',
    cancelledBy: '',
    cancelRemarks: '',
  });
  const [rows, setRows] = useState([createBlankRow()]);
  const [formErrors, setFormErrors] = useState({});

  // Catalog data
  const [catalog, setCatalog] = useState({
    vendors: [],
    companies: [],
    deliveryAddresses: [],
    purchaseOrders: [],
    termsList: [],
    items: [],
  });

  // Lookup state
  const [lookup, setLookup] = useState({
    type: null, // 'vendor' | 'company' | 'address' | 'item' | 'po'
    filters: { code: '', name: '', third: '' },
    selectedRow: null,
    loading: false,
    error: '',
  });

  // Save state
  const [saveState, setSaveState] = useState({ type: 'idle', message: '' }); // idle | loading | success | error
  const [activeRowId, setActiveRowId] = useState(null);

  // ---- Derived ----
  const isOpen = Number(formData.status || 1) === 1;
  const isNew = !formData.id;

  // ---- API Helpers ----
  const apiCall = useCallback(async (path, options = {}) => {
    const token = getToken();
    const url = buildApiUrl(path);
    const headers = {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    };
    const response = await fetch(url, { ...options, headers });
    if (!response.ok) {
      let errorMsg = response.statusText || String(response.status);
      try {
        const body = await response.json();
        if (body?.message) errorMsg = body.message;
      } catch {
        // ignore
      }
      throw new Error(errorMsg);
    }
    const json = await response.json();
    return json;
  }, []);

  const fetchJson = useCallback(
    async (path, signal) => {
      const json = await apiCall(path, { signal });
      return getApiCollection(json);
    },
    [apiCall]
  );

  // ---- Load data ----
  const loadVendorAddresses = useCallback(
    async (vendorId, signal) => {
      if (!vendorId) {
        setCatalog((prev) => ({ ...prev, deliveryAddresses: [] }));
        return [];
      }
      const addresses = await fetchJson(
        `${VENDOR_ADDRESSES_ENDPOINT}?vendorId=${encodeURIComponent(vendorId)}`,
        signal
      );
      setCatalog((prev) => ({ ...prev, deliveryAddresses: addresses }));
      return addresses;
    },
    [fetchJson]
  );

  const loadPurchaseOrderDetails = useCallback(
    async (id) => {
      try {
        const data = await fetchJson(`${PURCHASE_ORDERS_ENDPOINT}/${id}`);
        setFormData({
          id: String(data.id || ''),
          status: data.status || 1,
          poNumber: data.poNumber || '',
          purchaseDate: data.purchaseDate ? data.purchaseDate.split('T')[0] : '',
          vendorId: String(data.vendorId || ''),
          vendorCode: data.vendorCode || '',
          vendorName: data.vendorName || '',
          vendorAddress: data.vendorAddress || '',
          currency: data.currency || 'PHP - Philippine Peso',
          deliveryDate: data.deliveryDate ? data.deliveryDate.split('T')[0] : '',
          terms: String(data.terms || ''),
          companyId: String(data.companyId || ''),
          company: data.company || '',
          comments: data.comments || '',
          deliveryAddressId: String(data.deliveryAddressId || ''),
          deliveryAddress: data.deliveryAddress || '',
          referenceType: data.referenceType || '',
          referenceNo: data.referenceNo || '',
          createdBy: data.createdBy || '',
          modifiedBy: data.modifiedBy || '',
          approvedBy: data.approvedBy || '',
          cancelledBy: data.cancelledBy || '',
          cancelRemarks: data.cancelRemarks || '',
        });
        setRows(
          (data.lines || []).map((line, idx) => ({
            id: `po-line-${idx}-${Date.now()}`,
            selected: false,
            itemCode: line.itemCode || '',
            itemDescription: line.itemDescription || '',
            free: line.free || false,
            unit: line.unit || '',
            quantity: line.quantity || 0,
            purchaseCost: line.purchaseCost || 0,
            comments: line.comments || '',
          }))
        );
        setFormErrors({});
      } catch (err) {
        setSaveState({ type: 'error', message: err.message });
      }
    },
    [fetchJson]
  );

  // ---- Form update ----
  const updateForm = useCallback((field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    setFormErrors((prev) => ({ ...prev, [field]: undefined }));
  }, []);

  // ---- Lookup ----
  const openLookup = useCallback(
    (type) => {
      if (!isOpen && type !== 'po') return; // only allow lookup when open, except for PO search
      setLookup({
        type,
        filters: { code: '', name: '', third: '' },
        selectedRow: null,
        loading: false,
        error: '',
      });
      refreshLookupRows(type);
    },
    [isOpen]
  );

  const closeLookup = useCallback(() => {
    setLookup((prev) => ({ ...prev, type: null, selectedRow: null }));
  }, []);

  const refreshLookupRows = useCallback(
    async (typeOverride) => {
      const activeType = typeOverride ?? lookup.type;
      if (!activeType) return;
      setLookup((prev) => ({ ...prev, loading: true, error: '' }));
      try {
        let data = [];
        if (activeType === 'po') {
          data = await fetchJson(PURCHASE_ORDERS_ENDPOINT);
          setCatalog((prev) => ({ ...prev, purchaseOrders: data }));
        } else if (activeType === 'vendor') {
          data = await fetchJson(`${VENDORS_ENDPOINT}?query=`);
          setCatalog((prev) => ({ ...prev, vendors: data }));
        } else if (activeType === 'company') {
          data = await fetchJson(COMPANIES_ENDPOINT);
          setCatalog((prev) => ({ ...prev, companies: data }));
        } else if (activeType === 'address') {
          data = await loadVendorAddresses(formData.vendorId);
        } else if (activeType === 'item') {
          data = await fetchJson(ITEMS_ENDPOINT);
          setCatalog((prev) => ({ ...prev, items: data }));
        }
        // For address, data already set via loadVendorAddresses
        if (activeType !== 'address') {
          // already set
        }
      } catch (err) {
        setLookup((prev) => ({ ...prev, error: err.message || 'Unable to reload list.' }));
      } finally {
        setLookup((prev) => ({ ...prev, loading: false }));
      }
    },
    [lookup.type, fetchJson, loadVendorAddresses, formData.vendorId]
  );

  const confirmLookupSelection = useCallback(
    (selected) => {
      if (!selected) return;
      const { type } = lookup;
      if (type === 'po') {
        loadPurchaseOrderDetails(selected.id);
      } else if (type === 'vendor') {
        handleVendorSelect(selected.id);
      } else if (type === 'company') {
        const company = catalog.companies.find((c) => String(c.id) === String(selected.id));
        updateForm('companyId', String(selected.id));
        updateForm('company', company ? company.description : selected.description || '');
      } else if (type === 'address') {
        handleDeliveryAddressSelect(selected.id);
      } else if (type === 'item') {
        setRows((current) =>
          current.map((row) =>
            row.id === activeRowId
              ? {
                  ...row,
                  itemCode: selected.code,
                  itemDescription: selected.description,
                  unit: selected.unit,
                }
              : row
          )
        );
        setActiveRowId(null);
      }
      closeLookup();
    },
    [lookup, catalog, loadPurchaseOrderDetails, updateForm, activeRowId, closeLookup]
  );

  const setLookupFilter = useCallback((field, value) => {
    setLookup((prev) => ({ ...prev, filters: { ...prev.filters, [field]: value } }));
  }, []);

  // ---- Vendor / Address handlers ----
  const handleVendorSelect = useCallback(
    async (vendorId) => {
      const vendor = catalog.vendors.find((v) => String(v.id) === String(vendorId));
      if (!vendor) return;
      updateForm('vendorId', String(vendor.id));
      updateForm('vendorCode', vendor.code);
      updateForm('vendorName', vendor.name);
      updateForm('terms', String(vendor.creditTermId || ''));
      updateForm('deliveryAddressId', '');
      updateForm('deliveryAddress', '');
      updateForm('vendorAddress', '');
      try {
        const addresses = await loadVendorAddresses(vendor.id);
        if (addresses.length) {
          const first = addresses[0];
          updateForm('vendorAddress', `${first.name} ${first.address}`.trim());
        }
      } catch {
        // ignore
      }
    },
    [catalog.vendors, loadVendorAddresses, updateForm]
  );

  const handleDeliveryAddressSelect = useCallback(
    (addressId) => {
      const address = catalog.deliveryAddresses.find((a) => String(a.id) === String(addressId));
      if (!address) {
        updateForm('deliveryAddressId', '');
        updateForm('deliveryAddress', '');
        return;
      }
      updateForm('deliveryAddressId', String(address.id));
      updateForm('deliveryAddress', address.address);
    },
    [catalog.deliveryAddresses, updateForm]
  );

  // ---- Lines ----
  const updateRow = useCallback((rowId, field, value) => {
    setRows((current) =>
      current.map((row) => (row.id === rowId ? { ...row, [field]: value } : row))
    );
  }, []);

  const deleteSelectedRows = useCallback(() => {
    setRows((current) => current.filter((row) => !row.selected));
  }, []);

  // Auto-add blank row
  useEffect(() => {
    if (!isOpen) return;
    setRows((current) => ensureEmptyRow(current));
  }, [rows, isOpen]);

  // Clear item line error when an item is added
  useEffect(() => {
    const hasItem = rows.some((r) => r.itemCode?.trim());
    if (hasItem && formErrors.lines) {
      setFormErrors((prev) => ({ ...prev, lines: undefined }));
    }
  }, [rows, formErrors.lines]);

  // ---- Validation ----
  const validateForm = useCallback(() => {
    const errors = {};
    if (!formData.poNumber?.trim()) errors.poNumber = 'PO Number is required.';
    if (!formData.vendorId) errors.vendorId = 'Vendor (Supplier) is required.';
    if (!formData.companyId) errors.companyId = 'Company is required.';
    if (!formData.deliveryAddressId) errors.deliveryAddressId = 'Delivery address is required.';
    const hasItem = rows.some((r) => r.itemCode?.trim());
    if (!hasItem) errors.lines = 'At least one item line is required.';
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  }, [formData, rows]);

  // ---- Save ----
  const handleSave = useCallback(async () => {
    if (!validateForm()) {
      setSaveState({ type: 'error', message: 'Please correct the validation errors below.' });
      return;
    }
    setSaveState({ type: 'loading', message: '' });
    const id = Number(formData.id || 0);
    const method = id > 0 ? 'PUT' : 'POST';
    const url = id > 0 ? `${PURCHASE_ORDERS_ENDPOINT}/${id}` : PURCHASE_ORDERS_ENDPOINT;
    try {
      const payload = {
        id: id > 0 ? id : undefined,
        poNumber: formData.poNumber,
        purchaseDate: formData.purchaseDate,
        vendorId: Number(formData.vendorId || 0),
        vendorCode: formData.vendorCode,
        vendorName: formData.vendorName,
        vendorAddress: formData.vendorAddress,
        currency: formData.currency,
        deliveryDate: formData.deliveryDate,
        terms: formData.terms,
        companyId: Number(formData.companyId || 0),
        company: formData.company,
        comments: formData.comments,
        deliveryAddressId: Number(formData.deliveryAddressId || 0),
        deliveryAddress: formData.deliveryAddress,
        referenceType: formData.referenceType,
        referenceNo: formData.referenceNo,
        createdBy: formData.createdBy,
        modifiedBy: formData.modifiedBy,
        approvedBy: formData.approvedBy,
        cancelledBy: formData.cancelledBy,
        cancelRemarks: formData.cancelRemarks,
        lines: rows
          .filter((r) => r.itemCode?.trim())
          .map((r) => ({
            itemCode: r.itemCode,
            itemDescription: r.itemDescription,
            free: r.free,
            unit: r.unit,
            quantity: Number(r.quantity),
            purchaseCost: Number(r.purchaseCost),
            comments: r.comments,
          })),
      };
      const result = await apiCall(url, { method, body: JSON.stringify(payload) });
      setSaveState({ type: 'success', message: result?.message || 'Purchase order saved successfully.' });
      if (id === 0 && result?.purchaseOrderId) {
        loadPurchaseOrderDetails(result.purchaseOrderId);
      } else if (id > 0) {
        loadPurchaseOrderDetails(id);
      }
    } catch (err) {
      setSaveState({ type: 'error', message: err.message || 'Unable to save purchase order.' });
    } finally {
      setSaveState((prev) => ({ ...prev, type: prev.type === 'loading' ? 'idle' : prev.type }));
    }
  }, [validateForm, formData, rows, apiCall, loadPurchaseOrderDetails]);

  // ---- Actions (New, Undo, Delete, etc.) ----
  const handleNew = useCallback(() => {
    setFormData({
      id: '',
      status: 1,
      poNumber: '',
      purchaseDate: new Date().toISOString().slice(0, 10),
      vendorId: '',
      vendorCode: '',
      vendorName: '',
      vendorAddress: '',
      currency: 'PHP - Philippine Peso',
      deliveryDate: new Date().toISOString().slice(0, 10),
      terms: '',
      companyId: '',
      company: '',
      comments: '',
      deliveryAddressId: '',
      deliveryAddress: '',
      referenceType: '',
      referenceNo: '',
      createdBy: 'Current User',
      modifiedBy: '',
      approvedBy: '',
      cancelledBy: '',
      cancelRemarks: '',
    });
    setRows([createBlankRow()]);
    setFormErrors({});
    setSaveState({ type: 'idle', message: '' });
  }, []);

  const handleUndo = useCallback(() => {
    if (formData.id) {
      loadPurchaseOrderDetails(formData.id);
    } else {
      handleNew();
    }
  }, [formData.id, loadPurchaseOrderDetails, handleNew]);

  const handleDelete = useCallback(async () => {
    const id = Number(formData.id);
    if (!id || !window.confirm('Are you sure you want to delete this purchase order?')) return;
    try {
      await apiCall(`${PURCHASE_ORDERS_ENDPOINT}/${id}`, { method: 'DELETE' });
      alert('Purchase order deleted successfully.');
      handleNew();
    } catch (err) {
      setSaveState({ type: 'error', message: err.message });
    }
  }, [formData.id, apiCall, handleNew]);

  const handlePrint = useCallback(() => window.print(), []);

  // Generic action: approve, cancel, close
  const performAction = useCallback(
    async (action, confirmMsg, promptMsg = null) => {
      const id = Number(formData.id);
      if (!id) return;
      if (confirmMsg && !window.confirm(confirmMsg)) return;
      let payload = {};
      if (promptMsg) {
        const reason = window.prompt(promptMsg);
        if (reason === null) return;
        payload = { reason };
      }
      try {
        await apiCall(`${PURCHASE_ORDERS_ENDPOINT}/${id}/${action}`, {
          method: 'POST',
          body: JSON.stringify(payload),
        });
        setSaveState({ type: 'success', message: `Purchase order ${action}ed successfully.` });
        loadPurchaseOrderDetails(id);
      } catch (err) {
        setSaveState({ type: 'error', message: err.message });
      }
    },
    [formData.id, apiCall, loadPurchaseOrderDetails]
  );

  // ---- Toolbar ----
  const isActionDisabled = useCallback(
    (actionId) => {
      const status = Number(formData.status || 1);
      switch (actionId) {
        case 'new':
        case 'edit':
        case 'undo':
          return false;
        case 'save':
          return saveState.type === 'loading' || status !== 1 || Object.values(formErrors).some(val => !!val);
        case 'delete':
          return isNew || status !== 1;
        case 'print':
          return isNew;
        case 'approve':
          return isNew || status !== 1;
        case 'cancel':
          return isNew || status !== 1;
        case 'closed':
          return isNew || status !== 2;
        default:
          return true;
      }
    },
    [formData.status, isNew, saveState.type, formErrors]
  );

  const handleToolbarAction = useCallback(
    (actionId) => {
      switch (actionId) {
        case 'save':
          handleSave();
          break;
        case 'new':
          handleNew();
          break;
        case 'edit':
          openLookup('po');
          break;
        case 'delete':
          handleDelete();
          break;
        case 'undo':
          handleUndo();
          break;
        case 'print':
          handlePrint();
          break;
        case 'approve':
          performAction('approve', 'Are you sure you want to approve this purchase order?');
          break;
        case 'cancel':
          performAction('cancel', null, 'Enter cancellation remarks:');
          break;
        case 'closed':
          performAction('close', 'Are you sure you want to close this purchase order?');
          break;
        default:
          break;
      }
    },
    [handleSave, handleNew, openLookup, handleDelete, handleUndo, handlePrint, performAction]
  );

  // ---- Totals ----
  const totals = useMemo(() => {
    const grossTotal = rows
      .filter((r) => r.itemCode?.trim())
      .reduce((sum, r) => sum + Number(r.quantity) * Number(r.purchaseCost), 0);
    return {
      grossTotal,
      grossDiscount: 0,
      vatAmount: 0,
      withholdingTax: 0,
      netTotal: grossTotal,
    };
  }, [rows]);

  // ---- Initial load ----
  useEffect(() => {
    const controller = new AbortController();
    const loadOptions = async () => {
      try {
        const [vendors, companies, terms] = await Promise.all([
          fetchJson(`${VENDORS_ENDPOINT}?query=`, controller.signal),
          fetchJson(COMPANIES_ENDPOINT, controller.signal),
          fetchJson(TERMS_ENDPOINT, controller.signal),
        ]);
        setCatalog((prev) => ({ ...prev, vendors, companies, termsList: terms }));
      } catch (err) {
        if (err.name !== 'AbortError') console.error('Failed to load initial data', err);
      }
    };
    loadOptions();
    return () => controller.abort();
  }, [fetchJson]);

  // ---- Render ----
  const { type: lookupType, filters, selectedRow, loading, error } = lookup;
  const lookupRows = (() => {
    switch (lookupType) {
      case 'vendor':
        return catalog.vendors;
      case 'company':
        return catalog.companies;
      case 'address':
        return catalog.deliveryAddresses;
      case 'item':
        return catalog.items;
      case 'po':
        return catalog.purchaseOrders;
      default:
        return [];
    }
  })();

  const statusLabel = getStatusLabel(formData.status);
  const isSaving = saveState.type === 'loading';

  return (
    <div className="etr-po-entry">
      {/* Toolbar */}
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
              disabled={isActionDisabled(action.id)}
              className={action.id === 'save' ? 'is-primary' : ''}
              onClick={() => handleToolbarAction(action.id)}
            >
              {action.id === 'save' && isSaving ? 'Saving...' : action.label}
            </button>
          ))}
        </div>
      </div>

      {/* Save status */}
      {saveState.message && (
        <div className={`etr-po-save-status ${saveState.type === 'error' ? 'error' : 'success'}`}>
          {saveState.message}
        </div>
      )}

      {/* Main form */}
      <section className="etr-po-form-panel">
        <div className="etr-po-form-shell">
          <div className="etr-po-content-column">
            <div className="etr-po-main-stack">
              {/* Left column */}
              <div className="etr-po-column">
                {/* General */}
                <section className="etr-po-card">
                  <div className="etr-po-card-head">
                    <p>General</p>
                  </div>
                  <div className="etr-po-form-grid two">
                    <Field label="PO Number" error={formErrors.poNumber}>
                      <input
                        value={formData.poNumber}
                        onChange={(e) => updateForm('poNumber', e.target.value)}
                      />
                    </Field>
                    <Field label="Purchase Date">
                      <input
                        type="date"
                        value={formData.purchaseDate}
                        onChange={(e) => updateForm('purchaseDate', e.target.value)}
                      />
                    </Field>
                    <Field label="Currency">
                      <select
                        value={formData.currency}
                        onChange={(e) => updateForm('currency', e.target.value)}
                      >
                        <option>PHP - Philippine Peso</option>
                        <option>USD - US Dollar</option>
                      </select>
                    </Field>
                    <Field label="Terms">
                      <select
                        value={formData.terms}
                        onChange={(e) => updateForm('terms', e.target.value)}
                      >
                        <option value="">-- Select Terms --</option>
                        {catalog.termsList.map((term) => (
                          <option key={term.id} value={String(term.id)}>
                            {term.description}
                          </option>
                        ))}
                      </select>
                    </Field>
                  </div>
                </section>

                {/* Vendor */}
                <section className="etr-po-card">
                  <div className="etr-po-card-head">
                    <p>Vendor</p>
                  </div>
                  <div className="etr-po-form-grid two">
                    <LookupField
                      label="Vendor (Supplier)"
                      value={formData.vendorName}
                      code={formData.vendorCode}
                      onLookup={() => openLookup('vendor')}
                      error={formErrors.vendorId}
                      split
                    />
                    <Field label="Vendor Address" className="is-wide">
                      <input value={formData.vendorAddress} readOnly />
                    </Field>
                    <LookupField
                      label="Company"
                      value={formData.company}
                      onLookup={() => openLookup('company')}
                      error={formErrors.companyId}
                    />
                    <Field label="Comments" className="is-wide">
                      <input
                        value={formData.comments}
                        onChange={(e) => updateForm('comments', e.target.value)}
                      />
                    </Field>
                    <LookupField
                      label="Delivery Address"
                      value={formData.deliveryAddress}
                      onLookup={() => openLookup('address')}
                      error={formErrors.deliveryAddressId}
                      isTextarea
                    />
                  </div>
                </section>
              </div>

              {/* Right column */}
              <div className="etr-po-column etr-po-column-narrow">
                {/* Reference */}
                <section className="etr-po-card">
                  <div className="etr-po-card-head">
                    <p>Reference</p>
                  </div>
                  <div className="etr-po-form-grid two">
                    <Field label="Reference Type">
                      <select
                        value={formData.referenceType}
                        onChange={(e) => updateForm('referenceType', e.target.value)}
                      >
                        <option value="" />
                        <option>Purchase Request</option>
                        <option>Sales Order</option>
                        <option>Manual Entry</option>
                      </select>
                    </Field>
                    <Field label="Reference No." link>
                      <input
                        value={formData.referenceNo}
                        onChange={(e) => updateForm('referenceNo', e.target.value)}
                      />
                    </Field>
                    <Field label="Delivery Date" className="is-wide">
                      <input
                        type="date"
                        value={formData.deliveryDate}
                        onChange={(e) => updateForm('deliveryDate', e.target.value)}
                      />
                    </Field>
                  </div>
                </section>

                {/* System Logs */}
                <section className="etr-po-card">
                  <div className="etr-po-card-head">
                    <p>System Logs</p>
                  </div>
                  <div className="etr-po-audit-grid">
                    <Field label="Created By">
                      <input value={formData.createdBy} readOnly />
                    </Field>
                    <Field label="Modified By">
                      <input value={formData.modifiedBy} readOnly />
                    </Field>
                    <Field label="Approved By">
                      <input value={formData.approvedBy} readOnly />
                    </Field>
                    <Field label="Cancelled By">
                      <input value={formData.cancelledBy} readOnly />
                    </Field>
                    <Field label="Cancel Remarks" className="is-wide">
                      <textarea rows="3" value={formData.cancelRemarks} readOnly />
                    </Field>
                  </div>
                </section>
              </div>
            </div>
          </div>

          {/* Sidebar */}
          <aside className="etr-po-side-stack">
            <section className="etr-po-card etr-po-status-card">
              <div className="etr-po-card-head">
                <p>Status</p>
              </div>
              <input value={statusLabel} readOnly />
            </section>

            <section className="etr-po-card etr-po-summary-card">
              <div className="etr-po-card-head">
                <p>Amount</p>
              </div>
              <Field label="Gross Total">
                <input value={formatMoney(totals.grossTotal)} readOnly />
              </Field>
              <Field label="Gross Discount">
                <input value={formatMoney(totals.grossDiscount)} readOnly />
              </Field>
              <Field label="Vat Amount">
                <input value={formatMoney(totals.vatAmount)} readOnly />
              </Field>
              <Field label="Net Total">
                <input value={formatMoney(totals.netTotal)} readOnly />
              </Field>
            </section>
          </aside>
        </div>
      </section>

      {/* Lookup Modal */}
      {lookupType && (
        <SearchModal
          title={
            lookupType === 'vendor'
              ? 'Search Vendor'
              : lookupType === 'company'
              ? 'Search Company'
              : lookupType === 'po'
              ? 'Search Purchase Order'
              : lookupType === 'item'
              ? 'Search Item'
              : 'Search Delivery Address'
          }
          type={lookupType}
          rows={lookupRows}
          filters={filters}
          selectedRow={selectedRow}
          onFilterChange={setLookupFilter}
          onSelect={confirmLookupSelection}
          onRowSelect={(row) => setLookup((prev) => ({ ...prev, selectedRow: row }))}
          onClose={closeLookup}
          onRefresh={() => refreshLookupRows()}
          error={error}
        />
      )}

      {/* Lines Table */}
      <section
        className="etr-po-table-panel"
        style={{ borderColor: formErrors.lines ? '#c93636' : undefined }}
      >
        <div className="etr-po-table-tools">
          <button
            type="button"
            onClick={deleteSelectedRows}
            disabled={!isOpen || !rows.some((r) => r.selected)}
          >
            Delete Selected
          </button>
          <span>Total Items: {rows.filter((r) => r.itemCode?.trim()).length}</span>
          {formErrors.lines && (
            <span style={{ color: '#b42d2d', borderLeft: 'none', paddingLeft: 0 }}>
              {formErrors.lines}
            </span>
          )}
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
                      <input
                        type="checkbox"
                        checked={row.selected}
                        onChange={(e) => updateRow(row.id, 'selected', e.target.checked)}
                        disabled={!isOpen}
                      />
                    </td>
                    <td>
                      <button
                        type="button"
                        className="etr-po-link"
                        onClick={() => {
                          if (isOpen) {
                            setActiveRowId(row.id);
                            openLookup('item');
                          }
                        }}
                        disabled={!isOpen}
                      >
                        {row.itemCode || 'Click to Select'}
                      </button>
                    </td>
                    <td>
                      <button
                        type="button"
                        className="etr-po-link"
                        onClick={() => {
                          if (isOpen) {
                            setActiveRowId(row.id);
                            openLookup('item');
                          }
                        }}
                        disabled={!isOpen}
                      >
                        {row.itemDescription || 'Click to Select'}
                      </button>
                    </td>
                    <td>
                      <input
                        type="checkbox"
                        checked={row.free}
                        onChange={(e) => updateRow(row.id, 'free', e.target.checked)}
                        disabled={!isOpen}
                      />
                    </td>
                    <td>
                      <input
                        value={row.unit}
                        onChange={(e) => updateRow(row.id, 'unit', e.target.value)}
                        readOnly={!isOpen}
                      />
                    </td>
                    <td>
                      <input
                        type="number"
                        value={row.quantity}
                        onChange={(e) => updateRow(row.id, 'quantity', e.target.value)}
                        readOnly={!isOpen}
                      />
                    </td>
                    <td>
                      <input
                        type="number"
                        step="0.0001"
                        value={row.purchaseCost}
                        onChange={(e) => updateRow(row.id, 'purchaseCost', e.target.value)}
                        readOnly={!isOpen}
                      />
                    </td>
                    <td className="is-money">{formatMoney(amount)}</td>
                    <td>
                      <input
                        value={row.comments}
                        onChange={(e) => updateRow(row.id, 'comments', e.target.value)}
                        readOnly={!isOpen}
                      />
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