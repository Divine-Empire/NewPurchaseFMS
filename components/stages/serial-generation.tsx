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
import { Loader2, Search, ShieldAlert, Eye, Printer, PlusCircle, Check, ChevronsUpDown, ExternalLink, Download } from "lucide-react";
import { toast } from "sonner";
import { cn, formatDate, parseSheetDate, getFmsTimestamp } from "@/lib/utils";
import { Label } from "@/components/ui/label";
import {
    Command,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
} from "@/components/ui/command";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";
import QRCode from "qrcode";

const getDirectDriveLink = (url: string) => {
    if (!url) return "";
    const match = url.match(/\/d\/(.+?)\/(view|edit)/) || url.match(/id=(.+?)(&|$)/);
    if (match && match[1]) {
        return `https://drive.google.com/uc?export=view&id=${match[1]}`;
    }
    return url;
};

const getGoogleDriveViewLink = (url: string) => {
    if (!url) return "";
    const match = url.match(/\/d\/(.+?)\/(view|edit)/) || url.match(/id=(.+?)(&|$)/);
    if (match && match[1]) {
        return `https://drive.google.com/file/d/${match[1]}/view`;
    }
    return url;
};

const LocalQRPreview = ({ itemName, itemCode, serialNo, expiryDate }: { itemName: string, itemCode: string, serialNo: string, expiryDate?: string }) => {
    const [qrUrl, setQrUrl] = useState<string>("");

    useEffect(() => {
        let active = true;
        const generate = async () => {
            try {
                const dataUrl = await generateLabelPngDataUrl(itemName, itemCode, serialNo, expiryDate || "");
                if (active) {
                    setQrUrl(dataUrl);
                }
            } catch (err) {
                console.error("Failed to generate local QR code", err);
            }
        };
        generate();
        return () => {
            active = false;
        };
    }, [itemName, itemCode, serialNo, expiryDate]);

    if (!qrUrl) {
        return (
            <div className="h-[140px] w-[350px] flex items-center justify-center bg-slate-50 border rounded-lg animate-pulse">
                <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
            </div>
        );
    }

    return (
        <img
            src={qrUrl}
            alt="Sample QR Label"
            className="max-w-full h-auto w-[350px] border shadow-sm rounded-lg"
        />
    );
};

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

// ─── Serial-Generation sheet column map (0-based, headers row 5, data from row 7) ──────
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

const dataURLtoBlob = (dataurl: string) => {
    const arr = dataurl.split(',');
    const mimeMatch = arr[0].match(/:(.*?);/);
    const mime = mimeMatch ? mimeMatch[1] : 'image/png';
    const bstr = atob(arr[1]);
    let n = bstr.length;
    const u8arr = new Uint8Array(n);
    while (n--) {
        u8arr[n] = bstr.charCodeAt(n);
    }
    return new Blob([u8arr], { type: mime });
};

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

const getTextWrapLines = (
    ctx: CanvasRenderingContext2D,
    text: string,
    maxWidth: number
): string[] => {
    const words = text.split(" ");
    const lines: string[] = [];
    let currentLine = "";

    for (let i = 0; i < words.length; i++) {
        const word = words[i];
        const testLine = currentLine ? currentLine + " " + word : word;
        const metrics = ctx.measureText(testLine);
        if (metrics.width > maxWidth && i > 0) {
            lines.push(currentLine);
            currentLine = word;
        } else {
            currentLine = testLine;
        }
    }
    if (currentLine) {
        lines.push(currentLine);
    }
    return lines;
};

const generateLabelPngDataUrl = async (
    itemName: string,
    itemCode: string,
    serialNo: string,
    expiryDateStr: string
): Promise<string> => {
    const encodedDate = expiryDateStr ? encodeExpiryDate(expiryDateStr) : "";
    const qrData = encodedDate
        ? `${itemName}/${itemCode}/${serialNo}/${encodedDate}`
        : `${itemName}/${itemCode}/${serialNo}`;

    const qrDataUrl = await QRCode.toDataURL(qrData, {
        margin: 1,
        errorCorrectionLevel: 'L',
        width: 250
    });

    const canvas = document.createElement("canvas");
    canvas.width = 650;
    canvas.height = 250;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Could not get 2D context");

    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    await new Promise<void>((resolve, reject) => {
        const img = new Image();
        img.onload = () => {
            ctx.drawImage(img, 20, 20, 210, 210);
            resolve();
        };
        img.onerror = reject;
        img.src = qrDataUrl;
    });

    ctx.fillStyle = "#000000";
    ctx.textBaseline = "top";

    ctx.font = "bold 22px Arial, sans-serif";
    const displayName = `${itemName.toUpperCase()} (${itemCode})`;
    const titleLines = getTextWrapLines(ctx, displayName, 380);

    const line1Height = titleLines.length * 28;
    const line2Height = 26;
    const line3Height = encodedDate ? 24 : 0;
    const totalTextHeight = line1Height + 20 + line2Height + (encodedDate ? 12 + line3Height : 0);

    let currentY = Math.max(15, (250 - totalTextHeight) / 2);

    ctx.font = "bold 22px Arial, sans-serif";
    for (const line of titleLines) {
        ctx.fillText(line, 250, currentY);
        currentY += 28;
    }

    currentY += 20;

    ctx.font = "24px Arial, sans-serif";
    ctx.fillText(serialNo, 250, currentY);
    currentY += 26;

    if (encodedDate) {
        currentY += 12;
        ctx.font = "22px Arial, sans-serif";
        ctx.fillText(encodedDate, 250, currentY);
    }

    return canvas.toDataURL("image/png");
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






const Combobox = ({
    options,
    value,
    onChange,
    placeholder,
    searchPlaceholder,
    disabled,
}: {
    options: string[];
    value: string;
    onChange: (value: string) => void;
    placeholder: string;
    searchPlaceholder: string;
    disabled?: boolean;
}) => {
    const [open, setOpen] = useState(false);
    const [searchValue, setSearchValue] = useState("");
    const [debouncedSearchValue, setDebouncedSearchValue] = useState("");

    useEffect(() => {
        const handler = setTimeout(() => {
            setDebouncedSearchValue(searchValue);
        }, 300); // 300ms debounce
        return () => clearTimeout(handler);
    }, [searchValue]);

    const filteredOptions = useMemo(() => {
        if (!debouncedSearchValue) return options.slice(0, 50); // limit to 50 for max performance
        const lower = debouncedSearchValue.toLowerCase();
        return options
            .filter((option) => option.toLowerCase().includes(lower))
            .slice(0, 50);
    }, [options, debouncedSearchValue]);

    return (
        <Popover open={open} onOpenChange={setOpen} modal={true}>
            <PopoverTrigger asChild>
                <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={open}
                    className={cn("w-full justify-between font-normal bg-white border-slate-200 text-left", !value && "text-muted-foreground")}
                    disabled={disabled}
                >
                    <span className="truncate">
                        {value
                            ? options.find((option) => option === value) || value
                            : placeholder}
                    </span>
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
                <Command shouldFilter={false}>
                    <CommandInput
                        placeholder={searchPlaceholder}
                        value={searchValue}
                        onValueChange={setSearchValue}
                    />
                    <CommandList className="max-h-[250px] overflow-y-auto">
                        {filteredOptions.length === 0 && searchValue.trim() !== "" && (
                            <div
                                className="py-2 px-4 text-sm text-blue-600 cursor-pointer hover:bg-slate-100 flex items-center gap-2"
                                onMouseDown={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    onChange(searchValue); // Set custom value
                                    setOpen(false);
                                }}
                            >
                                <PlusCircle className="w-3 h-3" />
                                Create "{searchValue}"
                            </div>
                        )}
                        <CommandGroup>
                            {filteredOptions.map((option) => (
                                <CommandItem
                                    key={option}
                                    value={option}
                                    onSelect={() => {
                                        onChange(option);
                                        setOpen(false);
                                    }}
                                    className="whitespace-normal break-words py-2 cursor-pointer"
                                >
                                    <Check
                                        className={cn(
                                            "mr-2 h-4 w-4 shrink-0",
                                            value === option ? "opacity-100" : "opacity-0"
                                        )}
                                    />
                                    <span className="flex-1 text-sm">{option}</span>
                                </CommandItem>
                            ))}
                        </CommandGroup>
                    </CommandList>
                </Command>
            </PopoverContent>
        </Popover>
    );
};

