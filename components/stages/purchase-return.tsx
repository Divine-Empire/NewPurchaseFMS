"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { toast } from "sonner";
import { Loader2, FileText, RefreshCw, Search } from "lucide-react";
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
const FOLDER_ID = process.env.NEXT_PUBLIC_IMAGE_FOLDER_ID || "1SihRrPrgbuPGm-09fuB180QJhdxq5Nxy";

// Static columns definition
const PENDING_COLUMNS = [
  { key: "indentNumber", label: "Indent #" },
  { key: "category", label: "Category" },
  { key: "itemName", label: "Item" },
  { key: "rejectedQty", label: "Rejected Qty" },
  { key: "vendor", label: "Vendor" },
  { key: "invoiceNumber", label: "Invoice #" },
  { key: "plan6", label: "Plan Date" },
];

const HISTORY_COLUMNS = [
  { key: "indentNumber", label: "Indent #" },
  { key: "itemName", label: "Item" },
  { key: "vendor", label: "Vendor" },
  { key: "invoiceNumber", label: "Invoice #" },
  { key: "plan6", label: "Plan Date" },
  { key: "actual6", label: "Return Date" },
  { key: "returnedQty", label: "Ret Qty" },
  { key: "returnAmount", label: "Ret Amount" },
  { key: "returnReason", label: "Reason" },
  { key: "returnStatus", label: "Status" },
  { key: "returnItemImage", label: "Item Img" },
  { key: "creditNoteImage", label: "Credit Note" },
];

// Helper functions
const safeValue = (val: any, key: string = "") => {
  if (!val || val === "-" || val === "") return "-";
  if (key.includes("Image")) {
    return (
      <a href={String(val)} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline flex items-center gap-1">
        <FileText className="w-3 h-3" /> View
      </a>
    );
  }
  if ((key.includes("plan") || key.includes("actual") || key.includes("Date")) && !isNaN(Date.parse(String(val))) && !String(val).match(/^\d+$/)) {
    return new Date(String(val)).toLocaleDateString("en-IN");
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

      // Build FMS map for vendor info
      const fmsMap = new Map<string, any[]>();
      if (Array.isArray(fmsJson.data)) {
        fmsJson.data.slice(7).forEach((r: any) => {
          if (r[1] && String(r[1]).trim()) fmsMap.set(String(r[1]).trim(), r);
        });
      }

      // 1. Process RECEIVING-ACCOUNTS first to build a lookup map for Indent Details
      const indentMap = new Map<string, any>();
      if (Array.isArray(accJson.data)) {
        accJson.data.slice(6).forEach((row: any) => {
          const indentNo = String(row[1] || "").trim();
          if (!indentNo) return;

          const fmsRow = fmsMap.get(indentNo) || [];
          const selectedVendor = fmsRow[47]; // Index 47
          let vendorName = "-";
          if (selectedVendor === "Vendor 1") vendorName = fmsRow[21];
          else if (selectedVendor === "Vendor 2") vendorName = fmsRow[29];
          else if (selectedVendor === "Vendor 3") vendorName = fmsRow[37];

          indentMap.set(indentNo, {
            indentNumber: indentNo,
            liftNo: row[2] || "",
            category: row[2],
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

      const d = formData.actual6Date;
      const dateStr = `${d.getMonth() + 1}/${d.getDate()}/${d.getFullYear()}`;

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
    <div className="p-6">
      <div className="mb-6 p-6 bg-white border rounded-lg shadow-sm flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">Stage 12: Purchase Return</h2>
          <p className="text-gray-600 mt-1">Manage returns and credit notes</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-500" />
            <Input
              placeholder="Search by Indent No, Item, Vendor, PO, Invoice..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 bg-white w-[300px]"
            />
          </div>
          <Button variant="outline" onClick={fetchData} disabled={isLoading}>
            {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center items-center h-64">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
          <span className="ml-2 text-gray-500">Loading data...</span>
        </div>
      ) : (
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="pending">Pending ({pending.length})</TabsTrigger>
            <TabsTrigger value="history">History ({completed.length})</TabsTrigger>
          </TabsList>

          <TabsContent value="pending" className="mt-6">
            {pending.length === 0 ? (
              <div className="text-center py-12 text-gray-500">No pending returns</div>
            ) : (
              <div className="border rounded-lg overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Actions</TableHead>
                      {PENDING_COLUMNS.map(col => <TableHead key={col.key}>{col.label}</TableHead>)}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pending.map((rec) => (
                      <TableRow key={rec.id}>
                        <TableCell>
                          <Button size="sm" onClick={() => handleOpenForm(rec.id)}>Process</Button>
                        </TableCell>
                        {PENDING_COLUMNS.map(col => (
                          <TableCell
                            key={col.key}
                            className={col.key === "rejectedQty" ? "text-center" : ""}
                          >
                            {safeValue(rec.data[col.key], col.key)}
                          </TableCell>
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
              <div className="text-center py-12 text-gray-500">No return history</div>
            ) : (
              <div className="border rounded-lg overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      {HISTORY_COLUMNS.map(col => <TableHead key={col.key}>{col.label}</TableHead>)}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {completed.map((rec) => (
                      <TableRow key={rec.id}>
                        {HISTORY_COLUMNS.map(col => (
                          <TableCell
                            key={col.key}
                            className={col.key === "rejectedQty" ? "text-center" : ""}
                          >
                            {safeValue(rec.data[col.key], col.key)}
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
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>Process Return</DialogTitle>
          </DialogHeader>
          <div className="p-4 space-y-4">
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