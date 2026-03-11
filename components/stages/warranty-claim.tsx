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

// ─── WARRANTY sheet column map (0-based, headers row 5, data from row 7) ──────
// A(0): Indent No.  B(1): Lift No.  C(2): Vendor Name  D(3): Invoice No.
// E(4): Invoice Date  F(5): Invoice Copy  G(6): PO Number  H(7): PO Copy
// I(8): Qty  J(9): Item-Name  K(10): JSON [{ serialNo, startDate, endDate }]
// L(11): JSON [startDate]  M(12): JSON [endDate]
// N(13): Planned      O(14): Actual

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
    { key: "totalClaimed", label: "Total Claimed" },
    { key: "pendingQty", label: "Pending Qty" },
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
    { key: "claimedQty", label: "Claimed Qty" },
    { key: "serialNumbers", label: "Serial Numbers" },
];

const formatDate = (val: any): string => {
    if (!val || String(val).trim() === "" || val === "-") return "-";
    const str = String(val).trim();
    const d = new Date(str.includes(" ") && !str.includes("T") ? str.replace(" ", "T") : str);
    if (isNaN(d.getTime())) return str;
    return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
};

export default function WarrantyClaim() {
    const [pendingRecords, setPendingRecords] = useState<any[]>([]);
    const [historyRecords, setHistoryRecords] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [searchTerm, setSearchTerm] = useState("");
    const [activeTab, setActiveTab] = useState<"pending" | "history">("pending");

    const [open, setOpen] = useState(false);
    const [selectedRecord, setSelectedRecord] = useState<any>(null);
    const [claimQty, setClaimQty] = useState<string>("");
    const [entries, setEntries] = useState<{ serialNo: string }[]>([]);
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Local timestamp
    const localTimestamp = () => {
        const now = new Date();
        const pad = (n: number) => String(n).padStart(2, "0");
        return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
    };

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
            const history: any[] = [];

            const warrantyMap = new Map();

            if (warrantyJson.success && Array.isArray(warrantyJson.data)) {
                // WARRANTY data starts from row 7 → slice(6), index = i+7
                const allRows = warrantyJson.data
                    .slice(6)
                    .map((row: any, i: number) => ({ row, sheetIndex: i + 7 }))
                    .filter(({ row }: any) => row[0] && String(row[0]).trim() !== ""); // Filter by Indent No.

                allRows.forEach(({ row, sheetIndex }: any) => {
                    const receivedQty = row[8] || "";
                    const totalClaimed = row[16] || "0"; // Q
                    const pendingQty = row[17] || receivedQty; // R (fallback to received if empty on new rows)

                    const planned = String(row[13] || "").trim(); // N
                    const actual = String(row[14] || "").trim(); // O
                    const hasPlan = planned !== "" && planned !== "-";
                    const hasActual = actual !== "" && actual !== "-";

                    const data = {
                        indentNo: String(row[0] || "").trim(), // A
                        liftNo: row[1] || "",                 // B
                        vendorName: row[2] || "",                 // C
                        invoiceNo: row[3] || "",                 // D
                        invoiceDate: row[4] || "",                 // E
                        invoiceCopy: row[5] || "",                 // F
                        poNumber: row[6] || "",                 // G
                        poCopy: row[7] || "",                 // H
                        receivedQty,
                        itemName: row[9] || "",                 // J
                        pendingQty: pendingQty.toString(),
                        totalClaimed,
                    };

                    const id = `${data.indentNo}_${data.liftNo || ""}`;
                    warrantyMap.set(id, data);

                    const pQty = parseInt(pendingQty) || 0;
                    if (hasPlan && !hasActual && pQty > 0) {
                        pending.push({ id: `pending_${id}`, sheetIndex, data });
                    }
                });
            }

            if (claimJson.success && Array.isArray(claimJson.data)) {
                // Warranty_Claim data starts from row 6 -> slice(5)
                const claimRows = claimJson.data.slice(5).filter((row: any) => row[0] && String(row[0]).trim() !== "");

                claimRows.forEach((row: any, i: number) => {
                    const indentNo = String(row[0] || "").trim();
                    const liftNo = row[1] || "";
                    const snJson = row[2] || "[]";
                    const claimedQty = row[3] || "";

                    const id = `${indentNo}_${liftNo}`;
                    const wData = warrantyMap.get(id) || {};

                    let serialNumbers = snJson;
                    try {
                        const parsed = JSON.parse(snJson);
                        if (Array.isArray(parsed)) {
                            serialNumbers = parsed.join(", ");
                        }
                    } catch (e) { }

                    history.push({
                        id: `history_${id}_${i}`,
                        data: {
                            ...wData,
                            indentNo,
                            liftNo,
                            claimedQty,
                            serialNumbers,
                        }
                    });
                });
            }

            setPendingRecords(pending);
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
            String(r.data.poNumber || "").toLowerCase().includes(lower) ||
            String(r.data.invoiceNo || "").toLowerCase().includes(lower)
        );
    }, [searchTerm]);

    const pending = useMemo(() => applySearch(pendingRecords), [pendingRecords, applySearch]);
    const history = useMemo(() => applySearch(historyRecords), [historyRecords, applySearch]);

    // ─── Open form ────────────────────────────────────────────────────────────
    const openForm = useCallback((record: any) => {
        setSelectedRecord(record);
        setClaimQty("");
        setEntries([]);
        setOpen(true);
    }, []);

    const handleQtyChange = useCallback((val: string) => {
        const rawQty = parseInt(val) || 0;
        const maxQty = selectedRecord?.data.pendingQty ? parseInt(selectedRecord.data.pendingQty) : 999;

        let qty = rawQty;
        if (rawQty > maxQty) {
            qty = maxQty;
            val = maxQty.toString();
        }

        setClaimQty(val);
        setEntries(Array.from({ length: Math.min(qty, 100) }, () => ({ serialNo: "" })));
    }, [selectedRecord]);

    const updateEntry = useCallback((idx: number, serialNo: string) => {
        setEntries((prev) => {
            const next = [...prev];
            next[idx] = { serialNo };
            return next;
        });
    }, []);

    const formValid = claimQty && parseInt(claimQty) > 0 && entries.every((e) => e.serialNo.trim());

    // ─── Submit ───────────────────────────────────────────────────────────────
    const handleSubmit = useCallback(async (e: React.FormEvent) => {
        e.preventDefault();
        const API = process.env.NEXT_PUBLIC_API_URI;
        if (!selectedRecord || !API) return;

        setIsSubmitting(true);
        try {
            const ts = localTimestamp();
            const currentPending = parseInt(selectedRecord.data.pendingQty) || parseInt(selectedRecord.data.receivedQty) || 0;
            const claiming = parseInt(claimQty) || 0;
            const newPending = Math.max(0, currentPending - claiming);

            // 1. batchInsert into "Warranty_Claim" from row 6
            // A=Indent, B=Lift, C=Serial No, D=Qty
            const claimRows = entries.map((entry) => {
                const row = new Array(4).fill("");
                row[0] = selectedRecord.data.indentNo;      // A
                row[1] = selectedRecord.data.liftNo;        // B
                row[2] = entry.serialNo;                    // C
                row[3] = "1";                               // D (1 per serial no)
                return row;
            });

            const insertParams = new URLSearchParams();
            insertParams.append("action", "batchInsert");
            insertParams.append("sheetName", "Warranty_Claim");
            insertParams.append("rowsData", JSON.stringify(claimRows));
            insertParams.append("startRow", "6");

            // 2. Update WARRANTY sheet (Col O: Actual) ONLY if fully claimed
            let updateResPromise = Promise.resolve({ ok: true, json: async () => ({ success: true }) } as any);

            if (newPending <= 0) {
                const warrantyRow = new Array(16).fill("");
                warrantyRow[14] = ts; // O: Actual

                const updateParams = new URLSearchParams();
                updateParams.append("action", "update");
                updateParams.append("sheetName", "WARRANTY");
                updateParams.append("rowData", JSON.stringify(warrantyRow));
                updateParams.append("rowIndex", selectedRecord.sheetIndex.toString());

                updateResPromise = fetch(API, { method: "POST", body: updateParams });
            }

            const [insertRes, updateRes] = await Promise.all([
                fetch(API, { method: "POST", body: insertParams }),
                updateResPromise,
            ]);

            const insertJson = await insertRes.json();
            const updateJson = await updateRes.json();

            if (insertJson.success && updateJson.success) {
                setOpen(false);
                fetchData();
            } else {
                console.error("Insert:", insertJson, "Update:", updateJson);
            }
        } catch (e) {
            console.error("Submit error:", e);
        } finally {
            setIsSubmitting(false);
        }
    }, [selectedRecord, claimQty, entries, fetchData]);

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
        if (key === "invoiceDate" || key === "planned" || key === "actual") {
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
                        <ShieldAlert className="w-7 h-7 text-indigo-600" />
                        <div>
                            <h2 className="text-2xl font-bold">Warranty Claim</h2>
                            <p className="text-gray-500 text-sm mt-0.5">
                                Track and process Warranty Claims for filed items.
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
                    <Loader2 className="w-8 h-8 animate-spin mb-4 text-indigo-600" />
                    <p className="text-lg animate-pulse text-indigo-900 font-medium">Loading records...</p>
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
                                <p className="text-lg">No pending Warranty Claims</p>
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
                                                        Warranty Claim
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
                                <p className="text-lg">No completed Warranty Claims</p>
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
                <DialogContent className="max-h-[90vh] flex flex-col p-4 w-[400px] max-w-[95vw]">
                    <DialogHeader className="shrink-0 mb-2">
                        <DialogTitle className="text-lg">Warranty Claim Form</DialogTitle>
                        {selectedRecord && (
                            <div className="text-xs text-gray-500 mt-1 space-y-0.5">
                                <p>Item: <span className="font-medium text-gray-700">{selectedRecord.data.itemName}</span></p>
                                <p>Indent: <span className="font-medium text-gray-700">{selectedRecord.data.indentNo}</span></p>
                                <p>Pending Qty: <span className="font-medium text-blue-600">{selectedRecord.data.pendingQty}</span></p>
                            </div>
                        )}
                    </DialogHeader>

                    <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
                        <div className="mb-3 shrink-0 px-1">
                            <label className="text-xs font-medium mb-1 block text-gray-600">Claim Qty</label>
                            <Input
                                type="number"
                                min="1"
                                max={selectedRecord?.data.pendingQty || 999}
                                value={claimQty}
                                onChange={(e) => handleQtyChange(e.target.value)}
                                placeholder="Qty..."
                                className="h-8 text-sm w-full"
                                required
                            />
                        </div>

                        {entries.length > 0 && (
                            <div className="flex-1 overflow-y-auto space-y-2 px-1 pb-1">
                                <label className="text-xs font-medium block text-gray-600">Serial Numbers</label>
                                {entries.map((entry, idx) => (
                                    <div key={idx} className="flex items-center gap-2">
                                        <span className="text-xs text-gray-400 w-5 font-medium shrink-0">{idx + 1}.</span>
                                        <Input
                                            placeholder={`SN ${idx + 1}...`}
                                            value={entry.serialNo}
                                            onChange={(e) => updateEntry(idx, e.target.value)}
                                            className="h-8 text-sm w-full"
                                            required
                                        />
                                    </div>
                                ))}
                            </div>
                        )}

                        <DialogFooter className="shrink-0 pt-3 border-t mt-3 flex justify-end gap-2">
                            <Button type="button" variant="outline" size="sm" className="h-8 text-xs" onClick={() => setOpen(false)} disabled={isSubmitting}>
                                Cancel
                            </Button>
                            <Button type="submit" size="sm" className="h-8 text-xs px-3" disabled={!formValid || isSubmitting}>
                                {isSubmitting ? (
                                    <><Loader2 className="w-3 h-3 mr-1.5 animate-spin" /> ...</>
                                ) : "Submit"}
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>
        </div>
    );
}
