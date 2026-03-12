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
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, Search, ShieldAlert } from "lucide-react";
import { toast } from "sonner";

// ─── RECEIVING-ACCOUNTS column map (0-based) ──────────────────────────────────
// B(1): Indent No.  C(2): Lift No.  D(3): Vendor Name  E(4): PO No.
// H(7): Item Name   I(8): Lifting Qty  X(23): Invoice Date  Y(24): Invoice No.
// Z(25): Received Qty  DA(104): Warranty Claim  DB(105): Duration
// DC(106): Warranty Expiry  DD(107): Product Expiry
// DE(108): Planned   DF(109): Actual

// ─── INDENT-LIFT sheet column map (0-based, headers row 8, data from row 9) ──
// B(1): Indent No.  BG(58): PO Copy

// ─── WARRANTY sheet column map (0-based, headers row 5, data from row 7) ──────
// A(0): Indent No.  B(1): Lift No.  C(2): Vendor Name  D(3): Invoice No.
// E(4): Invoice Date  F(5): Invoice Copy  G(6): PO Number  H(7): PO Copy
// I(8): Qty  J(9): Item-Name  K(10): Serial No
// L(11): Start Date  M(12): End Date

const PENDING_COLUMNS = [
    { key: "indentNo", label: "Indent #" },
    { key: "liftNo", label: "Lift No." },
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
    { key: "indentNo", label: "Indent #" },
    { key: "liftNo", label: "Lift No." },
    { key: "vendorName", label: "Vendor Name" },
    { key: "itemName", label: "Item Name" },
    { key: "invoiceNo", label: "Invoice No." },
    { key: "invoiceDate", label: "Invoice Date" },
    { key: "invoiceCopy", label: "Invoice Copy" },
    { key: "poNumber", label: "PO Number" },
    { key: "poCopy", label: "PO Copy" },
    { key: "receivedQty", label: "Received Qty" },
    { key: "planned", label: "Planned" },
    { key: "actual", label: "Completed On" },
];

interface WarrantyEntry {
    serialNo: string;
}

// Local timestamp — no timezone suffix
const localTimestamp = () => {
    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
};