export default function SerialGeneration() {
    const [pendingRecords, setPendingRecords] = useState<any[]>([]);
    const [historyRecords, setHistoryRecords] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [searchTerm, setSearchTerm] = useState("");
    const [activeTab, setActiveTab] = useState<"pending" | "history">("pending");

    const [open, setOpen] = useState(false);
    const [selectedRecords, setSelectedRecords] = useState<any[]>([]);
    const [entriesMap, setEntriesMap] = useState<Record<string, WarrantyEntry[]>>({});
    const [isSerialEnabled, setIsSerialEnabled] = useState(true);
    const [selectedPendingIds, setSelectedPendingIds] = useState<Set<string>>(new Set());
    const [selectedInvoiceGroup, setSelectedInvoiceGroup] = useState<string | null>(null);
    const [isAutoMode, setIsAutoMode] = useState(false);
    const [vendorCodes, setVendorCodes] = useState<Record<string, string>>({});
    const [itemCodeMap, setItemCodeMap] = useState<Record<string, string>>({});
    const [previewContent, setPreviewContent] = useState<Record<string, string>>({});
    const [startingSequence, setStartingSequence] = useState(1);
    const [isCheckingSequence, setIsCheckingSequence] = useState(false);


    const [historyDialogOpen, setHistoryDialogOpen] = useState(false);
    const [selectedHistoryRecord, setSelectedHistoryRecord] = useState<any>(null);
    const [isPrinting, setIsPrinting] = useState(false);
    const [pdfGeneratingId, setPdfGeneratingId] = useState<string | null>(null);
    const [warrantyRows, setWarrantyRows] = useState<any[]>([]);

    // === Direct Entry Form State ===
    const [directFormOpen, setDirectFormOpen] = useState(false);
    const [directForm, setDirectForm] = useState<{
        itemName: string;
        vendorName: string;
        invoiceDate: string;
        duration: string;
        quantity: number | "";
    }>({
        itemName: "",
        vendorName: "",
        invoiceDate: "",
        duration: "12",
        quantity: "",
    });
    const [debouncedQuantity, setDebouncedQuantity] = useState(0);

    useEffect(() => {
        const handler = setTimeout(() => {
            setDebouncedQuantity(directForm.quantity === "" ? 0 : directForm.quantity);
        }, 500); // 500ms debounce when user stops typing quantity
        return () => clearTimeout(handler);
    }, [directForm.quantity]);
    const [directEntries, setDirectEntries] = useState<Array<{ serialNo: string }>>([]);
    const [directIsAutoMode, setDirectIsAutoMode] = useState(true);
    const [directStartingSequence, setDirectStartingSequence] = useState(1);
    const [directIsCheckingSequence, setDirectIsCheckingSequence] = useState(false);
    const [directPreviewContent, setDirectPreviewContent] = useState<Record<number, string>>({});

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
                fetch(`${API}?sheet=Serial-Generation&action=getAll`)
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
            // AND Grouped Serials by Indent No.
            const qrMap = new Map<string, any[]>();
            const groupedSerials = new Map<string, any[]>();
            if (warrantyJson.success && Array.isArray(warrantyJson.data)) {
                setWarrantyRows(warrantyJson.data);
                warrantyJson.data.slice(6).forEach((r: any) => {
                    const indent = String(r[0] || "").trim();
                    const lift = String(r[1] || "").trim();
                    const qrLink = String(r[2] || "").trim();
                    const serialNo = String(r[3] || "").trim();
                    const vendorName = String(r[4] || "").trim();
                    const itemName = String(r[5] || "").trim();
                    const invoiceDate = String(r[6] || "").trim();
                    const warrantyEnd = String(r[7] || "").trim();
                    const submissionTs = String(r[13] || "").trim();

                    if (indent) {
                        const key = `${indent}_${lift}`;
                        const existing = qrMap.get(key) || [];
                        existing.push({ serialNo, qrLink });
                        qrMap.set(key, existing);

                        const groupKey = indent;
                        const existingGroup = groupedSerials.get(groupKey) || [];
                        existingGroup.push({
                            serialNo,
                            qrLink,
                            vendorName,
                            itemName,
                            invoiceDate,
                            warrantyEnd,
                            submissionTs
                        });
                        groupedSerials.set(groupKey, existingGroup);
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
                const processedIndentsInHistory = new Set<string>();

                allRows.forEach(({ row, raIndex }: any) => {
                    const planned = String(row[108] || "").trim(); // DE
                    const actual = String(row[109] || "").trim(); // DF
                    const hasPlan = planned !== "" && planned !== "-";
                    const hasActual = actual !== "" && actual !== "-";

                    const indentNo = String(row[1] || "").trim();
                    const liftNo = String(row[2] || "").trim();
                    const fmsRow = fmsMap.get(indentNo);

                    const data = {
                        indentNo,
                        liftNo,
                        vendorName: row[3] || "",
                        poNumber: row[4] || "",
                        itemName: row[7] || "",
                        receivedQty: row[25] || "",
                        invoiceDate: row[23] || "",
                        invoiceNo: String(row[24] || "").trim(),
                        invoiceCopy: row[29] || "",
                        poCopy: fmsRow ? (fmsRow[58] || "") : "",
                        warrantyExpiry: row[106] || "",
                        productExpiry: row[107] || "",
                        planned,
                        actual,
                        serials: qrMap.get(`${indentNo}_${liftNo}`) || [],
                    };

                    const id = `${data.indentNo}_${data.liftNo || raIndex}`;

                    if (hasPlan && !hasActual) {
                        pending.push({ id: `pending_${id}`, raIndex, data });
                    }
                });

                // Build grouped history records from groupedSerials
                for (const [indentNo, serialsList] of groupedSerials.entries()) {
                    // Find all completed lifts for this indent in RECEIVING-ACCOUNTS
                    const matchingRARows = allRows.filter(({ row }: any) => {
                        const rowIndent = String(row[1] || "").trim();
                        const actual = String(row[109] || "").trim();
                        return rowIndent === indentNo && actual !== "" && actual !== "-";
                    });

                    if (matchingRARows.length > 0) {
                        const firstRARow = matchingRARows[0].row;
                        const firstFmsRow = fmsMap.get(indentNo);

                        const uniqueLifts = Array.from(new Set(matchingRARows.map(({ row }: any) => String(row[2] || "").trim()).filter(Boolean)));
                        const totalReceivedQty = matchingRARows.reduce((sum: number, { row }: any) => sum + (parseInt(row[25]) || 0), 0);
                        const serials = serialsList.map(s => ({
                            serialNo: s.serialNo,
                            qrLink: s.qrLink
                        }));

                        const data = {
                            indentNo,
                            liftNo: uniqueLifts.join(", ") || "-",
                            vendorName: firstRARow[3] || "",
                            poNumber: firstRARow[4] || "",
                            itemName: firstRARow[7] || "",
                            receivedQty: String(totalReceivedQty || serials.length),
                            invoiceDate: firstRARow[23] || "",
                            invoiceNo: String(firstRARow[24] || "").trim(),
                            invoiceCopy: firstRARow[29] || "",
                            poCopy: firstFmsRow ? (firstFmsRow[58] || "") : "",
                            warrantyExpiry: firstRARow[106] || "",
                            productExpiry: firstRARow[107] || "",
                            planned: firstRARow[108] || "",
                            actual: firstRARow[109] || "",
                            serials,
                        };

                        history.push({
                            id: `history_${indentNo}`,
                            raIndex: matchingRARows[0].raIndex,
                            data
                        });
                        processedIndentsInHistory.add(indentNo);
                    } else {
                        // Direct Indent (e.g. IN-DIR-XXXX) or indent not in RECEIVING-ACCOUNTS
                        const firstSerial = serialsList[0];
                        const serials = serialsList.map(s => ({
                            serialNo: s.serialNo,
                            qrLink: s.qrLink
                        }));

                        const data = {
                            indentNo,
                            liftNo: "-",
                            vendorName: firstSerial.vendorName || "-",
                            poNumber: "-",
                            itemName: firstSerial.itemName || "-",
                            receivedQty: String(serials.length),
                            invoiceDate: firstSerial.invoiceDate || "",
                            invoiceNo: "-",
                            invoiceCopy: "-",
                            poCopy: "-",
                            warrantyExpiry: firstSerial.warrantyEnd || "",
                            productExpiry: firstSerial.warrantyEnd || "",
                            planned: "-",
                            actual: firstSerial.submissionTs || "",
                            serials,
                        };

                        history.push({
                            id: `history_${indentNo}`,
                            raIndex: -1,
                            data
                        });
                        processedIndentsInHistory.add(indentNo);
                    }
                }

                // Fallback for any completed RECEIVING-ACCOUNTS row that does not have serials logged
                allRows.forEach(({ row, raIndex }: any) => {
                    const planned = String(row[108] || "").trim();
                    const actual = String(row[109] || "").trim();
                    const hasPlan = planned !== "" && planned !== "-";
                    const hasActual = actual !== "" && actual !== "-";
                    const indentNo = String(row[1] || "").trim();

                    if (hasPlan && hasActual && !processedIndentsInHistory.has(indentNo)) {
                        const liftNo = String(row[2] || "").trim();
                        const fmsRow = fmsMap.get(indentNo);
                        const data = {
                            indentNo,
                            liftNo,
                            vendorName: row[3] || "",
                            poNumber: row[4] || "",
                            itemName: row[7] || "",
                            receivedQty: row[25] || "",
                            invoiceDate: row[23] || "",
                            invoiceNo: String(row[24] || "").trim(),
                            invoiceCopy: row[29] || "",
                            poCopy: fmsRow ? (fmsRow[58] || "") : "",
                            warrantyExpiry: row[106] || "",
                            productExpiry: row[107] || "",
                            planned,
                            actual,
                            serials: [],
                        };
                        const id = `${data.indentNo}_${data.liftNo || raIndex}`;
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

    // Group pending records by Invoice Number
    const pendingGroups = useMemo(() => {
        const groups: Record<string, {
            invoiceNo: string;
            invoiceDate: string;
            vendorName: string;
            records: any[];
        }> = {};

        pending.forEach((rec) => {
            const invNo = rec.data.invoiceNo || "No Invoice";
            if (!groups[invNo]) {
                groups[invNo] = {
                    invoiceNo: invNo,
                    invoiceDate: rec.data.invoiceDate,
                    vendorName: rec.data.vendorName,
                    records: [],
                };
            }
            groups[invNo].records.push(rec);
        });

        return Object.values(groups);
    }, [pending]);

    const [expandedInvoices, setExpandedInvoices] = useState<Record<string, boolean>>({});

    const toggleInvoiceExpanded = (invoiceNo: string) => {
        setExpandedInvoices((prev) => ({
            ...prev,
            [invoiceNo]: !prev[invoiceNo],
        }));
    };

    const handleCheckboxChange = (rec: any, checked: boolean) => {
        const invNo = rec.data.invoiceNo || "No Invoice";
        if (checked) {
            if (selectedInvoiceGroup && selectedInvoiceGroup !== invNo) {
                toast.warning(`Selection cleared: You can only select lifts from the same invoice group ("${invNo}").`);
                const newSet = new Set<string>();
                newSet.add(rec.id);
                setSelectedPendingIds(newSet);
                setSelectedInvoiceGroup(invNo);
            } else {
                const newSet = new Set(selectedPendingIds);
                newSet.add(rec.id);
                setSelectedPendingIds(newSet);
                setSelectedInvoiceGroup(invNo);
            }
        } else {
            const newSet = new Set(selectedPendingIds);
            newSet.delete(rec.id);
            setSelectedPendingIds(newSet);
            if (newSet.size === 0) {
                setSelectedInvoiceGroup(null);
            }
        }
    };

    // ─── Open form ────────────────────────────────────────────────────────────
    const fetchNextSequence = async (vendorName: string, invoiceDate: string) => {
        const API = process.env.NEXT_PUBLIC_API_URI;
        if (!API) return;

        setIsCheckingSequence(true);
        try {
            const vendorCode = vendorCodes[vendorName] || "UNKNOWN";
            const encodedDate = encodeDateYYMMDD(invoiceDate);
            const prefix = `SN-${vendorCode}/${encodedDate}/`;

            // If raw rows are already cached, use them to calculate the sequence in memory
            if (warrantyRows.length > 0) {
                const serials = warrantyRows.slice(6).map((r: any) => String(r[3] || ""));
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
                setIsCheckingSequence(false);
                return;
            }

            const res = await fetch(`${API}?sheet=Serial-Generation&action=getAll`);
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

    const fetchDirectNextSequence = async (vendorName: string, invoiceDate: string) => {
        const API = process.env.NEXT_PUBLIC_API_URI;
        if (!API) return;

        setDirectIsCheckingSequence(true);
        try {
            const vendorCode = vendorCodes[vendorName] || "UNKNOWN";
            const encodedDate = encodeDateYYMMDD(invoiceDate);
            const prefix = `SN-${vendorCode}/${encodedDate}/`;

            // If raw rows are already cached, use them to calculate the sequence in memory
            if (warrantyRows.length > 0) {
                const serials = warrantyRows.slice(6).map((r: any) => String(r[3] || ""));
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
                setDirectStartingSequence(maxSeq + 1);
                setDirectIsCheckingSequence(false);
                return;
            }

            const res = await fetch(`${API}?sheet=Serial-Generation&action=getAll`);
            const json = await res.json();

            if (json.success && Array.isArray(json.data)) {
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
                setDirectStartingSequence(maxSeq + 1);
            }
        } catch (err) {
            console.error("Direct sequence fetch error:", err);
        } finally {
            setDirectIsCheckingSequence(false);
        }
    };

    const fetchNextDirectIndent = async (): Promise<string> => {
        const API = process.env.NEXT_PUBLIC_API_URI;
        if (!API) return "IN-DIR-0001";
        try {
            const res = await fetch(`${API}?sheet=Serial-Generation&action=getAll`);
            const json = await res.json();
            if (json.success && Array.isArray(json.data)) {
                let maxIndentNum = 0;
                json.data.slice(6).forEach((r: any) => {
                    const indent = String(r[0] || "").trim();
                    const indentMatch = indent.match(/^IN-DIR-(\d+)/i);
                    if (indentMatch) {
                        const num = parseInt(indentMatch[1], 10);
                        if (!isNaN(num) && num > maxIndentNum) {
                            maxIndentNum = num;
                        }
                    }
                });
                const nextIndentSeq = maxIndentNum + 1;
                return `IN-DIR-${String(nextIndentSeq).padStart(4, "0")}`;
            }
        } catch (err) {
            console.error("Direct indent fetch error:", err);
        }
        return "IN-DIR-0001";
    };

    useEffect(() => {
        if (directForm.vendorName && directForm.invoiceDate && directFormOpen) {
            fetchDirectNextSequence(directForm.vendorName, directForm.invoiceDate);
        }
    }, [directForm.vendorName, directForm.invoiceDate, directFormOpen]);

    useEffect(() => {
        if (!directFormOpen) return;
        const vendorCode = vendorCodes[directForm.vendorName] || "UNKNOWN";
        const encodedDate = encodeDateYYMMDD(directForm.invoiceDate);
        const prefix = `SN-${vendorCode}/${encodedDate}/`;

        if (directIsAutoMode) {
            if (directIsCheckingSequence) {
                setDirectEntries(Array.from({ length: debouncedQuantity }, () => ({
                    serialNo: `${prefix}Loading...`
                })));
            } else {
                setDirectEntries(Array.from({ length: debouncedQuantity }, (_, idx) => ({
                    serialNo: `${prefix}${String(directStartingSequence + idx).padStart(3, "0")}`
                })));
            }
        } else {
            setDirectEntries((prev) => {
                const arr = Array.from({ length: debouncedQuantity }, (_, idx) => {
                    if (prev[idx] && prev[idx].serialNo.startsWith(`SN-`)) {
                        return prev[idx];
                    }
                    return { serialNo: prefix };
                });
                return arr;
            });
        }
    }, [directIsAutoMode, directForm.vendorName, directForm.invoiceDate, debouncedQuantity, vendorCodes, directStartingSequence, directIsCheckingSequence, directFormOpen]);

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
                            font-size: 8pt;
                            font-weight: 900;
                            line-height: 1.1;
                            margin-bottom: 1px;
                            word-break: break-all;
                        }
                        .item-code {
                            font-size: 7pt;
                            font-weight: 900;
                            line-height: 1.1;
                            margin-bottom: 4px;
                        }
                        .serial-no {
                            font-size: 9pt;
                            font-weight: 900;
                            font-family: "Courier New", monospace;
                            line-height: 1.1;
                            word-break: break-all;
                        }
                        .expiry-date {
                            font-size: 7pt;
                            font-weight: 900;
                            margin-top: 2px;
                        }
                        @media print {
                            body { -webkit-print-color-adjust: exact; }
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

    const handleDownloadAllPDF = async (record: any) => {
        if (!record) return;
        const indentNo = record.data.indentNo;
        setPdfGeneratingId(indentNo);
        const toastId = toast.loading(`Generating PDF for Indent ${indentNo}...`);
        try {
            const itemName = record.data.itemName;
            const itemCode = itemCodeMap[itemName] || "N/A";
            const productExpiry = record.data.productExpiry || record.data.warrantyExpiry || "";
            const encodedDate = encodeExpiryDate(productExpiry);
            const serials = record.data.serials || [];

            if (serials.length === 0) {
                toast.error("No serial numbers found for this record", { id: toastId });
                return;
            }

            // Generate QR code data URLs for all serial numbers
            const serialsWithQr = await Promise.all(serials.map(async (s: any) => {
                const qrData = encodedDate
                    ? `${itemName}/${itemCode}/${s.serialNo}/${encodedDate}`
                    : `${itemName}/${itemCode}/${s.serialNo}`;
                const qrDataUrl = await QRCode.toDataURL(qrData, {
                    margin: 1,
                    errorCorrectionLevel: 'L',
                    width: 250
                });
                return {
                    serialNo: s.serialNo,
                    qrDataUrl
                };
            }));

            // Dynamically import @react-pdf/renderer and the PDF Document component
            const { pdf } = await import("@react-pdf/renderer");
            const { SerialPDFDocument } = await import("./serial-pdf");

            // Compile document to blob
            const doc = <SerialPDFDocument itemName={itemName} itemCode={itemCode} encodedDate={encodedDate} serials={serialsWithQr} />;
            const blob = await pdf(doc).toBlob();

            // Download trigger
            const url = URL.createObjectURL(blob);
            const link = document.createElement("a");
            link.href = url;
            link.download = `QR_Labels_${indentNo.replace(/[/\\:]/g, '_')}.pdf`;
            link.click();
            URL.revokeObjectURL(url);
            toast.success("PDF downloaded successfully!", { id: toastId });
        } catch (err) {
            console.error(err);
            toast.error("Failed to generate PDF", { id: toastId });
        } finally {
            setPdfGeneratingId(null);
        }
    };



    const openForm = useCallback((records: any[]) => {
        setSelectedRecords(records);
        setIsAutoMode(false);
        setIsSerialEnabled(true); // reset to Yes by default
        setStartingSequence(1); // Reset until fetch completes

        const newEntriesMap: Record<string, WarrantyEntry[]> = {};
        records.forEach(rec => {
            const vendorCode = vendorCodes[rec.data.vendorName] || "UNKNOWN";
            const encodedDate = encodeDateYYMMDD(rec.data.invoiceDate);
            const prefix = `SN-${vendorCode}/${encodedDate}/`;
            const qty = Math.max(1, parseInt(rec.data.receivedQty) || 1);
            newEntriesMap[rec.id] = Array.from({ length: qty }, () => ({
                serialNo: prefix, // Pre-fill prefix for manual mode immediately
            }));
        });
        setEntriesMap(newEntriesMap);

        // Trigger fetch silently in background
        if (records.length > 0) {
            fetchNextSequence(records[0].data.vendorName, records[0].data.invoiceDate);
        }

        setOpen(true);
    }, [vendorCodes]);

    // ─── Auto Serial Generation Logic ───
    useEffect(() => {
        if (selectedRecords.length === 0) return;

        const newEntriesMap: Record<string, WarrantyEntry[]> = {};
        let currentSeq = startingSequence;

        selectedRecords.forEach(rec => {
            const vendorCode = vendorCodes[rec.data.vendorName] || "UNKNOWN";
            const encodedDate = encodeDateYYMMDD(rec.data.invoiceDate);
            const prefix = `SN-${vendorCode}/${encodedDate}/`;
            const qty = Math.max(1, parseInt(rec.data.receivedQty) || 1);

            newEntriesMap[rec.id] = Array.from({ length: qty }, (_, idx) => {
                if (!isSerialEnabled) {
                    return { serialNo: prefix };
                } else if (isAutoMode) {
                    if (isCheckingSequence) {
                        return { serialNo: `${prefix}Loading...` };
                    } else {
                        const seqStr = String(currentSeq + idx).padStart(3, "0");
                        return { serialNo: `${prefix}${seqStr}` };
                    }
                } else {
                    return { serialNo: prefix };
                }
            });

            if (isSerialEnabled && isAutoMode && !isCheckingSequence) {
                currentSeq += qty;
            }
        });

        setEntriesMap(newEntriesMap);
    }, [isAutoMode, isSerialEnabled, selectedRecords, vendorCodes, startingSequence, isCheckingSequence]);

    const updateEntry = useCallback((recordId: string, idx: number, value: string) => {
        setEntriesMap((prev) => {
            const next = { ...prev };
            if (next[recordId]) {
                const nextList = [...next[recordId]];
                nextList[idx] = { ...nextList[idx], serialNo: value };
                next[recordId] = nextList;
            }
            return next;
        });
        // Clear preview when value changes
        setPreviewContent(prev => {
            const next = { ...prev };
            delete next[`${recordId}_${idx}`];
            return next;
        });
    }, []);

    const handlePreview = async (recordId: string, idx: number) => {
        const rec = selectedRecords.find(r => r.id === recordId);
        if (!rec) return;
        const recEntries = entriesMap[recordId] || [];
        const entry = recEntries[idx];
        if (!entry || !entry.serialNo.trim()) {
            toast.error("Please enter a serial number first");
            return;
        }

        try {
            const itemName = rec.data.itemName;
            const itemCode = itemCodeMap[itemName] || "N/A";
            const encodedDate = encodeExpiryDate(rec.data.productExpiry);
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

            setPreviewContent(prev => ({ ...prev, [`${recordId}_${idx}`]: html }));
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
        if (selectedRecords.length === 0 || !API || !FOLDER_ID) return;

        setIsSubmitting(true);
        try {
            const ts = getFmsTimestamp();
            
            // Accumulate all rowsData for batch insert
            const allRowsData: any[][] = [];

            // Loop over each selected record
            for (const rec of selectedRecords) {
                const itemName = rec.data.itemName;
                const itemCode = itemCodeMap[itemName] || "N/A";
                const recEntries = entriesMap[rec.id] || [];

                // 1. Generate and Upload images for each serial number (ONLY if isSerialEnabled is true)
                const uploadResults = await Promise.all(recEntries.map(async (entry, idx) => {
                    if (!isSerialEnabled) {
                        return ""; // Skip QR generation & upload
                    }
                    try {
                        const pngDataUrl = await generateLabelPngDataUrl(
                            itemName,
                            itemCode,
                            entry.serialNo,
                            rec.data.productExpiry
                        );
                        const blob = dataURLtoBlob(pngDataUrl);
                        const fileName = `QR_${entry.serialNo.replace(/[/\\:]/g, '_')}.png`;
                        const driveUrl = await uploadFileToDrive(blob, fileName, API, FOLDER_ID);
                        return driveUrl;
                    } catch (err) {
                        console.error("Upload error for record", rec.id, "index", idx, err);
                        return "";
                    }
                }));

                // 2. Build rows for this record
                recEntries.forEach((entry, idx) => {
                    const warrantyRow = new Array(15).fill(""); // Extended to length 15

                    let formattedWarrantyEnd = rec.data.warrantyExpiry;
                    if (formattedWarrantyEnd && formattedWarrantyEnd !== "-") {
                        const d = new Date(formattedWarrantyEnd);
                        if (!isNaN(d.getTime())) {
                            const pad = (n: number) => String(n).padStart(2, "0");
                            formattedWarrantyEnd = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
                        }
                    }

                    warrantyRow[0] = rec.data.indentNo;    // A: Indent No.
                    warrantyRow[1] = rec.data.liftNo;      // B: Unit Tracking No.
                    warrantyRow[2] = uploadResults[idx] || "";        // C: Serial Code (Drive Link)
                    warrantyRow[3] = entry.serialNo;                  // D: Serial No.
                    warrantyRow[4] = rec.data.vendorName;  // E: Vendor Name
                    warrantyRow[5] = rec.data.itemName;    // F: Item-Name
                    warrantyRow[6] = formatDate(rec.data.invoiceDate); // G: Invoice Date
                    warrantyRow[7] = formattedWarrantyEnd;            // H: Warranty End
                    warrantyRow[13] = ts;                             // N: Submission Timestamp
                    warrantyRow[14] = isSerialEnabled ? "Yes" : "No";  // O: Yes/No String
                    allRowsData.push(warrantyRow);
                });
            }

            // 3. Batch insert to Serial-Generation
            const insertParams = new URLSearchParams();
            insertParams.append("action", "batchInsert");
            insertParams.append("sheetName", "Serial-Generation");
            insertParams.append("rowsData", JSON.stringify(allRowsData));
            insertParams.append("startRow", "7");

            // 4. Update RECEIVING-ACCOUNTS actual timestamp (Col DF, index 109) for all records in parallel
            const updatePromises = selectedRecords.map(rec => {
                const raRow = new Array(110).fill("");
                raRow[109] = ts; // DF: Actual

                const updateParams = new URLSearchParams();
                updateParams.append("action", "update");
                updateParams.append("sheetName", "RECEIVING-ACCOUNTS");
                updateParams.append("rowData", JSON.stringify(raRow));
                updateParams.append("rowIndex", rec.raIndex.toString());

                return fetch(API, { method: "POST", body: updateParams }).then(res => res.json());
            });

            const [insertRes, ...updateJsonResults] = await Promise.all([
                fetch(API, { method: "POST", body: insertParams }),
                ...updatePromises
            ]);

            const insertJson = await insertRes.json();
            const allUpdatesSuccess = updateJsonResults.every(r => r.success);

            if (insertJson.success && allUpdatesSuccess) {
                toast.success("Serial Generation recorded successfully!");
                setOpen(false);
                setSelectedPendingIds(new Set());
                setSelectedInvoiceGroup(null);
                fetchData();
            } else {
                const failedUpdate = updateJsonResults.find(r => !r.success);
                const errMsg = (!insertJson.success ? insertJson.error : failedUpdate?.error) || "Unknown error";
                toast.error("Failed to save: " + errMsg);
            }
        } catch (err: any) {
            console.error(err);
            toast.error("Submission failed");
        } finally {
            setIsSubmitting(false);
        }
    }, [selectedRecords, entriesMap, isSerialEnabled, fetchData, itemCodeMap]);

    const updateDirectEntry = useCallback((idx: number, value: string) => {
        setDirectEntries((prev) => {
            const next = [...prev];
            next[idx] = { ...next[idx], serialNo: value };
            return next;
        });
        setDirectPreviewContent(prev => {
            const next = { ...prev };
            delete next[idx];
            return next;
        });
    }, []);

    const handleDirectPreview = async (idx: number) => {
        const entry = directEntries[idx];
        if (!entry || !entry.serialNo.trim()) {
            toast.error("Please enter a serial number first");
            return;
        }

        try {
            const itemName = directForm.itemName;
            const itemCode = itemCodeMap[itemName] || "N/A";
            const svgString = await generateQRSvgString(itemName, itemCode, entry.serialNo, "");

            const html = `
                <div style="width: 400px; height: 190px; border: 1px solid #eee; display: flex; align-items: center; padding: 10px; font-family: Arial, sans-serif;">
                    <div style="width: 130px; height: 130px; flex-shrink: 0;">
                        ${svgString.replace('<svg', '<svg style="width:100%;height:100%"')}
                    </div>
                    <div style="flex: 1; padding-left: 10px; overflow: hidden; display: flex; flex-direction: column; justify-content: center;">
                        <div style="font-size: 7.5px; font-weight: 900; line-height: 1.1; margin-bottom: 1px; word-break: break-all;">${itemName.toUpperCase()}</div>
                        <div style="font-size: 6px; font-weight: 900; color: #000; margin-bottom: 4px;">(${itemCode})</div>
                        <div style="font-size: 8.5px; font-weight: 900; line-height: 1.1; word-break: break-all;">${entry.serialNo}</div>
                    </div>
                </div>
            `;

            setDirectPreviewContent(prev => ({ ...prev, [idx]: html }));
        } catch (err) {
            console.error(err);
            toast.error("Failed to generate preview");
        }
    };

    const handleDirectSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        const API = process.env.NEXT_PUBLIC_API_URI;
        const FOLDER_ID = process.env.NEXT_PUBLIC_IMAGE_FOLDER_ID;
        if (!API || !FOLDER_ID) return;

        if (!directForm.itemName || !directForm.vendorName || !directForm.invoiceDate || !directForm.duration) {
            toast.error("Please fill in all details");
            return;
        }

        setIsSubmitting(true);
        try {
            const ts = getFmsTimestamp();
            const itemName = directForm.itemName;
            const itemCode = itemCodeMap[itemName] || "N/A";

            // Get next direct indent
            const nextIndentNo = await fetchNextDirectIndent();

            // 1. Generate and Upload images for each serial number
            const uploadResults = await Promise.all(directEntries.map(async (entry, idx) => {
                try {
                    const pngDataUrl = await generateLabelPngDataUrl(
                        itemName,
                        itemCode,
                        entry.serialNo,
                        ""
                    );
                    const blob = dataURLtoBlob(pngDataUrl);
                    const fileName = `QR_${entry.serialNo.replace(/[/\\:]/g, '_')}.png`;
                    const driveUrl = await uploadFileToDrive(blob, fileName, API, FOLDER_ID);
                    return driveUrl;
                } catch (err) {
                    console.error("Upload error for index", idx, err);
                    return "";
                }
            }));

            // 2. batchInsert new rows into Serial-Generation sheet
            const rowsData = directEntries.map((entry, idx) => {
                const warrantyRow = new Array(14).fill("");

                let formattedWarrantyEnd = "";
                if (directForm.invoiceDate && directForm.duration) {
                    const d = new Date(directForm.invoiceDate);
                    const months = parseInt(directForm.duration, 10);
                    if (!isNaN(d.getTime()) && !isNaN(months)) {
                        d.setMonth(d.getMonth() + months);
                        const pad = (n: number) => String(n).padStart(2, "0");
                        formattedWarrantyEnd = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
                    }
                }

                warrantyRow[0] = nextIndentNo;                    // A: Indent No.
                warrantyRow[1] = "";                              // B: Unit Tracking No. (Sent as empty as per user comment)
                warrantyRow[2] = uploadResults[idx] || "";        // C: Serial Code (Drive Link)
                warrantyRow[3] = entry.serialNo;                  // D: Serial No.
                warrantyRow[4] = directForm.vendorName;           // E: Vendor Name
                warrantyRow[5] = directForm.itemName;             // F: Item-Name
                warrantyRow[6] = formatDate(directForm.invoiceDate); // G: Invoice Date
                warrantyRow[7] = formattedWarrantyEnd;            // H: Warranty End
                warrantyRow[13] = ts;                             // N: Submission Timestamp
                return warrantyRow;
            });

            const insertParams = new URLSearchParams();
            insertParams.append("action", "batchInsert");
            insertParams.append("sheetName", "Serial-Generation");
            insertParams.append("rowsData", JSON.stringify(rowsData));
            insertParams.append("startRow", "7");

            const insertRes = await fetch(API, { method: "POST", body: insertParams });
            const insertJson = await insertRes.json();

            if (insertJson.success) {
                toast.success("Serial Generation recorded successfully!");
                setDirectFormOpen(false);
                // Clear direct form
                setDirectForm({
                    itemName: "",
                    vendorName: "",
                    invoiceDate: "",
                    duration: "12",
                    quantity: 1,
                });
                setDirectEntries([]);
                setDirectPreviewContent({});
                fetchData();
            } else {
                toast.error("Failed to save: " + insertJson.error);
            }
        } catch (err: any) {
            console.error(err);
            toast.error("Submission failed");
        } finally {
            setIsSubmitting(false);
        }
    };

    const formValid = useMemo(() => {
        if (selectedRecords.length === 0) return false;
        return selectedRecords.every(rec => {
            const recEntries = entriesMap[rec.id] || [];
            return recEntries.length > 0 && recEntries.every(e => e.serialNo.trim() !== "" && !e.serialNo.includes("Loading..."));
        });
    }, [selectedRecords, entriesMap]);

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
                <div className="sticky top-0 z-30 bg-[#f8fafc] -mx-6 px-6 pt-2 pb-4 mb-4 border-b shadow-sm">
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
                                {selectedPendingIds.size > 0 && (
                                    <Button
                                        onClick={() => {
                                            const selectedRecs = pendingRecords.filter(r => selectedPendingIds.has(r.id));
                                            openForm(selectedRecs);
                                        }}
                                        className="bg-blue-600 hover:bg-blue-700 text-white font-medium shadow-sm transition-all"
                                    >
                                        Generate Serials ({selectedPendingIds.size} selected)
                                    </Button>
                                )}
                                <Button
                                    onClick={() => setDirectFormOpen(true)}
                                    className="bg-amber-600 hover:bg-amber-700 text-white font-medium shadow-sm transition-colors"
                                >
                                    <PlusCircle className="w-4 h-4 mr-2" />
                                    Form
                                </Button>
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
                                                <th className="sticky left-0 z-40 bg-slate-200 w-[170px] border-b text-center whitespace-nowrap px-4 py-3 font-semibold text-slate-900">Actions</th>
                                                {PENDING_COLUMNS.map((c) => (
                                                    <th key={c.key} className="bg-slate-200 border-b text-center px-4 py-3 font-semibold text-slate-900 whitespace-nowrap">{c.label}</th>
                                                ))}
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {pendingGroups.map((group) => {
                                                const isExpanded = !!expandedInvoices[group.invoiceNo];
                                                return (
                                                    <React.Fragment key={group.invoiceNo}>
                                                        {/* Group Header Row */}
                                                        <tr 
                                                            className="bg-slate-100/80 cursor-pointer hover:bg-slate-200/60"
                                                            onClick={() => toggleInvoiceExpanded(group.invoiceNo)}
                                                        >
                                                            <td className="sticky left-0 z-20 bg-slate-100/80 hover:bg-slate-200/60 border-b px-4 py-3 font-bold text-slate-900">
                                                                <div className="flex items-center gap-2">
                                                                    <span className="text-slate-500 w-4 text-center">
                                                                        {isExpanded ? "▼" : "▶"}
                                                                    </span>
                                                                    <span>
                                                                        Invoice: {group.invoiceNo}
                                                                    </span>
                                                                </div>
                                                            </td>
                                                            <td colSpan={PENDING_COLUMNS.length} className="border-b px-4 py-3 font-semibold text-slate-700">
                                                                <div className="flex gap-6 text-sm">
                                                                    <span>Date: <span className="text-slate-900">{formatDateDash(group.invoiceDate)}</span></span>
                                                                    <span>Vendor: <span className="text-slate-900">{group.vendorName}</span></span>
                                                                    <span className="text-slate-500 font-normal">({group.records.length} lift{group.records.length > 1 ? "s" : ""})</span>
                                                                </div>
                                                            </td>
                                                        </tr>

                                                        {/* Child Rows */}
                                                        {isExpanded && group.records.map((rec) => {
                                                            const isChecked = selectedPendingIds.has(rec.id);
                                                            return (
                                                                <tr key={rec.id} className={cn("group transition-colors", isChecked ? "bg-blue-50/50 hover:bg-blue-100/50" : "hover:bg-gray-50")}>
                                                                    <td className={cn("sticky left-0 z-20 border-b text-center px-4 py-2 transition-colors", isChecked ? "bg-blue-50 group-hover:bg-blue-100/50" : "bg-white group-hover:bg-gray-50")}>
                                                                        <div className="flex items-center justify-center gap-3">
                                                                            <input
                                                                                type="checkbox"
                                                                                checked={isChecked}
                                                                                onChange={(e) => handleCheckboxChange(rec, e.target.checked)}
                                                                                className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                                                                            />
                                                                            <Button
                                                                                variant="outline"
                                                                                size="sm"
                                                                                onClick={() => openForm([rec])}
                                                                                className="h-8 px-3 text-xs font-medium border-slate-200 hover:bg-slate-50 hover:text-slate-900 transition-colors whitespace-nowrap"
                                                                            >
                                                                                Serial Generation
                                                                            </Button>
                                                                        </div>
                                                                    </td>
                                                                    {PENDING_COLUMNS.map((col) => (
                                                                        <td key={col.key} className="border-b px-4 py-2 text-center text-slate-700">
                                                                            {renderCell(rec.data, col.key)}
                                                                        </td>
                                                                    ))}
                                                                </tr>
                                                            );
                                                        })}
                                                    </React.Fragment>
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
                                                                <div className="flex items-center justify-center gap-1">
                                                                    <Button
                                                                        variant="ghost"
                                                                        size="sm"
                                                                        className="h-8 w-8 p-0 text-blue-600 hover:text-blue-800 hover:bg-blue-50"
                                                                        onClick={() => openHistoryDetails(rec)}
                                                                        title="View Details"
                                                                    >
                                                                        <Eye className="h-4 w-4" />
                                                                    </Button>
                                                                    <Button
                                                                        variant="ghost"
                                                                        size="sm"
                                                                        className="h-8 w-8 p-0 text-green-600 hover:text-green-800 hover:bg-green-50"
                                                                        onClick={() => handleDownloadAllPDF(rec)}
                                                                        disabled={pdfGeneratingId !== null}
                                                                        title="Download PDF"
                                                                    >
                                                                        {pdfGeneratingId === rec.data.indentNo ? (
                                                                            <Loader2 className="h-4 w-4 animate-spin text-green-600" />
                                                                        ) : (
                                                                            <Download className="h-4 w-4" />
                                                                        )}
                                                                    </Button>
                                                                </div>
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
                <DialogContent className="sm:max-w-2xl max-h-[90vh] flex flex-col">
                    <DialogHeader className="shrink-0 border-b pb-4">
                        <DialogTitle>Serial Generation</DialogTitle>
                        {selectedRecords.length > 0 && (
                            <div className="flex flex-col gap-2 mt-2">
                                <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-gray-500">
                                    <span>Invoice: <span className="font-medium text-gray-700">{selectedRecords[0].data.invoiceNo || "-"}</span></span>
                                    <span>Vendor: <span className="font-medium text-gray-700">{selectedRecords[0].data.vendorName}</span></span>
                                    <span>Total Lifts: <span className="font-medium text-gray-700">{selectedRecords.length}</span></span>
                                </div>
                                <div className="flex items-center justify-between mt-2 flex-wrap gap-4">
                                    <div className="flex items-center gap-2">
                                        <span className="text-sm font-medium text-gray-700">Yes / No Toggle:</span>
                                        <select
                                            value={isSerialEnabled ? "Yes" : "No"}
                                            onChange={(e) => setIsSerialEnabled(e.target.value === "Yes")}
                                            className="h-8 rounded-md border border-slate-200 bg-white px-2 py-1 text-sm font-semibold text-slate-700 shadow-sm focus:border-amber-500 focus:outline-none"
                                        >
                                            <option value="Yes">Yes</option>
                                            <option value="No">No</option>
                                        </select>
                                    </div>
                                    
                                    <div className="flex items-center gap-2">
                                        <span className="text-sm font-medium text-gray-700">Serial Mode:</span>
                                        <Button
                                            type="button"
                                            size="sm"
                                            variant={isAutoMode ? "default" : "outline"}
                                            className={
                                                !isSerialEnabled 
                                                ? "bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed min-w-[80px]"
                                                : isAutoMode ? "bg-blue-600 hover:bg-blue-700 text-white min-w-[80px]" : "border-amber-500 text-amber-600 hover:bg-amber-50 min-w-[80px]"
                                            }
                                            onClick={() => {
                                                if (isSerialEnabled) {
                                                    setIsAutoMode(!isAutoMode);
                                                }
                                            }}
                                            disabled={!isSerialEnabled || (isAutoMode && isCheckingSequence)}
                                        >
                                            {isAutoMode && isCheckingSequence ? (
                                                <><Loader2 className="w-3 h-3 animate-spin mr-1.5" />Auto</>
                                            ) : (
                                                isAutoMode ? "Auto" : "Manual"
                                            )}
                                        </Button>
                                    </div>
                                </div>
                            </div>
                        )}
                    </DialogHeader>

                    <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
                        {/* Scrollable sections */}
                        <div className="flex-1 overflow-y-auto space-y-6 py-4 pr-1">
                            {selectedRecords.map((rec) => {
                                const recEntries = entriesMap[rec.id] || [];
                                return (
                                    <div key={rec.id} className="border rounded-lg p-3 space-y-3 bg-white shadow-sm">
                                        <div className="bg-slate-50 px-3 py-2 -mx-3 -mt-3 rounded-t-lg border-b flex flex-wrap justify-between items-center text-xs font-semibold text-slate-700">
                                            <div className="flex gap-3">
                                                <span>Indent: <span className="font-bold text-slate-900">{rec.data.indentNo}</span></span>
                                                <span>Lift: <span className="font-bold text-slate-900">{rec.data.liftNo || "-"}</span></span>
                                            </div>
                                            <div className="flex gap-3">
                                                <span>Item: <span className="font-bold text-slate-900">{rec.data.itemName}</span></span>
                                                <span>Qty: <span className="font-bold text-slate-900">{rec.data.receivedQty}</span></span>
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-12 gap-2 text-xs font-semibold text-gray-500 uppercase tracking-wide px-1 py-1 border-b">
                                            <div className="col-span-1 text-center">#</div>
                                            <div className="col-span-10">Serial No. *</div>
                                            <div className="col-span-1 text-center">QR</div>
                                        </div>

                                        <div className="space-y-2">
                                            {recEntries.map((entry, idx) => {
                                                return (
                                                    <div key={idx} className="grid grid-cols-12 gap-2 items-center px-1">
                                                        <div className="col-span-1 text-center text-sm font-medium text-gray-500">
                                                            {idx + 1}
                                                        </div>
                                                        <div className="col-span-10">
                                                            <Input
                                                                value={entry.serialNo}
                                                                onChange={(e) => updateEntry(rec.id, idx, e.target.value)}
                                                                placeholder={isAutoMode ? "Auto-generated" : "Enter Serial Number"}
                                                                className={`h-8 text-sm ${isAutoMode || !isSerialEnabled ? "bg-slate-50 font-mono" : ""}`}
                                                                required
                                                                readOnly={isAutoMode || !isSerialEnabled}
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
                                                                        onClick={() => handlePreview(rec.id, idx)}
                                                                        disabled={!entry.serialNo.trim() || !isSerialEnabled}
                                                                    >
                                                                        <Eye className="h-4 w-4" />
                                                                    </Button>
                                                                </PopoverTrigger>
                                                                <PopoverContent className="w-[420px] p-2 bg-white" side="left">
                                                                    <div className="flex flex-col items-center gap-2">
                                                                        <span className="text-xs font-semibold text-gray-500">Label Preview</span>
                                                                        {previewContent[`${rec.id}_${idx}`] ? (
                                                                            <div
                                                                                dangerouslySetInnerHTML={{ __html: previewContent[`${rec.id}_${idx}`] }}
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
                                    : `Submit (${selectedRecords.reduce((acc, rec) => acc + (entriesMap[rec.id]?.length || 0), 0)} items across ${selectedRecords.length} lift${selectedRecords.length > 1 ? "s" : ""})`
                                }
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            {/* ── DIRECT SERIAL DIALOG ── */}
            <Dialog open={directFormOpen} onOpenChange={setDirectFormOpen}>
                <DialogContent className="sm:max-w-lg max-h-[90vh] flex flex-col p-0 overflow-hidden">
                    <DialogHeader className="p-6 pb-2 shrink-0 border-b">
                        <DialogTitle className="text-xl font-bold">Direct Serial Generation</DialogTitle>
                    </DialogHeader>

                    <form onSubmit={handleDirectSubmit} className="flex flex-col flex-1 overflow-hidden">
                        {/* Scrollable Form Body */}
                        <div className="flex-1 overflow-y-auto p-6 space-y-6">

                            {/* Section 1: Product & Purchase Details */}
                            <div className="space-y-4">
                                <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider border-b pb-1">Product Details</h3>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-1.5 col-span-2">
                                        <Label className="text-sm font-semibold text-slate-700">Item Name *</Label>
                                        <Combobox
                                            options={Object.keys(itemCodeMap)}
                                            value={directForm.itemName}
                                            onChange={(val) => setDirectForm(prev => ({ ...prev, itemName: val }))}
                                            placeholder="Search and select item"
                                            searchPlaceholder="Type item name..."
                                        />
                                    </div>
                                    <div className="space-y-1.5 col-span-2">
                                        <Label className="text-sm font-semibold text-slate-700">Vendor Name *</Label>
                                        <Combobox
                                            options={Object.keys(vendorCodes)}
                                            value={directForm.vendorName}
                                            onChange={(val) => setDirectForm(prev => ({ ...prev, vendorName: val }))}
                                            placeholder="Search and select vendor"
                                            searchPlaceholder="Type vendor name..."
                                        />
                                    </div>
                                    <div className="space-y-1.5">
                                        <Label className="text-sm font-semibold text-slate-700">Invoice Date *</Label>
                                        <Input
                                            type="date"
                                            value={directForm.invoiceDate}
                                            onChange={(e) => setDirectForm(prev => ({ ...prev, invoiceDate: e.target.value }))}
                                            className="h-9 bg-white border-slate-200 focus:ring-amber-500 focus:border-amber-500"
                                            required
                                        />
                                    </div>
                                    <div className="space-y-1.5">
                                        <Label className="text-sm font-semibold text-slate-700">Warranty (Months) *</Label>
                                        <Input
                                            type="number"
                                            min="0"
                                            value={directForm.duration}
                                            onChange={(e) => setDirectForm(prev => ({ ...prev, duration: e.target.value }))}
                                            placeholder="Warranty duration in months"
                                            className="h-9 bg-white border-slate-200 focus:ring-amber-500 focus:border-amber-500"
                                            required
                                        />
                                    </div>
                                    <div className="space-y-1.5">
                                        <Label className="text-sm font-semibold text-slate-700">Quantity *</Label>
                                        <Input
                                            type="number"
                                            value={directForm.quantity}
                                            onChange={(e) => {
                                                const val = e.target.value;
                                                setDirectForm(prev => ({
                                                    ...prev,
                                                    quantity: val === "" ? "" : parseInt(val) || 0
                                                }));
                                            }}
                                            className="h-9 bg-white border-slate-200 focus:ring-amber-500 focus:border-amber-500"
                                            required
                                        />
                                    </div>
                                    <div className="space-y-1.5 flex flex-col justify-end">
                                        <div className="flex items-center gap-2 mb-1">
                                            <span className="text-sm font-semibold text-slate-700">Serial Mode:</span>
                                            <Button
                                                type="button"
                                                size="sm"
                                                variant={directIsAutoMode ? "default" : "outline"}
                                                className={directIsAutoMode ? "bg-blue-600 hover:bg-blue-700 text-white min-w-[80px] h-8" : "border-amber-500 text-amber-600 hover:bg-amber-50 min-w-[80px] h-8"}
                                                onClick={() => setDirectIsAutoMode(!directIsAutoMode)}
                                                disabled={directIsAutoMode && directIsCheckingSequence && directEntries[0]?.serialNo?.includes("Loading...")}
                                            >
                                                {directIsAutoMode && directIsCheckingSequence ? (
                                                    <><Loader2 className="w-3 h-3 animate-spin mr-1.5" />Auto</>
                                                ) : (
                                                    directIsAutoMode ? "Auto" : "Manual"
                                                )}
                                            </Button>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Section 2: Serial Numbers List */}
                            <div className="space-y-3 pt-2">
                                <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider border-b pb-1">Serial Numbers</h3>
                                <div className="grid grid-cols-12 gap-2 text-xs font-semibold text-gray-400 uppercase tracking-wide px-1 py-1">
                                    <div className="col-span-1 text-center">#</div>
                                    <div className="col-span-10">Serial No. *</div>
                                    <div className="col-span-1 text-center">QR</div>
                                </div>

                                <div className="space-y-2">
                                    {directEntries.map((entry, idx) => (
                                        <div key={idx} className="grid grid-cols-12 gap-2 items-center px-1">
                                            <div className="col-span-1 text-center text-sm font-medium text-gray-500">
                                                {idx + 1}
                                            </div>
                                            <div className="col-span-10">
                                                <Input
                                                    value={entry.serialNo}
                                                    onChange={(e) => updateDirectEntry(idx, e.target.value)}
                                                    placeholder={directIsAutoMode ? "Auto-generated" : "Enter Serial Number"}
                                                    className={`h-8 text-sm ${directIsAutoMode ? "bg-gray-50 font-mono" : ""}`}
                                                    required
                                                    readOnly={directIsAutoMode}
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
                                                            onClick={() => handleDirectPreview(idx)}
                                                            disabled={!entry.serialNo.trim() || !directForm.itemName}
                                                        >
                                                            <Eye className="h-4 w-4" />
                                                        </Button>
                                                    </PopoverTrigger>
                                                    <PopoverContent className="w-[420px] p-2 bg-white" side="left">
                                                        <div className="flex flex-col items-center gap-2">
                                                            <span className="text-xs font-semibold text-gray-500">Label Preview</span>
                                                            {directPreviewContent[idx] ? (
                                                                <div
                                                                    dangerouslySetInnerHTML={{ __html: directPreviewContent[idx] }}
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
                                    ))}
                                </div>
                            </div>
                        </div>

                        {/* Sticky Footer */}
                        <DialogFooter className="shrink-0 p-6 border-t bg-slate-50">
                            <Button type="button" variant="outline" onClick={() => setDirectFormOpen(false)} disabled={isSubmitting}>
                                Cancel
                            </Button>
                            <Button
                                type="submit"
                                disabled={
                                    isSubmitting ||
                                    !directForm.itemName ||
                                    !directForm.vendorName ||
                                    !directForm.invoiceDate ||
                                    !directForm.duration ||
                                    directEntries.length === 0 ||
                                    directEntries.some(e => e.serialNo.trim() === "" || e.serialNo.includes("Loading..."))
                                }
                            >
                                {isSubmitting
                                    ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Submitting...</>
                                    : `Submit (${directEntries.length} item${directEntries.length > 1 ? "s" : ""})`
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
                                            <LocalQRPreview
                                                itemName={selectedHistoryRecord.data.itemName}
                                                itemCode={itemCodeMap[selectedHistoryRecord.data.itemName] || "N/A"}
                                                serialNo={selectedHistoryRecord.data.serials[0].serialNo}
                                                expiryDate={selectedHistoryRecord.data.productExpiry}
                                            />
                                        </div>
                                        {selectedHistoryRecord.data.serials[0].qrLink && (
                                            <a
                                                href={getGoogleDriveViewLink(selectedHistoryRecord.data.serials[0].qrLink)}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-600 hover:text-blue-800 hover:underline transition-colors mt-1"
                                            >
                                                <ExternalLink className="w-3.5 h-3.5" />
                                                View Original Document in Drive
                                            </a>
                                        )}
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
