import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import DailyExpenseManager from './Dailyexpensemanager.jsx';
import ExpenseEntryView from './Dailyexpense.jsx';
import JournalEntryView, { JournalEntryManagerView } from './Journalentry.jsx';
import PurchaseOrder from './PurchaseOrder.jsx';
import WithdrawalEntry from './WithdrawalEntry.jsx';

const DAILY_EXPENSE_ENTRY_DESCRIPTION = '{4DAE27D1-29DC-418F-AF97-CBCD368CF592}';
const DAILY_EXPENSE_MANAGER_DESCRIPTION = '{F9108E90-4118-49F1-96C5-640D98B3EED8}';
const REIMBURSEMENT_DEADLINE_DAYS = [6, 21];
const REIMBURSEMENT_REMINDER_DAYS = [5, 20];
const REIMBURSEMENT_NOTIFICATION_CUTOFF_HOUR = 14;

const sidebarSections = [
  {
    id: 'sales',
    title: 'Sales',
    children: [
      { id: 'customer', label: 'Customer', icon: 'group' },
      { id: 'sales-agent', label: 'Sales Agent', icon: 'person' },
      { id: 'bill-collector', label: 'Bill Collector', icon: 'person' },
      {
        id: 'advanced-pricing',
        label: 'Advanced Pricing',
        icon: 'bars',
        children: [
          { id: 'pricelist', label: 'Pricelist', icon: 'document' },
          { id: 'promo-deals', label: 'Promo Deals', icon: 'folder' },
          { id: 'promo-discount', label: 'Promo Discount', icon: 'document' },
        ],
      },
      { id: 'order-entry', label: 'Order Entry', icon: 'table' },
      { id: 'invoice', label: 'Invoice', icon: 'document' },
      { id: 'billing-entry', label: 'Billing Entry', icon: 'clipboard' },
      { id: 'customer-returns', label: 'Customer Returns', icon: 'folder' },
    ],
  },
  {
    id: 'logistics',
    title: 'Logistics',
    children: [
      { id: 'picklist-entry', label: 'Picklist Entry', icon: 'clipboard' },
      { id: 'delivery-manifest', label: 'Delivery Manifest', icon: 'table' },
    ],
  },
  {
    id: 'inventory',
    title: 'Inventory',
    children: [
      { id: 'purchase-order', label: 'Purchase Order', icon: 'document' },
      { id: 'supplier-returns', label: 'Supplier Returns', icon: 'folder' },
      { id: 'stock-transfer', label: 'Stock Transfer', icon: 'network' },
      { id: 'withdrawal-entry', label: 'Withdrawal Entry', icon: 'clipboard' },
    ],
  },
  {
    id: 'finance',
    title: 'Finance',
    children: [
      { id: 'daily-expense-manager', label: 'Daily Expense Manager', icon: 'table' },
      { id: 'expense-entry', label: 'Daily Expense Entry', icon: 'document' },
      { id: 'official-receipt', label: 'Official Receipt', icon: 'document' },
      { id: 'official-receipt-deductions', label: 'Official Receipt Deductions', icon: 'table' },
      { id: 'payable-entry', label: 'Payable Entry', icon: 'clipboard' },
      { id: 'voucher-payment', label: 'Voucher Payment', icon: 'folder' },
      { id: 'journal-manager', label: 'Journal Manager', icon: 'table' },
      { id: 'journal-entry', label: 'Journal Entry', icon: 'document' },
    ],
  },
  {
    id: 'analytics',
    title: 'Analytics',
    children: [
      { id: 'stock-inquiry', label: 'Stock Inquiry', icon: 'bars' },
      { id: 'lot-inquiry', label: 'Lot inquiry', icon: 'table' },
      { id: 'price-inquiry', label: 'Price Inquiry', icon: 'document' },
      { id: 'receivables-inquiry', label: 'Receivables Inquiry', icon: 'folder' },
      { id: 'payables-inquiry', label: 'Payables Inquiry', icon: 'folder' },
      { id: 'bank-inquiry', label: 'Bank Inquiry', icon: 'table' },
      { id: 'ledger-view', label: 'Ledger View', icon: 'clipboard' },
      { id: 'account-balances', label: 'Account Balances', icon: 'bars' },
    ],
  },
];

