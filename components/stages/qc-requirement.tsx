"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FileText, Loader2, Search } from "lucide-react";
import { toast } from "sonner";

const SHEET_API_URL = process.env.NEXT_PUBLIC_API_URI;
const IMAGE_FOLDER_ID = process.env.NEXT_PUBLIC_IMAGE_FOLDER_ID || "1SihRrPrgbuPGm-09fuB180QJhdxq5Nxy";

const toBase64 = (file: File) => new Promise<string>((resolve, reject) => {
  const reader = new FileReader();
  reader.readAsDataURL(file);
  reader.onload = () => resolve(reader.result as string);
  reader.onerror = error => reject(error);
});

const formatDisplayDate = (d: any) => {
  if (!d || d === "" || d === "-" || d === "Invalid Date") return "-";
  const date = new Date(d);
  if (isNaN(date.getTime())) return d;
  return date.toLocaleDateString("en-IN");
};

const PENDING_COLUMNS = [
  { key: "indentNumber", label: "Indent #" },
  { key: "vendorName", label: "Vendor" },
  { key: "invoiceNumber", label: "Invoice #" },
  { key: "itemName", label: "Item" },
  { key: "receivedQty", label: "Received Qty" },
  { key: "totalApproved", label: "Approved" },
  { key: "totalRejected", label: "Rejected" },
  { key: "pendingQty", label: "Pending Qty" },
];

const HISTORY_COLUMNS = [
  { key: "indentNumber", label: "Indent #" },
  { key: "vendorName", label: "Vendor" },
  { key: "itemName", label: "Item" },
  { key: "qcDate", label: "QC Date" },
  { key: "qcBy", label: "QC By" },
  { key: "qcStatus", label: "Status" },
  { key: "approvedQty", label: "Approved Qty" },
  { key: "rejectedQty", label: "Rejected Qty" },
  { key: "remarks", label: "Remarks" },
];

const FILE_FIELDS = new Set(["poCopy", "receivedItemImage", "billAttachment", "rejectPhoto"]);
const AMOUNT_FIELDS = new Set(["freightAmount", "advanceAmount", "basicValue", "totalWithTax", "ratePerQty", "paymentAmountHydra", "paymentAmountLabour", "paymentAmountHamali"]);

