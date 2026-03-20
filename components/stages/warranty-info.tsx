"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, Search, ShieldAlert, Eye } from "lucide-react";
import { toast } from "sonner";
import { formatDate, parseSheetDate, getFmsTimestamp } from "@/lib/utils";
import QRCode from "qrcode";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";

const formatDateDash = (date: any) => {
    if (!date || date === "-" || date === "—") return "-";
    const d = date instanceof Date ? date : parseSheetDate(date);
    if (!d || isNaN(d.getTime())) return typeof date === "string" ? date : "-";
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${dd}-${mm}-${yyyy}`;
};

// ─── RECEIVING-ACCOUNTS column map (0-based) ──────────────────────────────────
// B(1): Indent No.  C(2): Unit Tracking No.  D(3): Vendor Name  E(4): PO No.
// H(7): Item Name   I(8): Lifting Qty  X(23): Invoice Date  Y(24): Invoice No.
// Z(25): Received Qty  DA(104): Warranty Claim  DB(105): Duration
// DC(106): Warranty Expiry  DD(107): Product Expiry
// DE(108): Planned   DF(109): Actual

// ─── INDENT-LIFT sheet column map (0-based, headers row 8, data from row 9) ──
// B(1): Indent No.  BG(58): PO Copy

// ─── WARRANTY sheet column map (0-based, headers row 5, data from row 7) ──────
// A(0): Indent No.  B(1): Unit Tracking No.  C(2): Vendor Name  D(3): Invoice No.
// E(4): Invoice Date  F(5): Invoice Copy  G(6): PO Number  H(7): PO Copy
// I(8): Qty  J(9): Item-Name  K(10): Serial No
// L(11): Start Date  M(12): End Date

const PENDING_COLUMNS = [
    { key: "indentNo", label: "Indent No." },
    { key: "liftNo", label: "Unit Tracking No." },
    { key: "vendorName", label: "Vendor Name" },
    { key: "itemName", label: "Item Name" },
    { key: "invoiceNo", label: "Invoice No." },
    { key: "invoiceDate", label: "Invoice Date" },
    { key: "invoiceCopy", label: "Invoice Copy" },
    { key: "poNumber", label: "PO Number" },
    { key: "poCopy", label: "PO Copy" },
    { key: "receivedQty", label: "Received Qty" },
    { key: "planned", label: "Planned" },
];

const HISTORY_COLUMNS = [
    { key: "indentNo", label: "Indent No." },
    { key: "liftNo", label: "Unit Tracking No." },
    { key: "vendorName", label: "Vendor Name" },
    { key: "itemName", label: "Item Name" },
    { key: "invoiceNo", label: "Invoice No." },
    { key: "invoiceDate", label: "Invoice Date" },
    { key: "invoiceCopy", label: "Invoice Copy" },
    { key: "poNumber", label: "PO Number" },
    { key: "poCopy", label: "PO Copy" },
    { key: "receivedQty", label: "Received Qty" },
    { key: "planned", label: "Planned" },
    { key: "actual", label: "Actual" },
];

interface WarrantyEntry {
    serialNo: string;
}


const toBase64 = (blob: Blob): Promise<string> =>
    new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(blob);
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = (error) => reject(error);
    });

const uploadFileToDrive = async (
    blob: Blob,
    fileName: string,
    apiUrl: string,
    folderId: string
): Promise<string> => {
    const uploadParams = new URLSearchParams();
    uploadParams.append("action", "uploadFile");
    uploadParams.append("base64Data", await toBase64(blob));
    uploadParams.append("fileName", fileName);
    uploadParams.append("mimeType", "image/png");
    uploadParams.append("folderId", folderId);
    const res = await fetch(apiUrl, { method: "POST", body: uploadParams });
    const json = await res.json();
    return json.success ? json.fileUrl : "";
};

const generateQRLabel = async (
    itemName: string,
    itemCode: string,
    serialNo: string
): Promise<Blob> => {
    const canvas = document.createElement("canvas");
    canvas.width = 400;
    canvas.height = 520; // Increased height for better spacing
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Could not get canvas context");

    // Clear and fill with pure white (important for scanning)
    ctx.fillStyle = "white";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Text settings
    ctx.fillStyle = "black";
    ctx.textAlign = "center";
    ctx.textBaseline = "top";

    // Item Name + Item Code (Top)
    ctx.font = "bold 20px Arial";
    const headerText = `${itemName} (${itemCode})`;
    
    // Simple text wrapping for header
    const words = headerText.split(' ');
    let line = '';
    let y = 25;
    const lineHeight = 28;
    const maxWidth = 370;

    for (let n = 0; n < words.length; n++) {
        const testLine = line + words[n] + ' ';
        const metrics = ctx.measureText(testLine);
        if (metrics.width > maxWidth && n > 0) {
            ctx.fillText(line, canvas.width / 2, y);
            line = words[n] + ' ';
            y += lineHeight;
        } else {
            line = testLine;
        }
    }
    ctx.fillText(line, canvas.width / 2, y);

    // QR Code (Middle)
    // We encode the serial number with a label to make it clear what was scanned
    const qrData = serialNo.trim();
    const qrSize = 320; // Larger QR for better scan
    const qrY = y + 45;
    
    // Use toCanvas for sharper rendering
    const qrCanvas = document.createElement("canvas");
    await QRCode.toCanvas(qrCanvas, qrData, { 
        margin: 4, 
        width: qrSize,
        errorCorrectionLevel: 'H', // Maximum error correction
        color: {
            dark: '#000000',
            light: '#ffffff'
        }
    });

    // Draw the QR onto our main canvas
    ctx.imageSmoothingEnabled = false; // Keep QR sharp
    ctx.drawImage(qrCanvas, (canvas.width - qrSize) / 2, qrY, qrSize, qrSize);

    // Serial No (Bottom)
    ctx.font = "bold 24px Arial";
    ctx.textBaseline = "bottom";
    ctx.fillText(serialNo, canvas.width / 2, canvas.height - 25);

    return new Promise((resolve, reject) => {
        canvas.toBlob((blob) => {
            if (blob) resolve(blob);
            else reject(new Error("Canvas toBlob failed"));
        }, "image/png", 1.0); // Maximum quality
    });
};


export default function WarrantyInfo() {
    const [pendingRecords, setPendingRecords] = useState<any[]>([]);
    const [historyRecords, setHistoryRecords] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [searchTerm, setSearchTerm] = useState("");
    const [activeTab, setActiveTab] = useState<"pending" | "history">("pending");

    const [open, setOpen] = useState(false);
    const [selectedRecord, setSelectedRecord] = useState<any>(null);
    const [entries, setEntries] = useState<WarrantyEntry[]>([]);
    const [isAutoMode, setIsAutoMode] = useState(false);
    const [vendorCodes, setVendorCodes] = useState<Record<string, string>>({});
    const [itemCodeMap, setItemCodeMap] = useState<Record<string, string>>({});
    const [previewImages, setPreviewImages] = useState<Record<number, string>>({});

    // ─── Fetch ───────────────────────────────────────────────────────────────
    const fetchData = useCallback(async () => {
        const API = process.env.NEXT_PUBLIC_API_URI;
        if (!API) return;
        setIsLoading(true);
        try {
            // Need INDENT-LIFT for PO Copy (col BG = 58)
            const [raRes, fmsRes, dropRes] = await Promise.all([
                fetch(`${API}?sheet=RECEIVING-ACCOUNTS&action=getAll`),
                fetch(`${API}?sheet=INDENT-LIFT&action=getAll`),
                fetch(`${API}?sheet=Dropdown&action=getAll`)
            ]);
            const [raJson, fmsJson, dropJson] = await Promise.all([raRes.json(), fmsRes.json(), dropRes.json()]);

            // Dropdown mapping
            const vCodes: Record<string, string> = {};
            const iCodes: Record<string, string> = {};
            if (dropJson.success && Array.isArray(dropJson.data)) {
                dropJson.data.slice(1).forEach((r: any) => {
                    // Vendor Codes (F=5: Code, G=6: Name)
                    const vCode = String(r[5] || "").trim();
                    const vName = String(r[6] || "").trim();
                    if (vCode && vName) vCodes[vName] = vCode;

                    // Item Codes (C=2: Code, E=4: Name)
                    const iCode = String(r[2] || "").trim();
                    const iName = String(r[4] || "").trim();
                    if (iCode && iName) iCodes[iName] = iCode;
                });
                setVendorCodes(vCodes);
                setItemCodeMap(iCodes);
            }

            // Create FMS Map (Indent # -> Row) for PO Copy
            const fmsMap = new Map<string, any[]>();
            if (fmsJson.success && Array.isArray(fmsJson.data)) {
                fmsJson.data.slice(7).forEach((r: any) => { // FMS data starts from row 9, so slice(8) for 0-indexed, or slice(7) if headers are row 8
                    if (r[1] && String(r[1]).trim()) { // Indent No. is B(1)
                        fmsMap.set(String(r[1]).trim(), r);
                    }
                });
            }

            if (raJson.success && Array.isArray(raJson.data)) {
                // RA data rows start from row 7 → slice(6), originalIndex = i+7
                const allRows = raJson.data
                    .slice(6)
                    .map((row: any, i: number) => ({ row, raIndex: i + 7 }))
                    .filter(({ row }: any) => row[1] && String(row[1]).trim() !== "");

                const pending: any[] = [];
                const history: any[] = [];

                allRows.forEach(({ row, raIndex }: any) => {
                    const planned = String(row[108] || "").trim(); // DE
                    const actual = String(row[109] || "").trim(); // DF
                    const hasPlan = planned !== "" && planned !== "-";
                    const hasActual = actual !== "" && actual !== "-";

                    const indentNo = String(row[1] || "").trim();
                    const fmsRow = fmsMap.get(indentNo);

                    const data = {
                        indentNo,                                   // B
                        liftNo: row[2] || "",                 // C
                        vendorName: row[3] || "",                 // D
                        poNumber: row[4] || "",                 // E
                        itemName: row[7] || "",                 // H
                        receivedQty: row[25] || "",                 // Z
                        invoiceDate: row[23] || "",                 // X
                        invoiceNo: row[24] || "",                 // Y
                        invoiceCopy: row[29] || "",                 // AD: Bill Attachment
                        poCopy: fmsRow ? (fmsRow[58] || "") : "", // FMS BG: PO Copy
                        warrantyExpiry: row[106] || "",            // DC: Warranty Expiry
                        planned,
                        actual,
                    };

                    const id = `${data.indentNo}_${data.liftNo || raIndex}`;

                    if (hasPlan && !hasActual) {
                        pending.push({ id: `pending_${id}`, raIndex, data });
                    } else if (hasPlan && hasActual) {
                        history.push({ id: `history_${id}`, raIndex, data });
                    }
                });

                setPendingRecords(pending);
                setHistoryRecords(history);
            }
        } catch (e) {
            console.error("Fetch error:", e);
            toast.error("Failed to load data");
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
            String(r.data.poNumber || "").toLowerCase().includes(lower) ||
            String(r.data.invoiceNo || "").toLowerCase().includes(lower)
        );
    }, [searchTerm]);

    const pending = useMemo(() => applySearch(pendingRecords), [pendingRecords, applySearch]);
    const history = useMemo(() => applySearch(historyRecords), [historyRecords, applySearch]);

    // ─── Open form ────────────────────────────────────────────────────────────
    const openForm = useCallback((record: any) => {
        setSelectedRecord(record);
        setIsAutoMode(false); // Reset to manual by default
        const qty = Math.max(1, parseInt(record.data.receivedQty) || 1);
        setEntries(Array.from({ length: qty }, () => ({
            serialNo: "",
        })));
        setOpen(true);
    }, []);

    // ─── Auto Serial Generation Logic ───
    useEffect(() => {
        if (isAutoMode && selectedRecord) {
            const vendorCode = vendorCodes[selectedRecord.data.vendorName] || "UNKNOWN";
            
            // Format Invoice Date as DD-MM-YYYY
            let dateStr = "00-00-0000";
            if (selectedRecord.data.invoiceDate && selectedRecord.data.invoiceDate !== "-") {
                const d = new Date(selectedRecord.data.invoiceDate);
                if (!isNaN(d.getTime())) {
                    const pad = (n: number) => String(n).padStart(2, "0");
                    dateStr = `${pad(d.getDate())}-${pad(d.getMonth() + 1)}-${d.getFullYear()}`;
                }
            }

            setEntries(prev => prev.map((_, idx) => ({
                serialNo: `${vendorCode}/${dateStr}/${String(idx + 1).padStart(3, "0")}`
            })));
        } else if (!isAutoMode && selectedRecord) {
            // If switching from auto to manual, optionally clear or keep
            // User said: "when button=Manual, then it will show the current serial no. fields"
            // Let's clear for better UX or keep for editing. User's prompt implies manual entry.
            // I'll keep them but allow editing.
        }
    }, [isAutoMode, selectedRecord, vendorCodes]);

    const updateEntry = useCallback((idx: number, field: keyof WarrantyEntry, value: string) => {
        setEntries((prev) => {
            const next = [...prev];
            next[idx] = { ...next[idx], [field]: value };
            return next;
        });
        // Clear preview when value changes
        setPreviewImages(prev => {
            const next = { ...prev };
            delete next[idx];
            return next;
        });
    }, []);

    const handlePreview = async (idx: number) => {
        if (!selectedRecord) return;
        const entry = entries[idx];
        if (!entry.serialNo.trim()) {
            toast.error("Please enter a serial number first");
            return;
        }

        try {
            const itemName = selectedRecord.data.itemName;
            const itemCode = itemCodeMap[itemName] || "N/A";
            const blob = await generateQRLabel(itemName, itemCode, entry.serialNo);
            const url = URL.createObjectURL(blob);
            setPreviewImages(prev => ({ ...prev, [idx]: url }));
        } catch (err) {
            console.error(err);
            toast.error("Failed to generate preview");
        }
    };

    // ─── Submit ───────────────────────────────────────────────────────────────
    const handleSubmit = useCallback(async (e: React.FormEvent) => {
        e.preventDefault();
        const API = process.env.NEXT_PUBLIC_API_URI;
        const FOLDER_ID = process.env.NEXT_PUBLIC_IMAGE_FOLDER_ID;
        if (!selectedRecord || !API || !FOLDER_ID) return;

        setIsSubmitting(true);
        try {
            const ts = getFmsTimestamp();
            const itemName = selectedRecord.data.itemName;
            const itemCode = itemCodeMap[itemName] || "N/A";

            // 1. Generate and Upload images for each serial number
            const uploadResults = await Promise.all(entries.map(async (entry, idx) => {
                try {
                    const blob = await generateQRLabel(itemName, itemCode, entry.serialNo);
                    const fileName = `QR_${entry.serialNo.replace(/[/\\:]/g, '_')}.png`;
                    const driveUrl = await uploadFileToDrive(blob, fileName, API, FOLDER_ID);
                    return driveUrl;
                } catch (err) {
                    console.error("Upload error for index", idx, err);
                    return "";
                }
            }));

            // 2. batchInsert new rows into WARRANTY sheet
            const rowsData = entries.map((entry, idx) => {
                const warrantyRow = new Array(8).fill("");
                
                let formattedWarrantyEnd = selectedRecord.data.warrantyExpiry;
                if (formattedWarrantyEnd && formattedWarrantyEnd !== "-") {
                    const d = new Date(formattedWarrantyEnd);
                    if (!isNaN(d.getTime())) {
                        const pad = (n: number) => String(n).padStart(2, "0");
                        formattedWarrantyEnd = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
                    }
                }

                warrantyRow[0] = selectedRecord.data.indentNo;    // A: Indent No.
                warrantyRow[1] = selectedRecord.data.liftNo;      // B: Unit Tracking No.
                warrantyRow[2] = uploadResults[idx] || "";        // C: Serial Code (Drive Link)
                warrantyRow[3] = entry.serialNo;                  // D: Serial No.
                warrantyRow[4] = selectedRecord.data.vendorName;  // E: Vendor Name
                warrantyRow[5] = selectedRecord.data.itemName;    // F: Item-Name
                warrantyRow[6] = formatDate(selectedRecord.data.invoiceDate); // G: Invoice Date
                warrantyRow[7] = formattedWarrantyEnd;            // H: Warranty End
                return warrantyRow;
            });

            const insertParams = new URLSearchParams();
            insertParams.append("action", "batchInsert");
            insertParams.append("sheetName", "WARRANTY");
            insertParams.append("rowsData", JSON.stringify(rowsData));
            insertParams.append("startRow", "7");

            // 3. Update RECEIVING-ACCOUNTS col DF (index 109) = Actual timestamp
            const raRow = new Array(110).fill("");
            raRow[109] = ts; // DF: Actual

            const updateParams = new URLSearchParams();
            updateParams.append("action", "update");
            updateParams.append("sheetName", "RECEIVING-ACCOUNTS");
            updateParams.append("rowData", JSON.stringify(raRow));
            updateParams.append("rowIndex", selectedRecord.raIndex.toString());

            const [insertRes, updateRes] = await Promise.all([
                fetch(API, { method: "POST", body: insertParams }),
                fetch(API, { method: "POST", body: updateParams }),
            ]);
            
            const [insertJson, updateJson] = await Promise.all([
                insertRes.json(), updateRes.json(),
            ]);

            if (insertJson.success && updateJson.success) {
                toast.success("Warranty information recorded successfully!");
                setOpen(false);
                fetchData();
            } else {
                const errMsg = (!insertJson.success ? insertJson.error : updateJson.error) || "Unknown error";
                toast.error("Failed to save: " + errMsg);
            }
        } catch (err: any) {
            console.error(err);
            toast.error("Submission failed");
        } finally {
            setIsSubmitting(false);
        }
    }, [selectedRecord, entries, fetchData, itemCodeMap]);

    const formValid = useMemo(() =>
        entries.length > 0 &&
        entries.every((e) => e.serialNo.trim() !== ""),
        [entries]
    );

    // ─── Cell renderer ────────────────────────────────────────────────────────
    const renderCell = (data: any, key: string) => {
        const val = data?.[key];

        // Link columns
        if (key === "invoiceCopy" || key === "poCopy") {
            if (!val || String(val).trim() === "" || val === "-") return "-";
            return (
                <a
                    href={String(val)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:underline inline-flex items-center gap-1"
                >
                    View
                </a>
            );
        }

        // Date columns
        if (key === "invoiceDate" || key === "planned" || key === "actual" || key === "warrantyEnd") {
            return formatDateDash(val);
        }

        if (!val || String(val).trim() === "" || val === "-") return "-";
        return String(val);
    };

    // ─── Render ───────────────────────────────────────────────────────────────
    return (
        <div className="p-6 min-h-screen bg-[#f8fafc]">
            <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)} className="w-full">
                {/* Sticky Header and Tabs Container */}
                <div className="sticky top-0 z-50 bg-[#f8fafc] -mx-6 px-6 pt-2 pb-4 mb-4 border-b shadow-sm">
                    {/* Header Card */}
                    <div className="mb-6 p-6 bg-white border rounded-lg shadow-sm">
                        <div className="flex items-start justify-between flex-wrap gap-4">
                            <div className="flex items-center gap-3">
                                <ShieldAlert className="w-7 h-7 text-amber-600" />
                                <div>
                                    <h2 className="text-2xl font-bold text-slate-900">Stage: Warranty Information</h2>
                                </div>
                            </div>
                            <div className="relative flex-1 max-w-sm">
                                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-500" />
                                <Input
                                    placeholder="Search by Indent, Item, Vendor, PO, Invoice..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="pl-9 bg-white border-slate-200 focus:ring-amber-500 focus:border-amber-500"
                                />
                            </div>
                        </div>
                    </div>

                    <TabsList className="grid w-full grid-cols-2 h-12 bg-slate-100/50 p-1 rounded-lg">
                        <TabsTrigger 
                            value="pending" 
                            className="rounded-md data-[state=active]:bg-white data-[state=active]:text-slate-900 data-[state=active]:shadow-sm transition-all"
                        >
                            Pending ({pending.length})
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
                        <Loader2 className="w-8 h-8 animate-spin mb-4 text-black" />
                        <p className="text-lg animate-pulse text-black font-medium">Loading records...</p>
                    </div>
                ) : (
                    <>
                        {/* ── PENDING ── */}
                        <TabsContent value="pending" className="mt-0 outline-none">
                            {pending.length === 0 ? (
                                <div className="text-center py-12 text-gray-500">
                                    <ShieldAlert className="w-10 h-10 mx-auto mb-3 text-gray-300" />
                                    <p className="text-lg text-black">No pending Warranty Information entries</p>
                                </div>
                            ) : (
                                <div className="border rounded-lg overflow-x-auto h-[70vh] relative">
                                    <table className="w-full caption-bottom text-sm border-separate border-spacing-0 min-w-max">
                                        <thead className="sticky top-0 z-30 bg-slate-50 shadow-sm border-none text-center">
                                            <tr className="hover:bg-transparent border-none">
                                                <th className="sticky left-0 z-40 bg-slate-50 w-[150px] border-b text-center whitespace-nowrap px-4 py-3 font-semibold text-slate-900">Actions</th>
                                                {PENDING_COLUMNS.map((c) => (
                                                    <th key={c.key} className="bg-slate-50 border-b text-center px-4 py-3 font-semibold text-slate-900 whitespace-nowrap">{c.label}</th>
                                                ))}
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {pending.map((rec) => (
                                                <tr key={rec.id} className="hover:bg-gray-50 group">
                                                    <td className="sticky left-0 z-20 bg-white group-hover:bg-gray-50 border-b text-center px-4 py-2">
                                                        <Button variant="outline" size="sm" onClick={() => openForm(rec)} className="h-8 px-3 text-xs font-medium border-slate-200 hover:bg-slate-50 hover:text-slate-900 transition-colors whitespace-nowrap">
                                                            Warranty Information
                                                        </Button>
                                                    </td>
                                                    {PENDING_COLUMNS.map((col) => (
                                                        <td key={col.key} className="border-b px-4 py-2 text-center text-slate-700">
                                                            {renderCell(rec.data, col.key)}
                                                        </td>
                                                    ))}
                                                </tr>
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
                                    <p className="text-lg text-black">No completed Warranty Information entries</p>
                                </div>
                            ) : (
                                <div className="border rounded-lg overflow-x-auto h-[70vh] relative">
                                    <table className="w-full caption-bottom text-sm border-separate border-spacing-0 min-w-max">
                                        <thead className="sticky top-0 z-30 bg-slate-50 shadow-sm border-none">
                                            <tr className="hover:bg-transparent border-none">
                                                {HISTORY_COLUMNS.map((c) => (
                                                    <th key={c.key} className="bg-slate-50 border-b text-center px-4 py-3 font-semibold text-slate-900 whitespace-nowrap">{c.label}</th>
                                                ))}
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {history.map((rec) => (
                                                <tr key={rec.id} className="bg-green-50 hover:bg-green-100 transition-colors">
                                                    {HISTORY_COLUMNS.map((col) => (
                                                        <td key={col.key} className="border-b px-4 py-2 text-center text-slate-700">
                                                            {renderCell(rec.data, col.key)}
                                                        </td>
                                                    ))}
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </TabsContent>
                    </>
                )}
            </Tabs>

            {/* ── DIALOG ── */}
            <Dialog open={open} onOpenChange={setOpen}>
                <DialogContent className="sm:max-w-lg max-h-[90vh] flex flex-col">
                    <DialogHeader className="shrink-0">
                        <DialogTitle>Warranty Information</DialogTitle>
                        {selectedRecord && (
                            <div className="flex flex-col gap-2 mt-1">
                                <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-gray-500">
                                    <span>Indent: <span className="font-medium text-gray-700">{selectedRecord.data.indentNo}</span></span>
                                    <span>Vendor: <span className="font-medium text-gray-700">{selectedRecord.data.vendorName}</span></span>
                                    <span>Item: <span className="font-medium text-gray-700">{selectedRecord.data.itemName}</span></span>
                                    <span>Qty: <span className="font-medium text-gray-700">{selectedRecord.data.receivedQty}</span></span>
                                </div>
                                <div className="flex items-center gap-2 mt-2">
                                    <span className="text-sm font-medium text-gray-700">Serial Mode:</span>
                                    <Button
                                        type="button"
                                        size="sm"
                                        variant={isAutoMode ? "default" : "outline"}
                                        className={isAutoMode ? "bg-blue-600 hover:bg-blue-700 text-white" : "border-amber-500 text-amber-600 hover:bg-amber-50"}
                                        onClick={() => setIsAutoMode(!isAutoMode)}
                                    >
                                        {isAutoMode ? "Auto" : "Manual"}
                                    </Button>
                                </div>
                            </div>
                        )}
                    </DialogHeader>

                    <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
                        {/* Column headers */}
                        <div className="grid grid-cols-12 gap-2 text-xs font-semibold text-gray-500 uppercase tracking-wide px-1 py-2 border-b shrink-0">
                            <div className="col-span-1 text-center">#</div>
                            <div className="col-span-10">Serial No. *</div>
                            <div className="col-span-1 text-center">QR</div>
                        </div>

                        {/* Scrollable rows */}
                        <div className="flex-1 overflow-y-auto space-y-2 py-3 pr-1">
                            {entries.map((entry, idx) => {
                                return (
                                    <div key={idx} className="grid grid-cols-12 gap-2 items-center px-1">
                                        <div className="col-span-1 text-center text-sm font-medium text-gray-500">
                                            {idx + 1}
                                        </div>
                                        <div className="col-span-10">
                                            <Input 
                                                value={entry.serialNo}
                                                onChange={(e) => updateEntry(idx, "serialNo", e.target.value)}
                                                placeholder={isAutoMode ? "Auto-generated" : "Enter Serial Number"}
                                                className={`h-8 text-sm ${isAutoMode ? "bg-gray-50 font-mono" : ""}`}
                                                required 
                                                readOnly={isAutoMode}
                                            />
                                        </div>
                                        <div className="col-span-1 flex justify-center">
                                            <Popover>
                                                <PopoverTrigger asChild>
                                                    <Button 
                                                        type="button" 
                                                        variant="ghost" 
                                                        size="sm" 
                                                        className="h-8 w-8 p-0"
                                                        onClick={() => handlePreview(idx)}
                                                        disabled={!entry.serialNo.trim()}
                                                    >
                                                        <Eye className="h-4 w-4" />
                                                    </Button>
                                                </PopoverTrigger>
                                                <PopoverContent className="w-[420px] p-2 bg-white" side="left">
                                                    <div className="flex flex-col items-center gap-2">
                                                        <span className="text-xs font-semibold text-gray-500">Label Preview</span>
                                                        {previewImages[idx] ? (
                                                            <img 
                                                                src={previewImages[idx]} 
                                                                alt="QR Label Preview" 
                                                                className="border shadow-sm max-w-full"
                                                            />
                                                        ) : (
                                                            <div className="flex items-center justify-center w-[400px] h-[420px] bg-slate-50 border border-dashed rounded text-slate-400">
                                                                <Loader2 className="h-8 w-8 animate-spin" />
                                                            </div>
                                                        )}
                                                    </div>
                                                </PopoverContent>
                                            </Popover>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>

                        <DialogFooter className="shrink-0 pt-3 border-t">
                            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={isSubmitting}>
                                Cancel
                            </Button>
                            <Button type="submit" disabled={!formValid || isSubmitting}>
                                {isSubmitting
                                    ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Submitting...</>
                                    : `Submit (${entries.length} item${entries.length > 1 ? "s" : ""})`
                                }
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>
        </div>
    );
}