function getUserAccessDescriptions(user) {
  if (!user) {
    return new Set();
  }

  const rawDescriptions = [
    ...(Array.isArray(user.accessDescriptions) ? user.accessDescriptions : []),
    ...(Array.isArray(user.AccessDescriptions) ? user.AccessDescriptions : []),
  ];

  return new Set(
    rawDescriptions
      .map((description) => (typeof description === 'string' ? description.trim() : ''))
      .filter(Boolean),
  );
}

function filterSidebarSectionsByAccess(sections, user) {
  const accessDescriptions = getUserAccessDescriptions(user);
  const hasDailyExpenseEntryAccess = accessDescriptions.has(DAILY_EXPENSE_ENTRY_DESCRIPTION);
  const hasDailyExpenseManagerAccess = accessDescriptions.has(DAILY_EXPENSE_MANAGER_DESCRIPTION);

  return sections
    .map((section) => {
      if (section.id !== 'finance') {
        return section;
      }

      const children = section.children.filter((item) => {
        if (item.id === 'expense-entry') {
          return hasDailyExpenseEntryAccess;
        }

        if (item.id === 'daily-expense-manager') {
          return hasDailyExpenseManagerAccess;
        }

        return true;
      });

      return {
        ...section,
        children,
      };
    })
    .filter((section) => section.children.length > 0);
}

function getClosedSidebarState(sections) {
  const state = {};

  const closeItems = (items) => {
    items.forEach((item) => {
      state[item.id] = false;

      if (Array.isArray(item.children) && item.children.length > 0) {
        closeItems(item.children);
      }
    });
  };

  sections.forEach((section) => {
    state[section.id] = false;
    closeItems(section.children);
  });

  return state;
}

function buildSearchIndex(sections) {
  const index = [];

  const walkItems = (items, section, parents = []) => {
    items.forEach((item) => {
      const parentLabels = parents.map((parent) => parent.label);
      const hasChildren = Array.isArray(item.children) && item.children.length > 0;

      index.push({
        id: item.id,
        label: item.label,
        sectionId: section.id,
        sectionTitle: section.title,
        parentIds: [section.id, ...parents.map((parent) => parent.id)],
        path: [section.title, ...parentLabels, item.label].join(' / '),
        keywords: [section.title, ...parentLabels, item.label, item.id].join(' ').toLowerCase(),
        isSelectable: !hasChildren,
      });

      if (hasChildren) {
        walkItems(item.children, section, [...parents, item]);
      }
    });
  };

  sections.forEach((section) => {
    index.push({
      id: section.id,
      label: section.title,
      sectionId: section.id,
      sectionTitle: section.title,
      parentIds: [],
      path: section.title,
      keywords: `${section.title} ${section.id}`.toLowerCase(),
      isSelectable: false,
    });
    walkItems(section.children, section);
  });

  return index;
}

function SidebarIcon({ type }) {
  const icons = {
    bars: <path d="M4 19h16v1.8H4V19Zm1-2V9h2v8H5Zm4 0V5h2v12H9Zm4 0v-6h2v6h-2Zm4 0v-3h2v3h-2Z" />,
    clipboard: <path d="M9 3h6l1 2h3v16H5V5h3l1-2Zm0 4H7v12h10V7h-2v2H9V7Zm1-2v2h4V5h-4Z" />,
    network: <path d="M5 5h4v4H5V5Zm10 0h4v4h-4V5ZM10 15h4v4h-4v-4ZM7 9v2h10V9h2v4h-5v2h-4v-2H5V9h2Z" />,
    folder: <path d="M4 6h5l2 2h9v10H4V6Zm2 2v8h12V10h-8.2L7.8 8H6Z" />,
    document: <path d="M6 3h8l4 4v14H6V3Zm2 2v14h8V8h-3V5H8Zm2 7h4v2h-4v-2Zm0-4h4v2h-4V8Z" />,
    table: <path d="M5 5h14v14H5V5Zm2 2v2h3V7H7Zm5 0v2h5V7h-5ZM7 11v2h3v-2H7Zm5 0v2h5v-2h-5ZM7 15v2h3v-2H7Zm5 0v2h5v-2h-5Z" />,
    globe: <path d="M12 3a9 9 0 1 1 0 18 9 9 0 0 1 0-18Zm0 2a7 7 0 0 0-1.9 13.73c-.69-1.34-1.11-3.05-1.11-4.73H6.2A7.02 7.02 0 0 0 12 19Zm0-2c.77 0 1.86 1.3 2.48 3H9.52C10.14 4.3 11.23 3 12 3Zm3.11 5A15.3 15.3 0 0 1 15.8 12H8.2c.08-1.44.31-2.79.69-4h6.22ZM17.8 14h-2.8c0 1.68-.42 3.39-1.11 4.73A7.02 7.02 0 0 0 17.8 14Zm-4.37 0h-2.86c.3 1.93.95 3.43 1.43 3.88.48-.45 1.13-1.95 1.43-3.88Zm-.01-10c.7 1.35 1.12 3.06 1.12 4.74h2.8A7.02 7.02 0 0 0 13.42 4ZM6.2 10h2.8c0-1.68.42-3.39 1.12-4.74A7.02 7.02 0 0 0 6.2 10Z" />,
    group: <path d="M9 11a3 3 0 1 1 0-6 3 3 0 0 1 0 6Zm6 1a2.5 2.5 0 1 1 0-5 2.5 2.5 0 0 1 0 5ZM4 19v-1c0-2.76 2.24-5 5-5s5 2.24 5 5v1H4Zm11-.2V18c0-1.45-.5-2.78-1.34-3.83A4.5 4.5 0 0 1 20 18v.8h-5Z" />,
    person: <path d="M12 12a4 4 0 1 1 0-8 4 4 0 0 1 0 8Zm-6 8c0-3.31 2.69-6 6-6s6 2.69 6 6H6Z" />,
  };

  return <svg viewBox="0 0 24 24" aria-hidden="true">{icons[type]}</svg>;
}

