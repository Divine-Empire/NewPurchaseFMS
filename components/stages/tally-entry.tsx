"use client";

import React, { useState, useEffect } from "react";
import { toast } from "sonner";
import { Loader2, FileText, Search, RefreshCw } from "lucide-react";
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";



const SHEET_API_URL = process.env.NEXT_PUBLIC_API_URI;

export default function Stage9() {
  const [sheetRecords, setSheetRecords] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set());
  const [activeTab, setActiveTab] = useState<"pending" | "history">("pending");
  const [searchTerm, setSearchTerm] = useState("");
  const [accountantList, setAccountantList] = useState<string[]>([]);
  const [bulkError, setBulkError] = useState<string | null>(null);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData] = useState({
    doneBy: "",
    submissionDate: new Date().toISOString().split("T")[0],
    remarks: "",
    checkedStatus: "",
    checkedByAcc: "",
  });

  // Open Modal with Bulk Validation
  const handleOpenModal = () => {
    if (selectedRows.size === 0) return;
    setBulkError(null);

    const selectedIds = Array.from(selectedRows);
    const selectedRecords = sheetRecords.filter(r => selectedRows.has(r.id));

    if (selectedRecords.length === 0) return;

    // Validate Invoice Numbers
    const firstInvoice = selectedRecords[0].data.invoiceNumber;
    const isConsistent = selectedRecords.every(r => r.data.invoiceNumber === firstInvoice);

    if (!isConsistent) {
      setBulkError("Selected items have different Invoice Numbers. Cannot submit together.");
    }

    // Prefill from the first record
    const rec = selectedRecords[0];
    const hasCheckedBy = !!rec.data.checkedByAcc && rec.data.checkedByAcc !== "-";
    const doneByExists = !!rec.data.doneBy && rec.data.doneBy !== "-";

    let status = "";
    if (rec.data.checkedStatus && rec.data.checkedStatus !== "-") {
      status = rec.data.checkedStatus;
    } else if (doneByExists) {
      status = "No";
    }

    setFormData({
      doneBy: doneByExists ? rec.data.doneBy : "",
      submissionDate: new Date().toISOString().split("T")[0],
      remarks: (rec.data.remarks && rec.data.remarks !== "-") ? rec.data.remarks : "",
      checkedStatus: status,
      checkedByAcc: hasCheckedBy ? rec.data.checkedByAcc : "",
    });
    setIsModalOpen(true);
  };

  // Submit Handler
  const handleSubmit = async () => {
    if (selectedRows.size === 0 || !formData.doneBy || !formData.checkedStatus || !SHEET_API_URL) return;
    if (formData.checkedStatus === "Yes" && !formData.checkedByAcc) return;
    if (bulkError) return; // Prevent submit if there's an error

    setIsSubmitting(true);
    try {
      const now = new Date();
      const todayStr = `${now.getMonth() + 1}/${now.getDate()}/${now.getFullYear()}`;
      const selectedRecords = sheetRecords.filter(r => selectedRows.has(r.id));

      // Process sequentially
      for (const rec of selectedRecords) {
        const rowArray = new Array(84).fill("");

        // AJ (35): Plan2 (Leave)
        // AK (36): Actual2 - Write if Checked=Yes
        if (formData.checkedStatus === "Yes") {
          rowArray[36] = todayStr;
        }

        // AL (37): Delay2 (Formula - Skip)

        // AM (38): Done By
        rowArray[38] = formData.doneBy;

        // AN (39): Done Date
        rowArray[39] = formData.submissionDate;

        // AO (40): Remarks
        rowArray[40] = formData.remarks;

        // AP (41): Checked Status
        rowArray[41] = formData.checkedStatus;

        // AQ (42): Checked By Acc
        rowArray[42] = formData.checkedStatus === "Yes" ? formData.checkedByAcc : "";

        const params = new URLSearchParams();
        params.append("action", "update");
        params.append("sheetName", "RECEIVING-ACCOUNTS");
        params.append("rowIndex", rec.rowIndex.toString());
        params.append("rowData", JSON.stringify(rowArray));

        await fetch(SHEET_API_URL, { method: "POST", body: params });
      }

      toast.success(formData.checkedStatus === "Yes" ? "Tally Entry Completed (Bulk)!" : "Tally Entry Saved (Bulk Pending)");
      setIsModalOpen(false);
      setSelectedRows(new Set());
      fetchData();

    } catch (e) {
      console.error(e);
      toast.error("Submission failed");
    } finally {
      setIsSubmitting(false);
    }
  };

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
            // Stage 9 Logic: Check AJ (35) and AK (36)
            const hasPlan8 = !!row[35] && String(row[35]).trim() !== "";
            const hasActual8 = !!row[36] && String(row[36]).trim() !== "";

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

                // Tally Entry Plan/Actual (Dimensions AJ-AQ -> 35-42)
                plan8: row[35],                  // AJ: Plan 8
                actual8: row[36],                // AK: Actual 8 (Completion Date)
                // delay8: row[37],              // AL: Delay 8
                doneBy: row[38],                 // AM: Done By
                doneDate: row[39],               // AN: Done Date
                remarks: row[40],                // AO: Remarks
                checkedStatus: row[41],          // AP: Checked Status (Yes/No)
                checkedByAcc: row[42],           // AQ: Checked By (Name)

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
  const pending = sheetRecords
    .filter((r: any) => r.status === "pending")
    .filter((r) => {
      const searchLower = searchTerm.toLowerCase();
      return (
        r.data.indentNumber?.toLowerCase().includes(searchLower) ||
        r.data.itemName?.toLowerCase().includes(searchLower) ||
        r.data.vendorName?.toLowerCase().includes(searchLower) ||
        r.data.vendorName?.toLowerCase().includes(searchLower) ||
        String(r.data.poNumber || "").toLowerCase().includes(searchLower) ||
        String(r.data.invoiceNumber || "").toLowerCase().includes(searchLower)
      );
    });
  const completed = sheetRecords
    .filter((r: any) => r.status === "completed")
    .filter((r: any) => {
      const searchLower = searchTerm.toLowerCase();
      if (!searchLower) return true;
      return (
        r.data.indentNumber?.toLowerCase().includes(searchLower) ||
        r.data.itemName?.toLowerCase().includes(searchLower) ||
        r.data.vendorName?.toLowerCase().includes(searchLower) ||
        String(r.data.poNumber || "").toLowerCase().includes(searchLower) ||
        String(r.data.invoiceNumber || "").toLowerCase().includes(searchLower)
      );
    });

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
    { key: "doneDate", label: "Tally Date" },
    { key: "tallyStatus", label: "Tally Status" },
    { key: "remarks", label: "Tally Remarks" },
    { key: "checkedStatus", label: "Checked" },
    { key: "checkedByAcc", label: "Checked By" },
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

        let displayUrl = String(url);
        if (displayUrl.includes("drive.google.com/uc")) {
          const idMatch = displayUrl.match(/[?&]id=([a-zA-Z0-9_-]+)/);
          if (idMatch && idMatch[1]) {
            displayUrl = `https://drive.google.com/file/d/${idMatch[1]}/view`;
          }
        }

        return (
          <a
            href={displayUrl}
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

        {/* Tally Entry Button */}
        {selectedRows.size >= 1 && (
          <div className="mt-4 flex items-center gap-4">
            <Button onClick={handleOpenModal} className="bg-blue-600 hover:bg-blue-700 text-white">
              Tally Entry
            </Button>
            <span className="text-sm text-gray-500">
              {selectedRows.size} item(s) selected
            </span>
          </div>
        )}
      </div>

      {/* Search Filter */}
      <div className="mb-6 flex items-center gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-500" />
          <Input
            placeholder="Search by Indent No, Item Name, Vendor, PO, Invoice..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9 bg-white"
          />
        </div>
        <Button variant="outline" onClick={fetchData} disabled={isLoading}>
          {isLoading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <RefreshCw className="w-4 h-4" />
          )}
        </Button>
      </div>

      {/* Modal Form */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Tally Entry ({selectedRows.size} Selected)</DialogTitle>
          </DialogHeader>

          {bulkError && (
            <div className="bg-red-50 text-red-600 p-3 rounded-md text-sm mb-4 border border-red-200">
              {bulkError}
            </div>
          )}

          <div className="grid gap-4 py-4">

            {/* Done By */}
            <div className="grid gap-2">
              <Label>Done By *</Label>
              <Select
                value={formData.doneBy}
                onValueChange={(v) => setFormData({ ...formData, doneBy: v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select Accountant" />
                </SelectTrigger>
                <SelectContent>
                  {accountantList.map((n) => (
                    <SelectItem key={n} value={n}>{n}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Date */}
            <div className="grid gap-2">
              <Label>Date</Label>
              <Input
                type="date"
                value={formData.submissionDate}
                onChange={(e) => setFormData({ ...formData, submissionDate: e.target.value })}
              />
            </div>

            {/* Remarks */}
            <div className="grid gap-2">
              <Label>Remarks</Label>
              <Input
                value={formData.remarks}
                onChange={(e) => setFormData({ ...formData, remarks: e.target.value })}
                placeholder="Optional..."
              />
            </div>

            {/* Checked Status */}
            <div className="grid gap-2">
              <Label>Checked *</Label>
              <Select
                value={formData.checkedStatus}
                onValueChange={(v) => setFormData({ ...formData, checkedStatus: v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Yes">Yes</SelectItem>
                  <SelectItem value="No">No</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Checked By (Conditional) */}
            {formData.checkedStatus === "Yes" && (
              <div className="grid gap-2">
                <Label>Checked By *</Label>
                <Select
                  value={formData.checkedByAcc}
                  onValueChange={(v) => setFormData({ ...formData, checkedByAcc: v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select Accountant" />
                  </SelectTrigger>
                  <SelectContent>
                    {accountantList.map((n) => (
                      <SelectItem key={n} value={n}>{n}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsModalOpen(false)}>Cancel</Button>
            <Button
              onClick={handleSubmit}
              disabled={!formData.doneBy || !formData.checkedStatus || (formData.checkedStatus === "Yes" && !formData.checkedByAcc) || isSubmitting || !!bulkError}
            >
              {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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