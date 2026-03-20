"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { toast } from "sonner";
import { Loader2, FileText, RefreshCw, Search } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { getFmsTimestamp } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";

const SHEET_API_URL = process.env.NEXT_PUBLIC_API_URI;
const FOLDER_ID = process.env.NEXT_PUBLIC_IMAGE_FOLDER_ID || "1SihRrPrgbuPGm-09fuB180QJhdxq5Nxy";

// Static columns definition
const PENDING_COLUMNS = [
  { key: "indentNumber", label: "Indent No" },
  { key: "unitTrackingNo", label: "Unit Tracking No" },
  { key: "itemName", label: "Item" },
  { key: "rejectedQty", label: "Rejected Qty" },
  { key: "vendor", label: "Vendor" },
  { key: "invoiceNumber", label: "Invoice No" },
  { key: "plan6", label: "Planned" },
];

const HISTORY_COLUMNS = [
  { key: "indentNumber", label: "Indent No" },
  { key: "unitTrackingNo", label: "Unit Tracking No" },
  { key: "itemName", label: "Item" },
  { key: "vendor", label: "Vendor" },
  { key: "invoiceNumber", label: "Invoice No" },
  { key: "plan6", label: "Planned" },
  { key: "actual6", label: "Actual" },
  { key: "returnedQty", label: "Return Qty" },
  { key: "returnAmount", label: "Return Amount" },
  { key: "returnReason", label: "Reason" },
  { key: "returnStatus", label: "Status" },
  { key: "returnItemImage", label: "Item Img" },
  { key: "creditNoteImage", label: "Credit Note" },
];

