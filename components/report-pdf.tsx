import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

const styles = StyleSheet.create({
  page: { padding: 30, paddingBottom: 50, fontSize: 10, fontFamily: 'Helvetica' },
  section: { marginBottom: 20 },
  header: { fontSize: 16, marginBottom: 15, textAlign: 'center', fontWeight: 'bold' },
  stageHeader: { fontSize: 12, marginTop: 15, marginBottom: 5, fontWeight: 'bold', backgroundColor: '#f3f4f6', padding: 5 },
  table: { display: 'flex', width: 'auto', borderStyle: 'solid', borderWidth: 1, borderRightWidth: 0, borderBottomWidth: 0 },
  tableRow: { margin: 'auto', flexDirection: 'row' },
  // Summary columns
  colSumStage: { width: '40%', borderStyle: 'solid', borderWidth: 1, borderLeftWidth: 0, borderTopWidth: 0 },
  colSumPending: { width: '20%', borderStyle: 'solid', borderWidth: 1, borderLeftWidth: 0, borderTopWidth: 0, textAlign: 'center' },
  colSumResponsible: { width: '40%', borderStyle: 'solid', borderWidth: 1, borderLeftWidth: 0, borderTopWidth: 0 },
  // Detailed columns
  colDetIndent: { width: '20%', borderStyle: 'solid', borderWidth: 1, borderLeftWidth: 0, borderTopWidth: 0 },
  colDetParty: { width: '35%', borderStyle: 'solid', borderWidth: 1, borderLeftWidth: 0, borderTopWidth: 0 },
  colDetItem: { width: '35%', borderStyle: 'solid', borderWidth: 1, borderLeftWidth: 0, borderTopWidth: 0 },
  colDetQty: { width: '10%', borderStyle: 'solid', borderWidth: 1, borderLeftWidth: 0, borderTopWidth: 0, textAlign: 'center' },
  
  tableCellHeader: { margin: 5, fontSize: 10, fontWeight: 'bold' },
  tableCell: { margin: 5, fontSize: 9 },
  bgHeader: { backgroundColor: '#e5e7eb' },
  pageNumber: { position: 'absolute', fontSize: 10, bottom: 20, left: 0, right: 0, textAlign: 'center', color: 'gray' }
});

export const ReportDocument = ({ summaryData, detailedData }: { summaryData: any[], detailedData: any[] }) => {
  // Group detailedData by stage
  const groupedDetailedData = detailedData.reduce((acc, curr) => {
    if (!acc[curr.stage]) acc[curr.stage] = [];
    acc[curr.stage].push(curr);
    return acc;
  }, {} as Record<string, any[]>);

  return (
    <Document>
      {/* Summary Page */}
      <Page size="A4" style={styles.page}>
        <Text style={styles.header}>Summary Report</Text>
        <View style={styles.section}>
          <View style={styles.table}>
            <View style={[styles.tableRow, styles.bgHeader]} wrap={false}>
              <View style={styles.colSumStage}><Text style={styles.tableCellHeader}>Stages</Text></View>
              <View style={styles.colSumPending}><Text style={styles.tableCellHeader}>Pending</Text></View>
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

      {/* Detailed Page */}
      <Page size="A4" style={styles.page} orientation="landscape">
        <Text style={styles.header}>Detailed Report</Text>
        
        {Object.entries(groupedDetailedData).map(([stageName, itemsArray], idx) => {
          const items = itemsArray as any[];
          return (
          <View key={idx} style={styles.section} wrap={false}>
            <Text style={styles.stageHeader}>{String(stageName)} ({String(items.length)} Pending)</Text>
            <View style={styles.table}>
              <View style={[styles.tableRow, styles.bgHeader]}>
                <View style={styles.colDetIndent}><Text style={styles.tableCellHeader}>Indent No</Text></View>
                <View style={styles.colDetParty}><Text style={styles.tableCellHeader}>Party/Vendor</Text></View>
                <View style={styles.colDetItem}><Text style={styles.tableCellHeader}>Item</Text></View>
                <View style={styles.colDetQty}><Text style={styles.tableCellHeader}>Qty</Text></View>
              </View>
              {items.map((row, i) => (
                <View style={styles.tableRow} key={i}>
                  <View style={styles.colDetIndent}><Text style={styles.tableCell}>{String(row.indent)}</Text></View>
                  <View style={styles.colDetParty}><Text style={styles.tableCell}>{String(row.party)}</Text></View>
                  <View style={styles.colDetItem}><Text style={styles.tableCell}>{String(row.item)}</Text></View>
                  <View style={styles.colDetQty}><Text style={styles.tableCell}>{String(row.qty)}</Text></View>
                </View>
              ))}
            </View>
          </View>
          );
        })}
        <Text style={styles.pageNumber} render={({ pageNumber, totalPages }) => (`Page ${pageNumber} of ${totalPages}`)} fixed />
      </Page>
    </Document>
  );
};
