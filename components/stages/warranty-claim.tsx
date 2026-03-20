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
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2, Search, ShieldAlert } from "lucide-react";
import { formatDate, parseSheetDate, getFmsTimestamp } from "@/lib/utils";

// ─── WARRANTY sheet column map (0-based, data from row 7) ──────
// A(0): Indent No.  B(1): Unit Tracking No.  C(2): Serial Code  D(3): Serial No.
// E(4): Vendor Name  F(5): Item-Name  G(6): Invoice Date  H(7): Warranty End
// I(8): Planned      J(9): Actual

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

const HISTORY_COLUMNS = [
    { key: "indentNo", label: "Indent No." },
    { key: "liftNo", label: "Unit Tracking No." },
    { key: "vendorName", label: "Vendor Name" },
    { key: "itemName", label: "Item Name" },
    { key: "invoiceDate", label: "Invoice Date" },
    { key: "serialNo", label: "Claimed Serial No." },
    { key: "warrantyEnd", label: "Warranty End" },
    { key: "planned", label: "Planned" },
    { key: "actual", label: "Actual" },
];


export default function WarrantyClaim() {
    const [pendingRecords, setPendingRecords] = useState<any[]>([]);
    const [historyRecords, setHistoryRecords] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [searchTerm, setSearchTerm] = useState("");
    const [activeTab, setActiveTab] = useState<"pending" | "history">("pending");

    const [selectedIds, setSelectedIds] = useState<string[]>([]);
    const [isSubmitting, setIsSubmitting] = useState(false);


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
                // WARRANTY data starts from row 7 (index 6, but we slice(6) -> index i + 7)
                // Wait, if startRow was 7 in insert, headers are at row 6, data at 7.
                // index 0 -> row 1, index 6 -> row 7.
                const allRows = warrantyJson.data
                    .slice(6)
                    .map((row: any, i: number) => ({ row, sheetIndex: i + 7 }))
                    .filter(({ row }: any) => row[0] && String(row[0]).trim() !== "");

                allRows.forEach(({ row, sheetIndex }: any) => {
                    const actual = String(row[9] || "").trim(); // J
                    const hasActual = actual !== "" && actual !== "-";

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
                        actual,                               // J
                    };

                    const id = `w_${data.indentNo}_${data.liftNo}_${data.serialNo}`;
                    warrantyMap.set(id, data);

                    if (!hasActual) {
                        pending.push({ id, sheetIndex, data });
                    }
                });
            }

            if (claimJson.success && Array.isArray(claimJson.data)) {
                // Warranty_Claim data starts from row 6 -> slice(5)
                const claimRows = claimJson.data.slice(6).filter((row: any) => row[0] && String(row[0]).trim() !== "");

                claimRows.forEach((row: any, i: number) => {
                    const indentNo = String(row[0] || "").trim();
                    const liftNo = row[1] || "";
                    const serialNo = row[2] || ""; // C
                    
                    const mapKey = `w_${indentNo}_${liftNo}_${serialNo}`;
                    const wVal = warrantyMap.get(mapKey);
                    let wData: any = wVal ? { ...wVal } : {
                        indentNo,
                        liftNo,
                        serialNo,
                    };

                    history.push({
                        id: `history_${i}_${indentNo}_${serialNo}`,
                        data: {
                            ...wData,
                            indentNo,
                            liftNo,
                            serialNo,
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
            r.data.serialNo?.toLowerCase().includes(lower)
        );
    }, [searchTerm]);

    const pending = useMemo(() => applySearch(pendingRecords), [pendingRecords, applySearch]);
    const history = useMemo(() => applySearch(historyRecords), [historyRecords, applySearch]);

    // ─── Selection ────────────────────────────────────────────────────────────
    const toggleSelection = useCallback((id: string) => {
        setSelectedIds((prev) => prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]);
    }, []);

    const toggleAll = useCallback(() => {
        if (selectedIds.length === pending.length) {
            setSelectedIds([]);
        } else {
            setSelectedIds(pending.map((p) => p.id));
        }
    }, [selectedIds, pending]);

    // ─── Submit ───────────────────────────────────────────────────────────────
    const handleBulkSubmit = useCallback(async () => {
        const API = process.env.NEXT_PUBLIC_API_URI;
        if (!API || selectedIds.length === 0) return;

        setIsSubmitting(true);
        try {
            const ts = getFmsTimestamp();
            
            // Find selected records
            const selectedRecords = pending.filter(p => selectedIds.includes(p.id));

            // Prepare batch insert for Warranty_Claim
            const claimRows = selectedRecords.map(rec => {
                const row = new Array(5).fill("");
                row[0] = rec.data.indentNo;      // A
                row[1] = rec.data.liftNo;        // B
                row[2] = rec.data.serialNo;      // C
                row[3] = "1";                    // D
                row[4] = ts;                     // E: Local Timestamp
                return row;
            });

            const insertParams = new URLSearchParams();
            insertParams.append("action", "batchInsert");
            insertParams.append("sheetName", "Warranty_Claim");
            insertParams.append("rowsData", JSON.stringify(claimRows));
            insertParams.append("startRow", "6");

            // Update WARRANTY sheet (Col J: Actual)
            const updatePromises = selectedRecords.map(rec => {
                const warrantyRow = new Array(10).fill("");
                warrantyRow[9] = ts; // J: Actual

                const updateParams = new URLSearchParams();
                updateParams.append("action", "update");
                updateParams.append("sheetName", "WARRANTY");
                updateParams.append("rowData", JSON.stringify(warrantyRow));
                updateParams.append("rowIndex", rec.sheetIndex.toString());

                return fetch(API, { method: "POST", body: updateParams });
            });

            await Promise.all([
                fetch(API, { method: "POST", body: insertParams }),
                ...updatePromises
            ]);

            setSelectedIds([]);
            fetchData();
        } catch (e) {
            console.error("Submit error:", e);
        } finally {
            setIsSubmitting(false);
        }
    }, [selectedIds, pending, fetchData]);

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
        if (
            key === "invoiceDate" ||
            key === "planned" ||
            key === "actual" ||
            key === "warrantyEnd"
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
                            <div className="flex items-center gap-4 flex-1 max-w-lg justify-end">
                                {selectedIds.length > 0 && activeTab === "pending" && (
                                    <Button 
                                        onClick={handleBulkSubmit} 
                                        disabled={isSubmitting} 
                                        className="bg-indigo-600 hover:bg-indigo-700 whitespace-nowrap text-white shadow-sm"
                                    >
                                        {isSubmitting ? (
                                            <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Submitting...</>
                                        ) : (
                                            `Submit Claim (${selectedIds.length})`
                                        )}
                                    </Button>
                                )}
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
                                        <thead className="sticky top-0 z-30 bg-slate-50 shadow-sm border-none">
                                            <tr className="hover:bg-transparent border-none">
                                                <th className="sticky left-0 z-40 bg-slate-50 w-[50px] border-b text-center px-4 py-3">
                                                    <Checkbox
                                                        checked={selectedIds.length > 0 && selectedIds.length === pending.length}
                                                        onCheckedChange={toggleAll}
                                                        className="translate-y-[2px]"
                                                    />
                                                </th>
                                                {PENDING_COLUMNS.map((c) => (
                                                    <th key={c.key} className="bg-slate-50 border-b text-center px-4 py-3 font-semibold text-slate-900 whitespace-nowrap">
                                                        {c.label}
                                                    </th>
                                                ))}
                                            </tr>
                                        </thead>
                                        <tbody className="bg-white">
                                            {pending.map((rec) => (
                                                <tr key={rec.id} className="hover:bg-gray-50 group transition-colors">
                                                    <td className="sticky left-0 z-20 bg-white group-hover:bg-gray-50 border-b text-center px-4 py-2">
                                                        <Checkbox
                                                            checked={selectedIds.includes(rec.id)}
                                                            onCheckedChange={() => toggleSelection(rec.id)}
                                                            className="translate-y-[2px]"
                                                        />
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
                                    <p className="text-lg text-black">No completed Warranty Claims</p>
                                </div>
                            ) : (
                                <div className="border rounded-lg overflow-x-auto h-[70vh] relative shadow-sm">
                                    <table className="w-full caption-bottom text-sm border-separate border-spacing-0 min-w-max">
                                        <thead className="sticky top-0 z-30 bg-slate-50 shadow-sm border-none">
                                            <tr className="hover:bg-transparent border-none">
                                                {HISTORY_COLUMNS.map((c) => (
                                                    <th key={c.key} className="bg-slate-50 border-b text-center px-4 py-3 font-semibold text-slate-900 whitespace-nowrap">
                                                        {c.label}
                                                    </th>
                                                ))}
                                            </tr>
                                        </thead>
                                        <tbody className="bg-white">
                                            {history.map((rec) => (
                                                <tr key={rec.id} className="hover:bg-indigo-50/50 transition-colors">
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
        </div>
    );
}
