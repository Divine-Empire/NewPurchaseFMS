"use client";

import React, { useState, useEffect } from "react";
import { toast } from "sonner";
import { Loader2, FileText } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";



const SHEET_API_URL = process.env.NEXT_PUBLIC_API_URI;

export default function Stage9() {
  const [sheetRecords, setSheetRecords] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set());
  const [activeTab, setActiveTab] = useState<"pending" | "history">("pending");
  const [accountantList, setAccountantList] = useState<string[]>([]);

  const [bulkData, setBulkData] = useState({
    doneBy: "",
    submissionDate: new Date().toISOString().split("T")[0],
    remarks: "",
  });

  const fetchData = async () => {
    if (!SHEET_API_URL) return;
    setIsLoading(true);
    try {
      const [liftRes, fmsRes] = await Promise.all([
        fetch(`${SHEET_API_URL}?sheet=RECEIVING-ACCOUNTS&action=getAll`),
        fetch(`${SHEET_API_URL}?sheet=INDENT-LIFT&action=getAll`)
      ]);

      const liftJson = await liftRes.json();
      const fmsJson = await fmsRes.json();

      // Create FMS Map (Indent # -> Row)
      const fmsMap = new Map<string, any[]>();
      if (fmsJson.success && Array.isArray(fmsJson.data)) {
        fmsJson.data.slice(6).forEach((r: any) => {
          if (r[1] && String(r[1]).trim()) {
            fmsMap.set(String(r[1]).trim(), r);
          }
        });
      }

      if (liftJson.success && Array.isArray(liftJson.data)) {
        const rows = liftJson.data.slice(6)
          .map((row: any, i: number) => ({ row, originalIndex: i + 7 }))
          .filter(({ row }: any) => row[1] && String(row[1]).trim() !== "")
          .map(({ row, originalIndex }: any) => {
            const indentNo = String(row[1]).trim();
            const fmsRow = fmsMap.get(indentNo) || [];

            // Stage 9 Logic
            // 50: Plan 8
            // 51: Actual 8
            const hasPlan8 = !!row[44] && String(row[44]).trim() !== "";
            const hasActual8 = !!row[45] && String(row[45]).trim() !== "";

            let status = "not_ready";
            if (hasPlan8 && !hasActual8) {
              status = "pending";
            } else if (hasPlan8 && hasActual8) {
              status = "completed";
            }

            // Vendor Details from FMS (indent-po) - LEGACY FALLBACK
            const selectedVendor = fmsRow[47];
            let vendorDetails = {
              vendorNameFallback: "-",
              rate: "-",
              terms: "-",
            };
            if (selectedVendor === "Vendor 1") {
              vendorDetails = {
                vendorNameFallback: fmsRow[21],
                rate: fmsRow[22],
                terms: fmsRow[23],
              };
            } else if (selectedVendor === "Vendor 2") {
              vendorDetails = {
                vendorNameFallback: fmsRow[29],
                rate: fmsRow[30],
                terms: fmsRow[31],
              };
            } else if (selectedVendor === "Vendor 3") {
              vendorDetails = {
                vendorNameFallback: fmsRow[37],
                rate: fmsRow[38],
                terms: fmsRow[39],
              };
            }

            return {
              id: row[1] || `row-${originalIndex}`,
              rowIndex: originalIndex,
              stage: 9,
              status,
              originalRow: row,
              data: {
                indentNumber: row[1] || "",
                liftNumber: row[2] || "",
                // Vendor Name from RECEIVING-ACCOUNTS (Col D / Index 3) as per specific request
                vendorName: row[3] || "-",
                poNumber: row[4] || "-",
                nextFollowUpDate: row[5] || "",
                remarksStage6: row[6] || "",
                itemName: row[7] || "",
                quantity: row[8] || "", // Lifting Qty
                indentQty: fmsRow[14] || "", // Indent-Lift Col O (Index 14)

                // Transporter/Vehicle/Contact/LR are 9-12
                transporterName: row[9] || "",
                vehicleNo: row[10] || "",
                contactNo: row[11] || "",
                lrNo: row[12] || "",

                // Dispatch/Freight/Advance/Payment are 13-17
                dispatchDate: row[13] || "",
                freightAmount: row[14] || "",
                advanceAmount: row[15] || "",
                paymentDate: row[16] || "",
                paymentStatus: row[17] || "",
                biltyCopy: row[18] || "",

                // Invoice/Receipt Fields (Stage 7 Data - Verified from QC Req)
                invoiceType: row[22] || "-",
                invoiceDate: row[23] || "-",
                invoiceNumber: row[24] || "-",
                receivedQty: row[25] || "-",
                receivedItemImage: row[26] || "",
                srnNumber: row[27] || "-",
                qcRequirement: row[28] || "-",
                billAttachment: row[29] || "",
                paymentAmountHydra: row[30] || "",
                paymentAmountLabour: row[31] || "",
                paymentAmountHamali: row[32] || "",
                remarks7: row[33] || "",

                // Tally Entry Plan/Actual
                plan8: row[50],
                actual8: row[51],
                doneBy: row[52],
                submissionDate: row[53],
                remarks: row[54],

                // Fetch from INDENT-LIFT (fmsRow)
                // Created By: Col C (Index 2)
                createdBy: fmsRow[2] || "-",
                // Category: Col D (Index 3) 
                category: fmsRow[3] || "-",
                // Warehouse: Col G (Index 6)
                warehouse: fmsRow[6] || "-",

                // PO Details from INDENT-LIFT
                // Basic Value: Col BD (Index 55)
                basicValue: fmsRow[55] || "-",
                // Total With Tax: Col BE (Index 56)
                totalWithTax: fmsRow[56] || "-",
                // PO Copy: Col BG (Index 58)
                poCopy: fmsRow[58] || "",

                deliveryDate: "-",

                ...vendorDetails
              }
            };
          });
        setSheetRecords(rows);
      }

      // Fetch Dropdown sheet for Accountants (Column M / Index 12)
      const dropRes = await fetch(`${SHEET_API_URL}?sheet=Dropdown&action=getAll`);
      const dropJson = await dropRes.json();
      if (dropJson.success && Array.isArray(dropJson.data)) {
        const accList = dropJson.data.slice(1)
          .map((row: any) => String(row[12] || "").trim())
          .filter((a: string) => a !== "");
        setAccountantList(accList);
      }

    } catch (e) {
      console.error("Fetch error:", e);
    }
    setIsLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Filter records
  const pending = sheetRecords.filter((r: any) => r.status === "pending");
  const completed = sheetRecords.filter((r: any) => r.status === "completed");

  // Pending columns
  const pendingColumns = [
    { key: "indentNumber", label: "Indent #" },
    { key: "createdBy", label: "Created By" },
    { key: "category", label: "Category" },
    { key: "itemName", label: "Item" },
    { key: "indentQty", label: "Qty" },
    { key: "warehouse", label: "Warehouse" },
    { key: "vendorName", label: "Vendor" },
    { key: "poNumber", label: "PO Number" },
    { key: "basicValue", label: "Basic Value" },
    { key: "totalWithTax", label: "Total w/Tax" },
    { key: "poCopy", label: "PO Copy" },
    { key: "receiptLiftNumber", label: "Lift #" },
    { key: "receivedQty", label: "Rec. Qty" },
    { key: "invoiceNumber", label: "Invoice #" },
    { key: "invoiceDate", label: "Invoice Date" },
    { key: "srnNumber", label: "SRN #" },
    { key: "qcRequirement", label: "QC Required" },
    { key: "receivedItemImage", label: "Rec. Item Img" },
    { key: "billAttachment", label: "Bill Attach" },
    { key: "plan7", label: "Plan 7" },
    { key: "actual7", label: "Actual 7" },
    { key: "qcBy", label: "QC Done By" },
    { key: "qcDate", label: "QC Date" },
    { key: "qcStatus", label: "QC Status" },
    { key: "rejectQty", label: "Reject Qty" },
    { key: "rejectRemarks", label: "Reject Remarks" },
    { key: "returnStatus", label: "Return Status" },
    { key: "qcRemarks", label: "QC Remarks" },
    { key: "rejectPhoto", label: "Reject Photo" },
  ];

  // History columns
  const historyColumns = [
    ...pendingColumns,
    { key: "plan8", label: "Plan 8" },
    { key: "actual8", label: "Actual 8" },
    { key: "doneBy", label: "Tally Done By" },
    { key: "submissionDate", label: "Tally Date" },
    { key: "tallyStatus", label: "Tally Status" },
    { key: "remarks", label: "Tally Remarks" },
  ];

  const [selectedPendingColumns, setSelectedPendingColumns] = useState<string[]>(
    pendingColumns.map((c) => c.key)
  );

  const [selectedHistoryColumns, setSelectedHistoryColumns] = useState<string[]>(
    historyColumns.map((c) => c.key)
  );

  // Toggle row
  const toggleRow = (id: string) => {
    const newSet = new Set(selectedRows);
    if (newSet.has(id)) newSet.delete(id);
    else newSet.add(id);
    setSelectedRows(newSet);
  };

  // Toggle all
  const toggleAll = () => {
    if (selectedRows.size === pending.length) {
      setSelectedRows(new Set());
    } else {
      setSelectedRows(new Set(pending.map((r: any) => r.id)));
    }
  };

  // Bulk submit
  const handleBulkSubmit = async () => {
    if (!bulkData.doneBy || selectedRows.size === 0 || !SHEET_API_URL) return;

    setIsSubmitting(true);
    let successCount = 0;
    let failCount = 0;

    const selectedList = Array.from(selectedRows);

    // Process one by one for reliability in this loop
    for (const id of selectedList) {
      const rec = sheetRecords.find((r) => r.id === id);
      if (!rec) continue;

      try {
        const now = new Date();
        const todayStr = `${now.getMonth() + 1}/${now.getDate()}/${now.getFullYear()}`;

        // Sparse Row Update - indices 50-54 for lift-accounts
        // Array size 55 to cover up to index 54
        const rowArray = new Array(55).fill("");

        // 50: Plan 8 (Preserve)
        rowArray[44] = rec.data.plan8 || "";
        // 51: Actual 8 (Today)
        rowArray[45] = todayStr;
        rowArray[46] = "";
        // 52: Done By
        rowArray[47] = bulkData.doneBy;
        // 53: Submission Date
        rowArray[48] = bulkData.submissionDate;
        // 54: Remarks
        rowArray[49] = bulkData.remarks;

        const params = new URLSearchParams();
        params.append("action", "update");
        params.append("sheetName", "RECEIVING-ACCOUNTS");
        params.append("rowIndex", rec.rowIndex.toString());
        params.append("rowData", JSON.stringify(rowArray));

        const res = await fetch(SHEET_API_URL, { method: "POST", body: params });
        const json = await res.json();
        if (json.success) successCount++;
        else failCount++;
      } catch (e) {
        failCount++;
      }
    }

    if (successCount > 0) {
      toast.success(`Successfully recorded ${successCount} Tally entries.`);
      setSelectedRows(new Set());
      setBulkData({
        doneBy: "",
        submissionDate: new Date().toISOString().split("T")[0],
        remarks: "",
      });
      fetchData();
    }
    if (failCount > 0) {
      toast.error(`Failed to record ${failCount} entries.`);
    }
    setIsSubmitting(false);
  };

  // Get vendor data helper
  const getVendorData = (record: any) => {
    const data = record?.data;
    if (!data) return { name: "-", rate: "-", terms: "-" };
    // Only use fallback if needed, but primary vendorName is now direct from Row 3
    return {
      name: data.vendorName || data.vendorNameFallback || "-",
      rate: data.rate || "-",
      terms: data.terms || "-",
    };
  };

  // Safe value getter with lifting data support
  const safeValue = (record: any, key: string, isHistory = false) => {
    try {
      const data = record?.data;
      if (!data) return "-";

      const vendor = getVendorData(record);

      // Handle file attachments with clickable links
      const fileFields = ["poCopy", "receivedItemImage", "billAttachment", "rejectPhoto", "biltyCopy"];
      if (fileFields.includes(key)) {
        let url = data[key];
        if (key === "biltyCopy") url = data.liftingData?.[0]?.biltyCopy;

        if (!url || String(url).trim() === "" || url === "-") return "-";
        return (
          <a
            href={String(url)}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 text-xs text-blue-600 hover:underline"
          >
            <FileText className="w-3.5 h-3.5" />
            <span className="truncate max-w-20">View</span>
          </a>
        );
      }

      // Handle vendor data fields
      if (key === "vendorName") return vendor.name;
      if (key === "ratePerQty") return vendor.rate ? `₹${vendor.rate}` : "-";
      if (key === "paymentTerms") return vendor.terms;

      // Handle lifting data
      if (key === "receiptLiftNumber") return data.liftingData?.[0]?.liftNumber || "-";

      // Handle payment amounts
      if (key === "paymentAmountHydra" || key === "paymentAmountLabour" || key === "paymentAmountHamali") {
        return data[key] ? `₹${data[key]}` : "-";
      }

      // Handle QC Status for display
      if (key === "qcStatus") {
        const val = data[key];
        if (!val || val === "-") return "-";
        // Capitalize first letter
        return String(val).charAt(0).toUpperCase() + String(val).slice(1);
      }

      const val = data[key];
      if (val === undefined || val === null || String(val).trim() === "") return "-";

      const lowKey = key.toLowerCase();
      if ((lowKey.includes("date") || lowKey.includes("plan") || lowKey.includes("actual")) &&
        val && !isNaN(Date.parse(String(val)))) {
        return new Date(String(val)).toLocaleDateString("en-IN");
      }

      return String(val);
    } catch (err) {
      return "-";
    }
  };

  if (isLoading && sheetRecords.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
        <Loader2 className="w-8 h-8 animate-spin text-black" />
        <p className="text-gray-500 animate-pulse">Fetching records from sheet...</p>
      </div>
    );
  }

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-6 p-6 bg-white border rounded-lg shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold">Stage 9: Tally Entry</h2>
            <p className="text-gray-600 mt-1">Record material receipt in Tally</p>
          </div>
          <div className="flex items-center gap-4">
            <Label className="text-sm font-medium">Show Columns:</Label>
            <Select value="" onValueChange={() => { }}>
              <SelectTrigger className="w-64">
                <SelectValue
                  placeholder={
                    activeTab === "pending"
                      ? `${selectedPendingColumns.length} selected`
                      : `${selectedHistoryColumns.length} selected`
                  }
                />
              </SelectTrigger>
              <SelectContent className="w-64 max-h-96 overflow-y-auto">
                <div className="p-2">
                  <div className="flex items-center space-x-2 mb-2 pb-2 border-b">
                    <Checkbox
                      checked={
                        activeTab === "pending"
                          ? selectedPendingColumns.length === pendingColumns.length
                          : selectedHistoryColumns.length === historyColumns.length
                      }
                      onCheckedChange={(checked) => {
                        if (activeTab === "pending") {
                          setSelectedPendingColumns(
                            checked ? pendingColumns.map((c) => c.key) : []
                          );
                        } else {
                          setSelectedHistoryColumns(
                            checked ? historyColumns.map((c) => c.key) : []
                          );
                        }
                      }}
                    />
                    <Label className="text-sm font-medium">All</Label>
                  </div>
                  {(activeTab === "pending" ? pendingColumns : historyColumns).map(
                    (col) => (
                      <div
                        key={col.key}
                        className="flex items-center space-x-2 py-1"
                      >
                        <Checkbox
                          checked={
                            activeTab === "pending"
                              ? selectedPendingColumns.includes(col.key)
                              : selectedHistoryColumns.includes(col.key)
                          }
                          onCheckedChange={(checked) => {
                            if (activeTab === "pending") {
                              setSelectedPendingColumns(
                                checked
                                  ? [...selectedPendingColumns, col.key]
                                  : selectedPendingColumns.filter(
                                    (c) => c !== col.key
                                  )
                              );
                            } else {
                              setSelectedHistoryColumns(
                                checked
                                  ? [...selectedHistoryColumns, col.key]
                                  : selectedHistoryColumns.filter(
                                    (c) => c !== col.key
                                  )
                              );
                            }
                          }}
                        />
                        <Label className="text-sm">{col.label}</Label>
                      </div>
                    )
                  )}
                </div>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Bulk Tally Controls */}
        {selectedRows.size > 0 && (
          <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded-lg">
            <div className="flex items-center gap-4 flex-wrap">
              <div className="flex items-center gap-2">
                <Checkbox checked={true} disabled />
                <span className="font-medium">{selectedRows.size} selected</span>
              </div>

              <div className="flex items-center gap-2">
                <Label className="whitespace-nowrap">Done By *</Label>
                <Select
                  value={bulkData.doneBy}
                  onValueChange={(v) => setBulkData({ ...bulkData, doneBy: v })}
                >
                  <SelectTrigger className="w-48">
                    <SelectValue placeholder="Select" />
                  </SelectTrigger>
                  <SelectContent>
                    {accountantList.map((n) => (
                      <SelectItem key={n} value={n}>
                        {n}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center gap-2">
                <Label>Date</Label>
                <Input
                  type="date"
                  value={bulkData.submissionDate}
                  onChange={(e) =>
                    setBulkData({ ...bulkData, submissionDate: e.target.value })
                  }
                  className="w-40"
                />
              </div>

              <div className="flex items-center gap-2">
                <Label>Remarks</Label>
                <Input
                  value={bulkData.remarks}
                  onChange={(e) =>
                    setBulkData({ ...bulkData, remarks: e.target.value })
                  }
                  placeholder="Optional..."
                  className="w-64"
                />
              </div>

              <Button onClick={handleBulkSubmit} disabled={!bulkData.doneBy || isSubmitting}>
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Processing...
                  </>
                ) : (
                  "Done"
                )}
              </Button>
            </div>
          </div>
        )}
      </div>

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)}>
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="pending">Pending ({pending.length})</TabsTrigger>
          <TabsTrigger value="history">History ({completed.length})</TabsTrigger>
        </TabsList>

        {/* Pending Tab */}
        <TabsContent value="pending" className="mt-6">
          {pending.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <p className="text-lg">No pending Tally entries</p>
            </div>
          ) : (
            <div className="border rounded-lg overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12 sticky left-0 bg-white z-20">
                      <Checkbox
                        checked={
                          selectedRows.size === pending.length && pending.length > 0
                        }
                        onCheckedChange={toggleAll}
                      />
                    </TableHead>
                    {/* Reverted sticky ID column to fix overlap issue */}
                    {pendingColumns
                      .filter((c) => selectedPendingColumns.includes(c.key))
                      .map((col) => (
                        <TableHead key={col.key}>{col.label}</TableHead>
                      ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pending.map((record: any) => (
                    <TableRow key={record.id}>
                      <TableCell className="w-12 sticky left-0 bg-white z-10">
                        <Checkbox
                          checked={selectedRows.has(record.id)}
                          onCheckedChange={() => toggleRow(record.id)}
                        />
                      </TableCell>
                      {/* Reverted sticky ID column to fix overlap issue */}
                      {pendingColumns
                        .filter((c) => selectedPendingColumns.includes(c.key))
                        .map((col) => (
                          <TableCell key={col.key}>
                            {safeValue(record, col.key)}
                          </TableCell>
                        ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </TabsContent>

        {/* History Tab */}
        <TabsContent value="history" className="mt-6">
          {completed.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <p className="text-lg">No Tally history</p>
            </div>
          ) : (
            <div className="border rounded-lg overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    {/* Removed sticky ID column here too for consistency if needed, but keeping simple */}
                    <TableHead className="sticky left-0 bg-white z-10">
                      ID
                    </TableHead>
                    {historyColumns
                      .filter((c) => selectedHistoryColumns.includes(c.key))
                      .map((col) => (
                        <TableHead key={col.key}>{col.label}</TableHead>
                      ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {completed.map((record: any) => (
                    <TableRow key={record.id}>
                      <TableCell className="font-mono text-xs sticky left-0 bg-white z-10">
                        {record.id}
                      </TableCell>
                      {historyColumns
                        .filter((c) => selectedHistoryColumns.includes(c.key))
                        .map((col) => (
                          <TableCell key={col.key}>
                            {safeValue(record, col.key, true)}
                          </TableCell>
                        ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}