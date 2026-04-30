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
import { Loader2, Search, ShieldAlert, Eye, Printer, X } from "lucide-react";
import { toast } from "sonner";
import { formatDate, parseSheetDate, getFmsTimestamp } from "@/lib/utils";
import QRCode from "qrcode";

const getDirectDriveLink = (url: string) => {
    if (!url) return "";
    const match = url.match(/\/d\/(.+?)\/(view|edit)/) || url.match(/id=(.+?)(&|$)/);
    if (match && match[1]) {
        return `https://drive.google.com/uc?export=view&id=${match[1]}`;
    }
    return url;
};
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
    { key: "warrantyExpiry", label: "Warranty Expiry" },
    { key: "productExpiry", label: "Product Expiry" },
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
    { key: "warrantyExpiry", label: "Warranty Expiry" },
    { key: "productExpiry", label: "Product Expiry" },
    { key: "planned", label: "Planned" },
    { key: "actual", label: "Actual" },
    { key: "actions", label: "Action" },
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

const codeMap: Record<string, string> = {
    "0": "0", "1": "A", "2": "B", "3": "C", "4": "D",
    "5": "E", "6": "F", "7": "G", "8": "H", "9": "I"
};

const encodeExpiryDate = (dateStr: string) => {
    if (!dateStr) return "";
    try {
        const parts = dateStr.split("-"); // YYYY-MM-DD
        if (parts.length < 2) return "";
        const year = parts[0].slice(2); // YY
        const month = parts[1]; // MM
        const encode = (s: string) => s.split("").map(c => codeMap[c] || c).join("");
        return `${encode(month)}-${encode(year)}`;
    } catch (e) {
        return "";
    }
};

const encodeDateYYMMDD = (dateStr: string) => {
    if (!dateStr || dateStr === "-") return "";
    try {
        const d = new Date(dateStr);
        if (isNaN(d.getTime())) return "";
        const yy = String(d.getFullYear()).slice(-2);
        const mm = String(d.getMonth() + 1).padStart(2, "0");
        const dd = String(d.getDate()).padStart(2, "0");
        const full = yy + mm + dd; // YYMMDD
        return full.split("").map(c => codeMap[c] || c).join("");
    } catch (e) {
        return "";
    }
};


/**
 * Generates an SVG QR code string.
 * Uses Low error correction level to minimize density for 203 DPI printers.
 */
const generateQRSvgString = async (
    itemName: string,
    itemCode: string,
    serialNo: string,
    encodedDate: string
): Promise<string> => {
    const qrData = encodedDate 
        ? `${itemName}/${itemCode}/${serialNo}/${encodedDate}`
        : `${itemName}/${itemCode}/${serialNo}`;
    
    // Using 'L' level to reduce density and increase module size
    return await QRCode.toString(qrData, { 
        type: 'svg',
        margin: 2, 
        errorCorrectionLevel: 'L'
    });
};