export default function Stage8() {
  const [open, setOpen] = useState(false);
  const [selectedRecordId, setSelectedRecordId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"pending" | "history">("pending");
  const [sheetRecords, setSheetRecords] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [qcEngineerList, setQcEngineerList] = useState<string[]>([]);
  const [partialQCRecords, setPartialQCRecords] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState("");

  const [formData, setFormData] = useState({
    qcBy: "",
    qcDate: "",
    qcStatus: "",
    rejectRemarks: "",
    rejectQty: "",
    returnStatus: "",
    qcRemarks: "",
    rejectPhoto: null as File | null,
    approvedQty: "",
    srnEntries: [] as { serialNo: number; srn: string; image: File | null }[],
  });

  const fetchData = useCallback(async () => {
    if (!SHEET_API_URL) return;
    setIsLoading(true);
    try {
      const [dropRes, partialRes, receiveRes] = await Promise.all([
        fetch(`${SHEET_API_URL}?sheet=Dropdown&action=getAll`),
        fetch(`${SHEET_API_URL}?sheet=${encodeURIComponent("Partial QC")}&action=getAll`),
        fetch(`${SHEET_API_URL}?sheet=RECEIVING-ACCOUNTS&action=getAll`),
      ]);

      const [dropJson, partialJson, json] = await Promise.all([
        dropRes.json(),
        partialRes.json(),
        receiveRes.json(),
      ]);

      if (dropJson.success && Array.isArray(dropJson.data)) {
        setQcEngineerList(
          dropJson.data.slice(1)
            .map((row: any) => String(row[11] || "").trim())
            .filter((q: string) => q !== "")
        );
      }

      const approvedMap = new Map<string, number>();
      const rejectedMap = new Map<string, number>();
      let pRows: any[] = [];

      if (partialJson.success && Array.isArray(partialJson.data)) {
        pRows = partialJson.data.slice(1);
        pRows.forEach((r: any) => {
          const indentNo = String(r[1] || "").trim();
          if (!indentNo) return;
          approvedMap.set(indentNo, (approvedMap.get(indentNo) || 0) + (parseFloat(r[10] || "0") || 0));
          rejectedMap.set(indentNo, (rejectedMap.get(indentNo) || 0) + (parseFloat(r[7] || "0") || 0));
        });
        setPartialQCRecords(pRows);
      }

      if (json.success && Array.isArray(json.data)) {
        const rows = json.data.slice(6)
          .map((row: any, i: number) => ({ row, originalIndex: i + 7 }))
          .filter(({ row }: any) => row[1] && String(row[1]).trim() !== "")
          .map(({ row, originalIndex }: any) => {
            const indentNo = String(row[1] || "").trim();
            const receivedQty = parseFloat(row[25] || "0");
            const totalApproved = approvedMap.get(indentNo) || 0;
            const totalRejected = rejectedMap.get(indentNo) || 0;
            const pendingQty = Math.max(0, receivedQty - (totalApproved + totalRejected));

            const plan7Str = String(row[61] || "").trim();
            const completionDate = row[62];
            const completionStr = String(completionDate || "").trim();

            let status = "not_ready";
            if ((completionStr && completionStr !== "-") || pendingQty <= 0) {
              status = "completed";
            } else if (plan7Str && plan7Str !== "-") {
              status = "pending";
            }

            return {
              id: row[1] || `row-${originalIndex}`,
              rowIndex: originalIndex,
              status,
              data: {
                indentNumber: row[1] || "",
                liftNo: row[2] || "",
                vendorName: row[3] || "",
                poNumber: row[4] || "",
                nextFollowUpDate: row[5] || "",
                remarksStage6: row[6] || "",
                itemName: row[7] || "",
                liftingQty: row[8] || "",
                transporterName: row[9] || "",
                vehicleNo: row[10] || "",
                contactNo: row[11] || "",
                lrNo: row[12] || "",
                dispatchDate: row[13] || "",
                freightAmount: row[14] || "",
                advanceAmount: row[15] || "",
                paymentDate: row[16] || "",
                paymentStatus: row[17] || "",
                biltyCopy: row[18] || "",
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
                remarksStage7: row[33] || "",
                plan7: row[61],
                actual7: row[62],
                delay7: row[63],
                qcBy: row[64],
                qcDate: row[65],
                qcStatus: row[66],
                qcRemarks: row[67],
                rejectQty: row[68],
                rejectPhoto: row[69],
                rejectRemarks: row[70],
                returnStatus: row[73],
                srnJson: row[74] || "",
                totalApproved,
                totalRejected,
                pendingQty,
                completionDate,
              },
            };
          });
        setSheetRecords(rows);
      }
    } catch {
      toast.error("Failed to load data");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const selectedRecord = useMemo(
    () => sheetRecords.find((r) => r.id === selectedRecordId) ?? null,
    [sheetRecords, selectedRecordId]
  );

  const pending = useMemo(() => {
    const searchLower = searchTerm.toLowerCase();
    return sheetRecords.filter((r) => {
      if (r.status !== "pending") return false;
      if (!searchLower) return true;
      return (
        r.data.indentNumber?.toLowerCase().includes(searchLower) ||
        r.data.itemName?.toLowerCase().includes(searchLower) ||
        r.data.vendorName?.toLowerCase().includes(searchLower) ||
        String(r.data.poNumber || "").toLowerCase().includes(searchLower) ||
        String(r.data.invoiceNumber || "").toLowerCase().includes(searchLower)
      );
    });
  }, [sheetRecords, searchTerm]);

  const history = useMemo(() => {
    const searchLower = searchTerm.toLowerCase();
    return partialQCRecords
      .filter(pRow => pRow[1] && String(pRow[1]).trim() !== "")
      .map((pRow, idx) => {
        const indentNo = String(pRow[1] || "").trim();
        const parentData = sheetRecords.find(r => r.data.indentNumber === indentNo)?.data ?? {};
        return {
          id: `partial-${indentNo}-${idx}`,
          data: {
            indentNumber: indentNo,
            vendorName: parentData.vendorName || "-",
            invoiceNumber: parentData.invoiceNumber || "-",
            itemName: parentData.itemName || "-",
            qcDate: pRow[4] || "-",
            qcBy: pRow[3] || "-",
            approvedQty: pRow[10] || "0",
            rejectedQty: pRow[7] || "0",
            qcStatus: pRow[5] || "-",
            remarks: pRow[6] || "-",
          },
        };
      })
      .filter(rec => {
        if (!searchLower) return true;
        return (
          rec.data.indentNumber?.toLowerCase().includes(searchLower) ||
          rec.data.vendorName?.toLowerCase().includes(searchLower) ||
          rec.data.itemName?.toLowerCase().includes(searchLower)
        );
      })
      .reverse();
  }, [partialQCRecords, sheetRecords, searchTerm]);

  const handleOpenForm = useCallback((recordId: string) => {
    setSelectedRecordId(recordId);
    setFormData({
      qcBy: "",
      qcDate: new Date().toISOString().split("T")[0],
      qcStatus: "",
      rejectRemarks: "",
      rejectQty: "",
      returnStatus: "",
      qcRemarks: "",
      rejectPhoto: null,
      approvedQty: "",
      srnEntries: [],
    });
    setOpen(true);
  }, []);

  const isFormValid = useMemo(() =>
    !!(formData.qcBy &&
      formData.qcDate &&
      formData.qcStatus &&
      formData.returnStatus &&
      (formData.qcStatus === "approved"
        ? formData.approvedQty &&
        parseInt(formData.approvedQty) > 0 &&
        formData.srnEntries.length > 0 &&
        formData.srnEntries.every((e) => e.srn.trim() !== "")
        : formData.qcStatus === "rejected" &&
        formData.rejectQty &&
        formData.rejectRemarks)),
    [formData]
  );

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRecordId || !SHEET_API_URL || !selectedRecord) return;

    setIsSubmitting(true);
    try {
      const now = new Date();
      const mDYYYY = `${now.getMonth() + 1}/${now.getDate()}/${now.getFullYear()}`;
      const qcDateFormatted = formData.qcDate
        ? (() => { const d = new Date(formData.qcDate); return `${d.getMonth() + 1}/${d.getDate()}/${d.getFullYear()}`; })()
        : "";

      let photoUrl = "";
      if (formData.rejectPhoto instanceof File) {
        const uploadParams = new URLSearchParams();
        uploadParams.append("action", "uploadFile");
        uploadParams.append("base64Data", await toBase64(formData.rejectPhoto));
        uploadParams.append("fileName", formData.rejectPhoto.name);
        uploadParams.append("mimeType", formData.rejectPhoto.type);
        uploadParams.append("folderId", IMAGE_FOLDER_ID);
        const res = await fetch(SHEET_API_URL, { method: "POST", body: uploadParams });
        const json = await res.json();
        if (json.success) photoUrl = json.fileUrl;
        else throw new Error("Photo upload failed");
      }

      let approvedQtyJson = "";
      if (formData.qcStatus === "approved" && formData.srnEntries.length > 0) {
        const srnData = await Promise.all(
          formData.srnEntries.map(async (entry) => {
            let imageUrl = "";
            if (entry.image instanceof File) {
              const uploadParams = new URLSearchParams();
              uploadParams.append("action", "uploadFile");
              uploadParams.append("base64Data", await toBase64(entry.image));
              uploadParams.append("fileName", `SRN_${entry.serialNo}_${entry.image.name}`);
              uploadParams.append("mimeType", entry.image.type);
              uploadParams.append("folderId", IMAGE_FOLDER_ID);
              const res = await fetch(SHEET_API_URL!, { method: "POST", body: uploadParams });
              const json = await res.json();
              if (json.success) imageUrl = json.fileUrl || "";
            }
            return { serialNo: entry.serialNo, srn: entry.srn, image: imageUrl };
          })
        );
        approvedQtyJson = JSON.stringify(srnData);
      }

      const postToPartialQC = async (row: any[]) => {
        const p = new URLSearchParams();
        p.append("action", "batchInsert");
        p.append("sheetName", "Partial QC");
        p.append("rowsData", JSON.stringify([row]));
        p.append("startRow", "2");
        const res = await fetch(SHEET_API_URL!, { method: "POST", body: p });
        const json = await res.json();
        if (!json.success) throw new Error("Failed to write to Partial QC sheet");
      };

      const writeActualDateToRA = async () => {
        const raRowArray = new Array(80).fill("");
        raRowArray[62] = mDYYYY;
        const p = new URLSearchParams();
        p.append("action", "update");
        p.append("sheetName", "RECEIVING-ACCOUNTS");
        p.append("rowIndex", selectedRecord.rowIndex.toString());
        p.append("rowData", JSON.stringify(raRowArray));
        await fetch(SHEET_API_URL!, { method: "POST", body: p });
      };

      const receivedQty = parseFloat(selectedRecord.data.receivedQty || "0");

      if (formData.qcStatus === "rejected") {
        await postToPartialQC([
          mDYYYY,
          selectedRecord.data.indentNumber,
          selectedRecord.data.liftNo || "",
          formData.qcBy,
          qcDateFormatted,
          "rejected",
          formData.qcRemarks,
          formData.rejectQty,
          photoUrl,
          formData.rejectRemarks,
          "",
          "",
          formData.returnStatus,
        ]);

        const totalResolved =
          (selectedRecord.data.totalApproved || 0) +
          (selectedRecord.data.totalRejected || 0) +
          (parseFloat(formData.rejectQty || "0"));

        if (totalResolved >= receivedQty) {
          await writeActualDateToRA();
          toast.success("QC Rejection Complete — all quantity resolved!");
        } else {
          toast.success("Partial Rejection recorded.");
        }

      } else if (formData.qcStatus === "approved") {
        await postToPartialQC([
          mDYYYY,
          selectedRecord.data.indentNumber,
          selectedRecord.data.liftNo || "",
          formData.qcBy,
          qcDateFormatted,
          "approved",
          formData.qcRemarks,
          "",
          "",
          "",
          formData.approvedQty,
          approvedQtyJson,
          formData.returnStatus,
        ]);

        const totalResolved =
          (selectedRecord.data.totalApproved || 0) +
          (selectedRecord.data.totalRejected || 0) +
          (parseFloat(formData.approvedQty || "0"));

        if (totalResolved >= receivedQty) {
          await writeActualDateToRA();
          toast.success("QC Full Approval Recorded!");
        } else {
          toast.success("Partial QC Recorded.");
        }
      }

      setOpen(false);
      fetchData();
    } catch (error: any) {
      toast.error(error.message || "Submission failed");
    } finally {
      setIsSubmitting(false);
    }
  }, [selectedRecordId, selectedRecord, formData, fetchData]);

  const safeValue = useCallback((record: any, key: string, isHistory = false) => {
    try {
      const data = record?.data;
      if (!data) return "-";

      if (FILE_FIELDS.has(key)) {
        const url = data[key];
        if (!url || String(url).trim() === "" || url === "-") return "-";
        return (
          <a href={String(url)} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-xs text-blue-600 hover:underline">
            <FileText className="w-3.5 h-3.5" />
            <span className="truncate max-w-20">View</span>
          </a>
        );
      }

      if (key === "qcStatus") {
        const status = data.qcStatus;
        if (!status || status === "-" || status === "") return "-";
        return status.charAt(0).toUpperCase() + status.slice(1);
      }

      if (AMOUNT_FIELDS.has(key)) {
        const amount = data[key];
        return amount && amount !== "-" && amount !== "" ? `₹${amount}` : "-";
      }

      if (key === "receivedQty" && isHistory) {
        try {
          const json = data.srnJson;
          if (json && json !== "-" && json !== "") {
            const parsed = JSON.parse(json);
            return Array.isArray(parsed) ? parsed.length : 0;
          }
          return 0;
        } catch { return 0; }
      }

      const val = data[key];
      const lowKey = key.toLowerCase();
      if (lowKey.includes("date") || lowKey.includes("plan") || lowKey.includes("actual")) {
        return formatDisplayDate(val);
      }

      if (val === undefined || val === null || String(val).trim() === "") return "-";
      return String(val);
    } catch {
      return "-";
    }
  }, []);

  return (
    <div className="p-6">
      <div className="mb-6 p-6 bg-white border rounded-lg shadow-sm">
        <div>
          <h2 className="text-2xl font-bold">Stage 8: Quality Control</h2>
          <p className="text-gray-600 mt-1">Inspect and approve/reject received materials</p>
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
        </div>
      </div>

      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-24 text-gray-500">
          <Loader2 className="w-8 h-8 animate-spin mb-4 text-black" />
          <p className="text-lg animate-pulse text-black font-medium">Loading records...</p>
        </div>
      ) : (
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="pending">Pending ({pending.length})</TabsTrigger>
            <TabsTrigger value="history">History ({history.length})</TabsTrigger>
          </TabsList>

          <TabsContent value="pending" className="mt-6">
            {pending.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                <p className="text-lg">No pending QC checks</p>
                <p className="text-sm mt-1">All items are inspected!</p>
              </div>
            ) : (
              <div className="border rounded-lg overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="bg-white z-10">Actions</TableHead>
                      {PENDING_COLUMNS.map((col) => <TableHead key={col.key}>{col.label}</TableHead>)}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pending.map((record: any) => (
                      <TableRow key={record.id}>
                        <TableCell className="bg-white z-10">
                          <Button variant="outline" size="sm" onClick={() => handleOpenForm(record.id)}>Perform QC</Button>
                        </TableCell>
                        {PENDING_COLUMNS.map((col) => (
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
            {history.length === 0 ? (
              <div className="text-center py-12 text-gray-500"><p className="text-lg">No QC history found</p></div>
            ) : (
              <div className="border rounded-lg overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      {HISTORY_COLUMNS.map((col) => <TableHead key={col.key}>{col.label}</TableHead>)}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {history.map((record: any) => (
                      <TableRow key={record.id}>
                        {HISTORY_COLUMNS.map((col) => (
                          <TableCell key={col.key}>{safeValue(record, col.key, true)}</TableCell>
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
        <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col">
          <DialogHeader><DialogTitle>Quality Control Inspection</DialogTitle></DialogHeader>
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Planned QC Date</Label>
                  <Input value={formatDisplayDate(selectedRecord?.data?.plan7)} readOnly className="bg-gray-50" />
                </div>
                <div>
                  <Label>QC Done By *</Label>
                  <Select value={formData.qcBy} onValueChange={(v) => setFormData({ ...formData, qcBy: v })}>
                    <SelectTrigger><SelectValue placeholder="Select engineer" /></SelectTrigger>
                    <SelectContent>
                      {qcEngineerList.map((n) => <SelectItem key={n} value={n}>{n}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>QC Date *</Label>
                  <input type="date" className="w-full px-3 py-2 border rounded" value={formData.qcDate} onChange={(e) => setFormData({ ...formData, qcDate: e.target.value })} required />
                </div>
                <div>
                  <Label>QC Status *</Label>
                  <Select
                    value={formData.qcStatus}
                    onValueChange={(v) => setFormData({
                      ...formData,
                      qcStatus: v,
                      rejectQty: v === "approved" ? "" : formData.rejectQty,
                      rejectRemarks: v === "approved" ? "" : formData.rejectRemarks,
                      approvedQty: v === "rejected" ? "" : formData.approvedQty,
                      srnEntries: v === "rejected" ? [] : formData.srnEntries,
                    })}
                  >
                    <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="approved">Approved</SelectItem>
                      <SelectItem value="rejected">Rejected</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {formData.qcStatus === "approved" && (
                  <div>
                    <Label>Approved Qty *</Label>
                    <input
                      type="number"
                      min="1"
                      max={selectedRecord?.data?.receivedQty || 999}
                      className="w-full px-3 py-2 border rounded"
                      placeholder={`Max: ${selectedRecord?.data?.pendingQty || "-"}`}
                      value={formData.approvedQty}
                      onChange={(e) => {
                        const qty = parseInt(e.target.value) || 0;
                        const maxQty = parseInt(selectedRecord?.data?.pendingQty) || 999;
                        const validQty = Math.min(Math.max(0, qty), maxQty);
                        const newEntries = Array.from({ length: validQty }, (_, i) => ({
                          serialNo: i + 1,
                          srn: formData.srnEntries[i]?.srn || "",
                          image: formData.srnEntries[i]?.image || null,
                        }));
                        setFormData({ ...formData, approvedQty: e.target.value, srnEntries: newEntries });
                      }}
                      required
                    />
                  </div>
                )}

                <div>
                  <Label>Return Status *</Label>
                  <Select value={formData.returnStatus} onValueChange={(v) => setFormData({ ...formData, returnStatus: v })}>
                    <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="return">Return</SelectItem>
                      <SelectItem value="not return">Not Return</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {formData.qcStatus === "approved" && formData.srnEntries.length > 0 && (
                <div className="p-4 border rounded bg-green-50 space-y-3">
                  <h3 className="font-semibold text-green-800">SRN Details ({formData.srnEntries.length} items)</h3>
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    <div className="grid grid-cols-12 gap-2 text-xs font-medium text-gray-600 sticky top-0 bg-green-50 py-1">
                      <div className="col-span-1">S.No</div>
                      <div className="col-span-5">SRN *</div>
                      <div className="col-span-6">Image</div>
                    </div>
                    {formData.srnEntries.map((entry, idx) => (
                      <div key={entry.serialNo} className="grid grid-cols-12 gap-2 items-center">
                        <div className="col-span-1 text-sm font-medium text-gray-700">{entry.serialNo}</div>
                        <div className="col-span-5">
                          <input
                            type="text"
                            className="w-full px-2 py-1.5 border rounded text-sm"
                            placeholder="Enter SRN..."
                            value={entry.srn}
                            onChange={(e) => {
                              const updated = [...formData.srnEntries];
                              updated[idx] = { ...updated[idx], srn: e.target.value };
                              setFormData({ ...formData, srnEntries: updated });
                            }}
                            required
                          />
                        </div>
                        <div className="col-span-6 flex items-center gap-2">
                          <input
                            type="file"
                            accept="image/*"
                            id={`srn-image-${idx}`}
                            className="hidden"
                            onChange={(e) => {
                              const file = e.target.files?.[0] || null;
                              const updated = [...formData.srnEntries];
                              updated[idx] = { ...updated[idx], image: file };
                              setFormData({ ...formData, srnEntries: updated });
                            }}
                          />
                          <label htmlFor={`srn-image-${idx}`} className="flex-1 px-2 py-1.5 border rounded bg-white cursor-pointer hover:bg-gray-50 text-sm text-center">
                            {entry.image ? <span className="text-green-600 truncate block">{entry.image.name}</span> : <span className="text-gray-500">Upload</span>}
                          </label>
                          {entry.image && (
                            <button
                              type="button"
                              className="text-red-500 hover:text-red-700 text-xs"
                              onClick={() => {
                                const updated = [...formData.srnEntries];
                                updated[idx] = { ...updated[idx], image: null };
                                setFormData({ ...formData, srnEntries: updated });
                              }}
                            >
                              ✕
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {formData.qcStatus === "rejected" && (
                <div className="p-4 border rounded bg-red-50 space-y-3">
                  <h3 className="font-semibold text-red-800">Rejection Details</h3>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label>Reject Qty *</Label>
                      <input type="number" className="w-full px-3 py-2 border rounded" placeholder="0" value={formData.rejectQty} onChange={(e) => setFormData({ ...formData, rejectQty: e.target.value })} required />
                    </div>
                    <div>
                      <Label>Reject Photo</Label>
                      <input type="file" accept="image/*" onChange={(e) => { const file = e.target.files?.[0]; if (file) setFormData({ ...formData, rejectPhoto: file }); }} className="hidden" id="reject-photo" />
                      <label htmlFor="reject-photo" className="flex items-center justify-center w-full p-2 border rounded cursor-pointer hover:bg-gray-50">
                        {formData.rejectPhoto ? <span className="text-green-600">Photo Selected</span> : <span>Upload Photo</span>}
                      </label>
                    </div>
                    <div className="col-span-2">
                      <Label>Reject Remarks *</Label>
                      <textarea className="w-full px-3 py-2 border rounded resize-none" rows={3} value={formData.rejectRemarks} onChange={(e) => setFormData({ ...formData, rejectRemarks: e.target.value })} required />
                    </div>
                  </div>
                </div>
              )}

              <div>
                <Label>QC Remarks</Label>
                <textarea className="w-full px-3 py-2 border rounded resize-none" rows={3} value={formData.qcRemarks} onChange={(e) => setFormData({ ...formData, qcRemarks: e.target.value })} />
              </div>
            </form>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={isSubmitting}>Cancel</Button>
            <Button onClick={handleSubmit} disabled={!isFormValid || isSubmitting}>
              {isSubmitting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Submitting...</> : "Complete QC"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
