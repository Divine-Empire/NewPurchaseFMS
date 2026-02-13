"use client";

import React, { useState, useEffect } from "react";
import { toast } from "sonner";
import { Loader2, FileText, Upload, RefreshCw, CheckCircle, XCircle, Search } from "lucide-react";
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

export default function Stage12() {
  const [sheetRecords, setSheetRecords] = useState<any[]>([]);
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
  const fetchData = async () => {
    if (!SHEET_API_URL) return;
    setIsLoading(true);
    try {
      // Fetch both sheets to join data like Stage 14 did
      const [accRes, fmsRes] = await Promise.all([
        fetch(`${SHEET_API_URL}?sheet=RECEIVING-ACCOUNTS&action=getAll`),
        fetch(`${SHEET_API_URL}?sheet=INDENT_LIFT&action=getAll`) // Assuming we need Vendor info from here
      ]);

      const accJson = await accRes.json();
      const fmsJson = await fmsRes.json();

      // Create FMS Map for Vendor Info
      const fmsMap = new Map<string, any[]>();
      if (fmsJson.success && Array.isArray(fmsJson.data)) {
        fmsJson.data.slice(7).forEach((r: any) => {
          if (r[1] && String(r[1]).trim()) {
            fmsMap.set(String(r[1]).trim(), r);
          }
        });
      }

      if (accJson.success && Array.isArray(accJson.data)) {
        const rows = accJson.data.slice(6)
          .map((row: any, i: number) => ({ row, originalIndex: i + 7 }))
          .filter(({ row }: any) => row[1] && String(row[1]).trim() !== "")
          .map(({ row, originalIndex }: any) => {
            const indentNo = String(row[1]).trim();
            const fmsRow = fmsMap.get(indentNo) || [];

            // Vendor Logic (from Stage 14 pattern)
            const selectedVendor = fmsRow[47];
            let vendorName = "-";
            if (selectedVendor === "Vendor 1") vendorName = fmsRow[21];
            else if (selectedVendor === "Vendor 2") vendorName = fmsRow[29];
            else if (selectedVendor === "Vendor 3") vendorName = fmsRow[37];

            // --- STATUS LOGIC ---
            // Pending: Plan 6 (Index 71) NOT Empty AND Actual 6 (Index 72) Empty
            // History: Plan 6 (Index 71) NOT Empty AND Actual 6 (Index 72) NOT Empty
            const plan6 = row[71]; // BT
            const actual6 = row[72]; // BU

            const hasPlan = !!plan6 && String(plan6).trim() !== "" && String(plan6).trim() !== "-";
            const hasActual = !!actual6 && String(actual6).trim() !== "" && String(actual6).trim() !== "-";

            let status = "not_ready";
            if (hasPlan && hasActual) {
              status = "history";
            } else if (hasPlan && !hasActual) {
              status = "pending";
            }

            return {
              id: row[1], // Indent # as ID
              rowIndex: originalIndex,
              status,
              originalRow: row,
              data: {
                indentNumber: row[1],
                category: row[2], // Assuming Category
                itemName: row[7], // Col H (Index 7)
                rejectedQty: row[68], // Col BQ (Index 68) - Rejected Qty
                vendor: row[3], // Col D (Index 3) - Vendor from RECEIVING-ACCOUNTS
                invoiceNumber: row[24], // Col Y (Index 24) - Invoice Number

                // QC Reject Qty (Column BQ = index 68)
                rejectQty: row[68],

                // Stage 12 Fields (BT-CC -> 71-80)
                poNumber: row[4], // Col E (Index 4)
                plan6: row[71],   // BT
                actual6: row[72], // BU
                delay6: row[73],  // BV
                returnedQty: row[74], // BW
                returnRate: row[75],  // BX
                returnAmount: row[76], // BY
                returnReason: row[77], // BZ
                returnStatus: row[78], // CA
                returnItemImage: row[79], // CB
                creditNoteImage: row[80], // CC
              }
            };
          });
        setSheetRecords(rows);
      }
    } catch (e) {
      console.error("Fetch error:", e);
      toast.error("Failed to fetch data");
    }
    setIsLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, []);

  // -----------------------------------------------------------------
  // FILTER RECORDS
  // -----------------------------------------------------------------
  // FILTER RECORDS
  // -----------------------------------------------------------------
  const pending = sheetRecords
    .filter((r) => r.status === "pending")
    .filter((r) => {
      const searchLower = searchTerm.toLowerCase();
      return (
        r.data.indentNumber?.toLowerCase().includes(searchLower) ||
        r.data.itemName?.toLowerCase().includes(searchLower) ||
        r.data.vendor?.toLowerCase().includes(searchLower) ||
        String(r.data.poNumber || "").toLowerCase().includes(searchLower) ||
        String(r.data.invoiceNumber || "").toLowerCase().includes(searchLower)
      );
    });
  const completed = sheetRecords.filter((r) => r.status === "history");

  const pendingColumns = [
    { key: "indentNumber", label: "Indent #" },
    { key: "category", label: "Category" },
    { key: "itemName", label: "Item" },
    { key: "rejectedQty", label: "Rejected Qty" },
    { key: "vendor", label: "Vendor" },
    { key: "invoiceNumber", label: "Invoice #" },
    { key: "plan6", label: "Plan Date" },
  ];

  const historyColumns = [
    ...pendingColumns,
    { key: "actual6", label: "Return Date" },
    { key: "returnedQty", label: "Ret Qty" },
    { key: "returnAmount", label: "Ret Amount" },
    { key: "returnReason", label: "Reason" },
    { key: "returnStatus", label: "Status" },
  ];

  // -----------------------------------------------------------------
  // OPEN MODAL
  // -----------------------------------------------------------------
  const handleOpenForm = (recordId: string) => {
    const rec = sheetRecords.find((r) => r.id === recordId);
    if (!rec) return;

    // Use Reject Qty from QC (Column AP) as the max return quantity
    const rejectQty = parseInt(rec.data?.rejectQty || "0", 10) || 0;
    setOriginalQty(rejectQty);

    setSelectedRecordId(recordId);
    setFormData({
      returnedQty: rejectQty > 0 ? rejectQty.toString() : "", // Pre-fill with reject qty
      returnRate: "",
      returnAmount: "",
      returnReason: "",
      returnStatus: "",
      returnItemImage: null,
      creditNoteImage: null,
      actual6Date: new Date(),
    });
    setOpen(true);
  };

  // -----------------------------------------------------------------
  // CALCULATE AMOUNT
  // -----------------------------------------------------------------
  useEffect(() => {
    const qty = parseFloat(formData.returnedQty) || 0;
    const rate = parseFloat(formData.returnRate) || 0;
    setFormData(prev => ({ ...prev, returnAmount: (qty * rate).toFixed(2) }));
  }, [formData.returnedQty, formData.returnRate]);

  // -----------------------------------------------------------------
  // HELPER: UPLOAD
  // -----------------------------------------------------------------
  const toBase64 = (file: File) => new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = error => reject(error);
  });

  const uploadFile = async (file: File) => {
    const upParams = new URLSearchParams();
    upParams.append("action", "uploadFile");
    upParams.append("base64Data", await toBase64(file));
    upParams.append("fileName", file.name);
    upParams.append("mimeType", file.type);
    const folderId = process.env.NEXT_PUBLIC_IMAGE_FOLDER_ID || "1SihRrPrgbuPGm-09fuB180QJhdxq5Nxy";
    upParams.append("folderId", folderId);

    const upRes = await fetch(`${SHEET_API_URL}`, { method: "POST", body: upParams });
    const upJson = await upRes.json();
    if (upJson.success) return upJson.fileUrl;
    throw new Error("Upload failed");
  };

  // -----------------------------------------------------------------
  // SUBMIT
  // -----------------------------------------------------------------
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRecordId) return;

    const rec = sheetRecords.find((r) => r.id === selectedRecordId);
    if (!rec) return;

    setIsSubmitting(true);
    const toastId = toast.loading("Processing Return...");

    try {
      let itemImgUrl = "";
      let creditImgUrl = "";

      if (formData.returnItemImage) {
        itemImgUrl = await uploadFile(formData.returnItemImage);
      }
      if (formData.creditNoteImage) {
        creditImgUrl = await uploadFile(formData.creditNoteImage);
      }

      // 🔵 UPDATED: use selected date instead of auto today
      const d = formData.actual6Date;
      const dateStr = `${d.getMonth() + 1}/${d.getDate()}/${d.getFullYear()}`;

      // Create sparse row (DO NOT copy original row)
      const rowArray = new Array(80).fill("");

      // Pad array (Need up to index 80)
      while (rowArray.length <= 80) rowArray.push("");

      // Map to Indices 61-70 (BJ-BS) // Correct Range?
      // Wait, User said: Column-BT to CC for purchase return
      // BT = 71
      // CC = 80
      // Range: 71-80

      // 71 (BT): Plan 6
      // 72 (BU): Actual 6 (Return Date)
      rowArray[72] = dateStr;
      // 73 (BV): Delay 6
      rowArray[73] = "";
      // 74 (BW): Return Qty
      rowArray[74] = formData.returnedQty;
      // 75 (BX): Return Rate
      rowArray[75] = formData.returnRate;
      // 76 (BY): Return Amount
      rowArray[76] = formData.returnAmount;
      // 77 (BZ): Return Reason
      rowArray[77] = formData.returnReason;
      // 78 (CA): Return Status
      rowArray[78] = formData.returnStatus;
      // 79 (CB): Return Item Image
      rowArray[79] = itemImgUrl || "";
      // 80 (CC): Credit Note Image
      rowArray[80] = creditImgUrl || "";

      const params = new URLSearchParams();
      params.append("action", "update");
      params.append("sheetName", "RECEIVING-ACCOUNTS");
      params.append("rowIndex", rec.rowIndex.toString());
      params.append("rowData", JSON.stringify(rowArray));

      const res = await fetch(`${SHEET_API_URL}`, { method: "POST", body: params });
      const json = await res.json();

      if (json.success) {
        toast.success("Return processed successfully!", { id: toastId });
        setOpen(false);
        fetchData();
      } else {
        throw new Error(json.error || "Update failed");
      }

    } catch (err: any) {
      toast.error(err.message || "Failed to submit", { id: toastId });
    } finally {
      setIsSubmitting(false);
    }
  };

  const isFormValid =
    formData.returnedQty &&
    formData.returnRate &&
    formData.returnReason &&
    formData.returnStatus &&
    parseFloat(formData.returnedQty) <= originalQty;

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

          {/* PENDING */}
          <TabsContent value="pending" className="mt-6">
            {pending.length === 0 ? (
              <div className="text-center py-12 text-gray-500">No pending returns</div>
            ) : (
              <div className="border rounded-lg overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Actions</TableHead>
                      {pendingColumns.map(col => <TableHead key={col.key}>{col.label}</TableHead>)}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pending.map((rec) => (
                      <TableRow key={rec.id}>
                        <TableCell>
                          <Button size="sm" onClick={() => handleOpenForm(rec.id)}>Process</Button>
                        </TableCell>
                        {pendingColumns.map(col => (
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

          {/* HISTORY */}
          <TabsContent value="history" className="mt-6">
            {completed.length === 0 ? (
              <div className="text-center py-12 text-gray-500">No return history</div>
            ) : (
              <div className="border rounded-lg overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      {historyColumns.map(col => <TableHead key={col.key}>{col.label}</TableHead>)}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {completed.map((rec) => (
                      <TableRow key={rec.id}>
                        {historyColumns.map(col => (
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

      {/* MODAL */}
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
                    setFormData({ ...formData, returnedQty: val });
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
                  onChange={e => setFormData({ ...formData, returnRate: e.target.value })}
                />
              </div>
              <div>
                <Label>Return Amount</Label>
                <Input value={formData.returnAmount} readOnly className="bg-gray-50" />
              </div>
              {/* 🔵 ADDED: Actual6 (Return Date) */}
              <div>
                <Label>Return Date *</Label>
                <Input
                  type="date"
                  value={formData.actual6Date.toISOString().split("T")[0]}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      actual6Date: new Date(e.target.value),
                    })
                  }
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Return Reason *</Label>
                <Input
                  value={formData.returnReason}
                  onChange={e => setFormData({ ...formData, returnReason: e.target.value })}
                />
              </div>
              <div>
                <Label>Status *</Label>
                <Select value={formData.returnStatus} onValueChange={v => setFormData({ ...formData, returnStatus: v })}>
                  <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Debit Note">Debit Note</SelectItem>
                    <SelectItem value="Replaced (DN)">Replaced (DN)</SelectItem>
                  </SelectContent>
                </Select>
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