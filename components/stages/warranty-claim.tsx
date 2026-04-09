"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Loader2, Search, ShieldAlert } from "lucide-react";
import { formatDate, parseSheetDate, getFmsTimestamp, isWarrantyExpiringSoon } from "@/lib/utils";
import { toast } from "sonner";

const FOLDER_ID = process.env.NEXT_PUBLIC_IMAGE_FOLDER_ID || "1SihRrPrgbuPGm-09fuB180QJhdxq5Nxy";

const toBase64 = (file: File) => new Promise<string>((resolve, reject) => {
  const reader = new FileReader();
  reader.readAsDataURL(file);
  reader.onload = () => resolve(reader.result as string);
  reader.onerror = error => reject(error);
});

// ─── WARRANTY sheet column map (0-based, data from row 7) ──────
const PENDING_COLUMNS = [
    { key: "indentNo", label: "Indent No." },
    { key: "liftNo", label: "Unit Tracking No." },
    { key: "vendorName", label: "Vendor Name" },
    { key: "itemName", label: "Item Name" },
    { key: "invoiceDate", label: "Invoice Date" },
    { key: "serialNo", label: "Serial No." },
    { key: "warrantyEnd", label: "Warranty End" },
    { key: "planned", label: "Planned" },
];

const CLOSURE_PENDING_COLUMNS = [
    { key: "indentNo", label: "Indent No." },
    { key: "liftNo", label: "Unit Tracking No." },
    { key: "serialNo", label: "Serial No." },
    { key: "invoiceNo", label: "Invoice No." },
    { key: "issueDescription", label: "Issue Description" },
    { key: "claimType", label: "Claim Type" },
    { key: "status", label: "Status" },
];

const HISTORY_COLUMNS = [
    { key: "indentNo", label: "Indent No." },
    { key: "liftNo", label: "Unit Tracking No." },
    { key: "serialNo", label: "Serial No." },
    { key: "invoiceNo", label: "Invoice No." },
    { key: "issueDescription", label: "Issue Description" },
    { key: "claimType", label: "Claim Type" },
    {key: "status", label: "Status"},
    {key: "invoiceCopy", label: "Invoice Copy"},
    {key: "photoVideo", label: "Photo/Video"},
    {key: "closureDate", label: "Closure Date"},
    {key: "remarks", label: "Remarks"},
];

// --- Optimized Row Component ---
const RecordRow = React.memo(({ rec, columns, onAction, isHistory = false, renderCell, isCritical = false }: any) => {
    const rowClass = isCritical ? "bg-red-50 hover:bg-red-100" : (isHistory ? "hover:bg-indigo-50/50" : "hover:bg-gray-50");
    const stickyClass = isCritical ? "bg-red-50 group-hover:bg-red-100 border-b" : "bg-white group-hover:bg-gray-50 border-b";

    return (
        <tr className={`group transition-colors ${rowClass}`}>
            {!isHistory && (
                <td className={`sticky left-0 z-20 ${stickyClass} text-center px-4 py-2`}>
                    <Button
                        size="sm"
                        className="bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm transition-all active:scale-95 h-8 px-3 text-[11px] font-semibold"
                        onClick={() => onAction(rec)}
                    >
                        Claim
                    </Button>
                </td>
            )}
            {columns.map((col: any) => (
                <td key={col.key} className="border-b px-4 py-2 text-center text-slate-700 whitespace-nowrap">
                    {renderCell(rec.data, col.key)}
                </td>
            ))}
        </tr>
    );
});
RecordRow.displayName = "RecordRow";


