// i18n: Hinglish-first. Real Indian shopkeeper speak.
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type Locale = 'hi' | 'en' | 'hinglish';

export const LOCALES: { code: Locale; label: string; flag: string }[] = [
  { code: 'hinglish', label: 'Hinglish', flag: 'IN' },
  { code: 'hi', label: 'Hindi', flag: 'IN' },
  { code: 'en', label: 'English', flag: 'GB' },
];

type Dict = Record<string, string>;

const en: Dict = {
  'app.name': 'MerchantOS', 'app.tagline': 'Your shop, in your pocket',
  'common.save': 'Save', 'common.cancel': 'Cancel', 'common.delete': 'Delete', 'common.edit': 'Edit',
  'common.search': 'Search', 'common.loading': 'Loading...', 'common.empty': 'Nothing here yet',
  'common.error': 'Something went wrong', 'common.retry': 'Try again', 'common.close': 'Close',
  'common.confirm': 'Confirm', 'common.back': 'Back', 'common.next': 'Next', 'common.done': 'Done',
  'common.add': 'Add', 'common.update': 'Update', 'common.share': 'Share', 'common.download': 'Download',
  'common.print': 'Print', 'common.amount': 'Amount', 'common.note': 'Note', 'common.date': 'Date',
  'common.name': 'Name', 'common.phone': 'Phone', 'common.balance': 'Balance', 'common.total': 'Total',
  'common.cash': 'Cash', 'common.upi': 'UPI', 'common.card': 'Card', 'common.credit': 'Credit', 'common.debit': 'Debit',
  'nav.dashboard': 'Dashboard', 'nav.pos': 'Quick Sale', 'nav.bills': 'Bills', 'nav.khata': 'Khata',
  'nav.customers': 'Customers', 'nav.suppliers': 'Suppliers', 'nav.products': 'Products',
  'nav.expenses': 'Expenses', 'nav.shifts': 'Shifts', 'nav.reports': 'Reports',
  'nav.transactions': 'Transactions', 'nav.settings': 'Settings', 'nav.accept_payment': 'Accept Payment',
  'auth.welcome': 'Welcome back', 'auth.signin': 'Sign in to your shop',
  'auth.email': 'Email or phone', 'auth.password': 'Password', 'auth.signin.btn': 'Sign in', 'auth.signout': 'Sign out',
  'dash.today_sales': "Today's Sales", 'dash.today_bills': "Today's Bills", 'dash.outstanding': 'Outstanding Udhar',
  'dash.top_products': 'Top Selling Products', 'dash.recent_activity': 'Recent Activity',
  'dash.open_shift': 'Open Shift', 'dash.no_shift': 'Open a shift to start billing',
  'pos.title': 'New Sale', 'pos.add_items': 'Add items', 'pos.scan_barcode': 'Scan barcode',
  'pos.search_item': 'Search item', 'pos.quantity': 'Quantity', 'pos.discount': 'Discount',
  'pos.subtotal': 'Subtotal', 'pos.take_payment': 'Take Payment', 'pos.mark_udhar': 'Mark as Udhar',
  'pos.print_bill': 'Print Bill', 'pos.share_whatsapp': 'Share on WhatsApp',
  'pos.split_payment': 'Split Payment', 'pos.amount_collected': 'Amount Collected', 'pos.balance_due': 'Balance Due',
  'khata.title': 'Khata Book', 'khata.add_entry': 'Add Entry', 'khata.udhar': 'Udhar (Credit)',
  'khata.paasa': 'Paasa (Payment)', 'khata.history': 'Transaction History',
  'khata.send_reminder': 'Send Reminder', 'khata.share_whatsapp': 'Share on WhatsApp',
  'khata.full_ledger': 'Full Ledger', 'khata.outstanding': 'Outstanding', 'khata.bulk_pay': 'Bulk Payment',
  'bills.title': 'All Bills', 'bills.new_bill': 'New Bill', 'bills.bill_no': 'Bill #',
  'bills.customer': 'Customer', 'bills.items': 'Items', 'bills.share': 'Share Bill', 'bills.download_pdf': 'Download PDF',
  'products.title': 'Products', 'products.add': 'Add Product', 'products.stock': 'Stock',
  'products.low_stock': 'Low Stock', 'products.out_of_stock': 'Out of Stock',
  'products.price': 'Price', 'products.cost': 'Cost', 'products.sku': 'SKU',
  'products.category': 'Category', 'products.barcode': 'Barcode', 'products.restock': 'Restock',
  'expenses.title': 'Expenses', 'expenses.add': 'Add Expense', 'expenses.category': 'Category',
  'shifts.title': 'Shifts', 'shifts.open': 'Open Shift', 'shifts.close': 'Close Shift',
  'shifts.opening_cash': 'Opening Cash', 'shifts.closing_cash': 'Closing Cash',
  'shifts.started': 'Started', 'shifts.ended': 'Ended', 'shifts.duration': 'Duration',
  'shifts.cash_sales': 'Cash Sales', 'shifts.expected_cash': 'Expected in Drawer',
  'shifts.actual_cash': 'Actual Counted', 'shifts.difference': 'Difference',
  'reports.title': 'Reports', 'reports.today': 'Today', 'reports.week': 'This Week',
  'reports.month': 'This Month', 'reports.sales': 'Sales', 'reports.profit': 'Profit',
  'reports.expenses': 'Expenses', 'reports.top_products': 'Top Products', 'reports.outstanding': 'Outstanding',
  'wa.reminder_title': 'Payment Reminder', 'wa.bill_title': 'Bill', 'wa.statement_title': 'Account Statement', 'wa.thanks': 'Thank you!',
  'settings.title': 'Settings', 'settings.shop_name': 'Shop Name', 'settings.owner_name': 'Owner Name',
  'settings.phone': 'Phone', 'settings.address': 'Address', 'settings.upi_id': 'UPI ID (for receiving payments)',
  'settings.language': 'Language', 'settings.gst': 'GST Number', 'settings.notifications': 'Notifications', 'settings.backup': 'Backup & Restore',
  'suppliers.title': 'Suppliers', 'suppliers.add': 'Add Supplier',
  'toast.saved': 'Saved', 'toast.deleted': 'Deleted', 'toast.updated': 'Updated',
  'toast.error': 'Something went wrong', 'toast.no_internet': 'No internet - changes will sync when online', 'toast.synced': 'Synced',
  'greeting.morning': 'Good morning', 'greeting.afternoon': 'Good afternoon',
  'greeting.evening': 'Good evening', 'greeting.night': 'Good night',
};