// Helper functions
const formatDateDash = (date: any) => {
  if (!date || date === "-" || date === "—") return "-";
  const d = new Date(date);
  if (isNaN(d.getTime())) return typeof date === "string" ? date : "-";
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${dd}-${mm}-${yyyy}`;
};

const safeValue = (val: any, key: string = "") => {
  if (!val || val === "-" || val === "") return "-";
  if (key.includes("Image") || key.includes("Attachment") || key.includes("Copy")) {
    return (
      <a href={String(val)} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-blue-50 text-blue-600 hover:bg-blue-100 transition-colors text-xs font-medium">
        <FileText className="w-3.5 h-3.5" /> 
        View
      </a>
    );
  }
  const lowKey = key.toLowerCase();
  if (lowKey.includes("plan") || lowKey.includes("actual") || lowKey.includes("date")) {
    return formatDateDash(val);
  }
  return String(val);
};

const toBase64 = (file: File) => new Promise<string>((resolve, reject) => {
  const reader = new FileReader();
  reader.readAsDataURL(file);
  reader.onload = () => resolve(reader.result as string);
  reader.onerror = error => reject(error);
});

export default function Stage12() {
  const [sheetRecords, setSheetRecords] = useState<any[]>([]); // Used for Pending tab
  const [partialReturnRecords, setPartialReturnRecords] = useState<any[]>([]); // Used for History tab
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [open, setOpen] = useState(false);
  const [selectedRecordId, setSelectedRecordId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"pending" | "history">("pending");
  const [searchTerm, setSearchTerm] = useState("");

  const [formData, setFormData] = useState({
    returnedQty: "",
    returnRate: "",
    returnAmount: "",
    returnReason: "",
    returnStatus: "",
    returnItemImage: null as File | null,
    creditNoteImage: null as File | null,
    actual6Date: new Date(),
  });

  const [originalQty, setOriginalQty] = useState(0);

  // -----------------------------------------------------------------
  // FETCH DATA
  // -----------------------------------------------------------------
  const fetchData = useCallback(async () => {
    if (!SHEET_API_URL) return;
    setIsLoading(true);
    try {
      // Parallel fetch for speed
      const [accRes, fmsRes, partialRes] = await Promise.all([
        fetch(`${SHEET_API_URL}?sheet=RECEIVING-ACCOUNTS&action=getAll`, { cache: "no-store" }),
        fetch(`${SHEET_API_URL}?sheet=INDENT-LIFT&action=getAll`, { cache: "no-store" }),
        fetch(`${SHEET_API_URL}?sheet=Partial QC&action=getAll`, { cache: "no-store" }),
      ]);

      const [accJson, fmsJson, partialJson] = await Promise.all([
        accRes.json(),
        fmsRes.json(),
        partialRes.json(),
      ]);

      if (!accJson.success) console.error("Receiving Accounts fetch failed:", accJson);
      if (!fmsJson.success) console.error("Indent Lift fetch failed:", fmsJson);
      if (!partialJson.success) console.error("Partial QC fetch failed:", partialJson);

      if (!accJson.success || !fmsJson.success || !partialJson.success) {
        throw new Error("Failed to load sheet data. Check console for details.");
      }

      // Build lookup maps

      // Process RECEIVING-ACCOUNTS to build a lookup map for Indent Details
      const indentMap = new Map<string, any>();
      if (Array.isArray(accJson.data)) {
        accJson.data.slice(6).forEach((row: any) => {
          const indentNo = String(row[1] || "").trim();
          if (!indentNo) return;

          indentMap.set(indentNo, {
            indentNumber: indentNo,
            unitTrackingNo: row[2] || "",
            itemName: row[7],
            vendor: row[3],
            invoiceNumber: row[24],
            poNumber: row[4],
          });
        });
      }

      // 2. Process Partial QC rows to determine Pending & History
      let newPending: any[] = [];
      let newHistory: any[] = [];

      if (Array.isArray(partialJson.data)) {
        partialJson.data.slice(1).forEach((r: any, idx: number) => {
          const rowIndex = idx + 2; // Data starts at row 2
          const indentNo = String(r[1] || "").trim();
          const status = String(r[5] || "").toLowerCase();
          const returnStatus = String(r[12] || "").toLowerCase(); // M
          const plan7 = String(r[13] || "").trim(); // N
          const actual7 = String(r[14] || "").trim(); // O
          const rejectQty = parseFloat(r[7] || "0"); // H

          // Basic Criteria: QC Rejected AND Return Status is 'return'
          if (!indentNo || status !== "rejected" || !returnStatus.includes("return")) return;

          const parent = indentMap.get(indentNo) || {};

          const record = {
            id: `partial-${rowIndex}`,
            rowIndex,
            data: {
              ...parent,
              indentNumber: indentNo,
              rejectedQty: rejectQty,
              rejectQty: rejectQty,
              plan6: plan7,
              actual6: actual7,

              // Return Details (Cols Q-W / 16-22)
              returnedQty: r[16], // Q
              returnRate: r[17],  // R
              returnAmount: r[18],// S
              returnReason: r[19],// T
              returnStatus: r[20],// U
              returnItemImage: r[21], // V
              creditNoteImage: r[22], // W
              originalRow: r,
            }
          };

          const hasPlan = plan7 && plan7 !== "-" && plan7 !== "#VALUE!";
          const hasActual = actual7 && actual7 !== "-" && actual7 !== "#VALUE!";

          if (hasActual) {
            newHistory.push(record);
          } else if (hasPlan) {
            newPending.push(record);
          }
        });
      }

      setSheetRecords(newPending);
      setPartialReturnRecords(newHistory);

    } catch (e) {
      console.error("Fetch error:", e);
      toast.error("Failed to fetch data");
    }
    setIsLoading(false);
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // -----------------------------------------------------------------
  // MEMOIZED FILTER RECORDS
  // -----------------------------------------------------------------
  const pending = useMemo(() => {
    return sheetRecords.filter((r) => {
      const searchLower = searchTerm.toLowerCase();
      if (!searchLower) return true;
      return (
        r.data.indentNumber?.toLowerCase().includes(searchLower) ||
        r.data.itemName?.toLowerCase().includes(searchLower) ||
        r.data.vendor?.toLowerCase().includes(searchLower) ||
        String(r.data.poNumber || "").toLowerCase().includes(searchLower) ||
        String(r.data.invoiceNumber || "").toLowerCase().includes(searchLower)
      );
    });
  }, [sheetRecords, searchTerm]);

  const completed = useMemo(() => {
    const searchLower = searchTerm.toLowerCase();
    if (!searchLower) return partialReturnRecords;
    return partialReturnRecords.filter((r) => {
      return (
        r.data.indentNumber?.toLowerCase().includes(searchLower) ||
        r.data.itemName?.toLowerCase().includes(searchLower) ||
        r.data.vendor?.toLowerCase().includes(searchLower) ||
        String(r.data.invoiceNumber || "").toLowerCase().includes(searchLower)
      );
    });
  }, [partialReturnRecords, searchTerm]);

  // -----------------------------------------------------------------
  // HANDLERS
  // -----------------------------------------------------------------
  const handleOpenForm = useCallback((recordId: string) => {
    const rec = sheetRecords.find((r) => r.id === recordId);
    if (!rec) return;

    // Use Reject Qty as max
    const rejectQty = parseFloat(rec.data.rejectQty || "0") || 0;
    setOriginalQty(rejectQty);

    setSelectedRecordId(recordId);
    setFormData({
      returnedQty: rejectQty > 0 ? rejectQty.toString() : "",
      returnRate: "",
      returnAmount: "",
      returnReason: "",
      returnStatus: "",
      returnItemImage: null,
      creditNoteImage: null,
      actual6Date: new Date(),
    });
    setOpen(true);
  }, [sheetRecords]);

  // Calculate amount effect safely
  useEffect(() => {
    const qty = parseFloat(formData.returnedQty) || 0;
    const rate = parseFloat(formData.returnRate) || 0;
    setFormData(prev => {
      const newAmount = (qty * rate).toFixed(2);
      if (prev.returnAmount === newAmount) return prev;
      return { ...prev, returnAmount: newAmount };
    });
  }, [formData.returnedQty, formData.returnRate]);


  const uploadFile = useCallback(async (file: File) => {
    const upParams = new URLSearchParams();
    upParams.append("action", "uploadFile");
    upParams.append("base64Data", await toBase64(file));
    upParams.append("fileName", file.name);
    upParams.append("mimeType", file.type);
    upParams.append("folderId", FOLDER_ID);

    const upRes = await fetch(`${SHEET_API_URL}`, { method: "POST", body: upParams });
    const upJson = await upRes.json();
    if (upJson.success) return upJson.fileUrl;
    throw new Error("Upload failed");
  }, []);

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRecordId) return;

    const rec = sheetRecords.find((r) => r.id === selectedRecordId);
    if (!rec) return;

    setIsSubmitting(true);
    const toastId = toast.loading("Processing Return...");

    try {
      let itemImgUrl = "";
      let creditImgUrl = "";

      // Parallel uploads
      const uploadPromises = [];
      if (formData.returnItemImage) uploadPromises.push(uploadFile(formData.returnItemImage).then(url => { itemImgUrl = url; }));
      if (formData.creditNoteImage) uploadPromises.push(uploadFile(formData.creditNoteImage).then(url => { creditImgUrl = url; }));

      if (uploadPromises.length > 0) await Promise.all(uploadPromises);

      const pad = (n: number) => String(n).padStart(2, "0");
      const d = formData.actual6Date || new Date();
      const dateStr = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(new Date().getHours())}:${pad(new Date().getMinutes())}:${pad(new Date().getSeconds())}`;

      // Update specific Partial QC cells using updateCell to avoid overwriting row data (col A-N) or formulas (col P)
      // O: Actual7 (Return Date) -> Col 15
      // P: Delay7 -> Col 16 (Formula, SKIP)
      // Q-W: Return columns -> Col 17-23

      const updates = [
        { col: 15, val: dateStr },            // O: Actual7
        { col: 17, val: formData.returnedQty }, // Q: Return Qty
        { col: 18, val: formData.returnRate },  // R: Return Rate
        { col: 19, val: formData.returnAmount },// S: Total Return Amount
        { col: 20, val: formData.returnReason },// T: Return Reason
        { col: 21, val: formData.returnStatus },// U: Return Status
        { col: 22, val: itemImgUrl },           // V: Return Item Image
        { col: 23, val: creditImgUrl },         // W: Credit Note Image
      ];

      // Parallel updates for speed
      await Promise.all(updates.map(u => {
        const params = new URLSearchParams();
        params.append("action", "updateCell");
        params.append("sheetName", "Partial QC");
        params.append("rowIndex", rec.rowIndex.toString());
        params.append("columnIndex", u.col.toString());
        params.append("value", String(u.val || ""));

        return fetch(`${SHEET_API_URL}`, { method: "POST", body: params });
      }));

      toast.success("Return processed successfully!", { id: toastId });
      setOpen(false);
      fetchData(); // Refresh data
    } catch (err: any) {
      toast.error(err.message || "Failed to submit", { id: toastId });
    } finally {
      setIsSubmitting(false);
    }
  }, [selectedRecordId, sheetRecords, formData, uploadFile, fetchData]);


  const isFormValid = useMemo(() =>
    !!formData.returnedQty &&
    !!formData.returnRate &&
    !!formData.returnReason &&
    !!formData.returnStatus &&
    parseFloat(formData.returnedQty) <= originalQty
    , [formData, originalQty]);

  return (
    <div className="flex flex-col min-h-screen bg-slate-50/30">
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)} className="w-full flex flex-col h-full">
        {/* Sticky Top Header */}
        <div className="sticky top-0 z-30 bg-white/80 backdrop-blur-md border-b shadow-sm">
          <div className="max-w-[1600px] mx-auto">
            <div className="p-4 md:p-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
              <div>
                <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
                  <span className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center shadow-blue-200 shadow-lg">
                    <RefreshCw className="w-6 h-6 text-white" />
                  </span>
                  Stage 12: Purchase Return
                </h1>
                <p className="text-slate-500 text-sm mt-1 ml-12">Process and track returns for rejected QC items</p>
              </div>
              
              <div className="flex items-center gap-3 w-full md:w-auto">
                <div className="relative flex-1 md:w-80 group">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 group-focus-within:text-blue-500 transition-colors" />
                  <Input
                    placeholder="Search by indent, item, vendor..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10 bg-slate-50 border-slate-200 focus:bg-white focus:ring-2 focus:ring-blue-100 transition-all h-10 rounded-xl"
                  />
                </div>
                <Button 
                  variant="outline" 
                  size="icon"
                  onClick={fetchData} 
                  disabled={isLoading}
                  className="h-10 w-10 rounded-xl bg-white hover:bg-slate-50 text-slate-600 border-slate-200"
                >
                  <RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`} />
                </Button>
              </div>
            </div>

            <div className="px-6 pb-2">
              <TabsList className="bg-slate-200/50 p-1 rounded-xl h-11 inline-flex w-auto mb-2">
                <TabsTrigger 
                  value="pending" 
                  className="rounded-lg px-6 data-[state=active]:bg-white data-[state=active]:shadow-sm data-[state=active]:text-blue-600 transition-all font-medium"
                >
                  Pending Returns ({pending.length})
                </TabsTrigger>
                <TabsTrigger 
                  value="history"
                  className="rounded-lg px-6 data-[state=active]:bg-white data-[state=active]:shadow-sm data-[state=active]:text-blue-600 transition-all font-medium"
                >
                  Return History ({completed.length})
                </TabsTrigger>
              </TabsList>
            </div>
          </div>
        </div>

        <div className="p-4 md:p-6 max-w-[1600px] mx-auto w-full flex-1">
          {isLoading && sheetRecords.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 bg-white border rounded-2xl shadow-sm">
              <div className="relative">
                <div className="w-12 h-12 border-4 border-blue-100 border-t-blue-600 rounded-full animate-spin"></div>
                <RefreshCw className="w-5 h-5 text-blue-600 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 animate-pulse" />
              </div>
              <p className="mt-4 text-slate-500 font-medium animate-pulse">Synchronizing return data...</p>
            </div>
          ) : (
            <div className="bg-white border rounded-2xl shadow-sm overflow-hidden flex flex-col h-full">
              <TabsContent value="pending" className="flex-1 mt-0 focus-visible:outline-none">
                {pending.length === 0 ? (
                  <div className="py-20 flex flex-col items-center justify-center text-center">
                    <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mb-4 transition-transform hover:scale-110">
                      <FileText className="w-10 h-10 text-slate-300" />
                    </div>
                    <h3 className="text-xl font-semibold text-slate-900">No pending returns</h3>
                    <p className="text-slate-500 mt-2 max-w-sm">
                      All rejected items have been processed or there are no QC rejections currently.
                    </p>
                  </div>
                ) : (
                  <div className="overflow-x-auto overflow-y-auto max-h-[calc(100vh-320px)] custom-scrollbar">
                    <table className="w-full text-sm text-left border-collapse min-w-[1200px]">
                      <thead className="sticky top-0 z-10 shadow-sm">
                        <tr className="bg-slate-200 border-b border-slate-300">
                          <th className="px-4 py-4 font-semibold text-slate-900 w-24">Actions</th>
                          {PENDING_COLUMNS.map((col) => (
                            <th key={col.key} className="px-4 py-4 font-semibold text-slate-900 whitespace-nowrap">
                              {col.label}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {pending.map((record) => (
                          <tr key={record.id} className="hover:bg-slate-50/80 transition-colors group">
                            <td className="px-4 py-3 whitespace-nowrap">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleOpenForm(record.id)}
                                className="h-8 bg-white hover:bg-blue-50 hover:text-blue-600 hover:border-blue-200 transition-all font-medium"
                              >
                                Process
                              </Button>
                            </td>
                            {PENDING_COLUMNS.map((col) => (
                              <td key={col.key} className="px-4 py-3 text-slate-600 whitespace-nowrap">
                                {safeValue(record.data[col.key], col.key)}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </TabsContent>

              <TabsContent value="history" className="flex-1 mt-0 focus-visible:outline-none">
                {completed.length === 0 ? (
                  <div className="py-20 flex flex-col items-center justify-center text-center">
                    <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mb-4 transition-transform hover:scale-110">
                      <Search className="w-10 h-10 text-slate-300" />
                    </div>
                    <h3 className="text-xl font-semibold text-slate-900">No history found</h3>
                    <p className="text-slate-500 mt-2 max-w-sm">
                      Processed purchase returns will appear here once they are submitted.
                    </p>
                  </div>
                ) : (
                  <div className="overflow-x-auto overflow-y-auto max-h-[calc(100vh-320px)] custom-scrollbar">
                    <table className="w-full text-sm text-left border-collapse min-w-[1400px]">
                      <thead className="sticky top-0 z-10 shadow-sm">
                        <tr className="bg-slate-200 border-b border-slate-300">
                          {HISTORY_COLUMNS.map((col) => (
                            <th key={col.key} className="px-4 py-4 font-semibold text-slate-900 whitespace-nowrap">
                              {col.label}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {completed.map((record) => (
                          <tr key={record.id} className="hover:bg-slate-50/80 transition-colors">
                            {HISTORY_COLUMNS.map((col) => (
                              <td key={col.key} className="px-4 py-3 text-slate-600 whitespace-nowrap">
                                {safeValue(record.data[col.key], col.key)}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </TabsContent>
            </div>
          )}
        </div>
      </Tabs>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col p-0 overflow-hidden rounded-2xl border-none shadow-2xl bg-white">
          <DialogHeader className="p-6 bg-slate-50/80 backdrop-blur-sm border-b shrink-0">
            <DialogTitle className="text-xl font-bold flex items-center gap-3 text-slate-900">
              <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
                <RefreshCw className="w-5 h-5 text-blue-600" />
              </div>
              Process Purchase Return
            </DialogTitle>
          </DialogHeader>
          <div className="p-6 space-y-6 flex-1 overflow-y-auto custom-scrollbar">
            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label>Return Qty * (Max: {originalQty})</Label>
                <Input
                  type="number"
                  min="0"
                  max={originalQty}
                  value={formData.returnedQty}
                  onChange={e => {
                    const val = e.target.value;
                    setFormData(prev => ({ ...prev, returnedQty: val }));
                  }}
                  placeholder={`Max: ${originalQty}`}
                  className={parseFloat(formData.returnedQty) > originalQty ? "border-red-500" : ""}
                />
                {parseFloat(formData.returnedQty) > originalQty && (
                  <p className="text-red-500 text-xs mt-1">Cannot exceed reject qty ({originalQty})</p>
                )}
              </div>
              <div>
                <Label>Return Rate *</Label>
                <Input
                  type="number"
                  value={formData.returnRate}
                  onChange={e => setFormData(prev => ({ ...prev, returnRate: e.target.value }))}
                />
              </div>
              <div>
                <Label>Return Amount</Label>
                <Input value={formData.returnAmount} readOnly className="bg-gray-50" />
              </div>

              <div>
                <Label>Return Date *</Label>
                <Input
                  type="date"
                  value={formData.actual6Date instanceof Date && !isNaN(formData.actual6Date.getTime()) ? formData.actual6Date.toISOString().split("T")[0] : ""}
                  onChange={(e) => {
                    const d = new Date(e.target.value);
                    if (!isNaN(d.getTime())) {
                      setFormData(prev => ({ ...prev, actual6Date: d }));
                    }
                  }}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Return Reason *</Label>
                <Input
                  value={formData.returnReason}
                  onChange={e => setFormData(prev => ({ ...prev, returnReason: e.target.value }))}
                />
              </div>
              <div>
                <Label>Status *</Label>
                <Select value={formData.returnStatus} onValueChange={v => setFormData(prev => ({ ...prev, returnStatus: v }))}>
                  <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Debit Note">Debit Note</SelectItem>
                    <SelectItem value="Replaced (DN)">Replaced (DN)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>


            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Return Item Image</Label>
                <Input type="file" accept="image/*" onChange={(e) => {
                  const file = e.target.files?.[0] || null;
                  setFormData(prev => ({ ...prev, returnItemImage: file }));
                }} />
              </div>
              <div>
                <Label>Credit Note Image</Label>
                <Input type="file" accept="image/*" onChange={(e) => {
                  const file = e.target.files?.[0] || null;
                  setFormData(prev => ({ ...prev, creditNoteImage: file }));
                }} />
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button onClick={handleSubmit} disabled={isSubmitting || !isFormValid}>
                {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : "Submit"}
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}