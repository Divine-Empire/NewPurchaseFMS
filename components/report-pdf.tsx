import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

const styles = StyleSheet.create({
  page: { padding: 30, paddingBottom: 60, fontSize: 10, fontFamily: 'Helvetica' },
  section: { marginBottom: 15 },
  header: { fontSize: 18, marginBottom: 20, textAlign: 'center', fontWeight: 'bold', color: '#0f172a' },
  stageHeader: { fontSize: 12, marginTop: 10, marginBottom: 5, fontWeight: 'bold', backgroundColor: '#f3f4f6', padding: 5, color: '#374151' },
  table: { display: 'flex', width: '100%', borderStyle: 'solid', borderWidth: 1, borderColor: '#e5e7eb' },
  tableRow: { flexDirection: 'row', borderBottomWidth: 1, borderColor: '#e5e7eb', minHeight: 25, alignItems: 'center' },
  // Summary columns
  colSumStage: { width: '40%', padding: 5, borderRightWidth: 1, borderColor: '#e5e7eb' },
  colSumPending: { width: '20%', padding: 5, borderRightWidth: 1, borderColor: '#e5e7eb', textAlign: 'center' },
  colSumResponsible: { width: '40%', padding: 5 },
  // Detailed columns
  colDetIndent: { width: '15%', padding: 5, borderRightWidth: 1, borderColor: '#e5e7eb' },
  colDetParty: { width: '35%', padding: 5, borderRightWidth: 1, borderColor: '#e5e7eb' },
  colDetItem: { width: '40%', padding: 5, borderRightWidth: 1, borderColor: '#e5e7eb' },
  colDetQty: { width: '10%', padding: 5, textAlign: 'center' },
  
  tableCellHeader: { fontSize: 10, fontWeight: 'bold', color: '#ffffff' },
  tableCell: { fontSize: 9, color: '#1f2937' },
  bgHeader: { backgroundColor: '#1e293b' },
  pageNumber: { position: 'absolute', fontSize: 10, bottom: 30, left: 0, right: 0, textAlign: 'center', color: '#9ca3af' }
});


export const ReportDocument = ({ summaryData, detailedData }: { summaryData: any[], detailedData: any[] }) => {
  // Group detailedData by stage
  const groupedDetailedData = detailedData.reduce((acc, curr) => {
    if (!acc[curr.stage]) acc[curr.stage] = [];
    acc[curr.stage].push(curr);
    return acc;
  }, {} as Record<string, any[]>);

  const getHeaders = (stageName: string) => {
    if (stageName === "Indent Approval" || stageName === "Update 3 Vendors" || stageName === "Negotiation") {
      return ["Indent No", "Category", "Item", "Qty"];
    }
    if (stageName === "Freight Payments") {
      return ["LR No", "Transporter", "Invoice No", ""];
    }
    if (stageName === "Vendor Payment") {
      return ["Invoice No", "Party/Vendor", "Item", "Qty"];
    }
    return ["Indent No", "Party/Vendor", "Item", "Qty"];
  };

  return (
    <Document>
      {/* Summary Page */}
      <Page size="A4" style={styles.page}>
        <Text style={styles.header}>Summary Report</Text>
        <View style={styles.section}>
          <View style={styles.table}>
            <View style={[styles.tableRow, styles.bgHeader]} fixed>
              <View style={styles.colSumStage}><Text style={styles.tableCellHeader}>Stages</Text></View>
              <View style={styles.colSumPending}><Text style={styles.tableCellHeader}>Overdue Pending</Text></View>
              <View style={styles.colSumResponsible}><Text style={styles.tableCellHeader}>Responsible</Text></View>
            </View>
            {summaryData.map((row, i) => (
              <View style={styles.tableRow} key={i} wrap={false}>
                <View style={styles.colSumStage}><Text style={styles.tableCell}>{String(row.stage)}</Text></View>
                <View style={styles.colSumPending}><Text style={styles.tableCell}>{String(row.pending)}</Text></View>
                <View style={styles.colSumResponsible}><Text style={styles.tableCell}>{String(row.responsible)}</Text></View>
              </View>
            ))}
          </View>
        </View>
        <Text style={styles.pageNumber} render={({ pageNumber, totalPages }) => (`Page ${pageNumber} of ${totalPages}`)} fixed />
      </Page>

      {/* Detailed Report Pages - Separate page per stage allows headers to repeat correctly via 'fixed' */}
      {Object.entries(groupedDetailedData).map(([stageName, itemsArray], idx) => {
        const items = itemsArray as any[];
        const heads = getHeaders(stageName);
        return (
          <Page key={idx} size="A4" style={styles.page} orientation="landscape">
            <Text style={styles.header}>Detailed Report: {String(stageName)} ({String(items.length)} Overdue)</Text>
            
            <View style={styles.section}>
              <View style={styles.table}>
                {/* Column Headers - Re-added 'fixed' so they repeat on every page of this stage */}
                <View style={[styles.tableRow, styles.bgHeader]} fixed >
                  <View style={styles.colDetIndent}><Text style={styles.tableCellHeader}>{heads[0]}</Text></View>
                  <View style={styles.colDetParty}><Text style={styles.tableCellHeader}>{heads[1]}</Text></View>
                  <View style={styles.colDetItem}><Text style={styles.tableCellHeader}>{heads[2]}</Text></View>
                  <View style={styles.colDetQty}><Text style={styles.tableCellHeader}>{heads[3]}</Text></View>
                </View>

                {items.map((row, i) => (
                  <View style={styles.tableRow} key={i} wrap={false}>
                    <View style={styles.colDetIndent}><Text style={styles.tableCell}>{String(row.indent)}</Text></View>
                    <View style={styles.colDetParty}><Text style={styles.tableCell}>{String(row.party)}</Text></View>
                    <View style={styles.colDetItem}><Text style={styles.tableCell}>{String(row.item)}</Text></View>
                    <View style={styles.colDetQty}><Text style={styles.tableCell}>{String(row.qty)}</Text></View>
                  </View>
                ))}
              </View>
            </View>
            <Text style={styles.pageNumber} render={({ pageNumber, totalPages }) => (`Page ${pageNumber} of ${totalPages}`)} fixed />
          </Page>
        );
      })}
    </Document>
  );
};