const hi: Dict = {
  'app.name': 'MerchantOS', 'app.tagline': 'Aapki dukaan, aapki jeb mein',
  'common.save': 'Save karein', 'common.cancel': 'Radd karein', 'common.delete': 'Hataayein', 'common.edit': 'Badlein',
  'common.search': 'Khojein', 'common.loading': 'Load ho raha hai...', 'common.empty': 'Abhi kuch nahi hai',
  'common.error': 'Kuch gadbad ho gayi', 'common.retry': 'Dobara koshish karein', 'common.close': 'Band karein',
  'common.confirm': 'Pakka karein', 'common.back': 'Wapas', 'common.next': 'Aage', 'common.done': 'Ho gaya',
  'common.add': 'Jodein', 'common.update': 'Update karein', 'common.share': 'Share karein', 'common.download': 'Download karein',
  'common.print': 'Print karein', 'common.amount': 'Rakam', 'common.note': 'Note', 'common.date': 'Tareekh',
  'common.name': 'Naam', 'common.phone': 'Phone', 'common.balance': 'Baakiya', 'common.total': 'Kul',
  'common.cash': 'Cash', 'common.upi': 'UPI', 'common.card': 'Card', 'common.credit': 'Udhar', 'common.debit': 'Paasa',
  'nav.dashboard': 'Dashboard', 'nav.pos': 'Jaldi Sale', 'nav.bills': 'Bills', 'nav.khata': 'Khata',
  'nav.customers': 'Grahak', 'nav.suppliers': 'Suppliers', 'nav.products': 'Samaan',
  'nav.expenses': 'Kharche', 'nav.shifts': 'Shifts', 'nav.reports': 'Reports',
  'nav.transactions': 'Lenden', 'nav.settings': 'Settings', 'nav.accept_payment': 'Payment lein',
  'auth.welcome': 'Wapas swagat hai', 'auth.signin': 'Apni dukaan mein sign in karein',
  'auth.email': 'Email ya phone', 'auth.password': 'Password', 'auth.signin.btn': 'Sign in', 'auth.signout': 'Sign out',
  'dash.today_sales': 'Aaj ki Bikri', 'dash.today_bills': 'Aaj ke Bills', 'dash.outstanding': 'Baakiya Udhar',
  'dash.top_products': 'Sabse zyada bikne wala', 'dash.recent_activity': 'Haal ki halchal',
  'dash.open_shift': 'Shift shuru karein', 'dash.no_shift': 'Bill banane ke liye pehle shift shuru karein',
  'pos.title': 'Nai Sale', 'pos.add_items': 'Samaan jodein', 'pos.scan_barcode': 'Barcode scan',
  'pos.search_item': 'Samaan khojein', 'pos.quantity': 'Maatra', 'pos.discount': 'Discount',
  'pos.subtotal': 'Up-yog', 'pos.take_payment': 'Payment lein', 'pos.mark_udhar': 'Udhar mein daalein',
  'pos.print_bill': 'Bill print karein', 'pos.share_whatsapp': 'WhatsApp pe bhejein',
  'pos.split_payment': 'Aadha cash, aadha udhar', 'pos.amount_collected': 'Kitna mila', 'pos.balance_due': 'Kitna baakiya',
  'khata.title': 'Khata Bahi', 'khata.add_entry': 'Nai entry', 'khata.udhar': 'Udhar (Credit)',
  'khata.paasa': 'Paasa (Payment)', 'khata.history': 'Lenden ki history',
  'khata.send_reminder': 'Reminder bhejein', 'khata.share_whatsapp': 'WhatsApp pe bhejein',
  'khata.full_ledger': 'Puri bahi', 'khata.outstanding': 'Baakiya', 'khata.bulk_pay': 'Ek saath jama',
  'bills.title': 'Saare Bills', 'bills.new_bill': 'Naya Bill', 'bills.bill_no': 'Bill #',
  'bills.customer': 'Grahak', 'bills.items': 'Samaan', 'bills.share': 'Bill bhejein', 'bills.download_pdf': 'PDF download',
  'products.title': 'Samaan', 'products.add': 'Samaan jodein', 'products.stock': 'Stock',
  'products.low_stock': 'Stock kam', 'products.out_of_stock': 'Stock khatam',
  'products.price': 'Kimat', 'products.cost': 'Lagaat', 'products.sku': 'Code',
  'products.category': 'Category', 'products.barcode': 'Barcode', 'products.restock': 'Stock bharein',
  'expenses.title': 'Kharche', 'expenses.add': 'Kharcha jodein', 'expenses.category': 'Category',
  'shifts.title': 'Shifts', 'shifts.open': 'Shift shuru', 'shifts.close': 'Shift band',
  'shifts.opening_cash': 'Shuru mein cash', 'shifts.closing_cash': 'Band karte waqt cash',
  'shifts.started': 'Kab shuru', 'shifts.ended': 'Kab khatam', 'shifts.duration': 'Kitni der',
  'shifts.cash_sales': 'Cash bikri', 'shifts.expected_cash': 'Drawer mein hona chahiye',
  'shifts.actual_cash': 'Gina hua', 'shifts.difference': 'Farak',
  'reports.title': 'Reports', 'reports.today': 'Aaj', 'reports.week': 'Is hafte',
  'reports.month': 'Is mahine', 'reports.sales': 'Bikri', 'reports.profit': 'Munafa',
  'reports.expenses': 'Kharche', 'reports.top_products': 'Top samaan', 'reports.outstanding': 'Baakiya',
  'wa.reminder_title': 'Payment yaad dilana', 'wa.bill_title': 'Bill', 'wa.statement_title': 'Khata Bahi', 'wa.thanks': 'Shukriya!',
  'settings.title': 'Settings', 'settings.shop_name': 'Dukaan ka naam', 'settings.owner_name': 'Maalik ka naam',
  'settings.phone': 'Phone', 'settings.address': 'Pata', 'settings.upi_id': 'UPI ID (payment lene ke liye)',
  'settings.language': 'Bhasha', 'settings.gst': 'GST Number', 'settings.notifications': 'Notifications', 'settings.backup': 'Backup & Restore',
  'suppliers.title': 'Suppliers', 'suppliers.add': 'Supplier jodein',
  'toast.saved': 'Save ho gaya', 'toast.deleted': 'Hata diya', 'toast.updated': 'Update ho gaya',
  'toast.error': 'Kuch gadbad ho gayi', 'toast.no_internet': 'Internet nahi - baad mein sync hoga', 'toast.synced': 'Sync ho gaya',
  'greeting.morning': 'Suprabhat', 'greeting.afternoon': 'Namaskar',
  'greeting.evening': 'Shubh sandhya', 'greeting.night': 'Shubh ratri',
};

