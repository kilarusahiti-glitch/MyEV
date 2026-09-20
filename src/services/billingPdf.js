const PAGE_WIDTH = 210;
const PAGE_HEIGHT = 297;
const MARGIN = 16;

function safeNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function money(value, currencyCode) {
  return `${currencyCode} ${new Intl.NumberFormat('en-IN', { maximumFractionDigits: 2 }).format(safeNumber(value))}`;
}

export async function createBillPdf(bill, organization, sourceLabel) {
  const { jsPDF } = await import('jspdf');
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const currencyCode = bill.tariff?.currencyCode || 'INR';
  const contentWidth = PAGE_WIDTH - MARGIN * 2;
  let y = 0;

  const ensureSpace = (height = 9) => {
    if (y + height > PAGE_HEIGHT - 18) {
      doc.addPage();
      y = MARGIN;
    }
  };

  const section = (title) => {
    ensureSpace(13);
    doc.setFillColor(15, 83, 45);
    doc.roundedRect(MARGIN, y, contentWidth, 8, 1.5, 1.5, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(255, 255, 255);
    doc.text(title.toUpperCase(), MARGIN + 3, y + 5.4);
    doc.setTextColor(35, 45, 40);
    y += 12;
  };

  const row = (label, value, options = {}) => {
    ensureSpace(8);
    doc.setFont('helvetica', options.bold ? 'bold' : 'normal');
    doc.setFontSize(options.size || 9);
    doc.setTextColor(...(options.color || [55, 65, 81]));
    doc.text(String(label), MARGIN + 2, y);
    doc.text(String(value), PAGE_WIDTH - MARGIN - 2, y, { align: 'right' });
    doc.setDrawColor(225, 231, 228);
    doc.line(MARGIN, y + 2, PAGE_WIDTH - MARGIN, y + 2);
    y += 7;
  };

  doc.setFillColor(15, 83, 45);
  doc.rect(0, 0, PAGE_WIDTH, 42, 'F');
  doc.setTextColor(220, 252, 231);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text('VOLT FLOW | ENERGY STATEMENT', MARGIN, 13);
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(18);
  doc.text('Electricity Bill', MARGIN, 24);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.text(`Billing period: ${bill.billingPeriod}`, MARGIN, 33);
  doc.text(`Generated: ${new Date().toLocaleString('en-IN')}`, PAGE_WIDTH - MARGIN, 33, { align: 'right' });

  y = 51;
  doc.setFillColor(240, 253, 244);
  doc.roundedRect(MARGIN, y, contentWidth, 31, 2, 2, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(22, 78, 48);
  doc.text(organization.name, MARGIN + 4, y + 7);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(55, 65, 81);
  doc.text(`${organization.facilityType} | ${organization.unitsLabel}`, MARGIN + 4, y + 13);
  doc.text(`Account: ${bill.accountNumber}    Meter: ${bill.meterNumber}`, MARGIN + 4, y + 19);
  doc.text(`Consumer: ${bill.consumerName}    Due date: ${bill.dueDate}`, MARGIN + 4, y + 25);
  y += 38;

  section('Consumption Summary');
  row('Total billed consumption', `${safeNumber(bill.totalConsumptionKwh).toLocaleString('en-IN')} kWh`, { bold: true });
  row('EV charging consumption', `${safeNumber(bill.evConsumptionKwh).toLocaleString('en-IN')} kWh`);
  row('Building and common-area consumption', `${Math.max(0, safeNumber(bill.totalConsumptionKwh) - safeNumber(bill.evConsumptionKwh)).toLocaleString('en-IN')} kWh`);
  row('Solar generation', `${safeNumber(bill.solarGenKwh).toLocaleString('en-IN')} kWh`);

  section('Itemized Charges');
  row('Building energy charges', money(bill.breakdown?.buildingConsumption, currencyCode));
  row('EV charging energy charges', money(bill.breakdown?.evCharging, currencyCode));
  row('Solar energy credit', money(bill.breakdown?.solarOffset, currencyCode), { color: [22, 101, 52] });
  row('Net energy charges', money(bill.energyCharges, currencyCode), { bold: true });
  row('Fixed charges', money(bill.fixedCharges, currencyCode));
  row('Demand charges', money(bill.demandCharges, currencyCode));
  row(`Electricity duty and taxes (${(safeNumber(bill.tariff?.taxRate) * 100).toFixed(1)}%)`, money(bill.taxes, currencyCode));
  ensureSpace(17);
  doc.setFillColor(15, 83, 45);
  doc.roundedRect(MARGIN, y, contentWidth, 13, 2, 2, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text('ESTIMATED TOTAL PAYABLE', MARGIN + 4, y + 8.5);
  doc.text(money(bill.estimatedBill, currencyCode), PAGE_WIDTH - MARGIN - 4, y + 8.5, { align: 'right' });
  y += 19;

  section('Configured Time-of-Use Tariff');
  row('Off-peak (22:00-08:00)', `${money(bill.tariff?.offPeakRate, currencyCode)} / kWh`);
  row('Mid-peak (08:00-17:00)', `${money(bill.tariff?.midPeakRate, currencyCode)} / kWh`);
  row('Peak (17:00-21:00)', `${money(bill.tariff?.peakRate, currencyCode)} / kWh`);

  section('Smart Charging Comparison');
  row('Estimated cost without smart charging', money(bill.comparison?.withoutSmartCharging, currencyCode));
  row('Estimated cost with smart charging', money(bill.comparison?.withSmartCharging, currencyCode));
  row('Estimated savings', `${money(bill.comparison?.estimatedSavings, currencyCode)} (${safeNumber(bill.comparison?.savingsPercent)}%)`, { bold: true, color: [22, 101, 52] });

  ensureSpace(20);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(100, 110, 105);
  const disclaimer = `Status: ${bill.paymentStatus}. ${sourceLabel}. This is an estimated simulation statement, not a utility-issued invoice.`;
  doc.text(doc.splitTextToSize(disclaimer, contentWidth), MARGIN, y + 2);

  const pageCount = doc.internal.getNumberOfPages();
  for (let page = 1; page <= pageCount; page += 1) {
    doc.setPage(page);
    doc.setDrawColor(205, 215, 209);
    doc.line(MARGIN, PAGE_HEIGHT - 12, PAGE_WIDTH - MARGIN, PAGE_HEIGHT - 12);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(120, 130, 124);
    doc.text(`${bill.accountNumber} | ${bill.billingPeriod}`, MARGIN, PAGE_HEIGHT - 7);
    doc.text(`Page ${page} of ${pageCount}`, PAGE_WIDTH - MARGIN, PAGE_HEIGHT - 7, { align: 'right' });
  }

  return doc;
}

export function billPdfFilename(bill) {
  const safePeriod = String(bill.billingPeriod || 'current-period').replace(/[^a-z0-9-]+/gi, '-');
  return `VoltFlow-electricity-bill-${safePeriod}.pdf`;
}
