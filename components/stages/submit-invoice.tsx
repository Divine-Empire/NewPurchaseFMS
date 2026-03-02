"use client";

import React, { useState, useEffect } from "react";
import { toast } from "sonner";
import { Loader2, FileText, Search } from "lucide-react";
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
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { format } from "date-fns";

const SHEET_API_URL = process.env.NEXT_PUBLIC_API_URI;


export default function Stage10() {
  const [sheetRecords, setSheetRecords] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [open, setOpen] = useState(false);
  const [selectedRecordId, setSelectedRecordId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"pending" | "history">("pending");
  const [searchTerm, setSearchTerm] = useState("");
  const [warehouseFilter, setWarehouseFilter] = useState("All");
  const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set());
  const [bulkError, setBulkError] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    handoverBy: "",
    invoiceSubmissionDate: new Date(),
    invoiceNumber: "",
    vendorName: "",
  });

  // Fetch Data (Refactored for lift-accounts + indent-po)
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

            // Stage 10 Logic
            // AW (48): Plan 9 (Trigger)
            // AX (49): Actual 9 (Completion)
            const hasPlan9 = !!row[48] && String(row[48]).trim() !== "";
            const hasActual9 = !!row[49] && String(row[49]).trim() !== "";

            let status = "not_ready";
            if (hasPlan9 && !hasActual9) {
              status = "pending";
            } else if (hasPlan9 && hasActual9) {
              status = "completed";
            }

            // Vendor Details (indent-po)
            const selectedVendor = fmsRow[47];
            let vendorDetails = { vendorName: "-", rate: "-", terms: "-" };

            if (selectedVendor === "Vendor 1") {
              vendorDetails = { vendorName: fmsRow[21], rate: fmsRow[22], terms: fmsRow[23] };
            } else if (selectedVendor === "Vendor 2") {
              vendorDetails = { vendorName: fmsRow[29], rate: fmsRow[30], terms: fmsRow[31] };
            } else if (selectedVendor === "Vendor 3") {
              vendorDetails = { vendorName: fmsRow[37], rate: fmsRow[38], terms: fmsRow[39] };
            }

            return {
              id: row[1] || `row-${originalIndex}`,
              rowIndex: originalIndex,
              stage: 10,
              status,
              originalRow: row, // Preserve data
              data: {
                indentNumber: row[1],
                createdBy: row[2],
                category: fmsRow[3] || row[3], // D: Category (Indent Lift)
                itemName: fmsRow[4] || row[4], // E: Item Name (Indent Lift)
                quantity: row[25], // Z: Qty (Receiving Accounts)
                warehouse: row[6],
                deliveryDate: row[7],

                // Stage 6 (9-24)
                poNumber: fmsRow[54], // BC: PO Number (Indent Lift)

                // Stage 7 (25-39)
                billAttachment: row[18], // S: Bill Attachment (Receiving Accounts)
                invoiceNumber: row[24], // Y: Invoice Number (Receiving Accounts)
                invoiceDate: row[23], // X: Invoice Date (Receiving Accounts)
                srnNumber: row[32],
                receiptLiftNumber: row[28],

                // Stage 8 (40-49)
                qcStatus: row[39], // AN: QC Status (Receiving Accounts)
                qcDate: row[38], // AM: QC Date (Receiving Accounts)

                // Stage 9 (44-49)
                tallyDoneBy: row[47],
                tallyDate: row[48],
                tallyRemarks: row[49],

                // Stage 10 (48-53) (AW-BB)
                plan9: row[48],   // AW: Plan Date
                actual9: row[49], // AX: Actual Date
                // Delay: row[50] // AY
                handoverBy: row[51], // AZ
                submitToHeadOffice: row[52], // BA
                invoiceSubmissionDate: row[53], // BB

                // FMS Data
                approvedBy: fmsRow[12],
                basicValue: fmsRow[55], // BD: Basic Value (Indent Lift)
                totalWithTax: fmsRow[56], // BE: Total Value (Indent Lift)
                poCopy: fmsRow[56],
                ...vendorDetails,
                vendorName: row[3], // D: Vendor Name (Receiving Accounts)
              }
            };
          });
        setSheetRecords(rows);
      }
    } catch (e) {
      console.error("Fetch error:", e);
    }
    setIsLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, []);

  const pending = sheetRecords
    .filter((r) => r.status === "pending")
    .filter((r) => {
      if (warehouseFilter === "NE Warehouse" && r.data.warehouse !== "NE Warehouse") return false;
      if (warehouseFilter === "Others" && r.data.warehouse === "NE Warehouse") return false;

      const searchLower = searchTerm.toLowerCase();
      return (
        r.data.indentNumber?.toLowerCase().includes(searchLower) ||
        r.data.itemName?.toLowerCase().includes(searchLower) ||
        r.data.vendorName?.toLowerCase().includes(searchLower) ||
        String(r.data.poNumber || "").toLowerCase().includes(searchLower) ||
        String(r.data.invoiceNumber || "").toLowerCase().includes(searchLower)
      );
    });
  const completed = sheetRecords
    .filter((r) => r.status === "completed")
    .filter((r) => {
      if (warehouseFilter === "NE Warehouse" && r.data.warehouse !== "NE Warehouse") return false;
      if (warehouseFilter === "Others" && r.data.warehouse === "NE Warehouse") return false;

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

  const pendingColumns = [
    { key: "indentNumber", label: "Indent #" },
    { key: "category", label: "Category" },
    { key: "itemName", label: "Item" },
    { key: "quantity", label: "Qty" },
    { key: "warehouse", label: "Warehouse" },
    { key: "vendorName", label: "Vendor" },
    { key: "poNumber", label: "PO #" },
    { key: "invoiceNumber", label: "Invoice #" },
    { key: "invoiceDate", label: "Inv. Date" },
    { key: "basicValue", label: "Basic Val" },
    { key: "totalWithTax", label: "Total Val" },
    { key: "billAttachment", label: "Bill Attach" },
    { key: "qcStatus", label: "QC Status" },
    { key: "qcDate", label: "QC Date" },
    { key: "tallyDoneBy", label: "Tally By" },
    { key: "tallyDate", label: "Tally Date" },
    { key: "tallyRemarks", label: "Tally Remarks" },
    { key: "plan9", label: "Plan 9" },
    { key: "actual9", label: "Actual 9" },
  ];

  const historyColumns = [
    ...pendingColumns,
    // plan9 and actual9 are already in pendingColumns, so don't re-add explicitly to avoid duplicates
    { key: "handoverBy", label: "HardCopy Docs" },
    { key: "invoiceSubmissionDate", label: "Sub. Date" },
  ];

  const [selectedPendingColumns, setSelectedPendingColumns] = useState<string[]>(
    pendingColumns.map((c) => c.key)
  );

  const [selectedHistoryColumns, setSelectedHistoryColumns] = useState<string[]>(
    historyColumns.map((c) => c.key)
  );

  // Toggle Selection
  const toggleRow = (id: string) => {
    const newSet = new Set(selectedRows);
    if (newSet.has(id)) newSet.delete(id);
    else newSet.add(id);
    setSelectedRows(newSet);
  };

  const toggleAll = () => {
    if (selectedRows.size === pending.length) {
      setSelectedRows(new Set());
    } else {
      setSelectedRows(new Set(pending.map((r) => r.id)));
    }
  };

  const handleOpenForm = (recordId?: string) => {
    setBulkError(null);
    let targetRecord;

    // Single select or bulk
    if (recordId) {
      setSelectedRows(new Set([recordId]));
      targetRecord = sheetRecords.find((r) => r.id === recordId);
    } else {
      if (selectedRows.size === 0) return;
      const selectedRecords = sheetRecords.filter(r => selectedRows.has(r.id));
      if (selectedRecords.length === 0) return;

      // Validate Same Invoice Logic
      const firstInv = selectedRecords[0].data.invoiceNumber || "";
      const isConsistent = selectedRecords.every(r => (r.data.invoiceNumber || "") === firstInv);

      if (!isConsistent) {
        setBulkError("Selected items have different Invoice Numbers. Cannot submit together.");
      }
      targetRecord = selectedRecords[0];
    }

    if (!targetRecord) return;

    const invoiceNumber = targetRecord.data?.invoiceNumber || "-";
    const vendorName = targetRecord.data?.vendorName || "-";

    setSelectedRecordId(targetRecord.id);
    setFormData({
      handoverBy: "",
      invoiceSubmissionDate: new Date(),
      invoiceNumber,
      vendorName,
    });
    setOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if ((!selectedRecordId && selectedRows.size === 0) || !SHEET_API_URL) return;
    if (bulkError) return;

    // Additional validation if needed, but 'isFormValid' checks formData presence
    if (!isFormValid) return;

    setIsSubmitting(true);
    try {
      const selectedRecords = sheetRecords.filter(r => selectedRows.has(r.id));
      if (selectedRecords.length === 0) return;

      const now = new Date();
      // submissionDate is from formData.invoiceSubmissionDate
      const subDate = formData.invoiceSubmissionDate ? `${formData.invoiceSubmissionDate.getMonth() + 1}/${formData.invoiceSubmissionDate.getDate()}/${formData.invoiceSubmissionDate.getFullYear()}` : "";
      const todayStr = `${now.getMonth() + 1}/${now.getDate()}/${now.getFullYear()}`;

      // Iterate and submit for ALL selected records
      for (const rec of selectedRecords) {
        // Create sparse row (DO NOT copy original row)
        const rowArray = new Array(80).fill("");
        // 49 (AX): Actual 9
        rowArray[49] = todayStr;
        // 51 (AZ): Handover By
        rowArray[51] = formData.handoverBy;
        // 53 (BB): Invoice Submission Date
        rowArray[53] = subDate;

        const params = new URLSearchParams();
        params.append("action", "update");
        params.append("sheetName", "RECEIVING-ACCOUNTS");
        params.append("rowIndex", rec.rowIndex.toString());
        params.append("rowData", JSON.stringify(rowArray));

        await fetch(SHEET_API_URL, { method: "POST", body: params });
      }

      toast.success("Invoice(s) submitted successfully!");
      setOpen(false);
      setSelectedRows(new Set());
      fetchData();

    } catch (error: any) {
      console.error(error);
      toast.error(error.message || "Failed to submit");
    } finally {
      setIsSubmitting(false);
    }
  };



  const safeValue = (record: any, key: string) => {
    try {
      const data = record?.data;
      if (!data) return "-";

      if (key === "vendorName") return data.vendorName || "-";

      if (key === "billAttachment") {
        const url = data.billAttachment;
        if (!url || url === "-" || url === "") return "-";

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
            View
          </a>
        );
      }

      const val = data[key];
      if (val === undefined || val === null || String(val).trim() === "") return "-";

      if ((key.includes("Date") || key.includes("plan") || key.includes("actual")) && !isNaN(Date.parse(String(val)))) {
        return new Date(String(val)).toLocaleDateString("en-IN");
      }

      return String(val);
    } catch {
      return "-";
    }
  };

  const isFormValid =
    formData.handoverBy &&
    formData.invoiceNumber &&
    formData.vendorName;

  if (isLoading && sheetRecords.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
        <Loader2 className="w-8 h-8 animate-spin text-black" />
        <p className="text-gray-500 font-medium">Loading invoices...</p>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="mb-6 p-6 bg-white border rounded-lg shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold">Stage 10: Submit Invoice to Accounts</h2>
            <p className="text-gray-600 mt-1">Hand over original invoice for payment</p>
          </div>
          <div className="flex items-center gap-4">
            <Label className="text-sm font-medium">Show Columns:</Label>
            <Select value="" onValueChange={() => { }}>
              <SelectTrigger className="w-64">
                <SelectValue placeholder={`${activeTab === "pending" ? selectedPendingColumns.length : selectedHistoryColumns.length} selected`} />
              </SelectTrigger>
              <SelectContent className="w-64 max-h-96 overflow-y-auto">
                <div className="p-2">
                  <div className="flex items-center space-x-2 mb-2 pb-2 border-b">
                    <Checkbox
                      checked={activeTab === "pending" ? selectedPendingColumns.length === pendingColumns.length : selectedHistoryColumns.length === historyColumns.length}
                      onCheckedChange={(c) => {
                        if (activeTab === "pending") setSelectedPendingColumns(c ? pendingColumns.map(x => x.key) : []);
                        else setSelectedHistoryColumns(c ? historyColumns.map(x => x.key) : []);
                      }}
                    />
                    <Label>All</Label>
                  </div>
                  {(activeTab === "pending" ? pendingColumns : historyColumns).map(col => (
                    <div key={col.key} className="flex items-center space-x-2 py-1">
                      <Checkbox
                        checked={activeTab === "pending" ? selectedPendingColumns.includes(col.key) : selectedHistoryColumns.includes(col.key)}
                        onCheckedChange={(c) => {
                          if (activeTab === "pending") {
                            setSelectedPendingColumns(c ? [...selectedPendingColumns, col.key] : selectedPendingColumns.filter(x => x !== col.key));
                          } else {
                            setSelectedHistoryColumns(c ? [...selectedHistoryColumns, col.key] : selectedHistoryColumns.filter(x => x !== col.key));
                          }
                        }}
                      />
                      <Label>{col.label}</Label>
                    </div>
                  ))}
                </div>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Header Actions */}
        {selectedRows.size > 0 && (
          <div className="mt-4 flex items-center gap-4">
            <Button
              onClick={() => handleOpenForm()}
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              Submit Invoice ({selectedRows.size})
            </Button>
            <span className="text-sm text-gray-500">
              {selectedRows.size} item(s) selected
            </span>
          </div>
        )}
      </div>

      {/* Search and Filters */}
      <div className="mb-6 flex flex-wrap items-center gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-500" />
          <Input
            placeholder="Search by Indent No, Item, Vendor, PO, Invoice..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9 bg-white"
          />
        </div>

        {/* Warehouse Filter */}
        <Select value={warehouseFilter} onValueChange={setWarehouseFilter}>
          <SelectTrigger className="w-[200px] bg-white">
            <SelectValue placeholder="Select warehouse" />
          </SelectTrigger>
          <SelectContent className="bg-white">
            <SelectItem value="All">All Warehouses</SelectItem>
            <SelectItem value="NE Warehouse">NE Warehouse</SelectItem>
            <SelectItem value="Others">Others</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)}>
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="pending">Pending ({pending.length})</TabsTrigger>
          <TabsTrigger value="history">History ({completed.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="pending" className="mt-6">
          {pending.length === 0 ? (
            <div className="text-center py-12 text-gray-500"><p className="text-lg">No pending submissions</p></div>
          ) : (
            <div className="border rounded-lg overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12 sticky left-0 bg-white z-20">
                      <Checkbox
                        checked={selectedRows.size === pending.length && pending.length > 0}
                        onCheckedChange={toggleAll}
                      />
                    </TableHead>
                    <TableHead className="bg-white z-10">Actions</TableHead>
                    {pendingColumns.filter(c => selectedPendingColumns.includes(c.key)).map(col => (
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
                      <TableCell className="bg-white z-10">
                        <Button variant="outline" size="sm" onClick={() => handleOpenForm(record.id)}>Submit</Button>
                      </TableCell>
                      {pendingColumns.filter(c => selectedPendingColumns.includes(c.key)).map(col => (
                        <TableCell key={col.key}>{safeValue(record, col.key)}</TableCell>
                      ))}

                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </TabsContent>

        <TabsContent value="history" className="mt-6">
          {completed.length === 0 ? (
            <div className="text-center py-12 text-gray-500"><p className="text-lg">No history</p></div>
          ) : (
            <div className="border rounded-lg overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="sticky left-0 bg-white z-10 w-12"></TableHead>
                    {historyColumns.filter(c => selectedHistoryColumns.includes(c.key)).map(col => (
                      <TableHead key={col.key}>{col.label}</TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {completed.map((record: any) => (
                    <TableRow key={record.id}>
                      <TableCell className="sticky left-0 bg-white z-10"></TableCell>
                      {historyColumns.filter(c => selectedHistoryColumns.includes(c.key)).map(col => (
                        <TableCell key={col.key}>{safeValue(record, col.key)}</TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </TabsContent>
      </Tabs>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Submit Invoice ({selectedRows.size} Selected)</DialogTitle>
          </DialogHeader>

          {bulkError && (
            <div className="bg-red-50 text-red-600 p-3 rounded-md text-sm mb-4 border border-red-200">
              {bulkError}
            </div>
          )}

          <div className="py-4 space-y-4">
            <div className="grid grid-cols-2 gap-4 bg-gray-50 p-4 rounded-lg border border-gray-100 mb-6">
              <div>
                <Label className="text-xs font-semibold uppercase text-gray-500 mb-1 block">Invoice #</Label>
                <p className="font-mono font-medium text-lg">{formData.invoiceNumber}</p>
              </div>
              <div>
                <Label className="text-xs font-semibold uppercase text-gray-500 mb-1 block">Vendor</Label>
                <p className="font-medium text-lg text-gray-900">{formData.vendorName}</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
              <div className="space-y-2">
                <Label className="font-medium text-gray-700">Hardcopy Submitted? *</Label>
                <Select value={formData.handoverBy} onValueChange={(v) => setFormData({ ...formData, handoverBy: v })}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Yes">Yes</SelectItem>
                    <SelectItem value="No">No</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-[10px] text-gray-500">Confirm physical docs handover to Accounts</p>
              </div>

              <div className="space-y-2 md:col-span-2">
                <Label className="font-medium text-gray-700">Submission Date *</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="w-full text-left font-normal border-gray-300">
                      {formData.invoiceSubmissionDate ? format(formData.invoiceSubmissionDate, "PPP") : "Pick date"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={formData.invoiceSubmissionDate}
                      onSelect={(d) => d && setFormData({ ...formData, invoiceSubmissionDate: d })}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={isSubmitting}>Cancel</Button>
            <Button onClick={handleSubmit} disabled={!isFormValid || isSubmitting || !!bulkError}>
              {isSubmitting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Submitting...</> : "Submit"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}