function ChevronIcon({ isOpen }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={`etr-chevron-icon ${isOpen ? 'is-open' : ''}`}>
      <path d="M8 4 16 12 8 20" />
    </svg>
  );
}

function getUserInitials(name) {
  if (!name) {
    return 'ES';
  }

  const parts = name
    .split(/\s+/)
    .map((part) => part.trim())
    .filter(Boolean)
    .slice(0, 2);

  return parts.map((part) => part[0].toUpperCase()).join('') || 'ES';
}

function getUserDisplayName(user) {
  if (!user) {
    return 'Executive Service Account';
  }

  const lastName = user.lastName || user.lastname || user.LastName || user.LASTNAME || '';
  const firstName = user.firstName || user.firstname || user.FirstName || user.FIRSTNAME || '';

  if (lastName && firstName) {
    return `${lastName}, ${firstName}`;
  }

  if (lastName) {
    return lastName;
  }

  if (firstName) {
    return firstName;
  }

  return user.username || 'Executive Service Account';
}

function getUserProfile(user) {
  return user?.profile || user?.Profile || 'ETRIS-DEMO';
}

function getUserDeadlineKey(user) {
  const rawIdentifier =
    user?.employeeNo
    || user?.employeeNumber
    || user?.EmployeeNo
    || user?.userId
    || user?.id
    || user?.username
    || 'guest';

  return String(rawIdentifier).trim().replace(/\s+/g, '-').toLowerCase();
}

function getLocalDateId(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
}

function formatDeadlineDate(date) {
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function formatReminderShortDate(date) {
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });
}

function toValidDate(value) {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value;
  }

  if (typeof value === 'string' || typeof value === 'number') {
    const date = new Date(value);

    if (!Number.isNaN(date.getTime())) {
      return date;
    }
  }

  return null;
}

function createLocalDate(year, monthIndex, day) {
  return new Date(year, monthIndex, day);
}

function getReimbursementDeadlineDate(reminder) {
  const explicitDate = toValidDate(reminder?.deadlineDate ?? reminder?.DeadlineDate);

  if (explicitDate) {
    return explicitDate;
  }

  const currentDate = new Date();
  const currentDay = currentDate.getDate();
  const reminderDay = Number(reminder?.reminderDay ?? reminder?.ReminderDay ?? reminder?.deadlineDay ?? reminder?.DeadlineDay);
  const reminderType = String(reminder?.reminderType ?? reminder?.ReminderType ?? reminder?.state ?? reminder?.State ?? '').toLowerCase();
  let deadlineDay = Number.isFinite(reminderDay) ? reminderDay : currentDay;

  if ((reminderType === 'warning' || reminderType === 'reminder') && Number.isFinite(reminderDay)) {
    deadlineDay = reminderDay === 5 ? 6 : reminderDay === 20 ? 21 : reminderDay;
  }

  return createLocalDate(currentDate.getFullYear(), currentDate.getMonth(), deadlineDay);
}

