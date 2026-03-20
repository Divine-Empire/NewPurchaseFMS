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
import { FileText, Loader2, Search, ClipboardCheck, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { getFmsTimestamp } from "@/lib/utils";

const SHEET_API_URL = process.env.NEXT_PUBLIC_API_URI;
const IMAGE_FOLDER_ID = process.env.NEXT_PUBLIC_IMAGE_FOLDER_ID || "1SihRrPrgbuPGm-09fuB180QJhdxq5Nxy";

const toBase64 = (file: File) => new Promise<string>((resolve, reject) => {
  const reader = new FileReader();
  reader.readAsDataURL(file);
  reader.onload = () => resolve(reader.result as string);
  reader.onerror = error => reject(error);
});


const PENDING_COLUMNS = [
  { key: "indentNumber", label: "Indent No." },
  { key: "liftNo", label: "Unit Tracking No." },
  { key: "plan7", label: "Planned" },
  { key: "vendorName", label: "Vendor" },
  { key: "invoiceNumber", label: "Invoice No." },
  { key: "itemName", label: "Item" },
  { key: "receivedQty", label: "Received Qty" },
  { key: "totalApproved", label: "Approved" },
  { key: "totalRejected", label: "Rejected" },
  { key: "pendingQty", label: "Pending Qty" },
];

const HISTORY_COLUMNS = [
  { key: "indentNumber", label: "Indent No." },
  { key: "vendorName", label: "Vendor" },
  { key: "itemName", label: "Item" },
  { key: "plan7", label: "Planned" },
  { key: "actual7", label: "Actual" },
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
        pRows = partialJson.data.slice(7);
        pRows.forEach((r: any) => {
          const indentNo = String(r[1] || "").trim();
          if (!indentNo) return;
          approvedMap.set(indentNo, (approvedMap.get(indentNo) || 0) + (parseFloat(r[10] || "0") || 0));
          rejectedMap.set(indentNo, (rejectedMap.get(indentNo) || 0) + (parseFloat(r[7] || "0") || 0));
        });
        setPartialQCRecords(pRows);
      }

      if (json.success && Array.isArray(json.data)) {
        const rows = json.data.slice(7)
          .map((row: any, i: number) => ({ row, originalIndex: i + 8 }))
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
              id: `${indentNo}_${originalIndex}`,
              rowIndex: originalIndex,
              status,
              data: {
                indentNumber: indentNo,
                liftNo: row[2] || "",
                vendorName: row[3] || "",
                poNumber: row[4] || "",
                itemName: row[7] || "",
                invoiceNumber: row[24] || "-",
                receivedQty: row[25] || "0",
                plan7: row[61],
                actual7: row[62],
                totalApproved,
                totalRejected,
                pendingQty,
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
        const indentNoUpper = String(pRow[1] || "").trim().toUpperCase();
        const indentNoLower = indentNoUpper.toLowerCase();
        const parentData = sheetRecords.find(r => 
          String(r.data.indentNumber || "").trim().toLowerCase() === indentNoLower
        )?.data ?? {};
        return {
          id: `partial-${indentNoUpper}-${idx}`,
          data: {
            indentNumber: indentNoUpper,
            vendorName: parentData.vendorName || "-",
            invoiceNumber: parentData.invoiceNumber || "-",
            itemName: parentData.itemName || "-",
            plan7: parentData.plan7 || "-",
            actual7: pRow[0] || "-",
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
      qcDate: getFmsTimestamp(),
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
    if (!SHEET_API_URL || !selectedRecord) return;

    setIsSubmitting(true);
    try {
      const timestamp = getFmsTimestamp();
      const mDYYYY = timestamp;
      
      const qcDateObj = new Date(formData.qcDate);
      const qcDateFormatted = !isNaN(qcDateObj.getTime()) 
        ? `${qcDateObj.getMonth() + 1}/${qcDateObj.getDate()}/${qcDateObj.getFullYear()}`
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

      const updateCell = async (row: number, col: number, value: string) => {
        const params = new URLSearchParams();
        params.append("action", "updateCell");
        params.append("sheetName", "RECEIVING-ACCOUNTS");
        params.append("rowIndex", row.toString());
        params.append("columnIndex", col.toString());
        params.append("value", value);
        const res = await fetch(SHEET_API_URL!, { method: "POST", body: params });
        return res.json();
      };

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

      const receivedQty = parseFloat(selectedRecord.data.receivedQty || "0");
      const currentResolved = (selectedRecord.data.totalApproved || 0) + (selectedRecord.data.totalRejected || 0);
      const promises: Promise<any>[] = [];

      if (formData.qcStatus === "rejected") {
        const row = [
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
        ];
        promises.push(postToPartialQC(row));
        const newTotalResolved = currentResolved + parseFloat(formData.rejectQty || "0");
        if (newTotalResolved >= receivedQty) {
          promises.push(updateCell(selectedRecord.rowIndex, 62, mDYYYY));
          toast.success("QC Rejection Complete — all quantity resolved!");
        } else {
          toast.success("Partial Rejection recorded.");
        }
      } else if (formData.qcStatus === "approved") {
        const row = [
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
        ];
        promises.push(postToPartialQC(row));

        const newTotalResolved = currentResolved + parseFloat(formData.approvedQty || "0");
        if (newTotalResolved >= receivedQty) {
          promises.push(updateCell(selectedRecord.rowIndex, 62, mDYYYY));
          toast.success("QC Full Approval Recorded!");
        } else {
          toast.success("Partial QC Recorded.");
        }
      }

      await Promise.all(promises);

      setOpen(false);
      fetchData();
    } catch (error: any) {
      toast.error(error.message || "Submission failed");
    } finally {
      setIsSubmitting(false);
    }
  }, [selectedRecord, formData, fetchData]);

  const formatDateDash = (dateStr: any) => {
    if (!dateStr || dateStr === "-" || dateStr === "—") return "-";
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${day}-${month}-${year}`;
  };

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

      const val = data[key];
      const lowKey = key.toLowerCase();
      if (lowKey.includes("date") || lowKey.includes("plan") || lowKey.includes("actual")) {
        return formatDateDash(val);
      }

      if (val === undefined || val === null || String(val).trim() === "") return "-";
      return String(val);
    } catch {
      return "-";
    }
  }, []);

  return (
    <div className="flex flex-col h-full bg-slate-50/30">
      {/* Sticky Header Section */}
      <div className="sticky top-0 z-20 bg-slate-50/30 backdrop-blur-md border-b">
        <div className="p-4 lg:p-6 space-y-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h2 className="text-xl lg:text-2xl font-bold text-slate-900 flex items-center gap-2">
                <ClipboardCheck className="w-6 h-6 text-blue-600" />
                Stage 8: Quality Control
              </h2>
              <p className="text-sm text-slate-500 mt-1">Manage inspections and SRN entries</p>
            </div>
            <div className="flex items-center gap-3">
              <div className="relative w-full md:w-80">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input
                  placeholder="Search records..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9 bg-white border-slate-200 focus:ring-blue-500 rounded-lg shadow-sm w-full"
                />
              </div>
              <Button
                variant="outline"
                size="icon"
                onClick={fetchData}
                disabled={isLoading}
                className="bg-white hover:bg-slate-50 shrink-0"
              >
                <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
              </Button>
            </div>
          </div>

          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)} className="w-full">
            <TabsList className="bg-slate-100/80 p-1 w-full md:w-auto">
              <TabsTrigger
                value="pending"
                className="px-8 data-[state=active]:bg-white data-[state=active]:text-blue-600 data-[state=active]:shadow-sm transition-all"
              >
                Pending ({pending.length})
              </TabsTrigger>
              <TabsTrigger
                value="history"
                className="px-8 data-[state=active]:bg-white data-[state=active]:text-blue-600 data-[state=active]:shadow-sm transition-all"
              >
                History ({history.length})
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </div>

      <div className="flex-1 overflow-hidden">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center h-[400px] text-slate-500 bg-white m-6 rounded-xl border border-dashed">
            <div className="relative">
              <div className="w-12 h-12 border-4 border-blue-100 rounded-full animate-pulse"></div>
              <Loader2 className="w-12 h-12 animate-spin text-blue-600 absolute inset-0" />
            </div>
            <p className="mt-4 font-medium text-slate-900">Fetching records...</p>
            <p className="text-xs text-slate-400 mt-1">This may take a few seconds</p>
          </div>
        ) : (
          <div className="h-full overflow-auto p-4 lg:p-6">
            <Tabs value={activeTab} className="mt-0 h-full">
              <TabsContent value="pending" className="mt-0 focus-visible:outline-none">
                {pending.length === 0 ? (
                  <div className="bg-white border rounded-xl p-12 text-center shadow-sm">
                    <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4">
                      <ClipboardCheck className="w-8 h-8 text-slate-300" />
                    </div>
                    <h3 className="text-lg font-semibold text-slate-900">No pending QC checks</h3>
                    <p className="text-slate-500 mt-1 max-w-xs mx-auto">All items have been inspected or are not yet ready for QC.</p>
                  </div>
                ) : (
                  <div className="bg-white border rounded-xl shadow-sm overflow-hidden min-w-full">
                    <div className="overflow-x-auto overflow-y-auto max-h-[calc(100vh-280px)]">
                      <table className="w-full text-sm text-left border-collapse min-w-[1200px]">
                        <thead className="sticky top-0 z-10">
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
                          {pending.map((record: any) => (
                            <tr key={record.id} className="hover:bg-slate-50/80 transition-colors group">
                              <td className="px-4 py-3 whitespace-nowrap">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleOpenForm(record.id)}
                                  className="h-8 bg-white hover:bg-blue-50 hover:text-blue-600 hover:border-blue-200 transition-all font-medium"
                                >
                                  Perform QC
                                </Button>
                              </td>
                              {PENDING_COLUMNS.map((col) => (
                                <td key={col.key} className="px-4 py-3 text-slate-600 whitespace-nowrap">
                                  {safeValue(record, col.key)}
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </TabsContent>

              <TabsContent value="history" className="mt-0 focus-visible:outline-none">
                {history.length === 0 ? (
                  <div className="bg-white border rounded-xl p-12 text-center shadow-sm">
                    <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4">
                      <RefreshCw className="w-8 h-8 text-slate-300" />
                    </div>
                    <h3 className="text-lg font-semibold text-slate-900">No QC history found</h3>
                    <p className="text-slate-500 mt-1">Recent QC records will appear here.</p>
                  </div>
                ) : (
                  <div className="bg-white border rounded-xl shadow-sm overflow-hidden min-w-full">
                    <div className="overflow-x-auto overflow-y-auto max-h-[calc(100vh-280px)]">
                      <table className="w-full text-sm text-left border-collapse min-w-[1200px]">
                        <thead className="sticky top-0 z-10">
                          <tr className="bg-slate-200 border-b border-slate-300">
                            {HISTORY_COLUMNS.map((col) => (
                              <th key={col.key} className="px-4 py-4 font-semibold text-slate-900 whitespace-nowrap">
                                {col.label}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {history.map((record: any) => (
                            <tr key={record.id} className="hover:bg-slate-50/80 transition-colors">
                              {HISTORY_COLUMNS.map((col) => (
                                <td key={col.key} className="px-4 py-3 text-slate-600 whitespace-nowrap">
                                  {safeValue(record, col.key, true)}
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </div>
        )}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col p-0 overflow-hidden rounded-xl bg-white">
          <DialogHeader className="p-6 bg-slate-50 border-b">
            <DialogTitle className="text-xl font-bold flex items-center gap-2">
              <ClipboardCheck className="w-5 h-5 text-blue-600" />
              Quality Control Inspection
            </DialogTitle>
          </DialogHeader>
          
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            <div className="bg-blue-50/50 p-4 rounded-lg border border-blue-100 grid grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <dt className="text-[10px] font-bold text-blue-600 uppercase tracking-wider">Indent No.</dt>
                <dd className="text-sm font-semibold text-slate-900">{selectedRecord?.data?.indentNumber || "-"}</dd>
              </div>
              <div>
                <dt className="text-[10px] font-bold text-blue-600 uppercase tracking-wider">Vendor</dt>
                <dd className="text-sm font-semibold text-slate-900 truncate">{selectedRecord?.data?.vendorName || "-"}</dd>
              </div>
              <div>
                <dt className="text-[10px] font-bold text-blue-600 uppercase tracking-wider">Item</dt>
                <dd className="text-sm font-semibold text-slate-900 truncate">{selectedRecord?.data?.itemName || "-"}</dd>
              </div>
              <div>
                <dt className="text-[10px] font-bold text-blue-600 uppercase tracking-wider">Received Qty</dt>
                <dd className="text-sm font-semibold text-slate-900">{selectedRecord?.data?.receivedQty || "0"} units</dd>
              </div>
            </div>

            <form onSubmit={handleSubmit} id="qc-form" className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="space-y-2">
                  <Label className="text-xs font-bold text-slate-700">Planned QC Date</Label>
                  <div className="px-3 py-2 bg-slate-100 border border-slate-200 rounded-lg text-sm text-slate-600 font-medium">
                    {formatDateDash(selectedRecord?.data?.plan7)}
                  </div>
                </div>
                
                <div className="space-y-2">
                  <Label className="text-xs font-bold text-slate-700">QC Done By <span className="text-red-500">*</span></Label>
                  <Select value={formData.qcBy} onValueChange={(v) => setFormData({ ...formData, qcBy: v })}>
                    <SelectTrigger className="bg-white border-slate-200 rounded-lg shadow-sm h-10">
                      <SelectValue placeholder="Select engineer" />
                    </SelectTrigger>
                    <SelectContent>
                      {qcEngineerList.map((n) => <SelectItem key={n} value={n}>{n}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label className="text-xs font-bold text-slate-700">QC Date <span className="text-red-500">*</span></Label>
                  <Input 
                    type="date" 
                    className="bg-white border-slate-200 rounded-lg shadow-sm h-10" 
                    value={formData.qcDate} 
                    onChange={(e) => setFormData({ ...formData, qcDate: e.target.value })} 
                    required 
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-xs font-bold text-slate-700">QC Status <span className="text-red-500">*</span></Label>
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
                    <SelectTrigger className="bg-white border-slate-200 rounded-lg shadow-sm h-10">
                      <SelectValue placeholder="Select outcome" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="approved">Approved</SelectItem>
                      <SelectItem value="rejected">Rejected</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {formData.qcStatus === "approved" && (
                  <div className="space-y-2">
                    <Label className="text-xs font-bold text-slate-700 font-medium">Approved Qty <span className="text-red-500">*</span></Label>
                    <Input
                      type="number"
                      min="1"
                      max={selectedRecord?.data?.pendingQty || 999}
                      className="bg-white border-slate-200 rounded-lg shadow-sm h-10" 
                      placeholder={`Pending: ${selectedRecord?.data?.pendingQty || "0"}`}
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
                        setFormData({ ...formData, approvedQty: String(validQty), srnEntries: newEntries });
                      }}
                      required
                    />
                  </div>
                )}

                {formData.qcStatus === "rejected" && (
                  <div className="space-y-2">
                    <Label className="text-xs font-bold text-slate-700">Reject Qty <span className="text-red-500">*</span></Label>
                    <Input 
                      type="number" 
                      min="1"
                      max={selectedRecord?.data?.pendingQty || 999}
                      className="bg-white border-slate-200 rounded-lg shadow-sm h-10" 
                      placeholder={`Pending: ${selectedRecord?.data?.pendingQty || "0"}`}
                      value={formData.rejectQty} 
                      onChange={(e) => setFormData({ ...formData, rejectQty: e.target.value })} 
                      required 
                    />
                  </div>
                )}

                <div className="space-y-2">
                  <Label className="text-xs font-bold text-slate-700">Return Status <span className="text-red-500">*</span></Label>
                  <Select value={formData.returnStatus} onValueChange={(v) => setFormData({ ...formData, returnStatus: v })}>
                    <SelectTrigger className="bg-white border-slate-200 rounded-lg shadow-sm h-10">
                      <SelectValue placeholder="Select" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="return">Return</SelectItem>
                      <SelectItem value="not return">Not Return</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {formData.qcStatus === "approved" && formData.srnEntries.length > 0 && (
                <div className="bg-slate-50 border border-slate-200 rounded-xl overflow-hidden shadow-sm">
                  <div className="px-4 py-3 bg-slate-100 border-b border-slate-200 flex items-center justify-between">
                    <h3 className="text-sm font-bold text-slate-800">SRN Items Registration</h3>
                    <span className="text-xs bg-white text-slate-600 px-2 py-0.5 rounded-full border border-slate-200 font-medium">
                      {formData.srnEntries.length} Items Pending
                    </span>
                  </div>
                  <div className="p-4 space-y-3 max-h-[300px] overflow-y-auto">
                    {formData.srnEntries.map((entry, idx) => (
                      <div key={entry.serialNo} className="grid grid-cols-12 gap-3 items-center bg-white p-3 rounded-lg border border-slate-100 group">
                        <div className="col-span-1 text-xs font-bold text-slate-400">#{entry.serialNo}</div>
                        <div className="col-span-5 relative">
                          <Input
                            placeholder="Enter SRN Number"
                            className="bg-slate-50/50 border-slate-200 rounded-lg h-9 text-sm"
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
                          <div className="flex-1">
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
                            <label 
                              htmlFor={`srn-image-${idx}`} 
                              className={`flex items-center justify-center gap-2 px-3 py-1.5 border rounded-lg cursor-pointer transition-all h-9 text-xs font-medium ${
                                entry.image 
                                  ? "bg-emerald-50 border-emerald-200 text-emerald-700 hover:bg-emerald-100" 
                                  : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                              }`}
                            >
                              {entry.image ? (
                                <>
                                  <FileText className="w-3.5 h-3.5" />
                                  <span className="truncate max-w-[120px]">{entry.image.name}</span>
                                </>
                              ) : (
                                "Attach Photo"
                              )}
                            </label>
                          </div>
                          {entry.image && (
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                              onClick={() => {
                                const updated = [...formData.srnEntries];
                                updated[idx] = { ...updated[idx], image: null };
                                setFormData({ ...formData, srnEntries: updated });
                              }}
                            >
                              ✕
                            </Button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {formData.qcStatus === "rejected" && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-red-50/50 p-6 rounded-xl border border-red-100">
                  <div className="space-y-4">
                    <Label className="text-xs font-bold text-red-800">Defective Item Proof</Label>
                    <input 
                      type="file" 
                      accept="image/*" 
                      onChange={(e) => { const file = e.target.files?.[0]; if (file) setFormData({ ...formData, rejectPhoto: file }); }} 
                      className="hidden" 
                      id="reject-photo" 
                    />
                    <label 
                      htmlFor="reject-photo" 
                      className={`flex flex-col items-center justify-center w-full aspect-video border-2 border-dashed rounded-xl cursor-pointer transition-all ${
                        formData.rejectPhoto 
                          ? "bg-white border-emerald-300 text-emerald-600" 
                          : "bg-white border-red-200 text-slate-400 hover:bg-red-50 hover:border-red-300"
                      }`}
                    >
                      {formData.rejectPhoto ? (
                        <>
                          <FileText className="w-8 h-8 mb-2" />
                          <span className="text-sm font-bold truncate max-w-[200px] px-4">{formData.rejectPhoto.name}</span>
                          <span className="text-[10px] mt-1 text-slate-400 underline">Tap to change photo</span>
                        </>
                      ) : (
                        <>
                          <FileText className="w-8 h-8 mb-2 text-red-200" />
                          <span className="text-sm font-medium">Upload Defect Image</span>
                          <span className="text-[10px] text-slate-400 mt-1">Accepts JPG, PNG</span>
                        </>
                      )}
                    </label>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs font-bold text-red-800">Rejection Reason <span className="text-red-500">*</span></Label>
                    <textarea 
                      className="w-full px-4 py-3 bg-white border border-red-200 rounded-xl resize-none text-sm focus:ring-red-500 h-[calc(100%-24px)]" 
                      rows={4} 
                      placeholder="Detail the quality issues found..."
                      value={formData.rejectRemarks} 
                      onChange={(e) => setFormData({ ...formData, rejectRemarks: e.target.value })} 
                      required 
                    />
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <Label className="text-xs font-bold text-slate-700">Detailed QC Remarks & Findings</Label>
                <textarea 
                  className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl resize-none text-sm focus:ring-blue-500 shadow-sm" 
                  rows={3} 
                  placeholder="Optional internal notes..."
                  value={formData.qcRemarks} 
                  onChange={(e) => setFormData({ ...formData, qcRemarks: e.target.value })} 
                />
              </div>
            </form>
          </div>

          <DialogFooter className="p-6 bg-slate-50 border-t flex items-center justify-between sm:justify-between w-full">
            <Button 
              variant="outline" 
              onClick={() => setOpen(false)} 
              disabled={isSubmitting}
              className="px-8 border-slate-200 rounded-lg bg-white"
            >
              Cancel
            </Button>
            <Button 
              onClick={handleSubmit} 
              disabled={!isFormValid || isSubmitting}
              form="qc-form"
              className="px-10 bg-blue-600 hover:bg-blue-700 rounded-lg shadow-md transition-all active:scale-95"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Uploading Assets...
                </>
              ) : (
                "Finalize Quality Report"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