export default function WarrantyClaim() {
    const [pendingRecords, setPendingRecords] = useState<any[]>([]);
    const [closurePendingRecords, setClosurePendingRecords] = useState<any[]>([]);
    const [historyRecords, setHistoryRecords] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [searchTerm, setSearchTerm] = useState("");
    const [activeTab, setActiveTab] = useState<"pending" | "closurePending" | "history">("pending");
    const [showExpiringOnly, setShowExpiringOnly] = useState(false);

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isClosureModalOpen, setIsClosureModalOpen] = useState(false);
    const [selectedRecord, setSelectedRecord] = useState<any>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    
    // Initial Claim Form State
    const [formData, setFormData] = useState({
        by: "",
        invoiceNo: "",
        invoiceCopy: null as File | null,
        issueDescription: "",
        photosVideos: null as File | null,
        claimType: "",
    });

    // Closure Form State
    const [closureFormData, setClosureFormData] = useState({
        status: "Pending",
        closureDate: "",
        remarks: ""
    });
    // ─── Fetch ───────────────────────────────────────────────────────────────
    const fetchData = useCallback(async () => {
        const API = process.env.NEXT_PUBLIC_API_URI;
        if (!API) return;
        setIsLoading(true);
        try {
            const [warrantyRes, claimRes] = await Promise.all([
                fetch(`${API}?sheet=WARRANTY&action=getAll`),
                fetch(`${API}?sheet=Warranty_Claim&action=getAll`)
            ]);

            const warrantyJson = await warrantyRes.json();
            const claimJson = await claimRes.json();

            const pending: any[] = [];
            const closurePending: any[] = [];
            const history: any[] = [];

            const warrantyMap = new Map();

            if (warrantyJson.success && Array.isArray(warrantyJson.data)) {
                const allRows = warrantyJson.data
                    .slice(6)
                    .map((row: any, i: number) => ({ row, sheetIndex: i + 7 }))
                    .filter(({ row }: any) => row[0] && String(row[0]).trim() !== "");

                allRows.forEach(({ row, sheetIndex }: any) => {
                    const actualValue = String(row[9] || "").trim(); // J
                    const hasActual = actualValue !== "" && actualValue !== "-";

                    const data = {
                        indentNo: String(row[0] || "").trim(), // A
                        liftNo: row[1] || "",                 // B
                        serialCode: row[2] || "",             // C
                        serialNo: row[3] || "",               // D
                        vendorName: row[4] || "",             // E
                        itemName: row[5] || "",               // F
                        invoiceDate: row[6] || "",            // G
                        warrantyEnd: row[7] || "",            // H
                        planned: row[8] || "",                // I
                        actual: actualValue,                   // J
                    };

                    const id = `w_${data.indentNo}_${data.liftNo}_${data.serialNo}`;
                    warrantyMap.set(id, data);

                    if (!hasActual) {
                        pending.push({ id, sheetIndex, data });
                    }
                });
            }

            if (claimJson.success && Array.isArray(claimJson.data)) {
                // Warranty_Claim data starts from row 6 -> slice(6)
                // row[0]: Timestamp, row[1]: Indent, row[2]: Lift, row[3]: SN ... row[10]: Status
                const claimRows = claimJson.data
                    .slice(6)
                    .map((row: any, i: number) => ({ row, sheetIndex: i + 7 }))
                    .filter(({ row }: any) => row[0] && String(row[0]).trim() !== "");

                claimRows.forEach(({ row, sheetIndex }: any) => {
                    const status = String(row[10] || "Pending").trim();
                    const indentNo = String(row[1] || "").trim();
                    const liftNo = row[2] || "";
                    const serialNo = row[3] || "";
                    
                    const itemData = {
                        timestamp: row[0],
                        indentNo,
                        liftNo,
                        serialNo,
                        qty: row[4],
                        invoiceNo: row[5],
                        issueDescription: row[6],
                        invoiceCopy: row[7],
                        photoVideo: row[8],
                        claimType: row[9],
                        status,
                        closureDate: row[11],
                        remarks: row[12],
                    };

                    const rec = {
                        id: `claim_${sheetIndex}_${indentNo}_${serialNo}`,
                        sheetIndex,
                        originalRow: row,
                        data: itemData
                    };

                    if (status.toLowerCase() === "closure") {
                        history.push(rec);
                    } else {
                        closurePending.push(rec);
                    }
                });
            }

            setPendingRecords(pending);
            setClosurePendingRecords(closurePending);
            setHistoryRecords(history);
        } catch (e) {
            console.error("Fetch error:", e);
        }
        setIsLoading(false);
    }, []);

    useEffect(() => { fetchData(); }, [fetchData]);

    // ─── Search filter ────────────────────────────────────────────────────────
    const applySearch = useCallback((records: any[]) => {
        if (!searchTerm) return records;
        const lower = searchTerm.toLowerCase();
        return records.filter((r) =>
            r.data.indentNo?.toLowerCase().includes(lower) ||
            r.data.itemName?.toLowerCase().includes(lower) ||
            r.data.vendorName?.toLowerCase().includes(lower) ||
            r.data.serialNo?.toLowerCase().includes(lower) ||
            r.data.invoiceNo?.toLowerCase().includes(lower)
        );
    }, [searchTerm]);

    const pending = useMemo(() => {
        let filtered = applySearch(pendingRecords);
        if (showExpiringOnly) {
            filtered = filtered.filter(r => isWarrantyExpiringSoon(r.data.warrantyEnd));
        }
        return filtered;
    }, [pendingRecords, applySearch, showExpiringOnly]);
    const closurePending = useMemo(() => applySearch(closurePendingRecords), [closurePendingRecords, applySearch]);
    const history = useMemo(() => applySearch(historyRecords), [historyRecords, applySearch]);

    // ─── Submit ───────────────────────────────────────────────────────────────
    const uploadFile = useCallback(async (file: File) => {
        const API = process.env.NEXT_PUBLIC_API_URI;
        if (!API) throw new Error("API not configured");
        const upParams = new URLSearchParams();
        upParams.append("action", "uploadFile");
        upParams.append("base64Data", await toBase64(file));
        upParams.append("fileName", file.name);
        upParams.append("mimeType", file.type);
        upParams.append("folderId", FOLDER_ID);

        const upRes = await fetch(`${API}`, { method: "POST", body: upParams });
        const upJson = await upRes.json();
        if (upJson.success) return upJson.fileUrl;
        throw new Error("Upload failed");
    }, []);

    const handleClaimSubmit = useCallback(async () => {
        const API = process.env.NEXT_PUBLIC_API_URI;
        if (!API || !selectedRecord) return;

        setIsSubmitting(true);
        const toastId = toast.loading("Processing submission...");
        
        try {
            let invoiceCopyUrl = "";
            let photosVideosUrl = "";

            if (formData.by === "Client") {
                const uploadPromises: Promise<any>[] = [];
                if (formData.invoiceCopy) {
                    uploadPromises.push(uploadFile(formData.invoiceCopy).then(url => { invoiceCopyUrl = url; }));
                }
                if (formData.photosVideos) {
                    uploadPromises.push(uploadFile(formData.photosVideos).then(url => { photosVideosUrl = url; }));
                }
                if (uploadPromises.length > 0) {
                    toast.loading("Uploading files...", { id: toastId });
                    await Promise.all(uploadPromises);
                }
            }

            const ts = getFmsTimestamp();
            const row = new Array(13).fill("");
            row[0] = ts;
            row[1] = selectedRecord.data.indentNo || "";
            row[2] = selectedRecord.data.liftNo || "";
            row[3] = selectedRecord.data.serialNo || "";
            row[4] = "1";
            row[5] = formData.invoiceNo || "";
            row[6] = formData.issueDescription || "";
            row[7] = formData.by === "Client" ? invoiceCopyUrl : "";
            row[8] = formData.by === "Client" ? photosVideosUrl : "";
            row[9] = formData.claimType || "";
            row[10] = "Pending"; // Always Pending by default as per request
            row[11] = "";
            row[12] = "";

            const insertParams = new URLSearchParams();
            insertParams.append("action", "batchInsert");
            insertParams.append("sheetName", "Warranty_Claim");
            insertParams.append("rowsData", JSON.stringify([row]));
            insertParams.append("startRow", "7"); // Standardizing on row 7 for consistency with others

            const warrantyRow = new Array(10).fill("");
            warrantyRow[9] = ts; // Col J: Actual 

            const updateParams = new URLSearchParams();
            updateParams.append("action", "update");
            updateParams.append("sheetName", "WARRANTY");
            updateParams.append("rowData", JSON.stringify(warrantyRow));
            updateParams.append("rowIndex", selectedRecord.sheetIndex.toString());

            toast.loading("Saving record...", { id: toastId });
            
            await Promise.all([
                fetch(API, { method: "POST", body: insertParams }),
                fetch(API, { method: "POST", body: updateParams })
            ]);

            setIsModalOpen(false);
            toast.success("Claim submitted successfully!", { id: toastId, duration: 2000 });
            fetchData();
        } catch (e: any) {
            console.error("Submit error:", e);
            toast.error(e.message || "Failed to submit claim", { id: toastId });
        } finally {
            setIsSubmitting(false);
        }
    }, [selectedRecord, formData, fetchData, uploadFile]);

    const handleClosureSubmit = useCallback(async () => {
        const API = process.env.NEXT_PUBLIC_API_URI;
        if (!API || !selectedRecord) return;

        setIsSubmitting(true);
         const toastId = toast.loading("Processing closure...");
         try {
             // CLONE THE ORIGINAL ROW to ensure NO OTHER columns are touched
             const updatedRow = [...selectedRecord.originalRow];
             
             // Logically update only columns K, L, M (Indices 10, 11, 12)
             updatedRow[10] = closureFormData.status;
             updatedRow[11] = closureFormData.status === "Closure" ? closureFormData.closureDate : "";
             updatedRow[12] = closureFormData.remarks || "";
 
             // CRITICAL FIX: Robustly preserve Column A (index 0) timestamp as a string.
             // Google Apps Script stringifies Dates as ISO strings, so if Column A is a Date object,
             // or an ISO string, we re-format it into a friendly space-separated string.
             if (updatedRow[0]) {
                 const d = parseSheetDate(updatedRow[0]);
                 if (d && !isNaN(d.getTime())) {
                     const pad = (n: number) => String(n).padStart(2, "0");
                     updatedRow[0] = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
                 } else {
                     // Fallback: ensure it's at least a string
                     updatedRow[0] = String(updatedRow[0]);
                 }
             }

            const updateParams = new URLSearchParams();
            updateParams.append("action", "update");
            updateParams.append("sheetName", "Warranty_Claim");
            updateParams.append("rowData", JSON.stringify(updatedRow));
            updateParams.append("rowIndex", selectedRecord.sheetIndex.toString());

            const res = await fetch(API, { method: "POST", body: updateParams });
            const json = await res.json();

            if (json.success) {
                setIsClosureModalOpen(false);
                toast.success("Closure updated successfully!", { id: toastId, duration: 2000 });
                fetchData();
            } else {
                throw new Error(json.message || "Failed to update closure");
            }
        } catch (e: any) {
            console.error("Closure update error:", e);
            toast.error(e.message || "Failed to update closure", { id: toastId });
        } finally {
            setIsSubmitting(false);
        }
    }, [selectedRecord, closureFormData, fetchData]);

    const formatDateDash = (dateStr: any) => {
        if (!dateStr || dateStr === "-" || dateStr === "—") return "-";
        const d = parseSheetDate(dateStr);
        if (!d || isNaN(d.getTime())) return dateStr;
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, "0");
        const day = String(d.getDate()).padStart(2, "0");
        return `${day}-${month}-${year}`;
    };

    const renderCell = (data: any, key: string) => {
        const val = data?.[key];

        // Link columns
        if (key === "invoiceCopy" || key === "poCopy" || key === "photoVideo") {
            if (!val || String(val).trim() === "" || val === "-") return "-";
            return (
                <a
                    href={String(val)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-indigo-600 hover:underline inline-flex items-center gap-1 font-medium"
                >
                    View
                </a>
            );
        }

        // Date columns
        if (
            key === "invoiceDate" ||
            key === "planned" ||
            key === "actual" ||
            key === "warrantyEnd" ||
            key === "closureDate"
        ) {
            return formatDateDash(val);
        }

        if (!val || String(val).trim() === "" || val === "-") return "-";
        return String(val);
    };

    // ─── Render ───────────────────────────────────────────────────────────────
    return (
        <div className="p-6 min-h-screen bg-[#f8fafc]">
            <Tabs
                value={activeTab}
                onValueChange={(v) => setActiveTab(v as any)}
                className="w-full"
            >
                {/* Sticky Header and Tabs Container */}
                <div className="sticky top-0 z-50 bg-[#f8fafc] -mx-6 px-6 pt-2 pb-4 mb-4 border-b shadow-sm">
                    {/* Header Card */}
                    <div className="mb-6 p-6 bg-white border rounded-lg shadow-sm">
                        <div className="flex items-start justify-between flex-wrap gap-4">
                            <div className="flex items-center gap-3">
                                <ShieldAlert className="w-7 h-7 text-indigo-600" />
                                <div>
                                    <h2 className="text-2xl font-bold text-slate-900">Stage: Warranty Claim</h2>
                                </div>
                            </div>
                            <div className="flex items-center gap-4 flex-1 max-w-2xl justify-end">
                                <Button
                                    variant={showExpiringOnly ? "default" : "outline"}
                                    size="sm"
                                    onClick={() => setShowExpiringOnly(!showExpiringOnly)}
                                    className={`h-10 px-4 flex items-center gap-2 transition-all ${
                                        showExpiringOnly 
                                            ? "bg-red-600 hover:bg-red-700 text-white border-red-600 shadow-md" 
                                            : "border-slate-200 text-slate-600 hover:bg-red-50 hover:text-red-600 hover:border-red-200"
                                    }`}
                                >
                                    <ShieldAlert className={`w-4 h-4 ${showExpiringOnly ? "animate-pulse" : ""}`} />
                                    <span className="font-semibold">Recent Expiring</span>
                                </Button>
                                <div className="relative flex-1 max-w-sm">
                                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-500" />
                                    <Input
                                        placeholder="Search by Indent, Item, Vendor..."
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                        className="pl-9 bg-white border-slate-200 focus:ring-indigo-500 focus:border-indigo-500"
                                    />
                                </div>
                            </div>
                        </div>
                    </div>

                    <TabsList className="grid w-full grid-cols-3 h-12 bg-slate-100/50 p-1 rounded-lg">
                        <TabsTrigger 
                            value="pending"
                            className="rounded-md data-[state=active]:bg-white data-[state=active]:text-slate-900 data-[state=active]:shadow-sm transition-all"
                        >
                            Pending ({pending.length})
                        </TabsTrigger>
                        <TabsTrigger 
                            value="closurePending"
                            className="rounded-md data-[state=active]:bg-white data-[state=active]:text-slate-900 data-[state=active]:shadow-sm transition-all"
                        >
                            Closure Pending ({closurePending.length})
                        </TabsTrigger>
                        <TabsTrigger 
                            value="history"
                            className="rounded-md data-[state=active]:bg-white data-[state=active]:text-slate-900 data-[state=active]:shadow-sm transition-all"
                        >
                            History ({history.length})
                        </TabsTrigger>
                    </TabsList>
                </div>

                {isLoading ? (
                    <div className="flex flex-col items-center justify-center py-24 text-gray-500">
                        <Loader2 className="w-8 h-8 animate-spin mb-4 text-indigo-600" />
                        <p className="text-lg animate-pulse text-indigo-900 font-medium">Loading records...</p>
                    </div>
                ) : (
                    <>
                        {/* ── PENDING ── */}
                        <TabsContent value="pending" className="mt-0 outline-none">
                            {pending.length === 0 ? (
                                <div className="text-center py-12 text-gray-500">
                                    <ShieldAlert className="w-10 h-10 mx-auto mb-3 text-gray-300" />
                                    <p className="text-lg text-black">No pending Warranty Claims</p>
                                </div>
                            ) : (
                                <div className="border rounded-lg overflow-x-auto h-[70vh] relative shadow-sm">
                                    <table className="w-full caption-bottom text-sm border-separate border-spacing-0 min-w-max">
                                        <thead className="sticky top-0 z-30 bg-slate-200 shadow-sm border-none">
                                            <tr className="hover:bg-transparent border-none">
                                                <th className="sticky left-0 z-40 bg-slate-200 w-[100px] border-b text-center px-4 py-3 font-semibold text-slate-900">
                                                    Actions
                                                </th>
                                                {PENDING_COLUMNS.map((c) => (
                                                    <th key={c.key} className="bg-slate-200 border-b text-center px-4 py-3 font-semibold text-slate-900 whitespace-nowrap">
                                                        {c.label}
                                                    </th>
                                                ))}
                                            </tr>
                                        </thead>
                                        <tbody className="bg-white">
                                            {pending.map((rec) => (
                                                <RecordRow
                                                    key={rec.id}
                                                    rec={rec}
                                                    columns={PENDING_COLUMNS}
                                                    renderCell={renderCell}
                                                    isCritical={isWarrantyExpiringSoon(rec.data.warrantyEnd)}
                                                    onAction={(r: any) => {
                                                        setSelectedRecord(r);
                                                        setFormData({
                                                            by: "",
                                                            invoiceNo: r.data.invoiceNo || "",
                                                            invoiceCopy: null,
                                                            issueDescription: "",
                                                            photosVideos: null,
                                                            claimType: "",
                                                        });
                                                        setIsModalOpen(true);
                                                    }}
                                                />
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </TabsContent>

                        {/* ── CLOSURE PENDING ── */}
                        <TabsContent value="closurePending" className="mt-0 outline-none">
                            {closurePending.length === 0 ? (
                                <div className="text-center py-12 text-gray-500">
                                    <ShieldAlert className="w-10 h-10 mx-auto mb-3 text-gray-300" />
                                    <p className="text-lg text-black">No pending closures</p>
                                </div>
                            ) : (
                                <div className="border rounded-lg overflow-x-auto h-[70vh] relative shadow-sm">
                                    <table className="w-full caption-bottom text-sm border-separate border-spacing-0 min-w-max">
                                        <thead className="sticky top-0 z-30 bg-slate-200 shadow-sm border-none">
                                            <tr className="hover:bg-transparent border-none">
                                                <th className="sticky left-0 z-40 bg-slate-200 w-[100px] border-b text-center px-4 py-3 font-semibold text-slate-900">
                                                    Actions
                                                </th>
                                                {CLOSURE_PENDING_COLUMNS.map((c) => (
                                                    <th key={c.key} className="bg-slate-200 border-b text-center px-4 py-3 font-semibold text-slate-900 whitespace-nowrap">
                                                        {c.label}
                                                    </th>
                                                ))}
                                            </tr>
                                        </thead>
                                        <tbody className="bg-white">
                                            {closurePending.map((rec) => (
                                                <RecordRow
                                                    key={rec.id}
                                                    rec={rec}
                                                    columns={CLOSURE_PENDING_COLUMNS}
                                                    renderCell={renderCell}
                                                    onAction={(r: any) => {
                                                        setSelectedRecord(r);
                                                        setClosureFormData({
                                                            status: r.data.status || "Pending",
                                                            closureDate: r.data.closureDate || "",
                                                            remarks: r.data.remarks || ""
                                                        });
                                                        setIsClosureModalOpen(true);
                                                    }}
                                                />
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </TabsContent>

                        {/* ── HISTORY ── */}
                        <TabsContent value="history" className="mt-0 outline-none">
                            {history.length === 0 ? (
                                <div className="text-center py-12 text-gray-500">
                                    <ShieldAlert className="w-10 h-10 mx-auto mb-3 text-gray-300" />
                                    <p className="text-lg text-black">No completed Warranty Claims</p>
                                </div>
                            ) : (
                                <div className="border rounded-lg overflow-x-auto h-[70vh] relative shadow-sm">
                                    <table className="w-full caption-bottom text-sm border-separate border-spacing-0 min-w-max">
                                        <thead className="sticky top-0 z-30 bg-slate-200 shadow-sm border-none">
                                            <tr className="hover:bg-transparent border-none">
                                                {HISTORY_COLUMNS.map((c) => (
                                                    <th key={c.key} className="bg-slate-200 border-b text-center px-4 py-3 font-semibold text-slate-900 whitespace-nowrap">
                                                        {c.label}
                                                    </th>
                                                ))}
                                            </tr>
                                        </thead>
                                        <tbody className="bg-white">
                                            {history.map((rec) => (
                                                <RecordRow
                                                    key={rec.id}
                                                    rec={rec}
                                                    columns={HISTORY_COLUMNS}
                                                    renderCell={renderCell}
                                                    isHistory
                                                />
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </TabsContent>
                    </>
                )}
            </Tabs>

            <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
                <DialogContent className="max-w-[360px] p-0 overflow-hidden border-none shadow-2xl rounded-xl">
                    <DialogHeader className="p-4 bg-slate-50 border-b">
                        <DialogTitle className="text-lg font-bold flex items-center gap-2 text-slate-800">
                            <ShieldAlert className="w-5 h-5 text-indigo-600" />
                            Warranty Claim Form
                        </DialogTitle>
                    </DialogHeader>
                    <div className="p-5 overflow-y-auto max-h-[75vh] custom-scrollbar">
                        <div className="grid grid-cols-2 gap-x-3 gap-y-4">
                            {/* Row 1: By (Full Width because Status is removed) */}
                            <div className="col-span-2 space-y-1.5">
                                <label className="text-[11px] font-bold text-slate-500 uppercase tracking-tight">By *</label>
                                <select
                                    className="flex h-9 w-full rounded-md border border-slate-200 bg-white px-3 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500 transition-shadow transition-colors"
                                    value={formData.by}
                                    onChange={(e) => setFormData(prev => ({ ...prev, by: e.target.value }))}
                                >
                                    <option value="" disabled>Select...</option>
                                    <option value="Client">Client</option>
                                    <option value="Company">Company</option>
                                </select>
                            </div>

                            {formData.by !== "" && (
                                <>
                                    {/* Row 2: Type & Inv No. */}
                                    <div className="space-y-1.5">
                                        <label className="text-[11px] font-bold text-slate-500 uppercase tracking-tight">Claim Type *</label>
                                        <select
                                            className="flex h-9 w-full rounded-md border border-slate-200 bg-white px-3 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500 transition-shadow transition-colors"
                                            value={formData.claimType}
                                            onChange={(e) => setFormData(prev => ({ ...prev, claimType: e.target.value }))}
                                        >
                                            <option value="" disabled>Select...</option>
                                            <option value="Repair">Repair</option>
                                            <option value="Replacement">Replacement</option>
                                            <option value="Service issue">Service issue</option>
                                            <option value="Part failure">Part failure</option>
                                        </select>
                                    </div>
                                    <div className="space-y-1.5">
                                        <label className="text-[11px] font-bold text-slate-500 uppercase tracking-tight">Invoice *</label>
                                        <Input 
                                            value={formData.invoiceNo} 
                                            onChange={(e) => setFormData(prev => ({ ...prev, invoiceNo: e.target.value }))}
                                            placeholder="Invoice No."
                                            className="h-9 bg-white focus-visible:ring-indigo-500 text-sm"
                                        />
                                    </div>
                                    
                                    {/* Row 3: Issue (Full Width) */}
                                    <div className="col-span-2 space-y-1.5">
                                        <label className="text-[11px] font-bold text-slate-500 uppercase tracking-tight">Issue Description *</label>
                                        <Input 
                                            value={formData.issueDescription} 
                                            onChange={(e) => setFormData(prev => ({ ...prev, issueDescription: e.target.value }))}
                                            placeholder="What's the issue?"
                                            className="h-9 bg-white focus-visible:ring-indigo-500 text-sm"
                                        />
                                    </div>

                                    {formData.by === "Client" && (
                                        <>
                                            <div className="space-y-1.5">
                                                <label className="text-[11px] font-bold text-slate-500 uppercase tracking-tight">Invoice Copy</label>
                                                {formData.invoiceCopy ? (
                                                    <div className="flex items-center justify-between px-3 border border-slate-200 rounded-md bg-white h-9">
                                                        <span className="text-[11px] truncate mr-1 font-medium" title={formData.invoiceCopy.name}>{formData.invoiceCopy.name}</span>
                                                        <Button variant="ghost" size="sm" onClick={() => setFormData(prev => ({ ...prev, invoiceCopy: null }))} className="h-4 w-4 p-0 text-red-500 hover:text-red-700 rounded-full flex-shrink-0">✕</Button>
                                                    </div>
                                                ) : (
                                                    <Input 
                                                        type="file"
                                                        accept="image/*,.pdf"
                                                        onChange={(e) => {
                                                            const file = e.target.files?.[0] || null;
                                                            setFormData(prev => ({ ...prev, invoiceCopy: file }))
                                                        }}
                                                        className="h-9 text-[11px] cursor-pointer bg-white file:mr-2 file:py-0 file:px-2 file:rounded file:border-0 file:text-[10px] file:font-semibold file:bg-indigo-50 file:text-indigo-700 focus-visible:ring-indigo-500"
                                                    />
                                                )}
                                            </div>
                                            <div className="space-y-1.5">
                                                <label className="text-[11px] font-bold text-slate-500 uppercase tracking-tight">Photo/Video (Optional)</label>
                                                {formData.photosVideos ? (
                                                    <div className="flex items-center justify-between px-3 border border-slate-200 rounded-md bg-white h-9">
                                                        <span className="text-[11px] truncate mr-1 font-medium" title={formData.photosVideos.name}>{formData.photosVideos.name}</span>
                                                        <Button variant="ghost" size="sm" onClick={() => setFormData(prev => ({ ...prev, photosVideos: null }))} className="h-4 w-4 p-0 text-red-500 hover:text-red-700 rounded-full flex-shrink-0">✕</Button>
                                                    </div>
                                                ) : (
                                                    <Input 
                                                        type="file"
                                                        accept="image/*,video/*"
                                                        onChange={(e) => {
                                                            const file = e.target.files?.[0] || null;
                                                            setFormData(prev => ({ ...prev, photosVideos: file }))
                                                        }}
                                                        className="h-9 text-[11px] cursor-pointer bg-white file:mr-2 file:py-0 file:px-2 file:rounded file:border-0 file:text-[10px] file:font-semibold file:bg-indigo-50 file:text-indigo-700 focus-visible:ring-indigo-500"
                                                    />
                                                )}
                                            </div>
                                        </>
                                    )}
                                    
                                </>
                            )}
                        </div>
                    </div>
                    <DialogFooter className="p-4 bg-slate-50 border-t flex gap-3">
                        <Button 
                            variant="outline" 
                            onClick={() => setIsModalOpen(false)}
                            disabled={isSubmitting}
                            className="bg-white border-slate-300 hover:bg-slate-100 h-9 text-xs font-medium flex-1"
                        >
                            Cancel
                        </Button>
                        <Button 
                            onClick={handleClaimSubmit} 
                            disabled={isSubmitting || !formData.by || !formData.claimType || !formData.invoiceNo || !formData.issueDescription}
                            className="bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm font-bold h-9 text-xs flex-1 transition-all active:scale-95"
                        >
                            {isSubmitting ? (
                                <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> ...</>
                            ) : (
                                "Submit Claim"
                            )}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* --- Closure Modal --- */}
            <Dialog open={isClosureModalOpen} onOpenChange={setIsClosureModalOpen}>
                <DialogContent className="max-w-[360px] p-0 overflow-hidden border-none shadow-2xl rounded-xl">
                    <DialogHeader className="p-4 bg-slate-50 border-b">
                        <DialogTitle className="text-lg font-bold flex items-center gap-2 text-slate-800">
                            <ShieldAlert className="w-5 h-5 text-indigo-600" />
                            Process Closure
                        </DialogTitle>
                    </DialogHeader>
                    <div className="p-5 overflow-y-auto max-h-[75vh] custom-scrollbar">
                        <div className="space-y-4">
                            <div className="p-3 bg-indigo-50/50 rounded-lg border border-indigo-100 flex flex-col gap-1.5">
                                <div className="flex justify-between items-center text-[10px] text-indigo-600 font-bold uppercase tracking-wider">
                                    <span>Indent No</span>
                                    <span>Serial No</span>
                                </div>
                                <div className="flex justify-between items-center text-sm font-semibold text-indigo-900">
                                    <span>{selectedRecord?.data.indentNo || "-"}</span>
                                    <span>{selectedRecord?.data.serialNo || "-"}</span>
                                </div>
                            </div>

                            <div className="space-y-1.5">
                                <label className="text-[11px] font-bold text-slate-500 uppercase tracking-tight">Status *</label>
                                <select
                                    className="flex h-10 w-full rounded-md border border-slate-200 bg-white px-3 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                                    value={closureFormData.status}
                                    onChange={(e) => setClosureFormData(prev => ({ ...prev, status: e.target.value }))}
                                >
                                    <option value="Pending">Pending</option>
                                    <option value="Closure">Closure</option>
                                </select>
                            </div>

                            {closureFormData.status === "Closure" && (
                                <div className="space-y-1.5 animate-in fade-in slide-in-from-top-1 duration-200">
                                    <label className="text-[11px] font-bold text-slate-500 uppercase tracking-tight">Closure Date *</label>
                                    <Input 
                                        type="date"
                                        value={closureFormData.closureDate} 
                                        onChange={(e) => setClosureFormData(prev => ({ ...prev, closureDate: e.target.value }))}
                                        className="h-10 bg-white focus-visible:ring-indigo-500 text-sm"
                                    />
                                </div>
                            )}

                            <div className="space-y-1.5">
                                <label className="text-[11px] font-bold text-slate-500 uppercase tracking-tight">Remarks</label>
                                <Input 
                                    value={closureFormData.remarks} 
                                    onChange={(e) => setClosureFormData(prev => ({ ...prev, remarks: e.target.value }))}
                                    placeholder="Enter closure remarks..."
                                    className="h-10 bg-white focus-visible:ring-indigo-500 text-sm"
                                />
                            </div>
                        </div>
                    </div>
                    <DialogFooter className="p-4 bg-slate-50 border-t flex gap-3">
                        <Button 
                            variant="outline" 
                            onClick={() => setIsClosureModalOpen(false)}
                            disabled={isSubmitting}
                            className="bg-white border-slate-300 hover:bg-slate-100 h-10 text-xs font-medium flex-1"
                        >
                            Cancel
                        </Button>
                        <Button 
                            onClick={handleClosureSubmit} 
                            disabled={isSubmitting || (closureFormData.status === "Closure" && !closureFormData.closureDate)}
                            className="bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm font-bold h-10 text-xs flex-1 transition-all active:scale-95"
                        >
                            {isSubmitting ? (
                                <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Updating...</>
                            ) : (
                                "Update Status"
                            )}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