function createReimbursementAlertInfo({
  state,
  tone,
  deadlineDay,
  deadlineDate,
  title,
  notificationMessage,
  badge,
}) {
  return {
    state,
    tone,
    deadlineDay,
    deadlineDate,
    title,
    notificationMessage,
    emailBody: notificationMessage,
    message: notificationMessage,
    badge,
  };
}

function calculateReimbursementDeadline(today = new Date()) {
  const currentDate = createLocalDate(today.getFullYear(), today.getMonth(), today.getDate());
  const currentDay = currentDate.getDate();
  const isAfterNotificationCutoff = today.getHours() >= REIMBURSEMENT_NOTIFICATION_CUTOFF_HOUR;

  if (isAfterNotificationCutoff) {
    return null;
  }

  const currentYear = currentDate.getFullYear();
  const currentMonth = currentDate.getMonth();
  const isDeadlineToday = REIMBURSEMENT_DEADLINE_DAYS.includes(currentDay);
  const isReminderDay = REIMBURSEMENT_REMINDER_DAYS.includes(currentDay);

  if (!isDeadlineToday && !isReminderDay) {
    return null;
  }

  const upcomingDeadlineDay = REIMBURSEMENT_DEADLINE_DAYS.find((deadlineDay) => currentDay <= deadlineDay);
  const deadlineDate = upcomingDeadlineDay
    ? createLocalDate(currentYear, currentMonth, upcomingDeadlineDay)
    : createLocalDate(currentYear, currentMonth + 1, REIMBURSEMENT_DEADLINE_DAYS[0]);
  const deadlineDay = deadlineDate.getDate();

  if (isDeadlineToday) {
    const notificationMessage = `Urgent: Reimbursement submission deadline is today (${formatReminderShortDate(currentDate)}).`;

    return createReimbursementAlertInfo({
      state: 'deadline',
      tone: 'red',
      deadlineDay: currentDay,
      deadlineDate: currentDate,
      title: 'Reimbursement deadline today',
      notificationMessage,
      badge: 'Deadline today',
    });
  }

  if (isReminderDay) {
    const notificationMessage = `Reminder: Reimbursement submission deadline is tomorrow (${formatReminderShortDate(deadlineDate)}).`;

    return createReimbursementAlertInfo({
      state: 'reminder',
      tone: 'yellow',
      deadlineDay,
      deadlineDate,
      title: 'Reimbursement reminder',
      notificationMessage,
      badge: 'Due tomorrow',
    });
  }

  return null;
}

function getReimbursementLoginData(user) {
  return user?.reimbursementNotification
    ?? user?.ReimbursementNotification
    ?? user?.reimbursementDeadline
    ?? user?.ReimbursementDeadline
    ?? user?.reimbursementStatus
    ?? user?.ReimbursementStatus
    ?? null;
}

function getBooleanField(source, fieldNames) {
  if (!source || typeof source !== 'object') {
    return null;
  }

  for (const fieldName of fieldNames) {
    if (source[fieldName] === true || source[fieldName] === 'true' || source[fieldName] === 1 || source[fieldName] === '1') {
      return true;
    }

    if (source[fieldName] === false || source[fieldName] === 'false' || source[fieldName] === 0 || source[fieldName] === '0') {
      return false;
    }
  }

  return null;
}

function isReimbursementSubmittedFromLogin(user) {
  const reimbursementData = getReimbursementLoginData(user);
  const source = reimbursementData && typeof reimbursementData === 'object' ? reimbursementData : user;

  return getBooleanField(source, [
    'submitted',
    'Submitted',
    'isSubmitted',
    'IsSubmitted',
    'isReimbursementSubmitted',
    'IsReimbursementSubmitted',
    'reimbursementSubmitted',
    'ReimbursementSubmitted',
    'hasSubmittedReimbursement',
    'HasSubmittedReimbursement',
  ]);
}

function DeadlineNotificationIcon({ state }) {
  if (state === 'submitted') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M9.2 16.6 4.9 12.3l1.4-1.4 2.9 2.9 8.5-8.5 1.4 1.4-9.9 9.9Z" />
      </svg>
    );
  }

  if (state === 'deadline') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M12 2 22 20H2L12 2Zm0 4.2L5.4 18h13.2L12 6.2ZM11 10h2v4h-2v-4Zm0 5h2v2h-2v-2Z" />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 22a2.6 2.6 0 0 0 2.45-1.75h-4.9A2.6 2.6 0 0 0 12 22Zm7-5V11a7 7 0 0 0-5-6.7V3a2 2 0 1 0-4 0v1.3A7 7 0 0 0 5 11v6l-2 2v1h18v-1l-2-2Zm-2 1H7v-7a5 5 0 0 1 10 0v7Z" />
    </svg>
  );
}

