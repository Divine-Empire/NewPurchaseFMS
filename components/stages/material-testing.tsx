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

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FileText, Loader2, Search, ClipboardCheck, RefreshCw, Eye } from "lucide-react";
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


interface SearchableSrnDropdownProps {
  value: string;
  onChange: (val: string) => void;
  options: string[];
  placeholder: string;
}

function SearchableSrnDropdown({ value, onChange, options, placeholder }: SearchableSrnDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const containerRef = React.useRef<HTMLDivElement>(null);

  useEffect(() => {
    setSearch(value);
  }, [value]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const filteredOptions = useMemo(() => {
    const term = search.toLowerCase().trim();
    if (!term) return options;
    return options.filter((opt) => opt.toLowerCase().includes(term));
  }, [options, search]);

  return (
    <div ref={containerRef} className="relative w-full">
      <Input
        placeholder={placeholder}
        className="bg-slate-50/50 border-slate-200 rounded-lg h-9 text-sm w-full focus-visible:ring-1 focus-visible:ring-blue-500"
        value={search}
        onChange={(e) => {
          setSearch(e.target.value);
          onChange(e.target.value);
          setIsOpen(true);
        }}
        onFocus={() => setIsOpen(true)}
        required
      />
      {isOpen && filteredOptions.length > 0 && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-slate-200 rounded-lg shadow-lg max-h-40 overflow-y-auto">
          {filteredOptions.map((opt) => (
            <button
              key={opt}
              type="button"
              className="w-full text-left px-3 py-2 text-xs hover:bg-slate-100 transition-colors focus:bg-slate-100 focus:outline-none"
              onClick={() => {
                onChange(opt);
                setSearch(opt);
                setIsOpen(false);
              }}
            >
              {opt}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

const PENDING_COLUMNS = [
  { key: "indentNumber", label: "Indent No." },
  { key: "liftNo", label: "Unit Tracking No." },
  { key: "plan7", label: "Planned" },
  { key: "itemName", label: "Item" },
  { key: "receivedQty", label: "Received Qty" },
  { key: "totalApproved", label: "Approved" },
  { key: "totalRejected", label: "Rejected" },
  { key: "pendingQty", label: "Pending Qty" },
  { key: "damageQty", label: "Damage Qty" },
  { key: "damageReason", label: "Reason" },
  { key: "damageImage", label: "Image" },
];

const HISTORY_COLUMNS = [
  { key: "indentNumber", label: "Indent No." },
  { key: "liftNo", label: "Lift No." },
  { key: "qcDate", label: "QC-Date" },
  { key: "workingCondition", label: "Working Condition" },
  { key: "qcBy", label: "Checked By" },
  { key: "approvedQty", label: "Approved Qty" },
  { key: "checklist", label: "Checklist" },
  { key: "serialNo", label: "Serial-No" },
  { key: "image", label: "Image" },
  { key: "rejectType", label: "Reject Type" },
  { key: "partName", label: "Part-Name" },
  { key: "rejectedQty", label: "Reject Qty" },
  { key: "remarks", label: "Remarks" },
];

const FILE_FIELDS = new Set(["poCopy", "receivedItemImage", "billAttachment", "rejectPhoto", "damageImage"]);
const AMOUNT_FIELDS = new Set(["freightAmount", "advanceAmount", "basicValue", "totalWithTax", "ratePerQty", "paymentAmountHydra", "paymentAmountLabour", "paymentAmountHamali"]);

export default function Stage8() {
  const [open, setOpen] = useState(false);
  const [selectedRecordId, setSelectedRecordId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"pending" | "history">("pending");
  const [sheetRecords, setSheetRecords] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [qcEngineerList, setQcEngineerList] = useState<string[]>([]);
  const [checklistList, setChecklistList] = useState<string[]>([]);
  const [rejectTypeList, setRejectTypeList] = useState<string[]>([]);
  const [partialQCRecords, setPartialQCRecords] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [historyDialogOpen, setHistoryDialogOpen] = useState(false);
  const [selectedHistoryRecord, setSelectedHistoryRecord] = useState<any>(null);

  const [formData, setFormData] = useState({
    qcBy: "",
    qcDate: "",
    workingCondition: "", // "yes", "no", "passed_concern"
    approvedQty: "",
    checklistSelected: [] as string[],
    rejectType: "",
    partName: "",
    rejectQty: "",
    rejectPhoto: null as File | null,
    remarks: "",
    srnEntries: [] as { serialNo: number; srn: string; image: File | null }[],
    rejectSrnEntries: [] as { serialNo: number; srn: string; image: File | null }[],
  });

  const [serialNoList, setSerialNoList] = useState<string[]>([]);
  const [isSerialsLoading, setIsSerialsLoading] = useState(false);

  const fetchData = useCallback(async () => {
    if (!SHEET_API_URL) return;
    setIsLoading(true);
    try {
      const [dropRes, partialRes, receiveRes] = await Promise.all([
        fetch(`${SHEET_API_URL}?sheet=Dropdown&action=getAll`),
        fetch(`${SHEET_API_URL}?sheet=${encodeURIComponent("Material-Testing")}&action=getAll`),
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
        setChecklistList(
          dropJson.data.slice(1)
            .map((row: any) => String(row[15] || "").trim())
            .filter((c: string) => c !== "")
        );
        setRejectTypeList(
          dropJson.data.slice(1)
            .map((row: any) => String(row[16] || "").trim())
            .filter((r: string) => r !== "")
        );
      }

      const approvedMap = new Map<string, number>();
      const rejectedMap = new Map<string, number>();
      let pRows: any[] = [];

      if (partialJson.success && Array.isArray(partialJson.data)) {
        pRows = partialJson.data.slice(6).filter((r: any) => r[1] && String(r[1]).trim() !== "");
        pRows.forEach((r: any) => {
          const liftNo = String(r[2] || "").trim().toLowerCase();
          if (!liftNo) return;
          approvedMap.set(liftNo, (approvedMap.get(liftNo) || 0) + (parseFloat(r[6] || "0") || 0));
          rejectedMap.set(liftNo, (rejectedMap.get(liftNo) || 0) + (parseFloat(r[12] || "0") || 0));
        });
        setPartialQCRecords(pRows);
      }

      if (json.success && Array.isArray(json.data)) {
        const rows = json.data.slice(7)
          .map((row: any, i: number) => ({ row, originalIndex: i + 8 }))
          .filter(({ row }: any) => row[1] && String(row[1]).trim() !== "")
          .map(({ row, originalIndex }: any) => {
            const indentNo = String(row[1] || "").trim();
            const liftNo = String(row[2] || "").trim().toLowerCase();
            const receivedQty = parseFloat(row[25] || "0");
            const totalApproved = approvedMap.get(liftNo) || 0;
            const totalRejected = rejectedMap.get(liftNo) || 0;
            const pendingQty = Math.max(0, receivedQty - (totalApproved + totalRejected));

            const plan7Str = String(row[61] || "").trim();
            const completionDate = row[62];
            const completionStr = String(completionDate || "").trim();

            let status = "not_ready";
            if (plan7Str && plan7Str !== "-") {
              if (completionStr && completionStr !== "-") {
                status = "completed";
              } else {
                status = "pending";
              }
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
                damageQty: row[116] || "0",
                damageReason: row[117] || "-",
                damageImage: row[118] || "",
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
        const liftNo = String(pRow[2] || "").trim().toLowerCase();
        
        const parentRecord = sheetRecords.find(r => 
          String(r.data.liftNo || "").trim().toLowerCase() === liftNo
        );
        const parentData = parentRecord?.data ?? {};
        const parentStatus = parentRecord?.status ?? "not_ready";

        return {
          id: `partial-${indentNoUpper}-${idx}`,
          parentStatus,
          data: {
            indentNumber: indentNoUpper,
            vendorName: parentData.vendorName || "-",
            invoiceNumber: parentData.invoiceNumber || "-",
            itemName: parentData.itemName || "-",
            plan7: parentData.plan7 || "-",
            actual7: pRow[0] || "-",
            qcDate: pRow[3] || "-",
            qcBy: pRow[5] || "-",
            approvedQty: pRow[6] || "0",
            rejectedQty: pRow[12] || "0",
            qcStatus: pRow[4] || "-",
            remarks: pRow[13] || "-",
            damageQty: parentData.damageQty || "-",
            damageReason: parentData.damageReason || "-",
            damageImage: parentData.damageImage || "",
            // New columns fields
            liftNo: pRow[2] || "-",
            workingCondition: pRow[4] || "-",
            checklist: pRow[7] || "-",
            serialNo: pRow[8] || "-",
            image: pRow[9] || "-",
            rejectType: pRow[10] || "-",
            partName: pRow[11] || "-",
          },
        };
      })
      .filter(rec => {
        if (rec.parentStatus !== "completed") return false;
        if (!searchLower) return true;
        return (
          rec.data.indentNumber?.toLowerCase().includes(searchLower) ||
          rec.data.vendorName?.toLowerCase().includes(searchLower) ||
          rec.data.itemName?.toLowerCase().includes(searchLower)
        );
      })
      .reverse();
  }, [partialQCRecords, sheetRecords, searchTerm]);

  const fetchSerialsForRecord = useCallback(async (indentNumber: string, liftNo: string) => {
    if (!SHEET_API_URL) return;
    setIsSerialsLoading(true);
    try {
      const res = await fetch(`${SHEET_API_URL}?sheet=Serial-Generation&action=getAll`);
      const json = await res.json();
      if (json.success && Array.isArray(json.data)) {
        const cleanIndent = String(indentNumber || "").trim().toLowerCase();
        const cleanLift = String(liftNo || "").trim().toLowerCase();

        let serials = json.data.slice(6)
          .filter((row: any) => {
            const rowIndent = String(row[0] || "").trim().toLowerCase();
            const rowLift = String(row[1] || "").trim().toLowerCase();
            return rowIndent === cleanIndent && rowLift === cleanLift;
          })
          .map((row: any) => String(row[3] || "").trim())
          .filter((s: string) => s !== "");

        if (serials.length === 0) {
          serials = json.data.slice(6)
            .filter((row: any) => {
              const rowIndent = String(row[0] || "").trim().toLowerCase();
              return rowIndent === cleanIndent;
            })
            .map((row: any) => String(row[3] || "").trim())
            .filter((s: string) => s !== "");
        }
        setSerialNoList(serials);
      }
    } catch (e) {
      console.error("Failed to fetch serial numbers", e);
    } finally {
      setIsSerialsLoading(false);
    }
  }, []);

  const handleOpenForm = useCallback((recordId: string) => {
    const record = sheetRecords.find((r) => r.id === recordId);
    if (!record) return;

    setSelectedRecordId(recordId);
    setFormData({
      qcBy: "",
      qcDate: getFmsTimestamp().split(" ")[0],
      workingCondition: "",
      approvedQty: "",
      checklistSelected: [],
      rejectType: "",
      partName: "",
      rejectQty: "",
      rejectPhoto: null,
      remarks: "",
      srnEntries: [],
      rejectSrnEntries: [],
    });
    setSerialNoList([]);
    setOpen(true);

    fetchSerialsForRecord(record.data.indentNumber, record.data.liftNo);
  }, [sheetRecords, fetchSerialsForRecord]);

  const isFormValid = useMemo(() => {
    if (!formData.qcDate || !formData.workingCondition) return false;
    const isPassed = formData.workingCondition === "Passed" || formData.workingCondition === "Passed but Concern";
    if (isPassed) {
      return !!(
        formData.qcBy &&
        formData.approvedQty &&
        parseInt(formData.approvedQty) > 0 &&
        formData.checklistSelected.length > 0 &&
        formData.srnEntries.length > 0 &&
        formData.srnEntries.every((e) => e.srn.trim() !== "")
      );
    } else if (formData.workingCondition === "Rejected") {
      return !!(
        formData.rejectType &&
        formData.partName &&
        formData.rejectQty &&
        parseInt(formData.rejectQty) > 0 &&
        formData.rejectSrnEntries.length > 0 &&
        formData.rejectSrnEntries.every((e) => e.srn.trim() !== "")
      );
    }
    return false;
  }, [formData]);

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

      const isPassed = formData.workingCondition === "Passed" || formData.workingCondition === "Passed but Concern";

      let serialNosStr = "";
      let imageUrlsStr = "";
      if (isPassed && formData.srnEntries.length > 0) {
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
            return { srn: entry.srn, image: imageUrl };
          })
        );
        serialNosStr = srnData.map((d) => d.srn).filter(Boolean).join(", ");
        imageUrlsStr = srnData.map((d) => d.image).filter(Boolean).join(" , ");
      } else if (formData.workingCondition === "Rejected" && formData.rejectSrnEntries.length > 0) {
        const srnData = await Promise.all(
          formData.rejectSrnEntries.map(async (entry) => {
            let imageUrl = "";
            if (entry.image instanceof File) {
              const uploadParams = new URLSearchParams();
              uploadParams.append("action", "uploadFile");
              uploadParams.append("base64Data", await toBase64(entry.image));
              uploadParams.append("fileName", `REJECT_SRN_${entry.serialNo}_${entry.image.name}`);
              uploadParams.append("mimeType", entry.image.type);
              uploadParams.append("folderId", IMAGE_FOLDER_ID);
              const res = await fetch(SHEET_API_URL!, { method: "POST", body: uploadParams });
              const json = await res.json();
              if (json.success) imageUrl = json.fileUrl || "";
            }
            return { srn: entry.srn, image: imageUrl };
          })
        );
        serialNosStr = srnData.map((d) => d.srn).filter(Boolean).join(", ");
        imageUrlsStr = srnData.map((d) => d.image).filter(Boolean).join(" , ");
      }

      const postToPartialQC = async (row: any[]) => {
        const p = new URLSearchParams();
        p.append("action", "batchInsert");
        p.append("sheetName", "Material-Testing");
        p.append("rowsData", JSON.stringify([row]));
        p.append("startRow", "2");
        const res = await fetch(SHEET_API_URL!, { method: "POST", body: p });
        const json = await res.json();
        if (!json.success) throw new Error("Failed to write to Material-Testing sheet");
      };

      const updateCell = async (rowIndex: number, columnIndex: number, value: string) => {
        const p = new URLSearchParams();
        p.append("action", "updateCell");
        p.append("sheetName", "RECEIVING-ACCOUNTS");
        p.append("rowIndex", rowIndex.toString());
        p.append("columnIndex", columnIndex.toString());
        p.append("value", value);
        const res = await fetch(SHEET_API_URL!, { method: "POST", body: p });
        const json = await res.json();
        if (!json.success) throw new Error("Failed to update parent status");
      };

      const receivedQty = parseFloat(selectedRecord.data.receivedQty || "0");
      const currentResolved = (selectedRecord.data.totalApproved || 0) + (selectedRecord.data.totalRejected || 0);
      const promises: Promise<any>[] = [];

      const checklistStr = isPassed ? formData.checklistSelected.join(", ") : "";

      const row = [
        mDYYYY,                                                        // A: Timestamp
        selectedRecord.data.indentNumber,                              // B: Indent No
        selectedRecord.data.liftNo || "",                              // C: Lift No
        qcDateFormatted,                                                // D: QC-Date
        formData.workingCondition,                                     // E: Working Condition
        formData.qcBy || "",                                           // F: Checked By
        isPassed ? formData.approvedQty : "",                          // G: Approved Qty
        checklistStr,                                                   // H: Checklist
        serialNosStr,                                                  // I: Serial-No
        imageUrlsStr,                                                  // J: Image
        formData.workingCondition === "Rejected" ? formData.rejectType : "", // K: Reject Type
        formData.workingCondition === "Rejected" ? formData.partName : "",   // L: Part-Name
        formData.workingCondition === "Rejected" ? formData.rejectQty : "",   // M: Reject Qty
        formData.remarks || "",                                        // N: Remarks
      ];

      promises.push(postToPartialQC(row));

      const changeQty = isPassed
        ? parseFloat(formData.approvedQty || "0")
        : parseFloat(formData.rejectQty || "0");

      const newTotalResolved = currentResolved + changeQty;
      if (newTotalResolved >= receivedQty) {
        promises.push(updateCell(selectedRecord.rowIndex, 63, mDYYYY)); // 63 is Column BK
        toast.success("QC Inspection Complete — all quantity resolved!");
      } else {
        toast.success("Material-Testing recorded successfully.");
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

  const safeValue = useCallback((record: any, key: string) => {
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

      if (key === "workingCondition") {
        const cond = data.workingCondition;
        if (!cond || cond === "-" || cond === "") return "-";
        if (cond === "yes" || cond === "Passed") return "Passed";
        if (cond === "no" || cond === "Rejected") return "Rejected";
        if (cond === "passed_concern" || cond === "Passed but Concern") return "Passed but Concern";
        return cond.charAt(0).toUpperCase() + cond.slice(1);
      }

      if (key === "checklist" || key === "serialNo" || key === "image") {
        const val = data[key];
        if (!val || String(val).trim() === "" || val === "-") return "-";
        return (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-slate-500 hover:text-blue-600 hover:bg-blue-50 transition-colors"
            onClick={(e) => {
              e.stopPropagation();
              setSelectedHistoryRecord(record);
              setHistoryDialogOpen(true);
            }}
          >
            <Eye className="w-4 h-4" />
          </Button>
        );
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
                Stage 8: Material Testing
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
            </Tabs>
          </div>
        )}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg sm:max-w-lg max-h-[90vh] flex flex-col p-0 overflow-hidden rounded-xl bg-white">
          <DialogHeader className="p-6 bg-slate-50 border-b">
            <DialogTitle className="text-xl font-bold flex items-center gap-2">
              <ClipboardCheck className="w-5 h-5 text-blue-600" />
              Quality Control Inspection
            </DialogTitle>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            <div className="bg-blue-50/50 p-4 rounded-lg border border-blue-100 grid grid-cols-2 gap-4">
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
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label className="text-xs font-bold text-slate-700">Machine Working Condition <span className="text-red-500">*</span></Label>
                  <Select
                    value={formData.workingCondition}
                    onValueChange={(v) => setFormData({
                      ...formData,
                      workingCondition: v,
                      approvedQty: v === "Rejected" ? "" : formData.approvedQty,
                      checklistSelected: v === "Rejected" ? [] : formData.checklistSelected,
                      srnEntries: v === "Rejected" ? [] : formData.srnEntries,
                      rejectType: (v === "Passed" || v === "Passed but Concern") ? "" : formData.rejectType,
                      partName: (v === "Passed" || v === "Passed but Concern") ? "" : formData.partName,
                      rejectQty: (v === "Passed" || v === "Passed but Concern") ? "" : formData.rejectQty,
                      rejectSrnEntries: (v === "Passed" || v === "Passed but Concern") ? [] : formData.rejectSrnEntries,
                    })}
                  >
                    <SelectTrigger className="bg-white border-slate-200 rounded-lg shadow-sm h-10">
                      <SelectValue placeholder="Select Option" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Passed">Passed</SelectItem>
                      <SelectItem value="Rejected">Rejected</SelectItem>
                      <SelectItem value="Passed but Concern">Passed but Concern</SelectItem>
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
                  <Label className="text-xs font-bold text-slate-700">Checked By</Label>
                  <Select value={formData.qcBy} onValueChange={(v) => setFormData({ ...formData, qcBy: v })}>
                    <SelectTrigger className="bg-white border-slate-200 rounded-lg shadow-sm h-10">
                      <SelectValue placeholder="Select engineer" />
                    </SelectTrigger>
                    <SelectContent>
                      {qcEngineerList.map((n) => <SelectItem key={n} value={n}>{n}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>

                {(formData.workingCondition === "Passed" || formData.workingCondition === "Passed but Concern") && (
                  <>
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

                    <div className="space-y-2 col-span-full">
                      <Label className="text-xs font-bold text-slate-700">Checklist <span className="text-red-500">*</span></Label>
                      <div className="grid grid-cols-1 gap-3 bg-slate-50 p-4 rounded-xl border border-slate-200 max-h-[160px] overflow-y-auto">
                        {checklistList.map((item) => {
                          const isChecked = formData.checklistSelected.includes(item);
                          return (
                            <div key={item} className="flex items-start space-x-3 py-1">
                              <input
                                type="checkbox"
                                id={`checklist-${item}`}
                                className="mt-1 h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                                checked={isChecked}
                                onChange={() => {
                                  setFormData((prev) => {
                                    const list = prev.checklistSelected.includes(item)
                                      ? prev.checklistSelected.filter((i) => i !== item)
                                      : [...prev.checklistSelected, item];
                                    return { ...prev, checklistSelected: list };
                                  });
                                }}
                              />
                              <Label
                                htmlFor={`checklist-${item}`}
                                className="text-xs font-medium text-slate-700 cursor-pointer leading-normal"
                              >
                                {item}
                              </Label>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </>
                )}

                {formData.workingCondition === "Rejected" && (
                  <>
                    <div className="space-y-2">
                      <Label className="text-xs font-bold text-slate-700">Reject Type <span className="text-red-500">*</span></Label>
                      <Select value={formData.rejectType} onValueChange={(v) => setFormData({ ...formData, rejectType: v })}>
                        <SelectTrigger className="bg-white border-slate-200 rounded-lg shadow-sm h-10">
                          <SelectValue placeholder="Select type" />
                        </SelectTrigger>
                        <SelectContent>
                          {rejectTypeList.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label className="text-xs font-bold text-slate-700">Part-Name <span className="text-red-500">*</span></Label>
                      <Input
                        type="text"
                        placeholder="Enter part name"
                        className="bg-white border-slate-200 rounded-lg shadow-sm h-10"
                        value={formData.partName}
                        onChange={(e) => setFormData({ ...formData, partName: e.target.value })}
                        required
                      />
                    </div>

                    <div className="space-y-2">
                      <Label className="text-xs font-bold text-slate-700">Reject Qty <span className="text-red-500">*</span></Label>
                      <Input
                        type="number"
                        min="1"
                        max={selectedRecord?.data?.pendingQty || 999}
                        className="bg-white border-slate-200 rounded-lg shadow-sm h-10"
                        placeholder={`Pending: ${selectedRecord?.data?.pendingQty || "0"}`}
                        value={formData.rejectQty}
                        onChange={(e) => {
                          const qty = parseInt(e.target.value) || 0;
                          const maxQty = parseInt(selectedRecord?.data?.pendingQty) || 999;
                          const validQty = Math.min(Math.max(0, qty), maxQty);
                          const newEntries = Array.from({ length: validQty }, (_, i) => ({
                            serialNo: i + 1,
                            srn: formData.rejectSrnEntries[i]?.srn || "",
                            image: formData.rejectSrnEntries[i]?.image || null,
                          }));
                          setFormData({ ...formData, rejectQty: String(validQty), rejectSrnEntries: newEntries });
                        }}
                        required
                      />
                    </div>
                  </>
                )}
              </div>

              {(formData.workingCondition === "Passed" || formData.workingCondition === "Passed but Concern") && formData.srnEntries.length > 0 && (
                <div className="bg-slate-50 border border-slate-200 rounded-xl overflow-hidden shadow-sm">
                  <div className="px-4 py-3 bg-slate-100 border-b border-slate-200 flex items-center justify-between">
                    <h3 className="text-sm font-bold text-slate-800">Approved-Qty with S No. and Img</h3>
                    <span className="text-xs bg-white text-slate-600 px-2 py-0.5 rounded-full border border-slate-200 font-medium">
                      {formData.srnEntries.length} Items Pending
                    </span>
                  </div>
                  <div className="p-4 space-y-3 max-h-[300px] overflow-y-auto">
                    {formData.srnEntries.map((entry, idx) => (
                      <div key={entry.serialNo} className="grid grid-cols-12 gap-3 items-center bg-white p-3 rounded-lg border border-slate-100 group">
                        <div className="col-span-1 text-xs font-bold text-slate-400">#{entry.serialNo}</div>
                        <div className="col-span-5 relative">
                          <SearchableSrnDropdown
                            value={entry.srn}
                            onChange={(val) => {
                              const updated = [...formData.srnEntries];
                              updated[idx] = { ...updated[idx], srn: val };
                              setFormData({ ...formData, srnEntries: updated });
                            }}
                            options={serialNoList}
                            placeholder="Select/Search SRN"
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
                              className={`flex items-center justify-center gap-2 px-3 py-1.5 border rounded-lg cursor-pointer transition-all h-9 text-xs font-medium ${entry.image
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

              {formData.workingCondition === "Rejected" && formData.rejectSrnEntries.length > 0 && (
                <div className="bg-red-50/30 border border-red-200 rounded-xl overflow-hidden shadow-sm">
                  <div className="px-4 py-3 bg-red-50/80 border-b border-red-100 flex items-center justify-between">
                    <h3 className="text-sm font-bold text-red-800">Rejected-Qty with S No. and Img</h3>
                    <span className="text-xs bg-white text-red-600 px-2 py-0.5 rounded-full border border-red-200 font-medium">
                      {formData.rejectSrnEntries.length} Items Pending
                    </span>
                  </div>
                  <div className="p-4 space-y-3 max-h-[300px] overflow-y-auto">
                    {formData.rejectSrnEntries.map((entry, idx) => (
                      <div key={entry.serialNo} className="grid grid-cols-12 gap-3 items-center bg-white p-3 rounded-lg border border-slate-100 group">
                        <div className="col-span-1 text-xs font-bold text-slate-400">#{entry.serialNo}</div>
                        <div className="col-span-5 relative">
                          <SearchableSrnDropdown
                            value={entry.srn}
                            onChange={(val) => {
                              const updated = [...formData.rejectSrnEntries];
                              updated[idx] = { ...updated[idx], srn: val };
                              setFormData({ ...formData, rejectSrnEntries: updated });
                            }}
                            options={serialNoList}
                            placeholder="Select/Search SRN"
                          />
                        </div>
                        <div className="col-span-6 flex items-center gap-2">
                          <div className="flex-1">
                            <input
                              type="file"
                              accept="image/*"
                              id={`reject-srn-image-${idx}`}
                              className="hidden"
                              onChange={(e) => {
                                const file = e.target.files?.[0] || null;
                                const updated = [...formData.rejectSrnEntries];
                                updated[idx] = { ...updated[idx], image: file };
                                setFormData({ ...formData, rejectSrnEntries: updated });
                              }}
                            />
                            <label
                              htmlFor={`reject-srn-image-${idx}`}
                              className={`flex items-center justify-center gap-2 px-3 py-1.5 border rounded-lg cursor-pointer transition-all h-9 text-xs font-medium ${entry.image
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
                                const updated = [...formData.rejectSrnEntries];
                                updated[idx] = { ...updated[idx], image: null };
                                setFormData({ ...formData, rejectSrnEntries: updated });
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

              <div className="space-y-2">
                <Label className="text-xs font-bold text-slate-700 font-medium">
                  {formData.workingCondition === "Passed but Concern" ? "Concern Issue" : "Remarks"}
                </Label>
                <textarea
                  className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl resize-none text-sm focus:ring-blue-500 h-24"
                  rows={3}
                  placeholder={formData.workingCondition === "Passed but Concern" ? "Concern Issue..." : "Remarks..."}
                  value={formData.remarks}
                  onChange={(e) => setFormData({ ...formData, remarks: e.target.value })}
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

      <Dialog open={historyDialogOpen} onOpenChange={setHistoryDialogOpen}>
        <DialogContent className="max-w-md max-h-[85vh] flex flex-col p-0 overflow-hidden rounded-xl bg-white">
          <DialogHeader className="p-6 bg-slate-50 border-b">
            <DialogTitle className="text-lg font-bold flex items-center gap-2">
              <ClipboardCheck className="w-5 h-5 text-blue-600" />
              Inspection Details
            </DialogTitle>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto p-6 space-y-5">
            {/* Record Summary */}
            <div className="grid grid-cols-2 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-100">
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Indent No</span>
                <span className="text-xs font-bold text-slate-800">{selectedHistoryRecord?.data?.indentNumber || "-"}</span>
              </div>
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Lift No</span>
                <span className="text-xs font-bold text-slate-800">{selectedHistoryRecord?.data?.liftNo || "-"}</span>
              </div>
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">QC Date</span>
                <span className="text-xs font-medium text-slate-800">{selectedHistoryRecord?.data?.qcDate || "-"}</span>
              </div>
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Checked By</span>
                <span className="text-xs font-medium text-slate-800">{selectedHistoryRecord?.data?.qcBy || "-"}</span>
              </div>
            </div>

            {/* Checklist Section */}
            <div className="space-y-2">
              <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider">QC Checklist</h4>
              {selectedHistoryRecord?.data?.checklist && selectedHistoryRecord.data.checklist !== "-" ? (
                <div className="flex flex-wrap gap-1.5">
                  {selectedHistoryRecord.data.checklist.split(",").map((item: string, i: number) => (
                    <span key={i} className="text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-100 px-2.5 py-1 rounded-full">
                      ✓ {item.trim()}
                    </span>
                  ))}
                </div>
              ) : (
                <span className="text-xs text-slate-400 italic">No checklist recorded</span>
              )}
            </div>

            {/* Serials & Images Section */}
            <div className="space-y-2">
              <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Serial Numbers & Photos</h4>
              <div className="space-y-2 max-h-[250px] overflow-y-auto pr-1">
                {selectedHistoryRecord?.data?.serialNo && selectedHistoryRecord.data.serialNo !== "-" ? (
                  (() => {
                    const serials = String(selectedHistoryRecord.data.serialNo).split(",").map(s => s.trim()).filter(Boolean);
                    const images = selectedHistoryRecord?.data?.image && selectedHistoryRecord.data.image !== "-"
                      ? String(selectedHistoryRecord.data.image).split(",").map(i => i.trim()).filter(Boolean)
                      : [];
                    return serials.map((serial, idx) => {
                      const imageUrl = images[idx] || "";
                      return (
                        <div key={idx} className="flex items-center justify-between p-2.5 bg-slate-50 border border-slate-100 rounded-lg">
                          <span className="text-xs font-semibold text-slate-400">#{idx + 1}</span>
                          {imageUrl ? (
                            <a
                              href={imageUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-xs font-semibold text-blue-600 hover:underline flex items-center gap-1.5 bg-white px-2.5 py-1 rounded border border-slate-200 shadow-sm transition-all hover:bg-slate-50"
                            >
                              <FileText className="w-3.5 h-3.5 text-blue-500" />
                              {serial}
                            </a>
                          ) : (
                            <span className="text-xs text-slate-600 font-medium bg-white px-2.5 py-1 rounded border border-slate-200">
                              {serial}
                            </span>
                          )}
                        </div>
                      );
                    });
                  })()
                ) : (
                  <span className="text-xs text-slate-400 italic">No serial numbers recorded</span>
                )}
              </div>
            </div>
          </div>

          <DialogFooter className="p-4 bg-slate-50 border-t flex justify-end">
            <Button variant="outline" onClick={() => setHistoryDialogOpen(false)} className="px-5 text-xs">
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
