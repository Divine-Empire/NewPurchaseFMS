"use client";

import React, { useState, useEffect } from "react";
import { toast } from "sonner";
import { Loader2, FileText, Search } from "lucide-react";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
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
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { format } from "date-fns";

const SHEET_API_URL = process.env.NEXT_PUBLIC_API_URI;

export default function SubmitInvoiceHO() {
    const [sheetRecords, setSheetRecords] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [open, setOpen] = useState(false);
    const [selectedRecordId, setSelectedRecordId] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState<"pending" | "history">("pending");
    const [searchTerm, setSearchTerm] = useState("");
    const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set());
    const [bulkError, setBulkError] = useState<string | null>(null);

    const [formData, setFormData] = useState({
        hardcopySubmitted: "",
        submissionDate: new Date(),
        invoiceNumber: "",
        vendorName: "",
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
                    .map(({ row, originalIndex }: any, idx: number) => {
                        const indentNo = String(row[1]).trim();
                        const fmsRow = fmsMap.get(indentNo) || [];

                        // Stage Logic (Submit Invoice HO)
                        // Stage Logic (Submit Invoice HO)
                        // 43: Plan (Planned3)
                        // 44: Actual
                        const hasPlan = !!row[43] && String(row[43]).trim() !== "";
                        const hasActual = !!row[44] && String(row[44]).trim() !== "";

                        let status = "not_ready";
                        if (hasPlan && !hasActual) {
                            status = "pending";
                        } else if (hasPlan && hasActual) {
                            status = "completed";
                        }

                        // Vendor Details (indent-po)
                        const selectedVendor = fmsRow[47];
                        let vendorDetails = { vendorName: "-", rate: "-", terms: "-" };

                        if (selectedVendor === "Vendor 1") {
                            vendorDetails = { vendorName: fmsRow[21], rate: fmsRow[22], terms: fmsRow[23] };
                        } else if (selectedVendor === "Vendor 2") {
                            vendorDetails = { vendorName: fmsRow[29], rate: fmsRow[30], terms: fmsRow[31] };
                        } else if (selectedVendor === "Vendor 3") {
                            vendorDetails = { vendorName: fmsRow[37], rate: fmsRow[38], terms: fmsRow[39] };
                        }

                        return {
                            id: row[1] || `row-${originalIndex}`,
                            rowIndex: originalIndex,
                            status,
                            originalRow: row, // Preserve data
                            data: {
                                indentNumber: row[1],
                                category: fmsRow[3] || row[3], // D: Category (Indent Lift)
                                itemName: fmsRow[4] || row[4], // E: Item Name (Indent Lift)
                                quantity: row[25], // Z: Qty (Receiving Accounts)

                                // Stage 6 (9-24)
                                poNumber: fmsRow[54], // BC: PO Number (Indent Lift)

                                // Stage 7 (25-39)
                                billAttachment: row[18], // S: Bill Attachment (Receiving Accounts)
                                invoiceNumber: row[24], // Y: Invoice Number (Receiving Accounts)
                                invoiceDate: row[23], // X: Invoice Date (Receiving Accounts)

                                // Stage 10 (HO) logic fields (AR-AV -> 43-47)
                                planDate: row[43],   // Planned3 (AR)
                                actualDate: row[44], // Actual (AS)
                                delay: row[45],      // Delay3 (AT)
                                hardcopySubmitted: row[46], // Submit Invoice to HO (AU)
                                submissionDate: row[47],    // Submission Date (AV)

                                // FMS Data
                                basicValue: fmsRow[55], // BD: Basic Value (Indent Lift)
                                totalWithTax: fmsRow[56], // BE: Total Value (Indent Lift)
                                ...vendorDetails,
                                vendorName: row[3], // D: Vendor Name (Receiving Accounts)
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

    const pending = sheetRecords
        .filter((r) => r.status === "pending")
        .filter((r) => {
            const searchLower = searchTerm.toLowerCase();
            return (
                r.data.indentNumber?.toLowerCase().includes(searchLower) ||
                r.data.itemName?.toLowerCase().includes(searchLower) ||
                r.data.vendorName?.toLowerCase().includes(searchLower) ||
                String(r.data.poNumber || "").toLowerCase().includes(searchLower) ||
                String(r.data.invoiceNumber || "").toLowerCase().includes(searchLower)
            );
        });
    const completed = sheetRecords
        .filter((r) => r.status === "completed")
        .filter((r) => {
            const searchLower = searchTerm.toLowerCase();
            if (!searchLower) return true;
            return (
                r.data.indentNumber?.toLowerCase().includes(searchLower) ||
                r.data.itemName?.toLowerCase().includes(searchLower) ||
                r.data.vendorName?.toLowerCase().includes(searchLower) ||
                String(r.data.poNumber || "").toLowerCase().includes(searchLower) ||
                String(r.data.invoiceNumber || "").toLowerCase().includes(searchLower)
            );
        });

    const pendingColumns = [
        { key: "indentNumber", label: "Indent #" },
        { key: "category", label: "Category" },
        { key: "itemName", label: "Item" },
        { key: "quantity", label: "Qty" },
        { key: "vendorName", label: "Vendor" },
        { key: "poNumber", label: "PO #" },
        { key: "invoiceNumber", label: "Invoice #" },
        { key: "invoiceDate", label: "Inv. Date" },
        { key: "basicValue", label: "Basic Val" },
        { key: "totalWithTax", label: "Total Val" },
        { key: "billAttachment", label: "Bill Attach" },
        { key: "planDate", label: "Plan Date" },
    ];

    const historyColumns = [
        ...pendingColumns,
        { key: "actualDate", label: "Actual Date" },
        { key: "delay", label: "Delay" },
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
        const newSet = new Set(selectedRows);
        if (newSet.has(id)) newSet.delete(id);
        else newSet.add(id);
        setSelectedRows(newSet);
    };

    const toggleAll = () => {
        if (selectedRows.size === pending.length) {
            setSelectedRows(new Set());
        } else {
            setSelectedRows(new Set(pending.map((r) => r.id)));
        }
    };

    const handleOpenForm = (recordId?: string) => {
        setBulkError(null);
        let targetRecord;

        // Determine if opening for single record (click) or bulk (button)
        if (recordId) {
            // Single item click - treat as single selection
            setSelectedRows(new Set([recordId]));
            targetRecord = sheetRecords.find((r) => r.id === recordId);
        } else {
            // Bulk button click
            if (selectedRows.size === 0) return;
            const selectedIds = Array.from(selectedRows);
            const selectedRecords = sheetRecords.filter(r => selectedRows.has(r.id));

            if (selectedRecords.length === 0) return;

            // Validate Invoice Numbers
            const firstInvoice = selectedRecords[0].data.invoiceNumber;
            const isConsistent = selectedRecords.every(r => r.data.invoiceNumber === firstInvoice);

            if (!isConsistent) {
                setBulkError("Selected items have different Invoice Numbers. Cannot submit together.");
            }
            targetRecord = selectedRecords[0];
        }

        if (!targetRecord) return;

        const invoiceNumber = targetRecord.data?.invoiceNumber || "-";
        const vendorName = targetRecord.data?.vendorName || "-";

        setSelectedRecordId(targetRecord.id); // Just for reference, mostly unused in bulk
        setFormData({
            hardcopySubmitted: "",
            submissionDate: new Date(),
            invoiceNumber,
            vendorName,
        });
        setOpen(true);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if ((!selectedRecordId && selectedRows.size === 0) || !SHEET_API_URL) return;
        if (bulkError) return;

        setIsSubmitting(true);
        try {
            const selectedRecords = sheetRecords.filter(r => selectedRows.has(r.id));
            if (selectedRecords.length === 0) return;

            // ✅ FIXED: Send ISO format (Google Sheets safe)
            const subDate = formData.submissionDate
                ? format(formData.submissionDate, "yyyy-MM-dd")
                : "";

            // Actual date same as submission date
            const actualDate = subDate;

            // Process all selected records
            for (const rec of selectedRecords) {
                // Use updateCell to avoid overwriting formulas in adjacent columns (like Delay/Plan)
                const updates = [
                    { col: "45", val: actualDate }, // Column AS (Index 44) => +1 = 45
                    { col: "47", val: formData.hardcopySubmitted }, // Column AU (Index 46) => +1 = 47
                    { col: "48", val: subDate } // Column AV (Index 47) => +1 = 48
                ];

                for (const u of updates) {
                    const params = new URLSearchParams();
                    params.append("action", "updateCell");
                    params.append("sheetName", "RECEIVING-ACCOUNTS");
                    params.append("rowIndex", rec.rowIndex.toString());
                    params.append("columnIndex", u.col);
                    params.append("value", u.val);
                    await fetch(`${SHEET_API_URL}`, { method: "POST", body: params });
                }
            }

            toast.success("Invoice(s) submitted to HO successfully!");
            setOpen(false);
            setSelectedRows(new Set());
            fetchData();
        } catch (error: any) {
            console.error(error);
            toast.error(error.message || "Failed to submit");
        } finally {
            setIsSubmitting(false);
        }
    };

    const safeValue = (record: any, key: string) => {
        try {
            const data = record?.data;
            if (!data) return "-";

            if (key === "vendorName") return data.vendorName || "-";

            if (key === "billAttachment") {
                const url = data.billAttachment;
                if (!url || url === "-" || url === "") return "-";
                return (
                    <a
                        href={String(url)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 text-xs text-blue-600 hover:underline"
                    >
                        <FileText className="w-3.5 h-3.5" />
                        View
                    </a>
                );
            }

            const val = data[key];
            if (val === undefined || val === null || String(val).trim() === "") return "-";

            if ((key.includes("Date") || key.includes("plan") || key.includes("actual")) && !isNaN(Date.parse(String(val)))) {
                return new Date(String(val)).toLocaleDateString("en-IN");
            }

            return String(val);
        } catch {
            return "-";
        }
    };

    const isFormValid = formData.hardcopySubmitted && formData.invoiceNumber && formData.vendorName;

    if (isLoading && sheetRecords.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
                <Loader2 className="w-8 h-8 animate-spin text-black" />
                <p className="text-gray-500 font-medium">Loading invoices...</p>
            </div>
        );
    }

    return (
        <div className="p-6">
            <div className="mb-6 p-6 bg-white border rounded-lg shadow-sm">
                <div className="flex items-center justify-between">
                    <div>
                        <h2 className="text-2xl font-bold">Submit Invoice (HO)</h2>
                        <p className="text-gray-600 mt-1">Submit hardcopy invoices to Head Office</p>
                    </div>
                    <div className="flex items-center gap-4">
                        <div className="relative flex-1 max-w-sm">
                            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-500" />
                            <Input
                                placeholder="Search by Indent No, Item, Vendor, PO, Invoice..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="pl-9 bg-white w-[300px]"
                            />
                        </div>
                        {/* Header Actions */}
                        <div className="flex items-center gap-4">
                            {selectedRows.size > 0 && (
                                <Button
                                    onClick={() => handleOpenForm()}
                                    className="bg-blue-600 hover:bg-blue-700 text-white"
                                >
                                    Submit Invoice to HO ({selectedRows.size})
                                </Button>
                            )}

                            <div className="flex items-center gap-2">
                                <Label className="text-sm font-medium">Show Columns:</Label>
                                <Select value="" onValueChange={() => { }}>
                                    <SelectTrigger className="w-64">
                                        <SelectValue placeholder={`${activeTab === "pending" ? selectedPendingColumns.length : selectedHistoryColumns.length} selected`} />
                                    </SelectTrigger>
                                    <SelectContent className="w-64 max-h-96 overflow-y-auto">
                                        <div className="p-2">
                                            <div className="flex items-center space-x-2 mb-2 pb-2 border-b">
                                                <Checkbox
                                                    checked={activeTab === "pending" ? selectedPendingColumns.length === pendingColumns.length : selectedHistoryColumns.length === historyColumns.length}
                                                    onCheckedChange={(c) => {
                                                        if (activeTab === "pending") setSelectedPendingColumns(c ? pendingColumns.map(x => x.key) : []);
                                                        else setSelectedHistoryColumns(c ? historyColumns.map(x => x.key) : []);
                                                    }}
                                                />
                                                <Label>All</Label>
                                            </div>
                                            {(activeTab === "pending" ? pendingColumns : historyColumns).map(col => (
                                                <div key={col.key} className="flex items-center space-x-2 py-1">
                                                    <Checkbox
                                                        checked={activeTab === "pending" ? selectedPendingColumns.includes(col.key) : selectedHistoryColumns.includes(col.key)}
                                                        onCheckedChange={(c) => {
                                                            if (activeTab === "pending") {
                                                                setSelectedPendingColumns(c ? [...selectedPendingColumns, col.key] : selectedPendingColumns.filter(x => x !== col.key));
                                                            } else {
                                                                setSelectedHistoryColumns(c ? [...selectedHistoryColumns, col.key] : selectedHistoryColumns.filter(x => x !== col.key));
                                                            }
                                                        }}
                                                    />
                                                    <Label>{col.label}</Label>
                                                </div>
                                            ))}
                                        </div>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)}>
                <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="pending">Pending ({pending.length})</TabsTrigger>
                    <TabsTrigger value="history">History ({completed.length})</TabsTrigger>
                </TabsList>

                <TabsContent value="pending" className="mt-6">
                    {pending.length === 0 ? (
                        <div className="text-center py-12 text-gray-500"><p className="text-lg">No pending submissions</p></div>
                    ) : (
                        <div className="border rounded-lg overflow-x-auto">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead className="bg-white z-10 w-[100px]">
                                            <Checkbox
                                                checked={selectedRows.size === pending.length && pending.length > 0}
                                                onCheckedChange={toggleAll}
                                            />
                                        </TableHead>
                                        <TableHead className="bg-white z-10 w-[100px]">Actions</TableHead>
                                        {pendingColumns.filter(c => selectedPendingColumns.includes(c.key)).map(col => (
                                            <TableHead key={col.key}>{col.label}</TableHead>
                                        ))}
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {pending.map((record: any) => (
                                        <TableRow key={record.id}>
                                            <TableCell className="bg-white z-10">
                                                <Checkbox
                                                    checked={selectedRows.has(record.id)}
                                                    onCheckedChange={() => toggleRow(record.id)}
                                                />
                                            </TableCell>
                                            <TableCell className="bg-white z-10">
                                                <Button variant="outline" size="sm" onClick={() => handleOpenForm(record.id)}>Submit</Button>
                                            </TableCell>
                                            {pendingColumns.filter(c => selectedPendingColumns.includes(c.key)).map(col => (
                                                <TableCell key={col.key}>{safeValue(record, col.key)}</TableCell>
                                            ))}
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>
                    )}
                </TabsContent>

                <TabsContent value="history" className="mt-6">
                    {completed.length === 0 ? (
                        <div className="text-center py-12 text-gray-500"><p className="text-lg">No history</p></div>
                    ) : (
                        <div className="border rounded-lg overflow-x-auto">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        {historyColumns.filter(c => selectedHistoryColumns.includes(c.key)).map(col => (
                                            <TableHead key={col.key}>{col.label}</TableHead>
                                        ))}
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {completed.map((record: any) => (
                                        <TableRow key={record.id}>
                                            {historyColumns.filter(c => selectedHistoryColumns.includes(c.key)).map(col => (
                                                <TableCell key={col.key}>{safeValue(record, col.key)}</TableCell>
                                            ))}
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>
                    )}
                </TabsContent>
            </Tabs>

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
                                    <Label className="text-xs font-semibold uppercase text-gray-500 mb-1 block">Invoice #</Label>
                                    <p className="font-mono font-medium text-lg">{formData.invoiceNumber}</p>
                                </div>
                                <div>
                                    <Label className="text-xs font-semibold uppercase text-gray-500 mb-1 block">Vendor</Label>
                                    <p className="font-medium text-lg text-gray-900">{formData.vendorName}</p>
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
        </div>
    );
}