function ReimbursementDeadlineAlert({ user }) {
  const loginReminder = getReimbursementLoginData(user);
  const deadlineInfo = useMemo(() => {
    if (loginReminder && typeof loginReminder === 'object' && loginReminder.showNotification !== false) {
      return loginReminder;
    }

    return null;
  }, [loginReminder]);
  const storageKey = useMemo(() => {
    if (!deadlineInfo) {
      return '';
    }

    const userKey = getUserDeadlineKey(user);
    const deadlineId = getLocalDateId(getReimbursementDeadlineDate(deadlineInfo));

    return `etr-reimbursement-submitted:${userKey}:${deadlineId}`;
  }, [deadlineInfo, user]);
  const [isSubmitted, setIsSubmitted] = useState(() => window.localStorage.getItem(storageKey) === 'true');
  const [isDismissed, setIsDismissed] = useState(false);

  useEffect(() => {
    if (!storageKey) {
      return;
    }

    setIsSubmitted(window.localStorage.getItem(storageKey) === 'true');
    setIsDismissed(false);
  }, [storageKey]);

  const handleDismiss = () => {
    setIsDismissed(true);
  };

  if (!deadlineInfo) {
    return null;
  }

  const loginSubmittedStatus = isReimbursementSubmittedFromLogin(user);
  const hasSubmitted = loginSubmittedStatus ?? isSubmitted;
  const resolvedDeadlineDate = getReimbursementDeadlineDate(deadlineInfo);
  const submittedMessage = `Submission is marked complete for the ${formatDeadlineDate(resolvedDeadlineDate)} deadline.`;
  const alertInfo = hasSubmitted
    ? {
      ...deadlineInfo,
      state: 'submitted',
      tone: 'green',
      title: 'Reimbursement already submitted',
      notificationMessage: submittedMessage,
      emailBody: submittedMessage,
      message: submittedMessage,
      badge: 'Submitted',
    }
    : deadlineInfo;

  if (!alertInfo || isDismissed) {
    return null;
  }

  return (
    <div className="etr-reimbursement-alert-wrap">
      <section className={`etr-reimbursement-alert etr-tone-${alertInfo.tone}`} role="status" aria-live="polite">
        <div className="etr-reimbursement-alert-icon">
          <DeadlineNotificationIcon state={alertInfo.state} />
        </div>

        <div className="etr-reimbursement-alert-copy">
          <strong>{alertInfo.title}</strong>
          <p>{alertInfo.notificationMessage}</p>
        </div>

        <button type="button" className="etr-reimbursement-close-button" onClick={handleDismiss} aria-label="Dismiss reimbursement notification">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="m6.4 5 12.6 12.6-1.4 1.4L5 6.4 6.4 5Zm11.2 0L19 6.4 6.4 19 5 17.6 17.6 5Z" />
          </svg>
        </button>
      </section>
    </div>
  );
}

function DashboardContent({ activeItemId, user, selectedExpense, onNavigate, onOpenExpense, onBackToManager }) {
  if (activeItemId === 'daily-expense-manager') {
    return (
      <DailyExpenseManager
        user={user}
        onNewEntry={() => {
          onOpenExpense(null);
          onNavigate('expense-entry');
        }}
        onOpenExpense={(expense) => {
          onOpenExpense(expense);
          onNavigate('expense-entry');
        }}
      />
    );
  }

  if (activeItemId === 'expense-entry') {
    return <ExpenseEntryView user={user} selectedExpense={selectedExpense} onBack={onBackToManager} />;
  }

  if (activeItemId === 'journal-manager') {
    return <JournalEntryManagerView user={user} onNewEntry={() => onNavigate('journal-entry')} />;
  }

  if (activeItemId === 'journal-entry') {
    return <JournalEntryView user={user} />;
  }

  if (activeItemId === 'withdrawal-entry') {
    return <WithdrawalEntry />;
  }

  if (activeItemId === 'purchase-order') {
    return <PurchaseOrder />;
  }

  return (
    <div className="etr-dashboard-empty-state">
      <p className="etr-expense-kicker">Module Workspace</p>
      <h1>Select a transaction from the sidebar</h1>
      <span>Finance Expense Entry is ready with the DailyExpense table.</span>
    </div>
  );
}

