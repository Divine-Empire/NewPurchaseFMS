"use client";

import React, { useState, useEffect } from "react";
import { toast } from "sonner";
import { Loader2, FileText, Search, RefreshCw, ClipboardCheck } from "lucide-react";
import {
    // Table, TableBody, TableCell, TableHead, TableHeader, TableRow removed in favor of standard HTML table
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from "@/components/ui/dialog";
import { formatDate, parseSheetDate, getFmsTimestamp } from "@/lib/utils";
import { useMemo } from "react";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { format } from "date-fns";

const SHEET_API_URL = process.env.NEXT_PUBLIC_API_URI;

export default function SubmitInvoiceHO() {
    const [sheetRecords, setSheetRecords] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [open, setOpen] = useState(false);
    const [activeTab, setActiveTab] = useState<"pending" | "history">("pending");
    const [searchTerm, setSearchTerm] = useState("");
    const [warehouseFilter, setWarehouseFilter] = useState("All");
    const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set());
    const [bulkError, setBulkError] = useState<string | null>(null);

    const [formData, setFormData] = useState({
        hardcopySubmitted: "",
        submissionDate: new Date(),
    });

    // Fetch Data
    const fetchData = async () => {
        if (!SHEET_API_URL) return;
        setIsLoading(true);
        try {
            const [liftRes, fmsRes] = await Promise.all([
                fetch(`${SHEET_API_URL}?sheet=RECEIVING-ACCOUNTS&action=getAll`, { cache: "no-store" }),
                fetch(`${SHEET_API_URL}?sheet=INDENT-LIFT&action=getAll`, { cache: "no-store" })
            ]);

            const liftJson = await liftRes.json();
            const fmsJson = await fmsRes.json();

            const fmsMap = new Map<string, any[]>();
            if (fmsJson.success && Array.isArray(fmsJson.data)) {
                fmsJson.data.slice(6).forEach((r: any) => {
                    if (r[1] && String(r[1]).trim()) {
                        fmsMap.set(String(r[1]).trim(), r);
                    }
                });
            }

            if (liftJson.success && Array.isArray(liftJson.data)) {
                const rows = liftJson.data.slice(6)
                    .map((row: any, i: number) => ({ row, originalIndex: i + 7 }))
                    .filter(({ row }: any) => row[1] && String(row[1]).trim() !== "")
                    .map(({ row, originalIndex }: any) => {
                        const indentNo = String(row[1]).trim();
                        const fmsRow = fmsMap.get(indentNo) || [];

                        const hasPlan = !!row[43] && String(row[43]).trim() !== "";
                        const hasActual = !!row[44] && String(row[44]).trim() !== "";

                        let status = "not_ready";
                        if (hasPlan && !hasActual) status = "pending";
                        else if (hasPlan && hasActual) status = "completed";

                        return {
                            id: `${indentNo}_${originalIndex}`,
                            rowIndex: originalIndex,
                            status,
                            data: {
                                indentNumber: indentNo,
                                category: fmsRow[3] || row[3],
                                itemName: fmsRow[4] || row[4],
                                quantity: row[25],
                                poNumber: fmsRow[54],
                                billAttachment: row[18],
                                invoiceNumber: row[24],
                                invoiceDate: row[23],
                                planDate: row[43],
                                actualDate: row[44],
                                hardcopySubmitted: row[46],
                                submissionDate: row[47],
                                warehouse: fmsRow[6] || "-",
                                basicValue: fmsRow[55],
                                totalWithTax: fmsRow[56],
                                vendorName: row[3],
                            }
                        };
                    });
                setSheetRecords(rows);
            }
        } catch (e) {
            console.error("Fetch error:", e);
        }
        setIsLoading(false);
    };

    useEffect(() => {
        fetchData();
    }, []);

    const pending = useMemo(() => sheetRecords
        .filter((r) => r.status === "pending")
        .filter((r) => {
            if (warehouseFilter === "NE Warehouse" && r.data.warehouse !== "NE Warehouse") return false;
            if (warehouseFilter === "Others" && r.data.warehouse === "NE Warehouse") return false;

            const searchLower = searchTerm.toLowerCase();
            return (
                r.data.indentNumber?.toLowerCase().includes(searchLower) ||
                r.data.itemName?.toLowerCase().includes(searchLower) ||
                r.data.vendorName?.toLowerCase().includes(searchLower) ||
                String(r.data.poNumber || "").toLowerCase().includes(searchLower) ||
                String(r.data.invoiceNumber || "").toLowerCase().includes(searchLower)
            );
        }), [sheetRecords, searchTerm, warehouseFilter]);

    const completed = useMemo(() => sheetRecords
        .filter((r) => r.status === "completed")
        .filter((r) => {
            if (warehouseFilter === "NE Warehouse" && r.data.warehouse !== "NE Warehouse") return false;
            if (warehouseFilter === "Others" && r.data.warehouse === "NE Warehouse") return false;

            const searchLower = searchTerm.toLowerCase();
            if (!searchLower) return true;
            return (
                r.data.indentNumber?.toLowerCase().includes(searchLower) ||
                r.data.itemName?.toLowerCase().includes(searchLower) ||
                r.data.vendorName?.toLowerCase().includes(searchLower) ||
                String(r.data.poNumber || "").toLowerCase().includes(searchLower) ||
                String(r.data.invoiceNumber || "").toLowerCase().includes(searchLower)
            );
        }), [sheetRecords, searchTerm, warehouseFilter]);

    const pendingColumns = [
        { key: "indentNumber", label: "Indent No." },
        { key: "category", label: "Category" },
        { key: "itemName", label: "Item" },
        { key: "quantity", label: "Qty" },
        { key: "warehouse", label: "Warehouse" },
        { key: "vendorName", label: "Vendor" },
        { key: "poNumber", label: "PO No." },
        { key: "invoiceNumber", label: "Invoice No." },
        { key: "invoiceDate", label: "Invoice Date" },
        { key: "basicValue", label: "Basic Value" },
        { key: "totalWithTax", label: "Total Value" },
        { key: "billAttachment", label: "Bill Attach" },
        { key: "planDate", label: "Planned" },
    ];

    const historyColumns = [
        ...pendingColumns,
        { key: "actualDate", label: "Actual" },
        { key: "hardcopySubmitted", label: "Hardcopy Submitted" },
        { key: "submissionDate", label: "Submission Date" },
    ];

    const [selectedPendingColumns, setSelectedPendingColumns] = useState<string[]>(
        pendingColumns.map((c) => c.key)
    );

    const [selectedHistoryColumns, setSelectedHistoryColumns] = useState<string[]>(
        historyColumns.map((c) => c.key)
    );

    // Toggle Selection
    const toggleRow = (id: string) => {
        setSelectedRows(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    const toggleAll = () => {
        const allPendingSelected = pending.length > 0 && pending.every(r => selectedRows.has(r.id));
        if (allPendingSelected) {
            setSelectedRows(prev => {
                const next = new Set(prev);
                pending.forEach(r => next.delete(r.id));
                return next;
            });
        } else {
            setSelectedRows(prev => {
                const next = new Set(prev);
                pending.forEach(r => next.add(r.id));
                return next;
            });
        }
    };

    const handleOpenForm = (recordId?: string) => {
        setBulkError(null);
        if (recordId) {
            setSelectedRows(new Set([recordId]));
        } else if (selectedRows.size === 0) {
            return;
        }

        const selectedRecords = sheetRecords.filter(r => selectedRows.has(r.id) || r.id === recordId);
        if (selectedRecords.length === 0) return;

        // Bulk Validation
        if (!recordId && selectedRows.size > 1) {
            const firstInvoice = selectedRecords[0].data.invoiceNumber;
            if (!selectedRecords.every(r => r.data.invoiceNumber === firstInvoice)) {
                setBulkError("Selected items have different Invoice Numbers. Cannot submit together.");
            }
        }

        setFormData({
            hardcopySubmitted: "",
            submissionDate: new Date(),
        });
        setOpen(true);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (selectedRows.size === 0 || !SHEET_API_URL || bulkError) return;

        setIsSubmitting(true);
        try {
            const selectedRecords = sheetRecords.filter(r => selectedRows.has(r.id));
            if (selectedRecords.length === 0) return;

            const subDate = formData.submissionDate ? format(formData.submissionDate, "yyyy-MM-dd") : "";
            const actualDate = getFmsTimestamp();

            // Parallelize updates for better performance
            await Promise.all(selectedRecords.map(async (rec) => {
                const updates = [
                    { col: "45", val: actualDate }, // AS (Index 44)
                    { col: "47", val: formData.hardcopySubmitted }, // AU (Index 46)
                    { col: "48", val: subDate } // AV (Index 47)
                ];

                for (const u of updates) {
                    const params = new URLSearchParams({
                        action: "updateCell",
                        sheetName: "RECEIVING-ACCOUNTS",
                        rowIndex: rec.rowIndex.toString(),
                        columnIndex: u.col,
                        value: u.val
                    });
                    await fetch(SHEET_API_URL, { method: "POST", body: params });
                }
            }));

            toast.success(`${selectedRecords.length} invoice(s) submitted to HO!`);
            setOpen(false);
            setSelectedRows(new Set());
            fetchData();
        } catch (error: any) {
            console.error(error);
            toast.error(error.message || "Failed to submit");
        } finally {
            setIsSubmitting(true); // Should be false, wait
            setIsSubmitting(false);
        }
    };

    const formatDateDash = (dateStr: any) => {
        if (!dateStr || dateStr === "-" || dateStr === "—") return "-";
        const d = parseSheetDate(dateStr);
        if (!d || isNaN(d.getTime())) return dateStr;
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, "0");
        const day = String(d.getDate()).padStart(2, "0");
        return `${day}-${month}-${year}`;
    };

    const safeValue = (record: any, key: string) => {
        try {
            const data = record?.data;
            if (!data) return "-";

            if (key === "vendorName") return data.vendorName || "-";

            if (key === "billAttachment") {
                const url = data.billAttachment;
                if (!url || url === "-" || url === "") return "-";

                let displayUrl = String(url);
                if (displayUrl.includes("drive.google.com/uc")) {
                    const idMatch = displayUrl.match(/[?&]id=([a-zA-Z0-9_-]+)/);
                    if (idMatch && idMatch[1]) {
                        displayUrl = `https://drive.google.com/file/d/${idMatch[1]}/view`;
                    }
                }

                return (
                    <a
                        href={displayUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 text-xs text-blue-600 hover:underline"
                    >
                        <FileText className="w-3.5 h-3.5" />
                        <span className="truncate max-w-20">View</span>
                    </a>
                );
            }

            const val = data[key];
            if (val === undefined || val === null || String(val).trim() === "") return "-";

            const lowKey = key.toLowerCase();
            if ((lowKey.includes("date") || lowKey.includes("plan") || lowKey.includes("actual"))) {
                return formatDateDash(val);
            }

            return String(val);
        } catch {
            return "-";
        }
    };

    const isFormValid = formData.hardcopySubmitted;

    if (isLoading && sheetRecords.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-24 text-gray-500">
                <Loader2 className="w-8 h-8 animate-spin mb-4 text-blue-600" />
                <p className="text-lg animate-pulse text-blue-900 font-medium">Fetching invoices from HO system...</p>
            </div>
        );
    }

    return (
        <div className="p-6 min-h-screen bg-[#f8fafc]">
            {/* Modal Form */}
            <Dialog open={open} onOpenChange={setOpen}>
                <DialogContent className="max-w-3xl">
                    <DialogHeader>
                        <DialogTitle>Submit Invoice to HO ({selectedRows.size} Selected)</DialogTitle>
                    </DialogHeader>

                    {bulkError && (
                        <div className="bg-red-50 text-red-600 p-3 rounded-md text-sm mb-4 border border-red-200">
                            {bulkError}
                        </div>
                    )}

                    <form onSubmit={handleSubmit}>
                        <div className="py-4 space-y-4">
                            <div className="grid grid-cols-2 gap-4 bg-gray-50 p-4 rounded-lg border border-gray-100 mb-6">
                                <div>
                                    <Label className="text-xs font-semibold uppercase text-gray-500 mb-1 block">Invoice No.</Label>
                                    <p className="font-mono font-medium text-lg">
                                        {sheetRecords.find(r => selectedRows.has(r.id))?.data.invoiceNumber || "-"}
                                    </p>
                                </div>
                                <div>
                                    <Label className="text-xs font-semibold uppercase text-gray-500 mb-1 block">Vendor</Label>
                                    <p className="font-medium text-lg text-gray-900">
                                        {sheetRecords.find(r => selectedRows.has(r.id))?.data.vendorName || "-"}
                                    </p>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
                                <div className="space-y-2">
                                    <Label className="font-medium text-gray-700">Hardcopy Submitted to HO ? *</Label>
                                    <Select value={formData.hardcopySubmitted} onValueChange={(v) => setFormData({ ...formData, hardcopySubmitted: v })}>
                                        <SelectTrigger className="w-full">
                                            <SelectValue placeholder="Select status" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="Yes">Yes</SelectItem>
                                            <SelectItem value="No">No</SelectItem>
                                        </SelectContent>
                                    </Select>
                                    <p className="text-[10px] text-gray-500">Confirm physical docs handover to HO</p>
                                </div>

                                <div className="space-y-2">
                                    <Label className="font-medium text-gray-700">Submission Date *</Label>
                                    <Popover>
                                        <PopoverTrigger asChild>
                                            <Button variant="outline" className="w-full text-left font-normal border-gray-300">
                                                {formData.submissionDate ? format(formData.submissionDate, "PPP") : "Pick date"}
                                            </Button>
                                        </PopoverTrigger>
                                        <PopoverContent className="w-auto p-0" align="start">
                                            <Calendar
                                                mode="single"
                                                selected={formData.submissionDate}
                                                onSelect={(d) => d && setFormData({ ...formData, submissionDate: d })}
                                                initialFocus
                                            />
                                        </PopoverContent>
                                    </Popover>
                                </div>
                            </div>
                        </div>
                        <DialogFooter>
                            <Button variant="outline" onClick={() => setOpen(false)} disabled={isSubmitting}>Cancel</Button>
                            <Button onClick={handleSubmit} disabled={!isFormValid || isSubmitting}>
                                {isSubmitting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Submitting...</> : "Submit"}
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)} className="w-full">
                {/* Sticky Header and Tabs Container */}
                <div className="sticky top-0 z-50 bg-[#f8fafc] -mx-6 px-6 pt-2 pb-4 mb-4 border-b shadow-sm">
                    {/* Header Card */}
                    <div className="mb-6 p-6 bg-white border rounded-lg shadow-sm">
                        <div className="flex items-start justify-between flex-wrap gap-4">
                            <div className="flex items-center gap-3">
                                <div className="bg-blue-50 p-2 rounded-lg text-blue-600">
                                    <ClipboardCheck className="w-7 h-7" />
                                </div>
                                <div>
                                    <h2 className="text-2xl font-bold text-slate-900">Stage: Submit Invoice (HO)</h2>
                                    <p className="text-sm text-slate-500">Manage and track HO invoice submissions</p>
                                </div>
                            </div>

                            <div className="flex items-center gap-4 flex-1 justify-end flex-wrap">
                                {/* Column Selection */}
                                <div className="flex items-center gap-2">
                                    <Label className="text-sm font-medium text-slate-600">
                                        Columns:
                                    </Label>
                                    <Select value="" onValueChange={() => { }}>
                                        <SelectTrigger className="w-40 bg-white border-slate-200 h-9 text-slate-900">
                                            <SelectValue
                                                placeholder={
                                                    activeTab === "pending"
                                                        ? `${selectedPendingColumns.length} selected`
                                                        : `${selectedHistoryColumns.length} selected`
                                                }
                                            />
                                        </SelectTrigger>
                                        <SelectContent className="w-56 max-h-96 overflow-y-auto">
                                            <div className="p-2">
                                                <div className="flex items-center space-x-2 mb-2 pb-2 border-b">
                                                    <Checkbox
                                                        id="select-all-columns"
                                                        checked={
                                                            activeTab === "pending"
                                                                ? selectedPendingColumns.length === pendingColumns.length
                                                                : selectedHistoryColumns.length === historyColumns.length
                                                        }
                                                        onCheckedChange={(checked) => {
                                                            if (activeTab === "pending") {
                                                                setSelectedPendingColumns(
                                                                    checked ? pendingColumns.map((c) => c.key) : []
                                                                );
                                                            } else {
                                                                setSelectedHistoryColumns(
                                                                    checked ? historyColumns.map((c) => c.key) : []
                                                                );
                                                            }
                                                        }}
                                                    />
                                                    <Label
                                                        htmlFor="select-all-columns"
                                                        className="text-sm font-semibold text-slate-900 cursor-pointer"
                                                    >
                                                        Select All
                                                    </Label>
                                                </div>
                                                {(activeTab === "pending"
                                                    ? pendingColumns
                                                    : historyColumns
                                                ).map((col) => (
                                                    <div
                                                        key={col.key}
                                                        className="flex items-center space-x-2 py-1.5 hover:bg-slate-50 px-1 rounded transition-colors"
                                                    >
                                                        <Checkbox
                                                            id={`col-${col.key}`}
                                                            checked={
                                                                activeTab === "pending"
                                                                    ? selectedPendingColumns.includes(col.key)
                                                                    : selectedHistoryColumns.includes(col.key)
                                                            }
                                                            onCheckedChange={(checked) => {
                                                                if (activeTab === "pending") {
                                                                    setSelectedPendingColumns(
                                                                        checked
                                                                            ? [...selectedPendingColumns, col.key]
                                                                            : selectedPendingColumns.filter(
                                                                                (c) => c !== col.key
                                                                            )
                                                                    );
                                                                } else {
                                                                    setSelectedHistoryColumns(
                                                                        checked
                                                                            ? [...selectedHistoryColumns, col.key]
                                                                            : selectedHistoryColumns.filter(
                                                                                (c) => c !== col.key
                                                                            )
                                                                    );
                                                                }
                                                            }}
                                                        />
                                                        <Label
                                                            htmlFor={`col-${col.key}`}
                                                            className="text-sm cursor-pointer flex-1 text-slate-700"
                                                        >
                                                            {col.label}
                                                        </Label>
                                                    </div>
                                                ))}
                                            </div>
                                        </SelectContent>
                                    </Select>
                                </div>

                                {/* Warehouse Filter */}
                                <Select value={warehouseFilter} onValueChange={setWarehouseFilter}>
                                    <SelectTrigger className="w-[160px] bg-white border-slate-200 h-9 text-slate-900">
                                        <SelectValue placeholder="Warehouse" />
                                    </SelectTrigger>
                                    <SelectContent className="bg-white">
                                        <SelectItem value="All">All Warehouses</SelectItem>
                                        <SelectItem value="NE Warehouse">NE Warehouse</SelectItem>
                                        <SelectItem value="Others">Others</SelectItem>
                                    </SelectContent>
                                </Select>

                                {/* Search */}
                                <div className="relative flex-1 max-w-sm">
                                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-500" />
                                    <Input
                                        placeholder="Search records..."
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                        className="pl-9 bg-white border-slate-200 h-9"
                                    />
                                </div>

                                {/* Refresh */}
                                <Button
                                    variant="outline"
                                    size="icon"
                                    onClick={fetchData}
                                    disabled={isLoading}
                                    className="h-9 w-9 border-slate-200"
                                >
                                    {isLoading ? (
                                        <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
                                    ) : (
                                        <RefreshCw className="w-4 h-4 text-slate-600" />
                                    )}
                                </Button>

                                {/* Bulk Action Button */}
                                {selectedRows.size > 0 && activeTab === "pending" && (
                                    <Button
                                        onClick={() => handleOpenForm()}
                                        className="bg-blue-600 hover:bg-blue-700 text-white h-9 shadow-sm whitespace-nowrap"
                                    >
                                        Submit to HO ({selectedRows.size})
                                    </Button>
                                )}
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
                            History ({completed.length})
                        </TabsTrigger>
                    </TabsList>
                </div>

                <TabsContent value="pending" className="mt-0 outline-none">
                    {pending.length === 0 ? (
                        <div className="text-center py-24 bg-white border rounded-lg border-dashed">
                            <ClipboardCheck className="w-12 h-12 mx-auto text-slate-200 mb-3" />
                            <p className="text-lg text-slate-500">No pending submissions found</p>
                        </div>
                    ) : (
                        <div className="border rounded-lg overflow-x-auto h-[70vh] relative shadow-sm bg-white">
                            <table className="w-full caption-bottom text-sm border-separate border-spacing-0 min-w-max">
                                <thead className="sticky top-0 z-30 bg-slate-50 shadow-sm border-none">
                                    <tr className="hover:bg-transparent border-none">
                                        <th className="sticky left-0 z-40 bg-slate-50 w-[50px] border-b text-center py-3">
                                            <Checkbox
                                                checked={pending.length > 0 && pending.every(r => selectedRows.has(r.id))}
                                                onCheckedChange={toggleAll}
                                            />
                                        </th>
                                        <th className="sticky left-[50px] z-40 bg-slate-50 w-[100px] border-b text-center px-4 py-3 font-semibold text-slate-900">Actions</th>
                                        {pendingColumns
                                            .filter((c) => selectedPendingColumns.includes(c.key))
                                            .map((c) => (
                                                <th key={c.key} className="bg-slate-50 border-b text-center px-4 py-3 font-semibold text-slate-900 whitespace-nowrap">
                                                    {c.label}
                                                </th>
                                            ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {pending.map((rec) => (
                                        <tr key={rec.id} className="hover:bg-blue-50/30 transition-colors group">
                                            <td className="sticky left-0 z-20 bg-white group-hover:bg-blue-50/50 border-b text-center py-2">
                                                <Checkbox
                                                    checked={selectedRows.has(rec.id)}
                                                    onCheckedChange={() => toggleRow(rec.id)}
                                                />
                                            </td>
                                            <td className="sticky left-[50px] z-20 bg-white group-hover:bg-blue-50/50 border-b text-center px-4 py-2">
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    onClick={() => handleOpenForm(rec.id)}
                                                    className="h-8 px-3 text-xs border-slate-200 hover:bg-white hover:text-blue-600 transition-colors"
                                                >
                                                    Submit
                                                </Button>
                                            </td>
                                            {pendingColumns
                                                .filter((c) => selectedPendingColumns.includes(c.key))
                                                .map((col) => (
                                                    <td key={col.key} className="border-b px-4 py-2 text-center text-slate-700">
                                                        {safeValue(rec, col.key)}
                                                    </td>
                                                ))}
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </TabsContent>

                <TabsContent value="history" className="mt-0 outline-none">
                    {completed.length === 0 ? (
                        <div className="text-center py-24 bg-white border rounded-lg border-dashed">
                            <ClipboardCheck className="w-12 h-12 mx-auto text-slate-200 mb-3" />
                            <p className="text-lg text-slate-500">No history found</p>
                        </div>
                    ) : (
                        <div className="border rounded-lg overflow-x-auto h-[70vh] relative shadow-sm bg-white">
                            <table className="w-full caption-bottom text-sm border-separate border-spacing-0 min-w-max">
                                <thead className="sticky top-0 z-30 bg-slate-50 shadow-sm border-none">
                                    <tr className="hover:bg-transparent border-none">
                                        {historyColumns
                                            .filter((c) => selectedHistoryColumns.includes(c.key))
                                            .map((c) => (
                                                <th key={c.key} className="bg-slate-50 border-b text-center px-4 py-3 font-semibold text-slate-900 whitespace-nowrap">
                                                    {c.label}
                                                </th>
                                            ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {completed.map((rec) => (
                                        <tr key={rec.id} className="hover:bg-slate-50 transition-colors">
                                            {historyColumns
                                                .filter((c) => selectedHistoryColumns.includes(c.key))
                                                .map((col) => (
                                                    <td key={col.key} className="border-b px-4 py-2 text-center text-slate-700">
                                                        {safeValue(rec, col.key)}
                                                    </td>
                                                ))}
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </TabsContent>
            </Tabs>
        </div>
    );
}