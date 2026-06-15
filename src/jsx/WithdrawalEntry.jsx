import React, { useMemo, useState, useRef, useEffect } from 'react';
import { getToken } from '../services/authStorage';
import '../css/WithdrawalEntry.css';

const apiBaseUrl = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/+$/, '');
const WITHDRAWALS_ENDPOINT = '/api/withdrawals';
const COST_UNITS_ENDPOINT = '/api/costunits';
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
  referenceType: '',
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

function buildApiUrl(path) {
  return apiBaseUrl ? `${apiBaseUrl}${path}` : path;
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

function LookupModal({ title, rows, isLoading = false, error = '', onClose, onSelect }) {
  const [query, setQuery] = useState('');
  const filteredRows = rows.filter((row) => `${row.code} ${row.description}`.toLowerCase().includes(query.trim().toLowerCase()));

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
          {isLoading ? <span>Loading...</span> : null}
          {!isLoading && error ? <span>{error}</span> : null}
          {!isLoading && !error && filteredRows.length === 0 ? <span>No records found.</span> : null}
          {filteredRows.map((row) => (
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

export default function WithdrawalEntry() {
  const [activeTab, setActiveTab] = useState('details');
  const [isEditing, setIsEditing] = useState(true);
  const [formData, setFormData] = useState(emptyForm);
  const [details, setDetails] = useState([createBlankDetailRow()]);
  const [allocations, setAllocations] = useState([]);
  const [insufficientStocks, setInsufficientStocks] = useState([]);
  const [message, setMessage] = useState('');
  const [errors, setErrors] = useState({});
  const [lookup, setLookup] = useState(null);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [pendingItemLookupRow, setPendingItemLookupRow] = useState(null);
  const [withdrawalId, setWithdrawalId] = useState(-1);
  const [withdrawalTypeRows, setWithdrawalTypeRows] = useState(defaultWithdrawalTypes);
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

  const totals = useMemo(() => ({
    quantity: details.reduce((sum, row) => sum + parseNumber(row.quantity), 0),
    withdrawalQuantity: allocations.reduce((sum, row) => sum + parseNumber(row.quantity), 0),
    insufficientQuantity: insufficientStocks.reduce((sum, row) => sum + parseNumber(row.quantity), 0),
  }), [details, allocations, insufficientStocks]);

  const getCreatedInfo = () => {
    if (formData.createdBy && formData.createdDate) {
      return `${formData.createdBy} on ${formData.createdDate}`;
    }
    return 'Not created yet';
  };

  const getLastModifiedInfo = () => {
    const parts = [];
    if (formData.lastModifiedBy && formData.lastModifiedDate) {
      parts.push(`${formData.lastModifiedBy} on ${formData.lastModifiedDate}`);
    }
    if (formData.modificationHistory && formData.modificationHistory.length > 0) {
      formData.modificationHistory.forEach(hist => {
        if (hist.modifiedBy !== formData.lastModifiedBy) {
          parts.push(`${hist.modifiedBy} on ${hist.modifiedDate}`);
        }
      });
    }
    return parts.join(' | ') || 'Not modified yet';
  };

  const getApprovedInfo = () => {
    if (formData.approvedBy && formData.approvedDate) {
      return `${formData.approvedBy} on ${formData.approvedDate}`;
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
        const [typeResponse, warehouseResponse, companyResponse, costUnitResponse, recipientResponse] = await Promise.all([
          fetch(buildApiUrl(`${WITHDRAWALS_ENDPOINT}/types`), { headers, signal: controller.signal }),
          fetch(buildApiUrl(`${WITHDRAWALS_ENDPOINT}/warehouses`), { headers, signal: controller.signal }),
          fetch(buildApiUrl(`${WITHDRAWALS_ENDPOINT}/companies`), { headers, signal: controller.signal }),
          fetch(buildApiUrl(COST_UNITS_ENDPOINT), { headers, signal: controller.signal }),
          fetch(buildApiUrl(`${WITHDRAWALS_ENDPOINT}/recipients`), { headers, signal: controller.signal }),
        ]);

        const [typeData, warehouseData, companyData, costUnitData, recipientData] = await Promise.all([
          typeResponse.json().catch(() => ({})),
          warehouseResponse.json().catch(() => ({})),
          companyResponse.json().catch(() => ({})),
          costUnitResponse.json().catch(() => ({})),
          recipientResponse.json().catch(() => ({})),
        ]);

        if (!typeResponse.ok) throw new Error(typeData?.message || 'Unable to load withdrawal types.');
        if (!warehouseResponse.ok) throw new Error(warehouseData?.message || 'Unable to load warehouses.');
        if (!companyResponse.ok) throw new Error(companyData?.message || 'Unable to load companies.');
        if (!costUnitResponse.ok) throw new Error(costUnitData?.message || 'Unable to load cost units.');
        if (!recipientResponse.ok) throw new Error(recipientData?.message || 'Unable to load recipients.');

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

  const loadLookupRows = async (type) => {
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
      const response = await fetch(buildApiUrl(endpoint), {
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
        })).filter((row) => row.id && row.description),
      }));
    } catch (error) {
      setLookupError(error.message || `Unable to load ${type} options.`);
    } finally {
      setIsLookupLoading(false);
    }
  };

  const openLookup = (type) => {
    setLookup(type);
    setLookupError('');
    loadLookupRows(type);
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
    const detailRow = details.find(d => d.itemKey === itemKey);
    if (!detailRow) return;

    const remainingAllocations = allocations.filter(a => a.itemKey !== itemKey);
    const remainingInsufficient = insufficientStocks.filter(i => i.itemKey !== itemKey);
    
    const warehouseKey = formData.warehouseKey || -1;
    const locationKey = -1;
    
    try {
      const result = await preallocateStocks(itemKey, detailRow.unitKey, parseNumber(newQuantity), warehouseKey, locationKey);
    
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
        .filter(a => a.itemKey === itemKey)
        .reduce((sum, a) => sum + parseNumber(a.quantity), 0);
      
      updateDetail(detailRow.id, 'withdrawableQuantity', totalAllocated.toString());
      updateDetail(detailRow.id, 'insufficientQuantity', unallocatedQuantity.toString());
      updateDetail(detailRow.id, 'withdrawalQuantity', totalAllocated.toString());
    } catch (error) {
      setMessage(error.message || 'Unable to preallocate stocks.');
    }
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
    setFormData({ 
      ...emptyForm, 
      transactionDate: todayIso,
      createdBy: 'Current User',
      createdDate: todayIso,
      modificationHistory: []
    });
    setDetails([createBlankDetailRow()]);
    setAllocations([]);
    setInsufficientStocks([]);
    setWithdrawalId(-1);
    setIsEditing(true);
    setMessage('New withdrawal entry started.');
    setErrors({});
  };

  const handlePrint = () => {
    setMessage('Print options: Delivery Receipt, Withdrawal Form, POD, Picklist - API integration needed');
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
          setFormData(prev => ({
            ...prev,
            approvedBy: 'Current User',
            approvedDate: todayIso,
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
        setFormData(prev => ({
          ...prev,
          rejectReasonID: reason,
          rejectDescription: remarks,
          approvedBy: 'Current User',
          approvedDate: todayIso,
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
      referenceID: -1,
      referenceType: 0,
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
      if (savedId) {
        setWithdrawalId(savedId);
      }

      if (withdrawalId !== -1 && formData.lastModifiedBy && formData.lastModifiedDate) {
        addModificationHistory(formData.lastModifiedBy, formData.lastModifiedDate);
      }

      setFormData(prev => ({
        ...prev,
        transactionNo: prev.transactionNo || data.transactionNumber || data.TransactionNumber || prev.transactionNo,
        lastModifiedBy: 'Current User',
        lastModifiedDate: todayIso,
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
                <select value={formData.referenceType} onChange={(event) => updateForm('referenceType', event.target.value)} disabled={!isEditing}>
                  <option value="" />
                  <option>Withdrawal</option>
                  <option>StockTransfer</option>
                  <option>SOFile</option>
                </select>
              </Field>
              <Field label="Reference No." link>
                <input type="text" value={formData.referenceNo} onChange={(event) => updateForm('referenceNo', event.target.value)} readOnly={!isEditing} />
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
                  <input type="text" value={formData.podNo} onChange={(event) => updateForm('podNo', event.target.value)} readOnly={!isEditing} />
                </Field>
                <button 
                  type="button" 
                  disabled={!isEditing || withdrawalId === -1 || isSaving} 
                  onClick={async () => {
                    const token = getToken();
                    setIsSaving(true);
                    try {
                      const response = await fetch(buildApiUrl(`${WITHDRAWALS_ENDPOINT}/${withdrawalId}/pod`), {
                        method: 'POST',
                        headers: token ? { Authorization: `Bearer ${token}` } : {},
                      });
                      const data = await response.json().catch(() => ({}));

                      if (!response.ok) {
                        throw new Error(data?.message || 'Unable to generate POD.');
                      }

                      updateForm('podNo', data.podNumber || data.PODNumber || '');
                      setMessage('POD number generated successfully.');
                    } catch (error) {
                      setMessage(error.message || 'Unable to generate POD.');
                    } finally {
                      setIsSaving(false);
                    }
                  }}
                >
                  Generate POD
                </button>
              </div>
              <div className="etr-withdrawal-row-pair">
                <Field label="Target Delivery">
                  <input type="date" value={formData.targetDelivery} onChange={(event) => updateForm('targetDelivery', event.target.value)} disabled={!isEditing} />
                </Field>
                <Field label="No. of Pallets">
                  <input type="number" value={formData.noOfPallets} onChange={(event) => updateForm('noOfPallets', event.target.value)} readOnly={!isEditing} />
                </Field>
              </div>
              <Field label="Declare Value">
                <input type="number" step="0.0001" value={formData.declareValue} onChange={(event) => updateForm('declareValue', event.target.value)} readOnly={!isEditing} />
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
          <button type="button" onClick={deleteSelectedDetails} disabled={!isEditing}>
            Delete Selected
          </button>
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
                        value={row.quantity} 
                        onChange={(event) => {
                          const newQty = event.target.value;
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
                        style={{ backgroundColor: '#fff0f0' }}
                      />
                    </td>
                    <td>
                      <input 
                        type="number" 
                        value={row.withdrawalQuantity} 
                        readOnly 
                        style={{ backgroundColor: '#e8f5e9' }}
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
                  <th>Actions</th>
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
                        value={row.quantity} 
                        onChange={(e) => {
                          const newQty = e.target.value;
                          setAllocations(prev => prev.map(a => a.id === row.id ? { ...a, quantity: newQty } : a));
                        }}
                        readOnly={!isEditing}
                      />
                    </td>
                    <td>
                      {isEditing && (
                        <div className="etr-withdrawal-allocation-actions">
                          <button type="button" onClick={() => duplicateAllocationRow(row)}>Copy</button>
                          <button type="button" onClick={() => deleteAllocationRow(row.id)}>Delete</button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
                {allocations.length === 0 && (
                  <tr>
                    <td colSpan="10" style={{ textAlign: 'center' }}>No stock allocations. Add items in the Details tab.</td>
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
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {insufficientStocks.map((row) => (
                  <tr key={row.id}>
                    <td>{row.itemCode}</td>
                    <td>{row.itemDescription}</td>
                    <td>{row.unit}</td>
                    <td style={{ color: '#d32f2f', fontWeight: 'bold' }}>{row.quantity}</td>
                    <td>
                      {isEditing && (
                        <button type="button" onClick={() => setLookup('item')}>Allocate Stock</button>
                      )}
                    </td>
                  </tr>
                ))}
                {insufficientStocks.length === 0 && (
                  <tr>
                    <td colSpan="5" style={{ textAlign: 'center' }}>No insufficient stock items.</td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
        </div>
      </section>

      {lookup && (
        <LookupModal
          title={`Select ${lookup.replace(/([A-Z])/g, ' $1')}`}
          rows={lookupRows[lookup] || []}
          isLoading={isLookupLoading}
          error={lookupError}
          onClose={() => {
            setLookup(null);
            setPendingItemLookupRow(null);
          }}
          onSelect={handleLookupSelect}
        />
      )}

      {showRejectModal && (
        <RejectReasonModal onClose={() => setShowRejectModal(false)} onConfirm={handleRejectConfirm} />
      )}
    </div>
  );
}