function DashboardNode({ item, level, openItems, activeItemId, onToggle, onSelect }) {
  const hasChildren = Array.isArray(item.children) && item.children.length > 0;
  const isOpen = !!openItems[item.id];
  const isActive = activeItemId === item.id;

  return (
    <li className={`etr-dashboard-node level-${level}`}>
      <button
        type="button"
        className={`etr-dashboard-child-button ${hasChildren ? 'has-children' : 'is-leaf'} ${isOpen ? 'is-open' : ''} ${isActive ? 'is-active' : ''}`}
        onClick={() => (hasChildren ? onToggle(item.id) : onSelect(item.id))}
      >
        <span className="etr-dashboard-item-main">
          <span className="etr-dashboard-item-icon">
            <SidebarIcon type={item.icon} />
          </span>
          <span>{item.label}</span>
        </span>

        {hasChildren ? (
          <span className="etr-dashboard-item-arrow" aria-hidden="true">
            <ChevronIcon isOpen={isOpen} />
          </span>
        ) : null}
      </button>

      {hasChildren && isOpen ? (
        <ul className="etr-dashboard-child-list nested">
          {item.children.map((child) => (
            <DashboardNode
              key={child.id}
              item={child}
              level={level + 1}
              openItems={openItems}
              activeItemId={activeItemId}
              onToggle={onToggle}
              onSelect={onSelect}
            />
          ))}
        </ul>
      ) : null}
    </li>
  );
}