const formatDate = (val: any): string => {
    if (!val || String(val).trim() === "" || val === "-") return "-";
    const str = String(val).trim();
    const d = new Date(str.includes(" ") && !str.includes("T") ? str.replace(" ", "T") : str);
    if (isNaN(d.getTime())) return str;
    return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
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

    // ─── Fetch ───────────────────────────────────────────────────────────────
    const fetchData = useCallback(async () => {
        const API = process.env.NEXT_PUBLIC_API_URI;
        if (!API) return;
        setIsLoading(true);
        try {
            // Need INDENT-LIFT for PO Copy (col BG = 58)
            const [raRes, fmsRes] = await Promise.all([
                fetch(`${API}?sheet=RECEIVING-ACCOUNTS&action=getAll`),
                fetch(`${API}?sheet=INDENT-LIFT&action=getAll`)
            ]);
            const [raJson, fmsJson] = await Promise.all([raRes.json(), fmsRes.json()]);

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
        const qty = Math.max(1, parseInt(record.data.receivedQty) || 1);
        setEntries(Array.from({ length: qty }, () => ({
            serialNo: "",
        })));
        setOpen(true);
    }, []);

    const updateEntry = useCallback((idx: number, field: keyof WarrantyEntry, value: string) => {
        setEntries((prev) => {
            const next = [...prev];
            next[idx] = { ...next[idx], [field]: value };
            return next;
        });
    }, []);

    // ─── Submit ───────────────────────────────────────────────────────────────
    const handleSubmit = useCallback(async (e: React.FormEvent) => {
        e.preventDefault();
        const API = process.env.NEXT_PUBLIC_API_URI;
        if (!selectedRecord || !API) return;

        setIsSubmitting(true);
        try {
            const ts = localTimestamp();

            // 1. batchInsert new rows into WARRANTY sheet from row 7
            const rowsData = entries.map((entry) => {
                const warrantyRow = new Array(8).fill("");
                
                // Format the warranty expiry strictly as YYYY-MM-DD
                let formattedWarrantyEnd = selectedRecord.data.warrantyExpiry;
                if (formattedWarrantyEnd && formattedWarrantyEnd !== "-") {
                    const d = new Date(formattedWarrantyEnd);
                    if (!isNaN(d.getTime())) {
                        const pad = (n: number) => String(n).padStart(2, "0");
                        formattedWarrantyEnd = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
                    }
                }

                warrantyRow[0] = selectedRecord.data.indentNo;    // A: Indent No.
                warrantyRow[1] = selectedRecord.data.liftNo;      // B: Lift No.
                warrantyRow[2] = "";                              // C: Serial Code - auto generated
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

            // 2. Update RECEIVING-ACCOUNTS col DF (index 109) = Actual timestamp
            //    Leave Planned (DE=108) untouched (sent as "")
            const raRow = new Array(110).fill("");
            raRow[109] = ts; // DF: Actual

            const updateParams = new URLSearchParams();
            updateParams.append("action", "update");
            updateParams.append("sheetName", "RECEIVING-ACCOUNTS");
            updateParams.append("rowData", JSON.stringify(raRow));
            updateParams.append("rowIndex", selectedRecord.raIndex.toString());

            // Fire both requests in parallel
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
    }, [selectedRecord, entries, fetchData]);

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
            return formatDate(val);
        }

        if (!val || String(val).trim() === "" || val === "-") return "-";
        return String(val);
    };

    // ─── Render ───────────────────────────────────────────────────────────────
    return (
        <div className="p-6">
            {/* Header */}
            <div className="mb-6 p-6 bg-white border rounded-lg shadow-sm">
                <div className="flex items-start justify-between flex-wrap gap-4">
                    <div className="flex items-center gap-3">
                        <ShieldAlert className="w-7 h-7 text-amber-600" />
                        <div>
                            <h2 className="text-2xl font-bold">Warranty Information</h2>
                            <p className="text-gray-500 text-sm mt-0.5">
                                Track and process Warranty Information for received items.
                            </p>
                        </div>
                    </div>
                    <div className="relative flex-1 max-w-sm">
                        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-500" />
                        <Input
                            placeholder="Search by Indent, Item, Vendor, PO, Invoice..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="pl-9 bg-white"
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
                <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)} className="w-full">
                    <TabsList className="grid w-full grid-cols-2">
                        <TabsTrigger value="pending">Pending ({pending.length})</TabsTrigger>
                        <TabsTrigger value="history">History ({history.length})</TabsTrigger>
                    </TabsList>

                    {/* ── PENDING ── */}
                    <TabsContent value="pending" className="mt-6">
                        {pending.length === 0 ? (
                            <div className="text-center py-12 text-gray-500">
                                <ShieldAlert className="w-10 h-10 mx-auto mb-3 text-gray-300" />
                                <p className="text-lg">No pending Warranty Information entries</p>
                            </div>
                        ) : (
                            <div className="border rounded-lg overflow-x-auto">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Actions</TableHead>
                                            {PENDING_COLUMNS.map((c) => (
                                                <TableHead key={c.key}>{c.label}</TableHead>
                                            ))}
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {pending.map((rec) => (
                                            <TableRow key={rec.id} className="hover:bg-gray-50">
                                                <TableCell>
                                                    <Button variant="outline" size="sm" onClick={() => openForm(rec)}>
                                                        Warranty Information
                                                    </Button>
                                                </TableCell>
                                                {PENDING_COLUMNS.map((col) => (
                                                    <TableCell key={col.key}>
                                                        {renderCell(rec.data, col.key)}
                                                    </TableCell>
                                                ))}
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </div>
                        )}
                    </TabsContent>

                    {/* ── HISTORY ── */}
                    <TabsContent value="history" className="mt-6">
                        {history.length === 0 ? (
                            <div className="text-center py-12 text-gray-500">
                                <ShieldAlert className="w-10 h-10 mx-auto mb-3 text-gray-300" />
                                <p className="text-lg">No completed Warranty Information entries</p>
                            </div>
                        ) : (
                            <div className="border rounded-lg overflow-x-auto">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            {HISTORY_COLUMNS.map((c) => (
                                                <TableHead key={c.key}>{c.label}</TableHead>
                                            ))}
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {history.map((rec) => (
                                            <TableRow key={rec.id} className="hover:bg-gray-50">
                                                {HISTORY_COLUMNS.map((col) => (
                                                    <TableCell key={col.key}>
                                                        {renderCell(rec.data, col.key)}
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

            {/* ── DIALOG ── */}
            <Dialog open={open} onOpenChange={setOpen}>
                <DialogContent className="sm:max-w-lg max-h-[90vh] flex flex-col">
                    <DialogHeader className="shrink-0">
                        <DialogTitle>Warranty Information</DialogTitle>
                        {selectedRecord && (
                            <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-gray-500 mt-1">
                                <span>Indent: <span className="font-medium text-gray-700">{selectedRecord.data.indentNo}</span></span>
                                <span>Vendor: <span className="font-medium text-gray-700">{selectedRecord.data.vendorName}</span></span>
                                <span>Item: <span className="font-medium text-gray-700">{selectedRecord.data.itemName}</span></span>
                                <span>Received Qty: <span className="font-medium text-gray-700">{selectedRecord.data.receivedQty}</span></span>
                            </div>
                        )}
                    </DialogHeader>

                    <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
                        {/* Column headers */}
                        <div className="grid grid-cols-12 gap-2 text-xs font-semibold text-gray-500 uppercase tracking-wide px-1 py-2 border-b shrink-0">
                            <div className="col-span-2 text-center">#</div>
                            <div className="col-span-10">Serial No. *</div>
                        </div>

                        {/* Scrollable rows */}
                        <div className="flex-1 overflow-y-auto space-y-2 py-3 pr-1">
                            {entries.map((entry, idx) => {
                                return (
                                    <div key={idx} className="grid grid-cols-12 gap-2 items-center px-1">
                                        <div className="col-span-2 text-center text-sm font-medium text-gray-500">
                                            {idx + 1}
                                        </div>
                                        <div className="col-span-10">
                                            <Input value={entry.serialNo}
                                                onChange={(e) => updateEntry(idx, "serialNo", e.target.value)}
                                                placeholder="Enter Serial Number" className="h-8 text-sm" required />
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
