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

const HANDOVER_PERSONNEL = [
  "Vikram Singh",
  "Priya Sharma",
  "Rajesh Kumar",
  "Anita Patel",
  "Sneha Gupta",
];

const ACCOUNTS_PERSONNEL = [
  "Amit Shah",
  "Neha Jain",
  "Suresh Patel",
  "Kavita Rao",
  "Rohit Verma",
];

const SHEET_API_URL = process.env.NEXT_PUBLIC_API_URI;

export default function Stage10() {
  const [sheetRecords, setSheetRecords] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [open, setOpen] = useState(false);
  const [selectedRecordId, setSelectedRecordId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"pending" | "history">("pending");

  const [formData, setFormData] = useState({
    handoverBy: "",
    receivedBy: "",
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
            // 55: Plan 9 (Trigger for Pending)
            // 56: Actual 9 (Completion)
            const hasPlan9 = !!row[50] && String(row[50]).trim() !== "";
            const hasActual9 = !!row[51] && String(row[51]).trim() !== "";

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
                category: row[3],
                itemName: row[4],
                quantity: row[5],
                warehouse: row[6],
                deliveryDate: row[7],

                // Stage 6 (9-24)
                poNumber: row[12],

                // Stage 7 (25-39)
                billAttachment: row[35],
                invoiceNumber: row[31],
                invoiceDate: row[30],
                srnNumber: row[32],
                receiptLiftNumber: row[28],

                // Stage 8 (40-49)
                qcStatus: row[44],
                qcDate: row[43],

                // Stage 9 (44-49)
                tallyDoneBy: row[47],
                tallyDate: row[48],
                tallyRemarks: row[49],

                // Stage 10 (50-55)
                plan9: row[50],   // Plan Date
                actual9: row[51], // Actual Date
                handoverBy: row[53],
                receivedBy: row[54],
                invoiceSubmissionDate: row[55],

                // FMS Data
                approvedBy: fmsRow[12],
                basicValue: fmsRow[53],
                totalWithTax: fmsRow[54],
                poCopy: fmsRow[56],
                ...vendorDetails
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

  const pending = sheetRecords.filter((r) => r.status === "pending");
  const completed = sheetRecords.filter((r) => r.status === "completed");

  const pendingColumns = [
    { key: "indentNumber", label: "Indent #" },
    { key: "category", label: "Category" },
    { key: "itemName", label: "Item" },
    { key: "quantity", label: "Qty" },
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

  const handleOpenForm = (recordId: string) => {
    const record = sheetRecords.find((r) => r.id === recordId);
    if (!record) return;

    const vendor = getVendorData(record);
    const invoiceNumber = record.data?.invoiceNumber || "-";
    const vendorName = vendor.name !== "-" ? vendor.name : (record.data?.vendorName || "-");

    setSelectedRecordId(recordId);
    setFormData({
      handoverBy: "",
      receivedBy: "",
      invoiceSubmissionDate: new Date(),
      invoiceNumber,
      vendorName,
    });
    setOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRecordId || !isFormValid || !SHEET_API_URL) return;

    setIsSubmitting(true);
    try {
      const rec = sheetRecords.find((r) => r.id === selectedRecordId);
      if (!rec) throw new Error("Record not found");

      const now = new Date();
      // submissionDate is from formData.invoiceSubmissionDate
      const subDate = formData.invoiceSubmissionDate ? `${formData.invoiceSubmissionDate.getMonth() + 1}/${formData.invoiceSubmissionDate.getDate()}/${formData.invoiceSubmissionDate.getFullYear()}` : "";
      const todayStr = `${now.getMonth() + 1}/${now.getDate()}/${now.getFullYear()}`;

      // Create sparse row (DO NOT copy original row)
      const rowArray = new Array(80).fill(""); // >= sheet width

      // Ensure array size covers up to index 55
      while (rowArray.length <= 55) {
        rowArray.push("");
      }

      // 56: Actual 9 (Today or Form Date? Typically Actual is completion date)
      rowArray[51] = todayStr;
      rowArray[52] = "";

      // 57: Handover By
      rowArray[53] = formData.handoverBy;

      // 58: Received By
      rowArray[54] = formData.receivedBy;

      // 59: Invoice Submission Date (from Form)
      rowArray[55] = subDate;

      const params = new URLSearchParams();
      params.append("action", "update");
      params.append("sheetName", "RECEIVING-ACCOUNTS");
      params.append("rowIndex", rec.rowIndex.toString());
      params.append("rowData", JSON.stringify(rowArray));

      const res = await fetch(SHEET_API_URL, { method: "POST", body: params });
      const json = await res.json();
      console.log("Submission response:", json);

      if (json.success) {
        toast.success("Invoice submitted successfully!");
        setOpen(false);
        fetchData();
      } else {
        toast.error("Failed to submit invoice.");
      }
    } catch (error: any) {
      console.error(error);
      toast.error(error.message || "Failed to submit");
    } finally {
      setIsSubmitting(false);
    }
  };

  const getVendorData = (record: any) => {
    const data = record?.data;
    if (!data) return { name: "-", rate: "-", terms: "-" };
    const selectedId = data.selectedVendor || "vendor1";
    const idx = parseInt(selectedId.replace("vendor", ""), 10) || 1;
    return {
      name: data[`vendor${idx}Name`] || "-",
      rate: data[`vendor${idx}Rate`] || "-",
      terms: data[`vendor${idx}Terms`] || "-",
    };
  };

  const safeValue = (record: any, key: string) => {
    try {
      const data = record?.data;
      if (!data) return "-";

      const vendor = getVendorData(record);

      if (key === "billAttachment") {
        const url = data.billAttachment;
        if (!url || url === "-" || url === "") return "-";
        return (
          <a
            href={String(url)}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 text-xs text-blue-600 hover:underline"
          >
            <FileText className="w-3.5 h-3.5" />
            View
          </a>
        );
      }

      if (key === "vendorName") return vendor.name;

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
                    <TableHead className="sticky left-0 bg-white z-10">ID</TableHead>
                    <TableHead className="bg-white z-10">Actions</TableHead>
                    {pendingColumns.filter(c => selectedPendingColumns.includes(c.key)).map(col => (
                      <TableHead key={col.key}>{col.label}</TableHead>
                    ))}

                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pending.map((record: any) => (
                    <TableRow key={record.id}>
                      <TableCell className="font-mono text-xs sticky left-0 bg-white z-10">{record.id}</TableCell>
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
                    <TableHead className="sticky left-0 bg-white z-10">ID</TableHead>
                    {historyColumns.filter(c => selectedHistoryColumns.includes(c.key)).map(col => (
                      <TableHead key={col.key}>{col.label}</TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {completed.map((record: any) => (
                    <TableRow key={record.id}>
                      <TableCell className="font-mono text-xs sticky left-0 bg-white z-10">{record.id}</TableCell>
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
          <DialogHeader><DialogTitle>Submit Invoice</DialogTitle></DialogHeader>
          <div className="py-4 space-y-4">
            <div className="grid grid-cols-2 gap-4 bg-gray-50 p-4 rounded">
              <div><Label>Invoice #</Label><p className="font-mono">{formData.invoiceNumber}</p></div>
              <div><Label>Vendor</Label><p>{formData.vendorName}</p></div>
            </div>
            <div>
              <Label>Hardcopy Docs submitted to Acc *</Label>
              <Select value={formData.handoverBy} onValueChange={(v) => setFormData({ ...formData, handoverBy: v })}>
                <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Yes">Yes</SelectItem>
                  <SelectItem value="No">No</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Submission Date *</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full text-left font-normal">
                    {formData.invoiceSubmissionDate ? format(formData.invoiceSubmissionDate, "PPP") : "Pick date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar mode="single" selected={formData.invoiceSubmissionDate} onSelect={(d) => d && setFormData({ ...formData, invoiceSubmissionDate: d })} initialFocus />
                </PopoverContent>
              </Popover>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={isSubmitting}>Cancel</Button>
            <Button onClick={handleSubmit} disabled={!isFormValid || isSubmitting}>
              {isSubmitting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Submitting...</> : "Submit"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}