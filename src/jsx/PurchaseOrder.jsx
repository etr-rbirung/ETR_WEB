import React, { useEffect, useMemo, useState } from 'react';
import { getToken } from '../services/authStorage';
import '../css/PurchaseOrder.css';

const apiBaseUrl = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/+$|\/$/, '');
const PURCHASE_ORDERS_ENDPOINT = '/api/purchase-orders';
const VENDORS_ENDPOINT = `${PURCHASE_ORDERS_ENDPOINT}/vendors`;
const COMPANIES_ENDPOINT = `${PURCHASE_ORDERS_ENDPOINT}/companies`;
const VENDOR_ADDRESSES_ENDPOINT = `${PURCHASE_ORDERS_ENDPOINT}/vendor-addresses`;
const TERMS_ENDPOINT = `${PURCHASE_ORDERS_ENDPOINT}/terms`;

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
  id: `po-line-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
  selected: false,
  itemCode: '',
  itemDescription: '',
  free: false,
  unit: '',
  quantity: 0,
  purchaseCost: 0,
  comments: '',
});

const getStatusLabel = (status) => {
  const statusCode = Number(status);
  switch (statusCode) {
    case 0: return 'Deleted';
    case 1: return 'Open';
    case 2: return 'Approved';
    case 3: return 'Cancelled';
    case 4: return 'Received';
    case 5: return 'Partially Paid';
    case 6: return 'Paid';
    case 7: return 'Closed';
    default: return 'Open';
  }
};


function buildApiUrl(path) {
  return apiBaseUrl ? `${apiBaseUrl}${path}` : path;
}

function getApiCollection(data) {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.items)) return data.items;
  if (Array.isArray(data?.data)) return data.data;
  if (Array.isArray(data?.result)) return data.result;
  if (Array.isArray(data?.records)) return data.records;

  return [];
}

function formatMoney(value) {
  return Number(value || 0).toFixed(4);
}

function formatShortDate(value) {
  if (!value) return '';
  const [year, month, day] = value.split('-');
  return `${Number(month)}/${Number(day)}/${year}`;
}

function Field({ label, link = false, children, className = '', error = '', onLabelClick }) {
  return (
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
      {error ? <small>{error}</small> : null}
    </label>
  );
}

function SearchModal({ title, type, rows, filters, selectedRow, onFilterChange, onSelect, onClose, onRefresh, error, onRowSelect }) {
  const [sortField, setSortField] = useState('code');
  const [sortDirection, setSortDirection] = useState('asc');
  const selectedRowId = selectedRow?.id;

  const getSortValue = (row, field) => {
    if (field === 'code') {
      return String(row.code ?? row.name ?? '').toLowerCase();
    }

    if (field === 'name') {
      return String(type === 'address' ? row.name : type === 'po' ? row.vendorName : row.name ?? row.description ?? '').toLowerCase();
    }

    return String(type === 'vendor' ? row.classificationType : type === 'item' ? row.unit : type === 'company' ? row.address : type === 'po' ? row.total : row.address ?? '').toLowerCase();
  };

  const filteredRows = rows.filter((row) => {
    const codeMatch = String(row.code ?? row.name ?? '').toLowerCase().includes((filters.code || '').trim().toLowerCase());
    const nameMatch = String(type === 'address' ? row.name : type === 'po' ? row.vendorName : row.name ?? row.description ?? '').toLowerCase().includes((filters.name || '').trim().toLowerCase());
    const thirdValue = String(type === 'vendor' ? row.classificationType : type === 'item' ? row.unit : type === 'company' ? row.address : type === 'po' ? row.total : row.address ?? '').toLowerCase();
    const thirdMatch = thirdValue.includes((filters.third || '').trim().toLowerCase());

    return codeMatch && nameMatch && thirdMatch;
  });

  const sortedRows = [...filteredRows].sort((first, second) => {
    const a = getSortValue(first, sortField);
    const b = getSortValue(second, sortField);

    if (a === b) return 0;
    const result = a < b ? -1 : 1;
    return sortDirection === 'asc' ? result : -result;
  });

  const toggleSort = (field) => {
    if (sortField === field) {
      setSortDirection((current) => (current === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const renderSortIcon = (field) => {
    if (sortField !== field) return '';
    return sortDirection === 'asc' ? ' ▲' : ' ▼';
  };

  return (
    <div className="etr-po-search-backdrop" role="presentation">
      <section className="etr-po-search-modal" role="dialog" aria-modal="true" aria-label={title}>
        <div className="etr-po-search-head">
          <div>
            <p className="etr-po-kicker">Search</p>
            <h2>{title}</h2>
          </div>
          <button type="button" onClick={onClose}>Close</button>
        </div>

        <div className="etr-po-search-table-wrap">
          <table className="etr-po-search-table">
            {type === 'po' ? (
              <>
                <thead>
                  <tr>
                    <th onClick={() => toggleSort('code')}>PO Number{renderSortIcon('code')}</th>
                    <th>Date</th>
                    <th onClick={() => toggleSort('name')}>Vendor Name{renderSortIcon('name')}</th>
                    <th>Total</th>
                    <th>Status</th>
                  </tr>
                  <tr className="etr-po-search-filter-row">
                    <th>
                      <input type="search" value={filters.code} onChange={(e) => onFilterChange('code', e.target.value)} placeholder="" />
                    </th>
                    <th></th>
                    <th>
                      <input type="search" value={filters.name} onChange={(e) => onFilterChange('name', e.target.value)} placeholder="" />
                    </th>
                    <th></th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {sortedRows.map((row) => (
                    <tr
                      key={row.id}
                      className={String(row.id) === String(selectedRowId) ? 'selected' : ''}
                      onClick={() => onRowSelect ? onRowSelect(row) : onSelect(row)}
                      onDoubleClick={() => onSelect(row)}
                    >
                      <td>{row.code}</td>
                      <td>{formatShortDate(row.date ? row.date.split('T')[0] : '')}</td>
                      <td>{row.vendorName}</td>
                      <td>{formatMoney(row.total)}</td>
                      <td>{getStatusLabel(row.status)}</td>
                    </tr>
                  ))}
                  {sortedRows.length === 0 ? (
                    <tr>
                      <td colSpan="5">No records found.</td>
                    </tr>
                  ) : null}
                </tbody>
              </>
            ) : type === 'company' ? (
              <>
                <thead>
                  <tr>
                    <th onClick={() => toggleSort('name')}>CompanyName{renderSortIcon('name')}</th>
                    <th onClick={() => toggleSort('address')}>Address{renderSortIcon('address')}</th>
                  </tr>
                  <tr className="etr-po-search-filter-row">
                    <th>
                      <input type="search" value={filters.name} onChange={(e) => onFilterChange('name', e.target.value)} placeholder="" />
                    </th>
                    <th>
                      <input type="search" value={filters.third} onChange={(e) => onFilterChange('third', e.target.value)} placeholder="" />
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {sortedRows.map((row) => (
                    <tr
                      key={row.id ?? `${row.description ?? ''}-${row.address ?? ''}`}
                      className={String(row.id) === String(selectedRowId) ? 'selected' : ''}
                      onClick={() => onRowSelect ? onRowSelect(row) : onSelect(row)}
                      onDoubleClick={() => onSelect(row)}
                    >
                      <td>{row.description}</td>
                      <td>{row.address}</td>
                    </tr>
                  ))}
                  {sortedRows.length === 0 ? (
                    <tr>
                      <td colSpan="2">No records found.</td>
                    </tr>
                  ) : null}
                </tbody>
              </>
            ) : (
              <>
                <thead>
                  <tr>
                    <th onClick={() => toggleSort('code')}>Code{renderSortIcon('code')}</th>
                    <th onClick={() => toggleSort('name')}>Name{renderSortIcon('name')}</th>
                    <th onClick={() => toggleSort('third')}>{type === 'vendor' ? 'Classification Type' : type === 'item' ? 'Unit' : 'Address'}{renderSortIcon('third')}</th>
                  </tr>
                  <tr className="etr-po-search-filter-row">
                    <th>
                      <input type="search" value={filters.code} onChange={(event) => onFilterChange('code', event.target.value)} placeholder="" />
                    </th>
                    <th>
                      <input type="search" value={filters.name} onChange={(event) => onFilterChange('name', event.target.value)} placeholder="" />
                    </th>
                    <th>
                      <input type="search" value={filters.third} onChange={(event) => onFilterChange('third', event.target.value)} placeholder="" />
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {sortedRows.map((row) => (
                    <tr
                      key={row.id ?? `${row.code ?? row.name}-${row.description ?? row.address}`}
                      className={String(row.id) === String(selectedRowId) ? 'selected' : ''}
                      onClick={() => onRowSelect ? onRowSelect(row) : onSelect(row)}
                      onDoubleClick={() => onSelect(row)}
                    >
                      <td>{row.code ?? row.name ?? ''}</td>
                      <td>{type === 'address' ? row.name : type === 'item' ? row.description : row.name ?? row.description}</td>
                      <td>{type === 'vendor' ? row.classificationType : type === 'item' ? row.unit : row.address}</td>
                    </tr>
                  ))}
                  {sortedRows.length === 0 ? (
                    <tr>
                      <td colSpan="3">No records found.</td>
                    </tr>
                  ) : null}
                </tbody>
              </>
            )}
          </table>
        </div>

        <div className="etr-po-search-actions">
          <button type="button" onClick={onRefresh}>Refresh List</button>
          <div>
            <button type="button" onClick={onClose}>Cancel</button>
            <button type="button" onClick={() => onSelect(selectedRow)} disabled={!selectedRow}>Ok</button>
          </div>
        </div>
        {error ? <div className="etr-po-search-error">{error}</div> : null}
        {error ? <div className="etr-po-search-error">{error}</div> : null}
      </section>
    </div>
  );
}

export default function PurchaseOrder() {
  const [rows, setRows] = useState([createBlankRow()]);
  const [vendors, setVendors] = useState([]);
  const [companies, setCompanies] = useState([]);
  const [deliveryAddresses, setDeliveryAddresses] = useState([]);
  const [purchaseOrders, setPurchaseOrders] = useState([]);
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

  const [lookupType, setLookupType] = useState(null);
  const [lookupFilters, setLookupFilters] = useState({ code: '', name: '', third: '' });
  const [lookupSelectedRow, setLookupSelectedRow] = useState(null);
  const [lookupLoading, setLookupLoading] = useState(false);
  const [lookupError, setLookupError] = useState('');
  const [saveStatus, setSaveStatus] = useState({ message: '', error: '' });
  const [saveInProgress, setSaveInProgress] = useState(false);

  // Missing state declarations
  const [termsList, setTermsList] = useState([]);
  const [items, setItems] = useState([]);
  const [activeRowId, setActiveRowId] = useState(null);
  const [formErrors, setFormErrors] = useState({});

  const updateForm = (field, value) => {
    setFormData((current) => ({ ...current, [field]: value }));
  };

  const openLookup = (type) => {
    if (Number(formData.status || 1) !== 1) return;
    setLookupType(type);
    setLookupFilters({ code: '', name: '', third: '' });
    setLookupSelectedRow(null);
    setLookupError('');
    refreshLookupRows();
  };

  const closeLookup = () => {
    setLookupType(null);
    setLookupSelectedRow(null);
  };

  const handleLookupSelection = (row) => {
    setLookupSelectedRow(row);
  };

  const confirmLookupSelection = (selected) => {
    if (!selected) return;

    if (lookupType === 'po') {
      loadPurchaseOrderDetails(selected.id);
    } else if (lookupType === 'vendor') {
      handleVendorSelect(selected.id);
      if (formErrors.vendorId) setFormErrors((curr) => ({ ...curr, vendorId: '' }));
    } else if (lookupType === 'company') {
      const selectedCompany = companies.find((company) => String(company.id) === String(selected.id));
      updateForm('companyId', String(selected.id));
      updateForm('company', selectedCompany ? selectedCompany.description : selected.description || '');
      if (formErrors.companyId) setFormErrors((curr) => ({ ...curr, companyId: '' }));
    } else if (lookupType === 'address') {
      handleDeliveryAddressSelect(selected.id);
      if (formErrors.deliveryAddressId) setFormErrors((curr) => ({ ...curr, deliveryAddressId: '' }));
    } else if (lookupType === 'item') {
      setRows((currentRows) => currentRows.map((row) =>
        row.id === activeRowId 
          ? { 
              ...row, 
              itemCode: selected.code, 
              itemDescription: selected.description, 
              unit: selected.unit 
            } 
          : row
      ));
      setActiveRowId(null);
    }

    closeLookup();
  };

  const isActionDisabled = (actionId) => {
    const isNew = !formData.id;
    const status = Number(formData.status || 1);

    switch (actionId) {
      case 'new':
      case 'edit':
      case 'undo':
        return false;
      case 'save':
        return saveInProgress || status !== 1;
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
  };

  const validateForm = () => {
    const errors = {};
    if (!formData.poNumber || !formData.poNumber.trim()) {
      errors.poNumber = 'PO Number is required.';
    }
    if (!formData.vendorId) {
      errors.vendorId = 'Vendor (Supplier) is required.';
    }
    if (!formData.companyId) {
      errors.companyId = 'Company is required.';
    }
    if (!formData.deliveryAddressId) {
      errors.deliveryAddressId = 'Delivery address is required.';
    }
    const nonEmptyLines = rows.filter((row) => row.itemCode && row.itemCode.trim());
    if (nonEmptyLines.length === 0) {
      errors.lines = 'At least one item line is required.';
    }
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const setLookupFilter = (field, value) => {
    setLookupFilters((current) => ({ ...current, [field]: value }));
  };

  const openItemLookup = (rowId) => {
    if (Number(formData.status || 1) !== 1) return;
    setActiveRowId(rowId);
    openLookup('item');
  };

  const refreshLookupRows = async () => {
    if (!lookupType) return;

    setLookupLoading(true);
    setLookupError('');

    try {
      if (lookupType === 'po') {
        const poItems = await fetchJson(PURCHASE_ORDERS_ENDPOINT, null);
        setPurchaseOrders(poItems);
      } else if (lookupType === 'vendor') {
        const vendorItems = await fetchJson(`${VENDORS_ENDPOINT}?query=`, null);
        setVendors(vendorItems);
      } else if (lookupType === 'company') {
        const companyItems = await fetchJson(COMPANIES_ENDPOINT, null);
        setCompanies(companyItems);
      } else if (lookupType === 'address') {
        await loadVendorAddresses(formData.vendorId, null);
      } else if (lookupType === 'item') {
        const itemRows = await fetchJson('/api/withdrawals/items?query=', null);
        setItems(itemRows);
      }
    } catch (error) {
      setLookupError(error.message || 'Unable to reload list.');
    } finally {
      setLookupLoading(false);
    }
  };

  const handleSave = async () => {
    setSaveStatus({ message: '', error: '' });
    
    if (!validateForm()) {
      setSaveStatus({ message: '', error: 'Please correct the validation errors below.' });
      return;
    }

    setSaveInProgress(true);

    const purchaseOrderId = Number(formData.id || 0);
    const method = purchaseOrderId > 0 ? 'PUT' : 'POST';
    const url = purchaseOrderId > 0 
      ? `${PURCHASE_ORDERS_ENDPOINT}/${purchaseOrderId}` 
      : PURCHASE_ORDERS_ENDPOINT;

    try {
      const token = getToken();
      const response = await fetch(buildApiUrl(url), {
        method: method,
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          id: purchaseOrderId > 0 ? purchaseOrderId : undefined,
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
            .filter((row) => row.itemCode && row.itemCode.trim() !== '')
            .map((row) => ({
              itemCode: row.itemCode,
              itemDescription: row.itemDescription,
              free: row.free,
              unit: row.unit,
              quantity: Number(row.quantity),
              purchaseCost: Number(row.purchaseCost),
              comments: row.comments,
            })),
        }),
      });

      if (!response.ok) {
        const errorBody = await response.json().catch(() => null);
        throw new Error(errorBody?.message || `Failed to save purchase order: ${response.status}`);
      }

      const saved = await response.json();
      setSaveStatus({ message: saved?.message || 'Purchase order saved successfully.', error: '' });
      if (purchaseOrderId === 0 && saved?.purchaseOrderId) {
        loadPurchaseOrderDetails(saved.purchaseOrderId);
      } else if (purchaseOrderId > 0) {
        loadPurchaseOrderDetails(purchaseOrderId);
      }
    } catch (error) {
      setSaveStatus({ message: '', error: error.message || 'Unable to save purchase order.' });
    } finally {
      setSaveInProgress(false);
    }
  };

  const handleNew = () => {
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
    setSaveStatus({ message: '', error: '' });
    setFormErrors({});
  };

  const loadPurchaseOrderDetails = async (id) => {
    try {
      const token = getToken();
      const response = await fetch(buildApiUrl(`${PURCHASE_ORDERS_ENDPOINT}/${id}`), {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!response.ok) throw new Error('Failed to fetch purchase order details.');
      const data = await response.json();
      
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

      setRows((data.lines || []).map((line, idx) => ({
        id: `po-line-${idx}-${Date.now()}`,
        selected: false,
        itemCode: line.itemCode || '',
        itemDescription: line.itemDescription || '',
        free: line.free || false,
        unit: line.unit || '',
        quantity: line.quantity || 0,
        purchaseCost: line.purchaseCost || 0,
        comments: line.comments || '',
      })));
    } catch (error) {
      setSaveStatus({ message: '', error: error.message });
    }
  };

  const handleDelete = async () => {
    const purchaseOrderId = Number(formData.id || 0);
    if (purchaseOrderId <= 0) return;
    if (!window.confirm('Are you sure you want to delete this purchase order?')) return;
    
    try {
      const token = getToken();
      const response = await fetch(buildApiUrl(`${PURCHASE_ORDERS_ENDPOINT}/${purchaseOrderId}`), {
        method: 'DELETE',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!response.ok) throw new Error('Failed to delete purchase order.');
      alert('Purchase order deleted successfully.');
      handleNew();
    } catch (error) {
      setSaveStatus({ message: '', error: error.message });
    }
  };

  const handleUndo = () => {
    const purchaseOrderId = Number(formData.id || 0);
    if (purchaseOrderId > 0) {
      loadPurchaseOrderDetails(purchaseOrderId);
    } else {
      handleNew();
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const handleApprove = async () => {
    const purchaseOrderId = Number(formData.id || 0);
    if (purchaseOrderId <= 0) return;
    if (!window.confirm('Are you sure you want to approve this purchase order?')) return;
    
    try {
      const token = getToken();
      const response = await fetch(buildApiUrl(`${PURCHASE_ORDERS_ENDPOINT}/${purchaseOrderId}/approve`), {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!response.ok) throw new Error('Failed to approve purchase order.');
      setSaveStatus({ message: 'Purchase order approved successfully.', error: '' });
      loadPurchaseOrderDetails(purchaseOrderId);
    } catch (error) {
      setSaveStatus({ message: '', error: error.message });
    }
  };

  const handleCancel = async () => {
    const purchaseOrderId = Number(formData.id || 0);
    if (purchaseOrderId <= 0) return;
    const reason = window.prompt('Enter cancellation remarks:');
    if (reason === null) return;
    
    try {
      const token = getToken();
      const response = await fetch(buildApiUrl(`${PURCHASE_ORDERS_ENDPOINT}/${purchaseOrderId}/cancel`), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ reason }),
      });
      if (!response.ok) throw new Error('Failed to cancel purchase order.');
      setSaveStatus({ message: 'Purchase order cancelled successfully.', error: '' });
      loadPurchaseOrderDetails(purchaseOrderId);
    } catch (error) {
      setSaveStatus({ message: '', error: error.message });
    }
  };

  const handleClose = async () => {
    const purchaseOrderId = Number(formData.id || 0);
    if (purchaseOrderId <= 0) return;
    if (!window.confirm('Are you sure you want to close this purchase order?')) return;
    
    try {
      const token = getToken();
      const response = await fetch(buildApiUrl(`${PURCHASE_ORDERS_ENDPOINT}/${purchaseOrderId}/close`), {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!response.ok) throw new Error('Failed to close purchase order.');
      setSaveStatus({ message: 'Purchase order closed successfully.', error: '' });
      loadPurchaseOrderDetails(purchaseOrderId);
    } catch (error) {
      setSaveStatus({ message: '', error: error.message });
    }
  };

  const handleToolbarAction = (actionId) => {
    if (actionId === 'save') {
      handleSave();
    } else if (actionId === 'new') {
      handleNew();
    } else if (actionId === 'edit') {
      openLookup('po');
    } else if (actionId === 'delete') {
      handleDelete();
    } else if (actionId === 'undo') {
      handleUndo();
    } else if (actionId === 'print') {
      handlePrint();
    } else if (actionId === 'approve') {
      handleApprove();
    } else if (actionId === 'cancel') {
      handleCancel();
    } else if (actionId === 'closed') {
      handleClose();
    }
  };

  const fetchJson = async (path, signal) => {
    const token = getToken();
    const url = buildApiUrl(path);
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      signal,
    });

    console.debug('[PurchaseOrder] fetch', { url, status: response.status, ok: response.ok, tokenPresent: !!token });

    if (!response.ok) {
      let errorText = response.statusText || String(response.status);
      try {
        const body = await response.json();
        if (body?.message) {
          errorText = body.message;
        }
      } catch {
        // ignore parse errors
      }
      throw new Error(`Failed to fetch ${path}: ${errorText}`);
    }

    const json = await response.json();
    return getApiCollection(json);
  };

  const loadVendorAddresses = async (vendorId, signal) => {
    if (!vendorId) {
      setDeliveryAddresses([]);
      return [];
    }

    const addresses = await fetchJson(`${VENDOR_ADDRESSES_ENDPOINT}?vendorId=${encodeURIComponent(vendorId)}`, signal);
    setDeliveryAddresses(addresses);
    return addresses;
  };

  const handleVendorSelect = async (vendorId) => {
    const selectedVendor = vendors.find((vendor) => String(vendor.id) === String(vendorId));
    if (!selectedVendor) {
      return;
    }

    setFormData((current) => ({
      ...current,
      vendorId: String(selectedVendor.id),
      vendorCode: selectedVendor.code,
      vendorName: selectedVendor.name,
      terms: String(selectedVendor.creditTermId || ''),
      deliveryAddressId: '',
      deliveryAddress: '',
      vendorAddress: '',
    }));

    try {
      const addresses = await loadVendorAddresses(selectedVendor.id);
      const firstAddress = addresses[0];
      if (firstAddress) {
        setFormData((current) => ({
          ...current,
          vendorAddress: `${firstAddress.name} ${firstAddress.address}`.trim(),
        }));
      }
    } catch {
      setDeliveryAddresses([]);
    }
  };

  const handleDeliveryAddressSelect = (addressId) => {
    const selectedAddress = deliveryAddresses.find((item) => String(item.id) === String(addressId));

    if (!selectedAddress) {
      setFormData((current) => ({ ...current, deliveryAddressId: '', deliveryAddress: '' }));
      return;
    }

    setFormData((current) => ({
      ...current,
      deliveryAddressId: String(selectedAddress.id),
      deliveryAddress: selectedAddress.address,
    }));
  };

  useEffect(() => {
    const controller = new AbortController();

    const loadOptions = async () => {
      try {
        const [vendorItems, companyItems, termItems] = await Promise.all([
          fetchJson(`${VENDORS_ENDPOINT}?query=`, controller.signal),
          fetchJson(COMPANIES_ENDPOINT, controller.signal),
          fetchJson(TERMS_ENDPOINT, controller.signal),
        ]);

        setVendors(vendorItems);
        setCompanies(companyItems);
        setTermsList(termItems);

        // Do not auto-select the first vendor or company. Let the user choose.
        // The dropdown/search modal will provide the selection.
      } catch (error) {
        if (!isAbortError(error)) {
          console.error('Failed to load vendor, company or term options', error);
        }
      }
    };

    loadOptions();

    return () => {
      controller.abort();
    };
  }, []);

  const isAbortError = (error) => {
    return error?.name === 'AbortError' || error?.message === 'The operation was aborted.';
  };

  const totals = useMemo(() => {
    const grossTotal = rows
      .filter((row) => row.itemCode && row.itemCode.trim() !== '')
      .reduce((sum, row) => sum + (Number(row.quantity) * Number(row.purchaseCost)), 0);
    return {
      grossTotal,
      grossDiscount: 0,
      vatAmount: 0,
      withholdingTax: 0,
      netTotal: grossTotal,
    };
  }, [rows]);

  const updateRow = (rowId, field, value) => {
    setRows((currentRows) => currentRows.map((row) =>
      row.id === rowId ? { ...row, [field]: value } : row
    ));
  };

  const deleteSelectedRows = () => {
    setRows((currentRows) => {
      const remainingRows = currentRows.filter((row) => !row.selected);
      return remainingRows;
    });
  };

  useEffect(() => {
    const isEditable = Number(formData.status || 1) === 1;
    if (!isEditable) return;

    if (rows.length === 0) {
      setRows([createBlankRow()]);
      return;
    }

    const lastRow = rows[rows.length - 1];
    const hasItemCode = lastRow.itemCode && lastRow.itemCode.trim() !== '';
    const hasEmptyRow = rows.some(row => !row.itemCode || row.itemCode.trim() === '');

    if (hasItemCode && !hasEmptyRow) {
      setRows((current) => [...current, createBlankRow()]);
    }

    const nonEmptyRows = rows.filter(row => row.itemCode && row.itemCode.trim() !== '');
    const emptyRows = rows.filter(row => !row.itemCode || row.itemCode.trim() === '');

    if (emptyRows.length > 1) {
      const keepEmptyRow = emptyRows[emptyRows.length - 1];
      setRows([...nonEmptyRows, keepEmptyRow]);
    }
  }, [rows, formData.status]);

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
              disabled={isActionDisabled(action.id)}
              className={action.id === 'save' ? 'is-primary' : ''}
              onClick={() => handleToolbarAction(action.id)}
            >
              <span>{action.label}</span>
              {action.hasMenu ? <span className="etr-po-caret" aria-hidden="true" /> : null}
            </button>
          ))}
        </div>
      </div>
      {(saveStatus.message || saveStatus.error) && (
        <div className={`etr-po-save-status ${saveStatus.error ? 'error' : 'success'}`}>
          {saveStatus.error || saveStatus.message}
        </div>
      )}

      <section className="etr-po-form-panel">
        <div className="etr-po-form-shell">
          <div className="etr-po-content-column">
            <div className="etr-po-main-stack">
              <div className="etr-po-column">
                <section className="etr-po-card">
                  <div className="etr-po-card-head">
                    <div>
                      <p>General</p>
                    </div>
                  </div>
                  <div className="etr-po-form-grid two">
                    <Field label="PO Number" error={formErrors.poNumber}>
                      <input value={formData.poNumber} onChange={(e) => {
                        updateForm('poNumber', e.target.value);
                        if (formErrors.poNumber) setFormErrors(curr => ({ ...curr, poNumber: '' }));
                      }} />
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
                        <option value="">-- Select Terms --</option>
                        {termsList.map((term) => (
                          <option key={term.id} value={String(term.id)}>
                            {term.description}
                          </option>
                        ))}
                      </select>
                    </Field>
                  </div>
                </section>

                <section className="etr-po-card">
                  <div className="etr-po-card-head">
                    <div>
                      <p>Vendor</p>
                    </div>
                  </div>
                  <div className="etr-po-form-grid two">
                    <Field label="Vendor (Supplier)" link className="is-wide" onLabelClick={() => openLookup('vendor')} error={formErrors.vendorId}>
                      <div className="etr-po-split-input" style={{ position: 'relative' }}>
                        <input value={formData.vendorCode} readOnly />
                        <input value={formData.vendorName} readOnly />
                        <button
                          type="button"
                          onClick={() => openLookup('vendor')}
                          aria-label="Search vendor"
                          style={{
                            position: 'absolute',
                            inset: 0,
                            border: 'none',
                            background: 'transparent',
                            padding: 0,
                            margin: 0,
                            cursor: 'pointer',
                            zIndex: 2,
                          }}
                        />
                      </div>
                    </Field>
                    <Field label="Vendor Address" className="is-wide">
                      <input value={formData.vendorAddress} readOnly />
                    </Field>
                    <Field label="Company" link className="is-wide" onLabelClick={() => openLookup('company')} error={formErrors.companyId}>
                      <div style={{ position: 'relative' }}>
                        <input value={formData.company} readOnly />
                        <button
                          type="button"
                          onClick={() => openLookup('company')}
                          aria-label="Search company"
                          style={{
                            position: 'absolute',
                            inset: 0,
                            border: 'none',
                            background: 'transparent',
                            padding: 0,
                            margin: 0,
                            cursor: 'pointer',
                            zIndex: 2,
                          }}
                        />
                      </div>
                    </Field>
                    <Field label="Comments" className="is-wide">
                      <input value={formData.comments} onChange={(e) => updateForm('comments', e.target.value)} />
                    </Field>
                    <Field label="Delivery Address" link className="is-wide" onLabelClick={() => openLookup('address')} error={formErrors.deliveryAddressId}>
                      <div style={{ position: 'relative' }}>
                        <textarea rows="4" value={formData.deliveryAddress} readOnly />
                        <button
                          type="button"
                          onClick={() => openLookup('address')}
                          aria-label="Search delivery address"
                          style={{
                            position: 'absolute',
                            inset: 0,
                            border: 'none',
                            background: 'transparent',
                            padding: 0,
                            margin: 0,
                            cursor: 'pointer',
                            zIndex: 2,
                          }}
                        />
                      </div>
                    </Field>
                  </div>
                </section>
              </div>

              <div className="etr-po-column etr-po-column-narrow">
                <section className="etr-po-card">
                  <div className="etr-po-card-head">
                    <div>
                      <p>Reference</p>
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
                {lookupType && (
                  <SearchModal
                    title={lookupType === 'vendor' ? 'Search Vendor' : lookupType === 'company' ? 'Search Company' : lookupType === 'po' ? 'Search Purchase Order' : lookupType === 'item' ? 'Search Item' : 'Search Delivery Address'}
                    type={lookupType}
                    rows={lookupType === 'vendor' ? vendors : lookupType === 'company' ? companies : lookupType === 'po' ? purchaseOrders : lookupType === 'item' ? items : deliveryAddresses}
                    filters={lookupFilters}
                    selectedRow={lookupSelectedRow}
                    onFilterChange={setLookupFilter}
                    onSelect={confirmLookupSelection}
                    onRowSelect={handleLookupSelection}
                    onClose={closeLookup}
                    onRefresh={refreshLookupRows}
                    error={lookupError}
                  />
                )}

                <section className="etr-po-card">
                  <div className="etr-po-card-head">
                    <div>
                      <p>System Logs</p>
                    </div>
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

          <aside className="etr-po-side-stack">
            <section className="etr-po-card etr-po-status-card">
              <div className="etr-po-card-head">
                <div>
                  <p>Status</p>
                </div>
              </div>
              <input value={getStatusLabel(formData.status)} readOnly />
            </section>

            <section className="etr-po-card etr-po-summary-card">
              <div className="etr-po-card-head">
                <div>
                  <p>Amount</p>
                </div>
              </div>
              <Field label="Gross Total">
                <input value={rows.length > 0 ? formatMoney(totals.grossTotal) : ''} readOnly />
              </Field>
              <Field label="Gross Discount">
                <input value={rows.length > 0 ? formatMoney(totals.grossDiscount) : ''} readOnly />
              </Field>
              <Field label="Vat Amount">
                <input value={rows.length > 0 && totals.vatAmount ? formatMoney(totals.vatAmount) : ''} readOnly />
              </Field>
              <Field label="Net Total">
                <input value={rows.length > 0 ? formatMoney(totals.netTotal) : ''} readOnly />
              </Field>
            </section>
          </aside>
        </div>
      </section>
      {/* Lines panel – matches withdrawal’s table panel */}
      <section className="etr-po-table-panel" style={{ borderColor: formErrors.lines ? '#c93636' : undefined }}>
        <div className="etr-po-table-tools">
          <button
            type="button"
            onClick={deleteSelectedRows}
            disabled={Number(formData.status || 1) !== 1 || !rows.some((row) => row.selected)}
          >
            Delete Selected
          </button>
          <span>Total Items: {rows.filter(r => r.itemCode && r.itemCode.trim()).length}</span>
          {formErrors.lines ? <span style={{ color: '#b42d2d', borderLeft: 'none', paddingLeft: 0 }}>{formErrors.lines}</span> : null}
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
                const isEditable = Number(formData.status || 1) === 1;
                return (
                  <tr key={row.id}>
                    <td>
                      <input
                        type="checkbox"
                        checked={row.selected}
                        onChange={(e) => updateRow(row.id, 'selected', e.target.checked)}
                        disabled={!isEditable}
                      />
                    </td>
                    <td>
                      <button
                        type="button"
                        className="etr-po-link"
                        onClick={() => openItemLookup(row.id)}
                        disabled={!isEditable}
                      >
                        {row.itemCode || 'Click to Select'}
                      </button>
                    </td>
                    <td>
                      <button
                        type="button"
                        className="etr-po-link"
                        onClick={() => openItemLookup(row.id)}
                        disabled={!isEditable}
                      >
                        {row.itemDescription || 'Click to Select'}
                      </button>
                    </td>
                    <td>
                      <input
                        type="checkbox"
                        checked={row.free}
                        onChange={(e) => updateRow(row.id, 'free', e.target.checked)}
                        disabled={!isEditable}
                      />
                    </td>
                    <td>
                      <input
                        value={row.unit}
                        onChange={(e) => updateRow(row.id, 'unit', e.target.value)}
                        readOnly={!isEditable}
                      />
                    </td>
                    <td>
                      <input
                        type="number"
                        value={row.quantity}
                        onChange={(e) => updateRow(row.id, 'quantity', e.target.value)}
                        readOnly={!isEditable}
                      />
                    </td>
                    <td>
                      <input
                        type="number"
                        step="0.0001"
                        value={row.purchaseCost}
                        onChange={(e) => updateRow(row.id, 'purchaseCost', e.target.value)}
                        readOnly={!isEditable}
                      />
                    </td>
                    <td className="is-money">{formatMoney(amount)}</td>
                    <td>
                      <input
                        value={row.comments}
                        onChange={(e) => updateRow(row.id, 'comments', e.target.value)}
                        readOnly={!isEditable}
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