const overrides: Record<string, string> = {
  'app.tagline': 'Aapki dukaan, aapki jeb mein',
  'common.search': 'Khojo...',
  'common.loading': 'Load ho raha hai...',
  'common.empty': 'Abhi kuch nahi hai yahan',
  'common.error': 'Kuch gadbad ho gayi',
  'common.add': 'Jodo',
  'common.save': 'Save karo',
  'common.close': 'Band karo',
  'common.done': 'Ho gaya',
  'common.back': 'Peeche',
  'common.confirm': 'Pakka',
  'common.amount': 'Kitna',
  'common.name': 'Naam',
  'common.balance': 'Bakiya',
  'common.total': 'Total',
  'common.credit': 'Udhar',
  'common.debit': 'Paasa',
  'nav.dashboard': 'Dashboard',
  'nav.pos': 'Bilkul Sale',
  'nav.khata': 'Khata Bahi',
  'nav.products': 'Samaan',
  'nav.expenses': 'Kharche',
  'nav.accept_payment': 'Payment Lo',
  'auth.signin': 'Apni dukaan mein ghuso',
  'auth.signin.btn': 'Sign in',
  'dash.today_sales': 'Aaj ki Bikri',
  'dash.today_bills': 'Aaj ke Bills',
  'dash.outstanding': 'Bakiya Udhar',
  'dash.open_shift': 'Shift Shuru Karo',
  'dash.no_shift': 'Bill banane ke liye pehle shift shuru karo',
  'pos.title': 'Nai Sale',
  'pos.add_items': 'Samaan jodo',
  'pos.search_item': 'Samaan khojo',
  'pos.quantity': 'Kitna',
  'pos.take_payment': 'Payment Lo',
  'pos.mark_udhar': 'Udhar mein dalo',
  'pos.share_whatsapp': 'WhatsApp pe bhejo',
  'pos.amount_collected': 'Kitna mila',
  'pos.balance_due': 'Kitna bakiya',
  'khata.title': 'Khata Bahi',
  'khata.add_entry': 'Nai Entry',
  'khata.udhar': 'Udhar',
  'khata.paasa': 'Paasa',
  'khata.send_reminder': 'Reminder bhejo',
  'khata.share_whatsapp': 'WhatsApp pe bhejo',
  'khata.outstanding': 'Bakiya',
  'khata.bulk_pay': 'Ek saath jama',
  'bills.title': 'Saare Bills',
  'bills.new_bill': 'Naya Bill',
  'bills.customer': 'Customer',
  'bills.share': 'Bill bhejo',
  'bills.download_pdf': 'PDF Download',
  'products.title': 'Samaan',
  'products.add': 'Samaan jodo',
  'products.stock': 'Stock',
  'products.low_stock': 'Stock kam hai',
  'products.out_of_stock': 'Stock khatam',
  'products.price': 'Kimat',
  'products.cost': 'Lagaat',
  'expenses.title': 'Kharche',
  'expenses.add': 'Kharcha jodo',
  'shifts.open': 'Shift Shuru',
  'shifts.close': 'Shift Band',
  'shifts.opening_cash': 'Shuru mein kitna cash',
  'shifts.closing_cash': 'Band karte waqt kitna cash',
  'shifts.cash_sales': 'Cash Bikri',
  'shifts.expected_cash': 'Drawer mein hona chahiye',
  'reports.title': 'Reports',
  'reports.today': 'Aaj',
  'reports.week': 'Is Hafte',
  'reports.month': 'Is Mahine',
  'reports.sales': 'Bikri',
  'reports.profit': 'Munafa',
  'reports.expenses': 'Kharche',
  'reports.outstanding': 'Bakiya',
  'settings.title': 'Settings',
  'settings.shop_name': 'Dukaan ka naam',
  'settings.upi_id': 'Aapka UPI ID',
  'settings.language': 'Bhasha',
  'settings.backup': 'Backup',
  'toast.saved': 'Save ho gaya',
  'toast.deleted': 'Hata diya',
  'toast.error': 'Kuch gadbad ho gayi',
  'toast.synced': 'Sync ho gaya',
};

