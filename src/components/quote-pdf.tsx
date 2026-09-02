import React from 'react';
import { Document, Page, Text, View, StyleSheet, Image } from '@react-pdf/renderer';
import { LineItem, ShopSettings } from '@/types';

const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontSize: 10,
    fontFamily: 'Helvetica',
  },
  header: {
    marginBottom: 20,
    borderBottom: '2 solid #d7b73f',
    paddingBottom: 10,
  },
  logo: {
    width: 150,
    height: 'auto',
    marginBottom: 10,
  },
  companyName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#d7b73f',
    marginBottom: 5,
  },
  companyInfo: {
    fontSize: 9,
    color: '#666',
    marginBottom: 2,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    marginTop: 20,
    marginBottom: 10,
  },
  section: {
    marginBottom: 15,
  },
  label: {
    fontSize: 9,
    color: '#666',
    marginBottom: 3,
  },
  value: {
    fontSize: 11,
    marginBottom: 8,
  },
  table: {
    marginTop: 15,
    marginBottom: 15,
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#f0f0f0',
    padding: 8,
    fontWeight: 'bold',
    fontSize: 9,
    borderBottom: '1 solid #ccc',
  },
  tableRow: {
    flexDirection: 'row',
    padding: 8,
    borderBottom: '1 solid #eee',
  },
  col1: { width: '28%' },
  colPartNum: { width: '12%', fontSize: 8 },
  colCondition: { width: '10%', fontSize: 8 },
  col2: { width: '8%', textAlign: 'right' },
  col3: { width: '21%', textAlign: 'right' },
  col4: { width: '21%', textAlign: 'right' },
  summary: {
    marginTop: 20,
    marginLeft: 'auto',
    width: '50%',
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 5,
    fontSize: 10,
  },
  summaryTotal: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 8,
    marginTop: 5,
    backgroundColor: '#f0f0f0',
    fontWeight: 'bold',
    fontSize: 12,
  },
  footer: {
    position: 'absolute',
    bottom: 30,
    left: 40,
    right: 40,
    borderTop: '1 solid #ccc',
    paddingTop: 10,
    fontSize: 8,
    color: '#666',
  },
  terms: {
    marginTop: 20,
    padding: 10,
    backgroundColor: '#f9f9f9',
    fontSize: 8,
    color: '#666',
  },
});

type QuotePDFProps = {
  lineItems: LineItem[];
  settings?: ShopSettings;
  repairOrderId: string;
  customerName?: string;
  vehicleInfo?: string;
  vin?: string;
  licensePlate?: string;
  estimatedCompletion?: string;
  jobDescription?: string;
};