function DashboardPage({ user, onLogout }) {
  const navigate = useNavigate();
  const { moduleId = '' } = useParams();
  const filteredSidebarSections = useMemo(() => filterSidebarSectionsByAccess(sidebarSections, user), [user]);
  const [sidebarWidth, setSidebarWidth] = useState(398);
  const [isSidebarDrawerOpen, setIsSidebarDrawerOpen] = useState(false);
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
  const [selectedExpense, setSelectedExpense] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [openSections, setOpenSections] = useState(() => getClosedSidebarState(filteredSidebarSections));
  const dragStateRef = useRef({
    isDragging: false,
    startX: 0,
    startWidth: 398,
  });
  const searchBlurTimeoutRef = useRef(null);
  const profileMenuRef = useRef(null);
  const activeItemId = moduleId;
  const displayName = getUserDisplayName(user);
  const userInitials = getUserInitials(displayName);
  const activeProfile = getUserProfile(user);
  const searchIndex = useMemo(() => buildSearchIndex(filteredSidebarSections), [filteredSidebarSections]);
  const trimmedSearchQuery = searchQuery.trim().toLowerCase();
  const searchResults = useMemo(() => {
    if (!trimmedSearchQuery) {
      return [];
    }

    return searchIndex
      .filter((entry) => entry.keywords.includes(trimmedSearchQuery))
      .sort((first, second) => {
        const firstStartsWith = first.label.toLowerCase().startsWith(trimmedSearchQuery) ? 0 : 1;
        const secondStartsWith = second.label.toLowerCase().startsWith(trimmedSearchQuery) ? 0 : 1;

        return firstStartsWith - secondStartsWith || first.path.localeCompare(second.path);
      })
      .slice(0, 8);
  }, [searchIndex, trimmedSearchQuery]);

  const toggleSection = (sectionId) => {
    setOpenSections((current) => ({
      ...current,
      [sectionId]: !current[sectionId],
    }));
  };

  const navigateToModule = (itemId) => {
    if (itemId !== 'expense-entry') {
      setSelectedExpense(null);
    }

    setIsSidebarDrawerOpen(false);
    navigate(itemId ? `/dashboard/${itemId}` : '/dashboard');
  };

  useEffect(() => {
    setOpenSections(getClosedSidebarState(filteredSidebarSections));
  }, [filteredSidebarSections]);

  useEffect(() => {
    if (!activeItemId) {
      return;
    }

    const hasVisibleActiveItem = searchIndex.some((entry) => entry.id === activeItemId && entry.isSelectable);

    if (!hasVisibleActiveItem) {
      navigate('/dashboard', { replace: true });
    }
  }, [activeItemId, navigate, searchIndex]);

  useEffect(() => {
    if (!activeItemId) {
      return;
    }

    const activeEntry = searchIndex.find((entry) => entry.id === activeItemId);

    if (!activeEntry) {
      return;
    }

    setOpenSections((current) => {
      const nextOpenSections = { ...current, [activeEntry.sectionId]: true };

      activeEntry.parentIds.forEach((parentId) => {
        nextOpenSections[parentId] = true;
      });

      return nextOpenSections;
    });
  }, [activeItemId, searchIndex]);

  useEffect(() => {
    const handlePointerMove = (event) => {
      if (!dragStateRef.current.isDragging) {
        return;
      }

      const deltaX = event.clientX - dragStateRef.current.startX;
      const nextWidth = dragStateRef.current.startWidth + deltaX;
      setSidebarWidth(Math.max(0, Math.min(520, nextWidth)));
    };

    const handlePointerUp = () => {
      if (!dragStateRef.current.isDragging) {
        return;
      }

      dragStateRef.current.isDragging = false;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);

    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    };
  }, []);

  useEffect(() => () => {
    if (searchBlurTimeoutRef.current) {
      window.clearTimeout(searchBlurTimeoutRef.current);
    }
  }, []);

  useEffect(() => {
    const handlePointerDown = (event) => {
      if (!profileMenuRef.current || profileMenuRef.current.contains(event.target)) {
        return;
      }

      setIsProfileMenuOpen(false);
    };

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        setIsProfileMenuOpen(false);
      }
    };

    window.addEventListener('pointerdown', handlePointerDown);
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('pointerdown', handlePointerDown);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  const handleResizeStart = (event) => {
    if (window.matchMedia('(max-width: 900px)').matches) {
      return;
    }

    dragStateRef.current = {
      isDragging: true,
      startX: event.clientX,
      startWidth: sidebarWidth,
    };

    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  };

  const handleShowSidebar = () => {
    if (window.matchMedia('(max-width: 900px)').matches) {
      setSidebarWidth((currentWidth) => (currentWidth > 0 ? currentWidth : 398));
      setIsSidebarDrawerOpen((isOpen) => !isOpen);
      return;
    }

    setSidebarWidth(sidebarWidth > 0 ? 0 : 398);
  };

  const handleSelectSearchResult = (entry) => {
    setOpenSections((current) => {
      const nextOpenSections = { ...current, [entry.sectionId]: true };

      entry.parentIds.forEach((parentId) => {
        nextOpenSections[parentId] = true;
      });

      if (!entry.isSelectable) {
        nextOpenSections[entry.id] = true;
      }

      return nextOpenSections;
    });

    if (entry.isSelectable) {
      navigateToModule(entry.id);
    } else if (window.matchMedia('(max-width: 900px)').matches) {
      setIsSidebarDrawerOpen(true);
    }

    if (sidebarWidth <= 0) {
      setSidebarWidth(398);
    }

    setSearchQuery('');
    setIsSearchOpen(false);
  };

  const handleSearchKeyDown = (event) => {
    if (event.key === 'Enter' && searchResults.length > 0) {
      event.preventDefault();
      handleSelectSearchResult(searchResults[0]);
    }

    if (event.key === 'Escape') {
      setSearchQuery('');
      setIsSearchOpen(false);
    }
  };

  const handleSearchBlur = () => {
    searchBlurTimeoutRef.current = window.setTimeout(() => {
      setIsSearchOpen(false);
    }, 120);
  };

  const handleSearchFocus = () => {
    if (searchBlurTimeoutRef.current) {
      window.clearTimeout(searchBlurTimeoutRef.current);
    }

    setIsSearchOpen(true);
  };

  return (
    <main className="etr-dashboard-page">
      <header className="etr-dashboard-topbar">
        <button
          type="button"
          className="etr-dashboard-menu-button"
          onClick={handleShowSidebar}
          aria-label="Toggle sidebar"
          aria-expanded={isSidebarDrawerOpen || sidebarWidth > 0}
        >
          <span />
          <span />
          <span />
        </button>

        <div className="etr-dashboard-brand">ETR INTEGRATED SYSTEM</div>

        <div className="etr-dashboard-search" role="search">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M10 4a6 6 0 1 1 0 12 6 6 0 0 1 0-12Zm0-2a8 8 0 1 0 4.9 14.3l4.4 4.4 1.4-1.4-4.4-4.4A8 8 0 0 0 10 2Z" />
          </svg>
          <input
            type="text"
            value={searchQuery}
            onChange={(event) => {
              setSearchQuery(event.target.value);
              setIsSearchOpen(true);
            }}
            onFocus={handleSearchFocus}
            onBlur={handleSearchBlur}
            onKeyDown={handleSearchKeyDown}
            placeholder="Search module, document, or transaction"
            aria-expanded={isSearchOpen && !!trimmedSearchQuery}
            aria-controls="etr-dashboard-search-results"
          />

          {isSearchOpen && trimmedSearchQuery ? (
            <div className="etr-dashboard-search-results" id="etr-dashboard-search-results">
              {searchResults.length > 0 ? searchResults.map((entry) => (
                <button
                  type="button"
                  key={entry.path}
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => handleSelectSearchResult(entry)}
                >
                  <strong>{entry.label}</strong>
                  <span>{entry.path}</span>
                </button>
              )) : (
                <div className="etr-dashboard-search-empty">No matching modules found.</div>
              )}
            </div>
          ) : null}
        </div>

        <div className="etr-dashboard-profile" ref={profileMenuRef}>
          <button
            type="button"
            className="etr-dashboard-profile-button"
            onClick={() => setIsProfileMenuOpen((isOpen) => !isOpen)}
            aria-label="Open profile menu"
            aria-expanded={isProfileMenuOpen}
          >
            <span className="etr-dashboard-avatar">{userInitials}</span>
          </button>

          {isProfileMenuOpen ? (
            <div className="etr-dashboard-profile-menu" role="menu">
              <div className="etr-dashboard-profile-summary">
                <span className="etr-dashboard-avatar">{userInitials}</span>
                <div className="etr-dashboard-account">
                  <strong>{displayName}</strong>
                  <span>{activeProfile}</span>
                </div>
              </div>

              <button
                type="button"
                className="etr-dashboard-logout"
                onClick={() => {
                  setIsProfileMenuOpen(false);
                  onLogout();
                }}
                role="menuitem"
              >
                Logout
              </button>
            </div>
          ) : null}
        </div>
      </header>

      <ReimbursementDeadlineAlert user={user} />

      <div className="etr-dashboard-shell" style={{ gridTemplateColumns: `${sidebarWidth}px 9px 1fr` }}>
        <button
          type="button"
          className={`etr-dashboard-sidebar-scrim ${isSidebarDrawerOpen ? 'is-visible' : ''}`}
          onClick={() => setIsSidebarDrawerOpen(false)}
          aria-label="Close sidebar"
        />

        <aside className={`etr-dashboard-sidebar ${sidebarWidth <= 0 ? 'is-collapsed' : ''} ${isSidebarDrawerOpen ? 'is-drawer-open' : ''}`}>
          {filteredSidebarSections.map((section) => {
            const isOpen = !!openSections[section.id];

            return (
              <section key={section.id} className="etr-dashboard-section">
                <button
                  type="button"
                  className={`etr-dashboard-section-toggle etr-dashboard-top-category ${isOpen ? 'is-open' : ''}`}
                  onClick={() => toggleSection(section.id)}
                >
                  <span>{section.title}</span>
                  <span className="etr-dashboard-item-arrow" aria-hidden="true">
                    <ChevronIcon isOpen={isOpen} />
                  </span>
                </button>

                {isOpen ? (
                  <ul className="etr-dashboard-child-list">
                    {section.children.map((item) => (
                      <DashboardNode
                        key={item.id}
                        item={item}
                        level={1}
                        openItems={openSections}
                        activeItemId={activeItemId}
                        onToggle={toggleSection}
                        onSelect={navigateToModule}
                      />
                    ))}
                  </ul>
                ) : null}
              </section>
            );
          })}
        </aside>

        <button
          type="button"
          className="etr-dashboard-resizer"
          onPointerDown={handleResizeStart}
          aria-label="Resize sidebar"
        />

        <section className="etr-dashboard-main">
          <div className="etr-dashboard-canvas">
            <div className="etr-dashboard-content">
              <DashboardContent
                activeItemId={activeItemId}
                user={user}
                selectedExpense={selectedExpense}
                onNavigate={navigateToModule}
                onOpenExpense={setSelectedExpense}
                onBackToManager={() => {
                  setSelectedExpense(null);
                  navigateToModule('daily-expense-manager');
                }}
              />
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}

export default DashboardPage;