const hinglish: Dict = Object.fromEntries(
  Object.entries(en).map(([k, v]) => [k, overrides[k] || v])
);

const dicts: Record<Locale, Dict> = { en, hi, hinglish };

interface I18nState { locale: Locale; setLocale: (l: Locale) => void; }

export const useI18n = create<I18nState>()(
  persist(
    (set) => ({
      locale: 'hinglish',
      setLocale: (locale) => set({ locale }),
    }),
    { name: 'merchantos.locale' }
  )
);

export function t(key: string, locale?: Locale): string {
  const l = locale || useI18n.getState().locale;
  return dicts[l]?.[key] || dicts.en[key] || key;
}

export function formatCurrency(amount: number | string, locale: Locale = 'en'): string {
  const n = typeof amount === 'string' ? parseFloat(amount) : amount;
  if (!Number.isFinite(n)) return '\u20B90';
  return new Intl.NumberFormat(locale === 'hi' ? 'hi-IN' : 'en-IN', {
    style: 'currency', currency: 'INR', maximumFractionDigits: n < 100 ? 2 : 0,
  }).format(n);
}

export function greeting(locale?: Locale): string {
  const l = locale || useI18n.getState().locale;
  const h = new Date().getHours();
  if (h < 12) return t('greeting.morning', l);
  if (h < 17) return t('greeting.afternoon', l);
  if (h < 21) return t('greeting.evening', l);
  return t('greeting.night', l);
}