export const QuotePDF = ({ lineItems, settings, repairOrderId, customerName, vehicleInfo, vin, licensePlate, estimatedCompletion, jobDescription }: QuotePDFProps) => {
  // Calculate totals
  const subtotal = lineItems.reduce((sum, item) => {
    const partsTotal = (item.parts_price * item.quantity);
    const laborTotal = item.labor_price;
    return sum + partsTotal + laborTotal;
  }, 0);

  // Only sum parts prices for taxable items — labor is never subject to sales tax
  const taxableSubtotal = lineItems.reduce((sum, item) => {
    if ((item as any).taxable === false) return sum;
    const partsTotal = (item.parts_price * item.quantity);
    return sum + partsTotal;
  }, 0);

  const taxRate = settings?.tax?.enabled ? settings.tax.rate : 0;
  const taxAmount = taxableSubtotal * (taxRate / 100);
  const total = subtotal + taxAmount;

  const today = new Date().toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  const validUntil = new Date();
  validUntil.setDate(validUntil.getDate() + (settings?.quote_settings?.valid_days || 30));
  const validUntilStr = validUntil.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          <Image
            src={`${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3001'}/logo.png`}
            style={styles.logo}
          />
          {settings?.company_info?.address && (
            <Text style={styles.companyInfo}>{settings.company_info.address}</Text>
          )}
          {settings?.company_info?.phone && (
            <Text style={styles.companyInfo}>Phone: {settings.company_info.phone}</Text>
          )}
          {settings?.company_info?.email && (
            <Text style={styles.companyInfo}>Email: {settings.company_info.email}</Text>
          )}
        </View>

        {/* RO # small top-left + title row */}
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 4 }}>
          <Text style={styles.title}>REPAIR ESTIMATE</Text>
          <Text style={{ fontSize: 8, color: '#999' }}>RO# {repairOrderId.slice(0, 8)}</Text>
        </View>

        {/* Dates row: Quote Date left, Valid Until right */}
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 }}>
          <View>
            <Text style={styles.label}>Quote Date:</Text>
            <Text style={{ fontSize: 10 }}>{today}</Text>
          </View>
          <View style={{ textAlign: 'right' }}>
            <Text style={styles.label}>Valid Until:</Text>
            <Text style={{ fontSize: 10 }}>{validUntilStr}</Text>
          </View>
        </View>

        {/* Info: two-column layout */}
        <View style={{ flexDirection: 'row', marginBottom: 12 }}>
          {/* Left column: customer + vehicle */}
          <View style={{ width: '50%' }}>
            {customerName && (
              <>
                <Text style={styles.label}>Customer:</Text>
                <Text style={styles.value}>{customerName}</Text>
              </>
            )}
            {vehicleInfo && (
              <>
                <Text style={styles.label}>Vehicle:</Text>
                <Text style={styles.value}>{vehicleInfo}</Text>
              </>
            )}
            {vin && (
              <>
                <Text style={styles.label}>VIN:</Text>
                <Text style={styles.value}>{vin}</Text>
              </>
            )}
            {licensePlate && (
              <>
                <Text style={styles.label}>License Plate:</Text>
                <Text style={styles.value}>{licensePlate}</Text>
              </>
            )}
          </View>
          {/* Right column: work + completion */}
          <View style={{ width: '50%' }}>
            {jobDescription && (
              <>
                <Text style={styles.label}>Work Requested:</Text>
                <Text style={styles.value}>{jobDescription}</Text>
              </>
            )}
            {estimatedCompletion && (
              <>
                <Text style={styles.label}>Estimated Completion:</Text>
                <Text style={styles.value}>{estimatedCompletion}</Text>
              </>
            )}
          </View>
        </View>

        {/* Line Items Table */}
        <View style={styles.table}>
          <View style={styles.tableHeader}>
            <Text style={styles.col1}>Description</Text>
            <Text style={styles.colPartNum}>Part #</Text>
            <Text style={styles.colCondition}>Condition</Text>
            <Text style={styles.col2}>Qty</Text>
            <Text style={styles.col3}>Parts</Text>
            <Text style={styles.col4}>Labor</Text>
          </View>
          
          {lineItems.map((item, index) => (
            <View key={index} style={styles.tableRow}>
              <View style={styles.col1}>
                <Text>{item.description}</Text>
                {item.labor_hours > 0 && (
                  <Text style={{ fontSize: 8, color: '#666', marginTop: 2 }}>
                    {item.labor_hours} hrs @ ${item.labor_rate}/hr
                  </Text>
                )}
              </View>
              <Text style={styles.colPartNum}>{item.part_number || '—'}</Text>
              <Text style={styles.colCondition}>
                {item.condition ? item.condition.charAt(0).toUpperCase() + item.condition.slice(1) : '—'}
              </Text>
              <Text style={styles.col2}>{item.quantity}</Text>
              <Text style={styles.col3}>
                {item.parts_price > 0 ? `$${(item.parts_price * item.quantity).toFixed(2)}` : '—'}
              </Text>
              <Text style={styles.col4}>
                {item.labor_price > 0 ? `$${item.labor_price.toFixed(2)}` : '—'}
              </Text>
            </View>
          ))}
        </View>

        {/* Summary */}
        <View style={styles.summary}>
          <View style={styles.summaryRow}>
            <Text>Subtotal:</Text>
            <Text>${subtotal.toFixed(2)}</Text>
          </View>
          
          {settings?.tax?.enabled && (
            <View style={styles.summaryRow}>
              <Text>Tax ({taxRate}%):</Text>
              <Text>${taxAmount.toFixed(2)}</Text>
            </View>
          )}
          
          <View style={styles.summaryTotal}>
            <Text>TOTAL:</Text>
            <Text>${total.toFixed(2)}</Text>
          </View>
        </View>

        {/* Terms */}
        {settings?.quote_settings?.terms && (
          <View style={styles.terms}>
            <Text style={{ fontWeight: 'bold', marginBottom: 5 }}>Terms & Conditions:</Text>
            <Text>{settings.quote_settings.terms}</Text>
          </View>
        )}

        {settings?.quote_settings?.payment_terms && (
          <View style={styles.terms}>
            <Text style={{ fontWeight: 'bold', marginBottom: 5 }}>Payment Terms:</Text>
            <Text>{settings.quote_settings.payment_terms}</Text>
          </View>
        )}

        {/* Footer */}
        <View style={styles.footer}>
          <Text style={{ fontWeight: 'bold', fontSize: 9, marginBottom: 3 }}>Demo Auto Shop</Text>
          <Text>8367 Belding Rd NE, Rockford, MI 49341  |  (616) 874-9050</Text>
          <Text style={{ marginTop: 4 }}>This estimate is valid until {validUntilStr}. Prices and availability subject to change.</Text>
          <Text style={{ marginTop: 2 }}>The final cost of repairs may not exceed the estimate by more than $50 or 10%, whichever is less, unless the customer authorizes it.</Text>
          <Text style={{ marginTop: 3 }}>
            Thank you for choosing Demo Auto Shop!
          </Text>
        </View>
      </Page>
    </Document>
  );
};
