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
    if (stageName === "Indent Approval") {
      return ["Indent No", "Created By", "Item", "Qty", "Delay (Hours)"];
    }
    if (stageName === "PO Entry") {
      return ["Indent No", "Item", "Vendor", "Qty", "Delay (Hours)"];
    }
    if (stageName === "Follow-Up Vendor") {
      return ["PO Number", "Vendor", "Planned Date", "Delay (Days)"];
    }
    if (stageName === "Transporter Follow-Up") {
      return ["Indent No", "Item", "Vendor", "Transporter", "Expected Date", "Delay (Hours)"];
    }
    return ["Indent No", "Party/Vendor", "Item", "Qty"];
  };

  const getColStyles = (heads: string[]) => {
    if (heads.length === 6) {
      return [
        { width: '10%' }, // Indent
        { width: '20%' }, // Item
        { width: '20%' }, // Vendor
        { width: '20%' }, // Transporter
        { width: '20%' }, // Expected Date
        { width: '10%' }, // Delay
      ];
    }
    if (heads.length === 5) {
      return [
        { width: '10%' }, // Indent
        { width: '35%' }, // Party/Created By
        { width: '35%' }, // Item
        { width: '10%', justifyContent: 'center' as const }, // Qty
        { width: '10%' }, // Delay
      ];
    }
    if (heads.length === 4) {
      return [
        { width: '30%' }, // PO Number
        { width: '35%' }, // Vendor
        { width: '20%' }, // Planned Date
        { width: '15%' }, // Delay
      ];
    }
    // Default 4 columns
    return [
      { width: '15%' }, // Indent
      { width: '35%' }, // Party
      { width: '40%' }, // Item
      { width: '10%', justifyContent: 'center' as const }, // Qty
    ];
  };

  const formatDelay = (delay: any, stage?: string) => {
    if (!delay || delay === "-" || delay === "0") return stage === "Follow-Up Vendor" ? "0" : "0:00:00";
    
    const delayStr = String(delay).trim();
    let totalHours = 0;
    let isNegative = delayStr.startsWith("-");
    const cleanStr = isNegative ? delayStr.substring(1) : delayStr;

    // 1. Calculate totalHours from input
    if (delayStr.includes('T') && (delayStr.startsWith('1900') || delayStr.startsWith('1899') || delayStr.startsWith('00'))) {
       const date = new Date(delayStr);
       if (!isNaN(date.getTime())) {
          const epoch = new Date('1899-12-30T00:00:00.000Z').getTime();
          const offsetMs = new Date().getTimezoneOffset() * 60000;
          totalHours = (date.getTime() - epoch - offsetMs) / (1000 * 60 * 60);
       }
    } else if (cleanStr.includes(":")) {
      const parts = cleanStr.split(":");
      const hours = parseFloat(parts[0]) || 0;
      const minutes = parseFloat(parts[1]) || 0;
      const seconds = parseFloat(parts[2]) || 0;
      totalHours = hours + (minutes / 60) + (seconds / 3600);
    } else {
      const val = parseFloat(delayStr);
      if (isNaN(val)) totalHours = 0;
      else totalHours = val; // Assuming numeric input is already in hours
    }

    // 2. Format based on stage
    if (stage === "Follow-Up Vendor") {
      const days = totalHours / 24;
      if (Math.abs(totalHours) < 12 && Math.abs(totalHours) > 0) {
        const absHours = Math.abs(totalHours);
        const h = Math.floor(absHours);
        const m = Math.round((absHours % 1) * 60);
        return `${h} hrs ${m} mins`;
      }
      return Math.round(isNegative ? -days : days).toString();
    }

    // Default: HH:MM:SS
    const absHours = Math.abs(totalHours);
    const h = Math.floor(absHours);
    const m = Math.floor((absHours % 1) * 60);
    const s = Math.round(((absHours % 1) * 60 % 1) * 60);
    
    // Handle second overflow (e.g. 59.999 -> 60)
    let finalH = h;
    let finalM = m;
    let finalS = s;
    if (finalS >= 60) { finalS = 0; finalM += 1; }
    if (finalM >= 60) { finalM = 0; finalH += 1; }

    const formatted = `${isNegative ? '-' : ''}${finalH}:${String(finalM).padStart(2, '0')}:${String(finalS).padStart(2, '0')}`;
    return formatted;
  };

  const formatDateDisplay = (val: any) => {
    if (!val || val === "-" || val === "0") return "-";
    const d = new Date(val);
    if (isNaN(d.getTime())) return String(val);
    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const yyyy = d.getFullYear();
    return `${dd}-${mm}-${yyyy}`;
  };

  const getRowData = (row: any, stage: string) => {
    if (stage === "Indent Approval") {
      return [row.indent, row.party, row.item, row.qty, formatDelay(row.delay, stage)];
    }
    if (stage === "PO Entry") {
      return [row.indent, row.item, row.party, row.qty, formatDelay(row.delay, stage)];
    }
    if (stage === "Follow-Up Vendor") {
      return [row.poNumber, row.party, formatDateDisplay(row.plannedDate), formatDelay(row.delay, stage)];
    }
    if (stage === "Transporter Follow-Up") {
      return [row.indent, row.item, row.party, row.transporterName, formatDateDisplay(row.expectedDate), formatDelay(row.delay, stage)];
    }
    return [row.indent, row.party, row.item, row.qty];
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
                <View style={styles.colSumPending}>
                  <Text style={styles.tableCell}>
                    {row.stage === "Follow-Up Vendor" && row.uniquePoCount 
                      ? `${row.pending} (${row.uniquePoCount} Unique)`
                      : String(row.pending)}
                  </Text>
                </View>
                <View style={styles.colSumResponsible}><Text style={styles.tableCell}>{String(row.responsible)}</Text></View>
              </View>
            ))}
          </View>
        </View>
        <Text style={styles.pageNumber} render={({ pageNumber, totalPages }) => (`Page ${pageNumber} of ${totalPages}`)} fixed />
      </Page>

      {/* Detailed Report Pages - Separate page per stage allows headers to repeat correctly via 'fixed' */}
      {Object.entries(groupedDetailedData).map(([stageName, itemsArray], idx) => {
        let items = itemsArray as any[];
        
        // Alphabetical sort by vendor name for Follow-Up Vendor
        if (stageName === "Follow-Up Vendor") {
          items = [...items].sort((a, b) => String(a.party || "").localeCompare(String(b.party || "")));
        }

        const heads = getHeaders(stageName);
        const colStyles = getColStyles(heads);
        
        let headerText = `Detailed Report: ${String(stageName)} (${String(items.length)} Overdue)`;
        if (stageName === "Follow-Up Vendor") {
          const summaryItem = summaryData.find(s => String(s.stage).trim() === String(stageName).trim());
          const totalOverdue = summaryItem ? summaryItem.pending : items.length;
          headerText = `Detailed Report: ${String(stageName)} (Total Overdue: ${totalOverdue} | Unique PO: ${items.length})`;
        }

        return (
          <Page key={idx} size="A4" style={styles.page}>
            <Text style={styles.header}>{headerText}</Text>
            
            <View style={styles.section}>
              <View style={styles.table}>
                {/* Column Headers - Re-added 'fixed' so they repeat on every page of this stage */}
                <View style={[styles.tableRow, styles.bgHeader]} fixed >
                  {heads.map((head, i) => (
                    <View key={i} style={[colStyles[i], { padding: 5, borderRightWidth: 1, borderColor: '#e5e7eb' }]} >
                      <Text style={styles.tableCellHeader}>{head}</Text>
                    </View>
                  ))}
                </View>

                {items.map((row, i) => {
                  const data = getRowData(row, stageName);
                  return (
                    <View style={styles.tableRow} key={i} wrap={false}>
                      {data.map((cell, j) => (
                        <View key={j} style={[colStyles[j], { padding: 5, borderRightWidth: 1, borderColor: '#e5e7eb' }]} >
                          <Text style={styles.tableCell}>{String(cell || "-")}</Text>
                        </View>
                      ))}
                    </View>
                  );
                })}
              </View>
            </View>
            <Text style={styles.pageNumber} render={({ pageNumber, totalPages }) => (`Page ${pageNumber} of ${totalPages}`)} fixed />
          </Page>
        );
      })}
    </Document>
  );
};