export default function SerialGeneration() {
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
    const [previewContent, setPreviewContent] = useState<Record<number, string>>({});
    const [startingSequence, setStartingSequence] = useState(1);
    const [isCheckingSequence, setIsCheckingSequence] = useState(false);
    const [historyDialogOpen, setHistoryDialogOpen] = useState(false);
    const [selectedHistoryRecord, setSelectedHistoryRecord] = useState<any>(null);
    const [isPrinting, setIsPrinting] = useState(false);

    // ─── Fetch ───────────────────────────────────────────────────────────────
    const fetchData = useCallback(async () => {
        const API = process.env.NEXT_PUBLIC_API_URI;
        if (!API) return;
        setIsLoading(true);
        try {
            // Need INDENT-LIFT for PO Copy (col BG = 58)
            const [raRes, fmsRes, dropRes, warrantyRes] = await Promise.all([
                fetch(`${API}?sheet=RECEIVING-ACCOUNTS&action=getAll`),
                fetch(`${API}?sheet=INDENT-LIFT&action=getAll`),
                fetch(`${API}?sheet=Dropdown&action=getAll`),
                fetch(`${API}?sheet=WARRANTY&action=getAll`)
            ]);
            const [raJson, fmsJson, dropJson, warrantyJson] = await Promise.all([
                raRes.json(), 
                fmsRes.json(), 
                dropRes.json(),
                warrantyRes.json()
            ]);

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
            
            // Create Warranty Map (Indent#_Lift# -> Array of { serialNo, qrLink })
            const qrMap = new Map<string, any[]>();
            if (warrantyJson.success && Array.isArray(warrantyJson.data)) {
                warrantyJson.data.slice(6).forEach((r: any) => {
                    const indent = String(r[0] || "").trim();
                    const lift = String(r[1] || "").trim();
                    const qrLink = String(r[2] || "").trim();
                    const serialNo = String(r[3] || "").trim();
                    if (indent) {
                        const key = `${indent}_${lift}`;
                        const existing = qrMap.get(key) || [];
                        existing.push({ serialNo, qrLink });
                        qrMap.set(key, existing);
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
                        productExpiry: row[107] || "",             // DD: Product Expiry
                        planned,
                        actual,
                        serials: qrMap.get(`${indentNo}_${row[2] || ""}`) || [],
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
    const fetchNextSequence = async (vendorName: string, invoiceDate: string) => {
        const API = process.env.NEXT_PUBLIC_API_URI;
        if (!API) return;
        
        setIsCheckingSequence(true);
        try {
            const vendorCode = vendorCodes[vendorName] || "UNKNOWN";
            const encodedDate = encodeDateYYMMDD(invoiceDate);
            const prefix = `SN-${vendorCode}/${encodedDate}/`;
            
            const res = await fetch(`${API}?sheet=WARRANTY&action=getAll`);
            const json = await res.json();
            
            if (json.success && Array.isArray(json.data)) {
                // Column D is index 3
                const serials = json.data.slice(6).map((r: any) => String(r[3] || ""));
                const relevantSerials = serials.filter((s: string) => s.startsWith(prefix));
                
                let maxSeq = 0;
                relevantSerials.forEach((s: string) => {
                    const parts = s.split("/");
                    if (parts.length >= 3) {
                        const seqStr = parts[2];
                        const seqNum = parseInt(seqStr, 10);
                        if (!isNaN(seqNum) && seqNum > maxSeq) {
                            maxSeq = seqNum;
                        }
                    }
                });
                setStartingSequence(maxSeq + 1);
            }
        } catch (err) {
            console.error("Sequence fetch error:", err);
        } finally {
            setIsCheckingSequence(false);
        }
    };

    const openHistoryDetails = (record: any) => {
        setSelectedHistoryRecord(record);
        setHistoryDialogOpen(true);
    };

    const handlePrintAllQRs = async () => {
        if (!selectedHistoryRecord) return;
        setIsPrinting(true);
        try {
            const itemName = selectedHistoryRecord.data.itemName;
            const itemCode = itemCodeMap[itemName] || "N/A";
            const productExpiry = selectedHistoryRecord.data.productExpiry;
            const encodedDate = encodeExpiryDate(productExpiry);
            const serials = selectedHistoryRecord.data.serials || [];
            
            if (serials.length === 0) {
                toast.error("No serial numbers found for this record");
                return;
            }

            // Create print window (Pop-up experience)
            const printWindow = window.open('', '', 'width=900,height=800');
            if (!printWindow) {
                toast.error("Pop-up blocked. Please allow pop-ups to print.");
                return;
            }

            // Generate label HTML content for each serial
            const labelContents = await Promise.all(serials.map(async (s: any) => {
                const svgString = await generateQRSvgString(itemName, itemCode, s.serialNo, encodedDate);
                return `
                    <div class="page">
                        <div class="label-wrapper">
                            <div class="qr-container">
                                ${svgString}
                            </div>
                            <div class="text-container">
                                <div class="item-name">${itemName.toUpperCase()}</div>
                                <div class="item-code">(${itemCode})</div>
                                <div class="serial-no">${s.serialNo}</div>
                                ${encodedDate ? `<div class="expiry-date">${encodedDate}</div>` : ''}
                            </div>
                        </div>
                    </div>
                `;
            }));

            const html = `
                <html>
                <head>
                    <title>Print Labels - ${selectedHistoryRecord.data.indentNo}</title>
                    <style>
                        @page { 
                            size: 50mm 38mm; 
                            margin: 0 !important; 
                        }
                        * {
                            margin: 0;
                            padding: 0;
                            box-sizing: border-box;
                        }
                        body { 
                            margin: 0; 
                            padding: 0; 
                            background: white; 
                            font-family: Arial, sans-serif; 
                        }
                        .page { 
                            width: 50mm; 
                            height: 38mm; 
                            page-break-after: always;
                            overflow: hidden;
                            display: flex;
                            align-items: center;
                            justify-content: center;
                            padding-left: 2mm; /* Side padding */
                        }
                        .label-wrapper {
                            width: 100%;
                            height: 100%;
                            display: flex;
                            align-items: center;
                            justify-content: flex-start;
                            padding: 2mm;
                        }
                        .qr-container {
                            width: 24mm;
                            height: 24mm;
                            flex-shrink: 0;
                            display: flex;
                            align-items: center;
                            justify-content: center;
                        }
                        .qr-container svg {
                            width: 100%;
                            height: 100%;
                            display: block;
                            shape-rendering: crispEdges; /* Ensure sharp vector edges */
                        }
                        .text-container {
                            flex: 1;
                            padding-left: 3mm;
                            display: flex;
                            flex-direction: column;
                            justify-content: center;
                            overflow: hidden;
                            min-width: 0;
                        }
                        .item-name {
                            font-size: 5.5pt;
                            font-weight: 900;
                            line-height: 1.1;
                            margin-bottom: 1px;
                            word-break: break-all;
                        }
                        .item-code {
                            font-size: 4.5pt;
                            font-weight: 900;
                            line-height: 1.1;
                            margin-bottom: 4px;
                        }
                        .serial-no {
                            font-size: 6.5pt;
                            font-weight: 900;
                            line-height: 1.1;
                            word-break: break-all;
                        }
                        .expiry-date {
                            font-size: 4.5pt;
                            font-weight: 900;
                            margin-top: 2px;
                        }
                        @media print {
                            body { -webkit-print-color-adjust: exact; }
                            * {
                                image-rendering: pixelated;
                            }
                        }
                    </style>
                </head>
                <body>
                    ${labelContents.join('')}
                    <script>
                        window.onload = function() {
                            setTimeout(function() {
                                window.print();
                                // window.close(); // Optional: close after print
                            }, 500);
                        };
                    </script>
                </body>
                </html>
            `;

            printWindow.document.open();
            printWindow.document.write(html);
            printWindow.document.close();

        } catch (err) {
            console.error(err);
            toast.error("Failed to prepare labels");
        } finally {
            setIsPrinting(false);
        }
    };



    const openForm = useCallback((record: any) => {
        setSelectedRecord(record);
        setIsAutoMode(false); 
        setStartingSequence(1); // Reset until fetch completes
        
        const vendorCode = vendorCodes[record.data.vendorName] || "UNKNOWN";
        const encodedDate = encodeDateYYMMDD(record.data.invoiceDate);
        const prefix = `SN-${vendorCode}/${encodedDate}/`;
        
        const qty = Math.max(1, parseInt(record.data.receivedQty) || 1);
        setEntries(Array.from({ length: qty }, () => ({
            serialNo: prefix, // Pre-fill prefix for manual mode immediately
        })));
        
        // Trigger fetch silently in background
        fetchNextSequence(record.data.vendorName, record.data.invoiceDate);
        
        setOpen(true);
    }, [vendorCodes]);

    // ─── Auto Serial Generation Logic ───
    useEffect(() => {
        if (!selectedRecord) return;
        const vendorCode = vendorCodes[selectedRecord.data.vendorName] || "UNKNOWN";
        const encodedDate = encodeDateYYMMDD(selectedRecord.data.invoiceDate);
        const prefix = `SN-${vendorCode}/${encodedDate}/`;

        if (isAutoMode) {
            if (isCheckingSequence) {
                // Optionally show prefix + "..." while loading
                setEntries(prev => prev.map(() => ({
                    serialNo: `${prefix}Loading...`
                })));
            } else {
                setEntries(prev => prev.map((_, idx) => ({
                    serialNo: `${prefix}${String(startingSequence + idx).padStart(3, "0")}`
                })));
            }
        } else {
            // Manual Mode: Pre-fill prefix, clear sequence
            setEntries(prev => prev.map(() => ({
                serialNo: prefix
            })));
        }
    }, [isAutoMode, selectedRecord, vendorCodes, startingSequence, isCheckingSequence]);

    const updateEntry = useCallback((idx: number, field: keyof WarrantyEntry, value: string) => {
        setEntries((prev) => {
            const next = [...prev];
            next[idx] = { ...next[idx], [field]: value };
            return next;
        });
        // Clear preview when value changes
        setPreviewContent(prev => {
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
            const encodedDate = encodeExpiryDate(selectedRecord.data.productExpiry);
            const svgString = await generateQRSvgString(itemName, itemCode, entry.serialNo, encodedDate);
            
            const html = `
                <div style="width: 400px; height: 190px; border: 1px solid #eee; display: flex; align-items: center; padding: 10px; font-family: Arial, sans-serif;">
                    <div style="width: 130px; height: 130px; flex-shrink: 0;">
                        ${svgString.replace('<svg', '<svg style="width:100%;height:100%"')}
                    </div>
                    <div style="flex: 1; padding-left: 10px; overflow: hidden; display: flex; flex-direction: column; justify-content: center;">
                        <div style="font-size: 7.5px; font-weight: 900; line-height: 1.1; margin-bottom: 1px; word-break: break-all;">${itemName.toUpperCase()}</div>
                        <div style="font-size: 6px; font-weight: 900; color: #000; margin-bottom: 4px;">(${itemCode})</div>
                        <div style="font-size: 8.5px; font-weight: 900; line-height: 1.1; word-break: break-all;">${entry.serialNo}</div>
                        ${encodedDate ? `<div style="font-size: 6px; font-weight: 900; margin-top: 2px;">${encodedDate}</div>` : ''}
                    </div>
                </div>
            `;

            setPreviewContent(prev => ({ ...prev, [idx]: html }));
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
                    const encodedDate = encodeExpiryDate(selectedRecord.data.productExpiry);
                    const svgString = await generateQRSvgString(itemName, itemCode, entry.serialNo, encodedDate);
                    const blob = new Blob([svgString], { type: 'image/svg+xml' });
                    const fileName = `QR_${entry.serialNo.replace(/[/\\:]/g, '_')}.svg`;
                    const driveUrl = await uploadFileToDrive(blob, fileName, API, FOLDER_ID);
                    return driveUrl;
                } catch (err) {
                    console.error("Upload error for index", idx, err);
                    return "";
                }
            }));

            // 2. batchInsert new rows into WARRANTY sheet
            const rowsData = entries.map((entry, idx) => {
                const warrantyRow = new Array(14).fill("");
                
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
                warrantyRow[13] = ts;                             // N: Product Expiry (Submission Timestamp as local date-time)
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
                toast.success("Serial Generation recorded successfully!");
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
        if (key === "invoiceCopy" || key === "poCopy" || key === "actions") {
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
        if (key === "invoiceDate" || key === "planned" || key === "actual" || key === "warrantyEnd" || key === "warrantyExpiry" || key === "productExpiry") {
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
                                    <h2 className="text-2xl font-bold text-slate-900">Stage: Serial Generation</h2>
                                </div>
                            </div>
                            <div className="flex items-center gap-4 flex-1 max-w-2xl justify-end">
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
                                    <p className="text-lg text-black">No pending Serial Generation entries</p>
                                </div>
                            ) : (
                                <div className="border rounded-lg overflow-x-auto h-[70vh] relative">
                                    <table className="w-full caption-bottom text-sm border-separate border-spacing-0 min-w-max">
                                        <thead className="sticky top-0 z-30 bg-slate-200 shadow-sm border-none text-center">
                                            <tr className="hover:bg-transparent border-none">
                                                <th className="sticky left-0 z-40 bg-slate-200 w-[150px] border-b text-center whitespace-nowrap px-4 py-3 font-semibold text-slate-900">Actions</th>
                                                {PENDING_COLUMNS.map((c) => (
                                                    <th key={c.key} className="bg-slate-200 border-b text-center px-4 py-3 font-semibold text-slate-900 whitespace-nowrap">{c.label}</th>
                                                ))}
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {pending.map((rec) => {
                                                return (
                                                    <tr key={rec.id} className="hover:bg-gray-50 group transition-colors">
                                                        <td className="sticky left-0 z-20 bg-white group-hover:bg-gray-50 border-b text-center px-4 py-2 transition-colors">
                                                            <Button 
                                                                variant="outline" 
                                                                size="sm" 
                                                                onClick={() => openForm(rec)} 
                                                                className="h-8 px-3 text-xs font-medium border-slate-200 hover:bg-slate-50 hover:text-slate-900 transition-colors whitespace-nowrap"
                                                            >
                                                                Serial Generation
                                                            </Button>
                                                        </td>
                                                        {PENDING_COLUMNS.map((col) => (
                                                            <td key={col.key} className="border-b px-4 py-2 text-center text-slate-700">
                                                                {renderCell(rec.data, col.key)}
                                                            </td>
                                                        ))}
                                                    </tr>
                                                );
                                            })}
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
                                    <p className="text-lg text-black">No completed Serial Generation entries</p>
                                </div>
                            ) : (
                                <div className="border rounded-lg overflow-x-auto h-[70vh] relative">
                                    <table className="w-full caption-bottom text-sm border-separate border-spacing-0 min-w-max">
                                        <thead className="sticky top-0 z-30 bg-slate-200 shadow-sm border-none">
                                            <tr className="hover:bg-transparent border-none">
                                                {HISTORY_COLUMNS.map((c) => (
                                                    <th key={c.key} className="bg-slate-200 border-b text-center px-4 py-3 font-semibold text-slate-900 whitespace-nowrap">{c.label}</th>
                                                ))}
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {history.map((rec) => (
                                                <tr key={rec.id} className="bg-green-50 hover:bg-green-100 transition-colors">
                                                    {HISTORY_COLUMNS.map((col) => (
                                                        <td key={col.key} className="border-b px-4 py-2 text-center text-slate-700">
                                                            {col.key === "actions" ? (
                                                                <Button
                                                                    variant="ghost"
                                                                    size="sm"
                                                                    className="h-8 w-8 p-0 text-blue-600 hover:text-blue-800 hover:bg-blue-50"
                                                                    onClick={() => openHistoryDetails(rec)}
                                                                >
                                                                    <Eye className="h-4 w-4" />
                                                                </Button>
                                                            ) : renderCell(rec.data, col.key)}
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
                        <DialogTitle>Serial Generation</DialogTitle>
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
                                        className={isAutoMode ? "bg-blue-600 hover:bg-blue-700 text-white min-w-[80px]" : "border-amber-500 text-amber-600 hover:bg-amber-50 min-w-[80px]"}
                                        onClick={() => setIsAutoMode(!isAutoMode)}
                                        disabled={isAutoMode && isCheckingSequence && entries[0]?.serialNo?.includes("Loading...")}
                                    >
                                        {isAutoMode && isCheckingSequence ? (
                                            <><Loader2 className="w-3 h-3 animate-spin mr-1.5" />Auto</>
                                        ) : (
                                            isAutoMode ? "Auto" : "Manual"
                                        )}
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
                                                        {previewContent[idx] ? (
                                                            <div 
                                                                dangerouslySetInnerHTML={{ __html: previewContent[idx] }}
                                                                className="border shadow-sm max-w-full"
                                                            />
                                                        ) : (
                                                            <div className="flex items-center justify-center w-[400px] h-[190px] bg-slate-50 border border-dashed rounded text-slate-400">
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

            {/* ── HISTORY DETAILS DIALOG ── */}
            <Dialog open={historyDialogOpen} onOpenChange={setHistoryDialogOpen}>
                <DialogContent className="sm:max-w-md p-0 overflow-hidden rounded-2xl border-none shadow-2xl">
                    <div className="bg-[#0089d1] p-4 flex items-center justify-between text-white">
                        <DialogTitle className="text-lg font-bold">Product QR</DialogTitle>
                    </div>
                    
                    <div className="p-6 space-y-6 bg-white">
                        {/* QR Label Card - Mimicking img2 */}
                        <div className="relative bg-white border border-slate-100 rounded-2xl p-6 shadow-sm flex flex-col items-center gap-4">
                            <div className="w-full flex justify-center">
                                {selectedHistoryRecord?.data.serials?.[0] ? (
                                    <div className="flex flex-col items-center gap-3">
                                        <div className="text-xs font-semibold text-slate-400 uppercase tracking-widest">Sample QR</div>
                                        <div className="p-2 border rounded-lg bg-slate-50">
                                            <img 
                                                src={getDirectDriveLink(selectedHistoryRecord.data.serials[0].qrLink)} 
                                                alt="Sample QR Label" 
                                                className="max-w-full h-auto w-[300px]"
                                            />
                                        </div>
                                    </div>
                                ) : (
                                    <div className="h-40 w-full flex items-center justify-center bg-slate-50 border border-dashed rounded-xl text-slate-400">
                                        No QR Available
                                    </div>
                                )}
                            </div>

                            <div className="text-center space-y-2">
                                <h3 className="text-2xl font-black text-slate-900 leading-tight">
                                    {selectedHistoryRecord?.data.indentNo} / {selectedHistoryRecord?.data.liftNo}
                                </h3>
                                <p className="text-sm text-slate-500 font-medium px-4">
                                    {selectedHistoryRecord?.data.itemName}
                                </p>
                                <div className="mt-2">
                                    <span className="inline-flex items-center px-3 py-1 rounded-full bg-slate-100 text-slate-600 text-xs font-bold ring-1 ring-inset ring-slate-200">
                                        Quantity: {selectedHistoryRecord?.data.receivedQty}
                                    </span>
                                </div>
                            </div>
                        </div>

                        <div className="space-y-3 pt-2">
                            <Button 
                                className="w-full h-14 bg-[#0089d1] hover:bg-[#0077b6] text-white text-base font-bold rounded-xl shadow-lg shadow-blue-500/20 transition-all active:scale-[0.98] flex items-center justify-center gap-3"
                                onClick={handlePrintAllQRs}
                                disabled={isPrinting}
                            >
                                {isPrinting ? (
                                    <><Loader2 className="h-5 w-5 animate-spin" /> Preparing...</>
                                ) : (
                                    <><Printer className="h-5 w-5" /> Print QRs ({selectedHistoryRecord?.data.receivedQty})</>
                                )}
                            </Button>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
}
