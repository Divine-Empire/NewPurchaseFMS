"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { toast } from "sonner";
import { Loader2, FileText, RefreshCw, Upload, CheckCircle, CalendarIcon, Banknote, Search, ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";
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
    DialogDescription,
    DialogFooter,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { format } from "date-fns";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { ScrollArea } from "@/components/ui/scroll-area";

// ─── Module-level constants (never re-created on render) ─────────────────────
const SHEET_API_URL = process.env.NEXT_PUBLIC_API_URI;
const IMAGE_FOLDER_ID = process.env.NEXT_PUBLIC_IMAGE_FOLDER_ID;

// Stable column definitions — outside component so reference is identical each render
const PENDING_COLUMNS = [
    { key: "invoiceNo", label: "Invoice #" },
    { key: "totalVal", label: "Total Amt" },
    { key: "totalPaid", label: "Paid" },
    { key: "pendingAmount", label: "Pending" },
    { key: "plan1", label: "Due Date" },
    { key: "invoiceDate", label: "Inv. Date" },
    { key: "vendor", label: "Vendor" },
    { key: "poNumber", label: "PO Number" },
    { key: "invoiceCopy", label: "Invoice Copy" },
    { key: "totalRcvd", label: "Total Rcvd." },
    { key: "qty", label: "Rec. Qty" },
    { key: "receivedItems", label: "Rec. Items" },
] as const;

const HISTORY_COLUMNS = [
    { key: "date", label: "Payment Date" },
    { key: "invoiceNo", label: "Invoice #" },
    { key: "vendor", label: "Vendor" },
    { key: "amountPaid", label: "Amount Paid" },
    { key: "mode", label: "Payment Mode" },
    { key: "status", label: "Status" },
    { key: "proof", label: "Proof" },
] as const;

const ALL_PENDING_KEYS = PENDING_COLUMNS.map(c => c.key);

// ─── Stable helper functions ──────────────────────────────────────────────────
const toDate = (val: any): string => {
    if (!val || String(val).trim() === "" || String(val).trim() === "-") return "-";
    try {
        const d = new Date(val);
        if (isNaN(d.getTime())) return val;
        return format(d, "dd-MM-yyyy");
    } catch {
        return val;
    }
};

const parseNum = (val: any): number =>
    parseFloat(String(val || 0).replace(/,/g, "")) || 0;

// Google Sheets-compatible timestamp  (M/D/YYYY H:MM:SS)
const gsNow = (): string => {
    const n = new Date();
    return `${n.getMonth() + 1}/${n.getDate()}/${n.getFullYear()} ${n.getHours()}:${String(n.getMinutes()).padStart(2, "0")}:${String(n.getSeconds()).padStart(2, "0")}`;
};

const safeValue = (val: any) => {
    if (!val || val === "-" || val === "") return "-";
    if (typeof val === "string" && (val.startsWith("http") || val.includes("drive.google"))) {
        return (
            <a href={val} target="_blank" rel="noopener noreferrer"
                className="text-blue-600 hover:underline flex items-center gap-1">
                <FileText className="w-3 h-3" /> View
            </a>
        );
    }
    return String(val);
};

// Default bulk-form factory — avoids sharing a mutable reference
const defaultBulkForm = () => ({
    paymentMode: "",
    paymentDate: new Date() as Date | undefined,
    proof: null as File | null,
});

// ─── Component ────────────────────────────────────────────────────────────────
export default function Stage13() {
    const [records, setRecords] = useState<any[]>([]);
    const [historyRecords, setHistoryRecords] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [activeTab, setActiveTab] = useState<"pending" | "history">("pending");
    const [searchTerm, setSearchTerm] = useState("");
    const [selectedPendingColumns, setSelectedPendingColumns] = useState<string[]>(ALL_PENDING_KEYS);

    const [sortConfig, setSortConfig] = useState<{ key: string, direction: 'asc' | 'desc' } | null>(null);

    // Bulk payment modal state
    const [bulkOpen, setBulkOpen] = useState(false);
    const [bulkStep, setBulkStep] = useState<"vendor" | "invoices">("vendor");
    const [selectedVendor, setSelectedVendor] = useState("");
    const [vendorSearch, setVendorSearch] = useState("");
    const [bulkInvoices, setBulkInvoices] = useState<Record<string, { selected: boolean; payAmount: string; originalPending: number }>>({});
    const [bulkFormData, setBulkFormData] = useState(defaultBulkForm);

    // ── Fetch ─────────────────────────────────────────────────────────────────
    const fetchData = useCallback(async () => {
        if (!SHEET_API_URL) return;
        setIsLoading(true);
        try {
            const [payRes, histRes] = await Promise.all([
                fetch(`${SHEET_API_URL}?sheet=VENDOR-PAYMENTS&action=getAll`),
                fetch(`${SHEET_API_URL}?sheet=PAID-DATA&action=getAll`),
            ]);
            const [payJson, histJson] = await Promise.all([payRes.json(), histRes.json()]);

            // 1. Pending — VENDOR-PAYMENTS
            // A(0)=Timestamp, B(1)=Invoice No, C(2)=Invoice Copy, D(3)=Invoice Date
            // E(4)=Vendor Name, F(5)=PO Number, G(6)=PO Copy, H(7)=Hydra Amt
            // I(8)=Labour Amt, J(9)=Auto Charge, K(10)=Received Qty, L(11)=Payment Amount
            // M(12)=Received Items, N(13)=Planned1, O(14)=Actual1, P(15)=Delay1
            // Q(16)=Total Paid, R(17)=Pending Amount
            if (payJson.success && Array.isArray(payJson.data)) {
                const rows = payJson.data
                    .slice(6)
                    .map((row: any, i: number) => ({ row, originalIndex: i + 7 }))
                    .filter(({ row }: any) => row[1] && String(row[1]).trim() !== "")
                    .map(({ row, originalIndex }: any) => {
                        const totalVal = parseNum(row[11]);
                        const pendingRaw = row[17];
                        const currentPending = (pendingRaw !== undefined && pendingRaw !== "" && pendingRaw !== "-")
                            ? parseNum(pendingRaw)
                            : totalVal;
                        const storedPaid = parseNum(row[16]);
                        const plan1 = row[13];
                        const actual1 = row[14];
                        const hasPlan = !!plan1 && String(plan1).trim() !== "" && String(plan1).trim() !== "-";
                        const hasActual = !!actual1 && String(actual1).trim() !== "" && String(actual1).trim() !== "-";

                        let status = "not_ready";
                        if (hasPlan) {
                            status = (!hasActual || currentPending > 1) ? "pending" : "history";
                        }

                        const invNo = String(row[1] || "").trim();
                        const vendorName = String(row[4] || "").trim();

                        const qtyStr = String(row[10] || "");
                        const totalRcvd = qtyStr.split(',')
                            .map(v => parseFloat(v.trim()) || 0)
                            .reduce((sum, val) => sum + val, 0);

                        return {
                            id: `${invNo}_${originalIndex}`,
                            rowIndex: originalIndex,
                            status,
                            data: {
                                id: invNo,
                                invoiceNo: invNo,
                                invoiceCopy: row[2] || "",        // C
                                invoiceDate: toDate(row[3]),       // D
                                vendor: vendorName,           // E
                                poNumber: row[5] || "",        // F
                                totalRcvd,
                                poCopy: row[6] || "",        // G
                                qty: row[10] || "",        // K
                                receivedItems: row[12] || "",        // M
                                totalVal,                            // L
                                plan1: toDate(plan1),        // N
                                actual1: toDate(actual1),      // O
                                totalPaid: storedPaid,           // Q
                                pendingAmount: currentPending,       // R
                                paymentStatus: currentPending <= 1 ? "paid" : (storedPaid > 0 ? "partial" : "pending"),
                            },
                        };
                    });

                setRecords(rows.filter((r: any) => r.status === "pending"));
            }

            // 2. History — PAID-DATA
            // A(0)=Timestamp, B(1)=Status, C(2)=Invoice No, D(3)=Vendor Name,
            // E(4)=Amount, F(5)=Payment Status, G(6)=Payment Due Date, H(7)=Payment Type, I(8)=Proof
            if (histJson.success && Array.isArray(histJson.data)) {
                const hRows = histJson.data
                    .slice(1)
                    .map((row: any, i: number) => ({ row, id: `HIST_${i}` }))
                    .filter(({ row }: any) => row[1] === "Vendor Payment")
                    .map(({ row, id }: any) => ({
                        id,
                        invoiceNo: row[2],
                        vendor: row[3],
                        amountPaid: row[4],
                        status: row[5],
                        date: toDate(row[6]),
                        mode: row[7],
                        proof: row[8],
                    }));

                setHistoryRecords(hRows.reverse());
            }
        } catch (e) {
            console.error(e);
            toast.error("Failed to load data");
        }
        setIsLoading(false);
    }, []);

    useEffect(() => { fetchData(); }, [fetchData]);

    // ── Derived state (memoized) ──────────────────────────────────────────────
    const searchLower = useMemo(() => searchTerm.toLowerCase(), [searchTerm]);

    const filteredRecords = useMemo(() => {
        let result = records.filter(r => {
            if (!searchLower) return true;
            return (
                r.data.invoiceNo?.toLowerCase().includes(searchLower) ||
                r.data.vendor?.toLowerCase().includes(searchLower) ||
                r.data.receivedItems?.toLowerCase().includes(searchLower) ||
                String(r.data.poNumber || "").toLowerCase().includes(searchLower)
            );
        });

        if (sortConfig !== null) {
            result.sort((a, b) => {
                if (sortConfig.key === 'plan1') {
                    // Due Date sorting
                    const dateA = a.data.plan1 && a.data.plan1 !== "-" ? new Date(a.data.plan1.split('-').reverse().join('-')).getTime() : 0;
                    const dateB = b.data.plan1 && b.data.plan1 !== "-" ? new Date(b.data.plan1.split('-').reverse().join('-')).getTime() : 0;

                    if (dateA < dateB) return sortConfig.direction === 'asc' ? -1 : 1;
                    if (dateA > dateB) return sortConfig.direction === 'asc' ? 1 : -1;
                    return 0;
                }
                return 0;
            });
        }
        return result;
    }, [records, searchLower, sortConfig]);

    const filteredHistoryRecords = useMemo(() => {
        if (!searchLower) return historyRecords;
        return historyRecords.filter(rec =>
            rec.invoiceNo?.toLowerCase().includes(searchLower) ||
            rec.vendor?.toLowerCase().includes(searchLower)
        );
    }, [historyRecords, searchLower]);

    const uniqueVendors = useMemo(() => {
        const names = Array.from(new Set(records.map(r => r.data.vendor).filter(Boolean)));
        return (names as string[]).sort();
    }, [records]);

    const filteredVendors = useMemo(() => {
        if (!vendorSearch) return uniqueVendors;
        const lower = vendorSearch.toLowerCase();
        return uniqueVendors.filter(v => v.toLowerCase().includes(lower));
    }, [uniqueVendors, vendorSearch]);

    const bulkTotalToPay = useMemo(() =>
        Object.values(bulkInvoices)
            .filter(i => i.selected)
            .reduce((sum, item) => sum + (parseFloat(item.payAmount) || 0), 0),
        [bulkInvoices]);

    // Visible columns for the pending table (memoized — used in header + body)
    const visiblePendingColumns = useMemo(() =>
        PENDING_COLUMNS.filter(c => selectedPendingColumns.includes(c.key)),
        [selectedPendingColumns]);

    // ── Column toggle ─────────────────────────────────────────────────────────
    const handleColumnToggle = useCallback((key: string, checked: boolean) => {
        setSelectedPendingColumns(prev =>
            checked ? [...prev, key] : prev.filter(k => k !== key)
        );
    }, []);

    const handleSort = useCallback((key: string) => {
        let direction: 'asc' | 'desc' = 'asc';
        if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
            direction = 'desc';
        }
        setSortConfig({ key, direction });
    }, [sortConfig]);

    // ── Bulk modal handlers ───────────────────────────────────────────────────
    const handleBulkOpen = useCallback(() => {
        setBulkOpen(true);
        setBulkStep("vendor");
        setSelectedVendor("");
        setVendorSearch("");
        setBulkInvoices({});
        setBulkFormData(defaultBulkForm());
    }, []);

    const handleVendorSelect = useCallback((vendorName: string) => {
        setSelectedVendor(vendorName);
        const vendorInvoices = records.filter(r => r.data.vendor === vendorName);
        const initialMap: Record<string, { selected: boolean; payAmount: string; originalPending: number }> = {};
        vendorInvoices.forEach(inv => {
            initialMap[inv.id] = {
                selected: false,
                payAmount: inv.data.pendingAmount.toFixed(2),
                originalPending: inv.data.pendingAmount,
            };
        });
        setBulkInvoices(initialMap);
        setBulkStep("invoices");
    }, [records]);

    const handleBulkInvoiceToggle = useCallback((id: string, checked: boolean) => {
        setBulkInvoices(prev => ({ ...prev, [id]: { ...prev[id], selected: checked } }));
    }, []);

    const handleBulkAmountChange = useCallback((id: string, val: string) => {
        setBulkInvoices(prev => ({ ...prev, [id]: { ...prev[id], payAmount: val } }));
    }, []);

    // ── Stable form field updaters ────────────────────────────────────────────
    const handlePaymentModeChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) =>
        setBulkFormData(prev => ({ ...prev, paymentMode: e.target.value })), []);
    const handlePaymentDateChange = useCallback((date: Date | undefined) =>
        date && setBulkFormData(prev => ({ ...prev, paymentDate: date })), []);
    const handleProofChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) =>
        setBulkFormData(prev => ({ ...prev, proof: e.target.files?.[0] || null })), []);
    const handleTabChange = useCallback((v: string) =>
        setActiveTab(v as "pending" | "history"), []);
    const handleSearchChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) =>
        setSearchTerm(e.target.value), []);
    const handleVendorSearchChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) =>
        setVendorSearch(e.target.value), []);
    const handleBackToVendors = useCallback(() => setBulkStep("vendor"), []);
    const handleCloseBulk = useCallback(() => setBulkOpen(false), []);

    // ── Bulk submit ───────────────────────────────────────────────────────────
    const handleBulkSubmit = useCallback(async () => {
        const selectedIds = Object.keys(bulkInvoices).filter(id => bulkInvoices[id].selected);

        if (selectedIds.length === 0) { toast.error("Please select at least one invoice."); return; }
        if (bulkTotalToPay <= 0) { toast.error("Total payment amount must be greater than 0."); return; }
        if (!bulkFormData.paymentMode) { toast.error("Please enter payment details (Mode)."); return; }

        setIsSubmitting(true);
        const toastId = toast.loading("Processing Bulk Payment...");

        try {
            const dateStr = bulkFormData.paymentDate
                ? format(bulkFormData.paymentDate, "yyyy-MM-dd")
                : format(new Date(), "yyyy-MM-dd");

            // 1. Upload proof (once for all invoices)
            let proofUrl = "";
            if (bulkFormData.proof) {
                const base64Data = await new Promise<string>(resolve => {
                    const reader = new FileReader();
                    reader.onload = e => resolve(e.target?.result as string);
                    reader.readAsDataURL(bulkFormData.proof!);
                });
                const upParams = new URLSearchParams({
                    action: "uploadFile",
                    fileName: `BULKPAY_${selectedVendor}_${Date.now()}`,
                    mimeType: bulkFormData.proof.type,
                    base64Data,
                    ...(IMAGE_FOLDER_ID ? { folderId: IMAGE_FOLDER_ID } : {}),
                });
                const upJson = await fetch(`${SHEET_API_URL}`, { method: "POST", body: upParams }).then(r => r.json());
                if (upJson.success) proofUrl = upJson.fileUrl;
            }

            // 2. Write each invoice to PAID-DATA sequentially
            // Schema: A=Timestamp, B=Status, C=Invoice No, D=Vendor, E=Amount,
            //         F=Payment Status, G=Due Date, H=Payment Type, I=Proof
            let successCount = 0;
            for (const id of selectedIds) {
                const rec = records.find(r => r.id === id);
                if (!rec) continue;
                const payInfo = bulkInvoices[id];
                const payAmount = parseFloat(payInfo.payAmount) || 0;
                if (payAmount <= 0) continue;

                const newTotalPaid = (rec.data.totalPaid || 0) + payAmount;
                const newPending = rec.data.totalVal - newTotalPaid;
                const paymentStatus = newPending <= 1 ? "Paid" : "Partial";

                const paidRow = [
                    gsNow(),                        // A: Timestamp
                    "Vendor Payment",               // B: type tag
                    rec.data.invoiceNo || "",       // C
                    rec.data.vendor || "",       // D
                    payAmount.toString(),            // E
                    paymentStatus,                  // F
                    dateStr,                        // G
                    bulkFormData.paymentMode,       // H
                    proofUrl,                       // I
                ];

                const paidParams = new URLSearchParams({
                    action: "insert",
                    sheetName: "PAID-DATA",
                    rowData: JSON.stringify(paidRow),
                });
                await fetch(`${SHEET_API_URL}`, { method: "POST", body: paidParams });
                successCount++;
            }

            toast.success(`Processed ${successCount} payments!`, { id: toastId });
            setBulkOpen(false);
            fetchData();
        } catch (err: any) {
            console.error(err);
            toast.error(err.message || "Bulk Payment Failed", { id: toastId });
        } finally {
            setIsSubmitting(false);
        }
    }, [bulkInvoices, bulkTotalToPay, bulkFormData, selectedVendor, records, fetchData]);

    // ─── Render ───────────────────────────────────────────────────────────────
    return (
        <div className="p-6">
            {/* Header */}
            <div className="mb-6 p-6 bg-white border rounded-lg shadow-sm flex justify-between items-center">
                <div>
                    <h2 className="text-2xl font-bold">Stage 13: Vendor Payments</h2>
                    <p className="text-gray-600 mt-1">Pending payments (Verified Accounts)</p>
                </div>

                <div className="flex gap-4 items-center">
                    <Button
                        onClick={handleBulkOpen}
                        className="bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-700 hover:to-green-700 text-white shadow-md hover:shadow-lg transition-all duration-200 ease-in-out transform hover:-translate-y-0.5 gap-2 px-6"
                    >
                        <Banknote className="w-4 h-4" /> Payment
                    </Button>

                    <div className="relative flex-1 max-w-sm">
                        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-500" />
                        <Input
                            placeholder="Search by Invoice, Vendor, Item, PO..."
                            value={searchTerm}
                            onChange={handleSearchChange}
                            className="pl-9 bg-white w-[300px]"
                        />
                    </div>

                    <Button
                        variant="outline"
                        onClick={() => handleSort('plan1')}
                        className="bg-white"
                        title="Sort by Due Date"
                    >
                        Due Date
                        {sortConfig?.key === 'plan1' ? (
                            sortConfig.direction === 'asc' ? <ArrowUp className="w-4 h-4 ml-2" /> : <ArrowDown className="w-4 h-4 ml-2" />
                        ) : (
                            <ArrowUpDown className="w-4 h-4 ml-2 text-gray-400" />
                        )}
                    </Button>

                    <Select value="" onValueChange={() => { }}>
                        <SelectTrigger className="w-40"><SelectValue placeholder="Columns" /></SelectTrigger>
                        <SelectContent className="max-h-64">
                            {PENDING_COLUMNS.map(c => (
                                <div key={c.key} className="flex items-center p-2 gap-2">
                                    <Checkbox
                                        checked={selectedPendingColumns.includes(c.key)}
                                        onCheckedChange={chk => handleColumnToggle(c.key, !!chk)}
                                    />
                                    <span className="text-sm">{c.label}</span>
                                </div>
                            ))}
                        </SelectContent>
                    </Select>

                    <Button variant="outline" onClick={fetchData} disabled={isLoading}>
                        {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                    </Button>
                </div>
            </div>

            {/* Tables */}
            {isLoading ? (
                <div className="flex justify-center items-center h-64">
                    <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
                    <span className="ml-2 text-gray-500">Loading verified invoices...</span>
                </div>
            ) : (
                <Tabs value={activeTab} onValueChange={handleTabChange}>
                    <TabsList className="grid w-full grid-cols-2">
                        <TabsTrigger value="pending">Pending ({filteredRecords.length})</TabsTrigger>
                        <TabsTrigger value="history">History ({filteredHistoryRecords.length})</TabsTrigger>
                    </TabsList>

                    <TabsContent value="pending" className="mt-6">
                        {filteredRecords.length === 0 ? (
                            <div className="text-center py-12 text-gray-500">No pending payments</div>
                        ) : (
                            <div className="border rounded-lg overflow-x-auto">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            {visiblePendingColumns.map(c => <TableHead key={c.key}>{c.label}</TableHead>)}
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {filteredRecords.map(rec => (
                                            <TableRow key={rec.id}>
                                                {visiblePendingColumns.map(c => (
                                                    <TableCell key={c.key}>{safeValue(rec.data[c.key])}</TableCell>
                                                ))}
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </div>
                        )}
                    </TabsContent>

                    <TabsContent value="history" className="mt-6">
                        <div className="mb-4 text-sm text-gray-600">
                            Showing partial and full payment transaction history.
                        </div>
                        {filteredHistoryRecords.length === 0 ? (
                            <div className="text-center py-12 text-gray-500">No payment transaction history</div>
                        ) : (
                            <div className="border rounded-lg overflow-x-auto">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            {HISTORY_COLUMNS.map(c => <TableHead key={c.key}>{c.label}</TableHead>)}
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {filteredHistoryRecords.map(rec => (
                                            <TableRow key={rec.id}>
                                                {HISTORY_COLUMNS.map(c => (
                                                    <TableCell key={c.key}>
                                                        {c.key === "amountPaid" ? (
                                                            <span className="font-medium">₹ {rec[c.key]}</span>
                                                        ) : c.key === "status" ? (
                                                            <Badge variant={rec[c.key] === "Paid" ? "default" : "secondary"}>
                                                                {rec[c.key]}
                                                            </Badge>
                                                        ) : (
                                                            safeValue(rec[c.key])
                                                        )}
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

            {/* Bulk Payment Dialog */}
            <Dialog open={bulkOpen} onOpenChange={setBulkOpen}>
                <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>Processing Payment</DialogTitle>
                        <DialogDescription>
                            {bulkStep === "vendor"
                                ? "Select a vendor to view pending invoices."
                                : `Process payments for ${selectedVendor}`}
                        </DialogDescription>
                    </DialogHeader>

                    {bulkStep === "vendor" ? (
                        <div className="space-y-4 py-4 min-h-[300px]">
                            <Input
                                placeholder="Search vendor..."
                                value={vendorSearch}
                                onChange={handleVendorSearchChange}
                                className="mb-4"
                            />
                            <ScrollArea className="h-[300px] border rounded-md p-2">
                                {filteredVendors.length === 0 ? (
                                    <div className="text-center text-gray-500 py-10">No pending vendors found</div>
                                ) : (
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                        {filteredVendors.map(vendor => (
                                            <Button
                                                key={vendor}
                                                variant="outline"
                                                className="justify-start h-auto py-3 px-4 text-left"
                                                onClick={() => handleVendorSelect(vendor)}
                                            >
                                                {vendor}
                                            </Button>
                                        ))}
                                    </div>
                                )}
                            </ScrollArea>
                        </div>
                    ) : (
                        <div className="space-y-6">
                            <div className="border rounded-lg overflow-hidden">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead className="w-[50px]"></TableHead>
                                            <TableHead>Invoice #</TableHead>
                                            <TableHead>Date</TableHead>
                                            <TableHead className="text-right">Total Amt</TableHead>
                                            <TableHead className="text-right">Total Paid</TableHead>
                                            <TableHead className="text-right">Pending</TableHead>
                                            <TableHead className="w-[150px]">Pay Amount</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {Object.keys(bulkInvoices).map(id => {
                                            const rec = records.find(r => r.id === id);
                                            if (!rec) return null;
                                            const info = bulkInvoices[id];
                                            return (
                                                <TableRow key={id} className={info.selected ? "bg-blue-50" : ""}>
                                                    <TableCell>
                                                        <Checkbox
                                                            checked={info.selected}
                                                            onCheckedChange={c => handleBulkInvoiceToggle(id, !!c)}
                                                        />
                                                    </TableCell>
                                                    <TableCell className="font-medium">{rec.data.invoiceNo}</TableCell>
                                                    <TableCell>{rec.data.invoiceDate}</TableCell>
                                                    <TableCell className="text-right">{rec.data.totalVal}</TableCell>
                                                    <TableCell className="text-right">{rec.data.totalPaid}</TableCell>
                                                    <TableCell className="text-right text-red-600 font-medium">{info.originalPending.toFixed(2)}</TableCell>
                                                    <TableCell>
                                                        <Input
                                                            type="number"
                                                            className="h-8 w-32"
                                                            value={info.payAmount}
                                                            onChange={e => handleBulkAmountChange(id, e.target.value)}
                                                            disabled={!info.selected}
                                                        />
                                                    </TableCell>
                                                </TableRow>
                                            );
                                        })}
                                    </TableBody>
                                </Table>
                            </div>

                            <div className="grid grid-cols-2 gap-6 p-4 bg-gray-50 rounded-lg">
                                <div className="space-y-4">
                                    <div>
                                        <Label>Payment Mode / Details *</Label>
                                        <Input
                                            placeholder="IMPS / RTGS / Cheque Details"
                                            value={bulkFormData.paymentMode}
                                            onChange={handlePaymentModeChange}
                                        />
                                    </div>
                                    <div className="flex flex-col gap-2">
                                        <Label>Payment Date *</Label>
                                        <Popover>
                                            <PopoverTrigger asChild>
                                                <Button
                                                    variant="outline"
                                                    className={cn(
                                                        "w-full justify-start text-left font-normal bg-white",
                                                        !bulkFormData.paymentDate && "text-muted-foreground"
                                                    )}
                                                >
                                                    <CalendarIcon className="mr-2 h-4 w-4" />
                                                    {bulkFormData.paymentDate
                                                        ? format(bulkFormData.paymentDate, "PPP")
                                                        : <span>Pick a date</span>}
                                                </Button>
                                            </PopoverTrigger>
                                            <PopoverContent className="w-auto p-0" align="start">
                                                <Calendar
                                                    mode="single"
                                                    selected={bulkFormData.paymentDate}
                                                    onSelect={handlePaymentDateChange}
                                                    initialFocus
                                                />
                                            </PopoverContent>
                                        </Popover>
                                    </div>
                                </div>
                                <div className="space-y-4">
                                    <div>
                                        <Label>Payment Proof (Optional)</Label>
                                        <div className="mt-1 border-2 border-dashed bg-white rounded-lg p-4 flex flex-col items-center justify-center text-center cursor-pointer hover:bg-gray-50 transition-colors relative h-[100px]">
                                            <input
                                                type="file"
                                                className="absolute inset-0 opacity-0 cursor-pointer"
                                                onChange={handleProofChange}
                                                accept="image/*,application/pdf"
                                            />
                                            <Upload className="w-5 h-5 text-gray-400 mb-1" />
                                            <span className="text-xs font-medium text-gray-700">
                                                {bulkFormData.proof ? bulkFormData.proof.name : "Upload Proof"}
                                            </span>
                                        </div>
                                    </div>
                                    <div className="flex justify-between items-center text-lg font-bold pt-2 border-t">
                                        <span>Total Paying:</span>
                                        <span className="text-green-700">₹ {bulkTotalToPay.toFixed(2)}</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    <DialogFooter className="mt-4">
                        {bulkStep === "invoices" && (
                            <Button variant="outline" onClick={handleBackToVendors} className="mr-auto">
                                Back to Vendors
                            </Button>
                        )}
                        <Button variant="ghost" onClick={handleCloseBulk}>Cancel</Button>
                        {bulkStep === "vendor" ? (
                            <Button disabled className="opacity-50">Select a Vendor</Button>
                        ) : (
                            <Button
                                onClick={handleBulkSubmit}
                                disabled={isSubmitting || bulkTotalToPay <= 0}
                                className="bg-green-600 hover:bg-green-700 min-w-[150px]"
                            >
                                {isSubmitting
                                    ? <Loader2 className="w-4 h-4 animate-spin mr-2" />
                                    : <CheckCircle className="w-4 h-4 mr-2" />}
                                Pay ₹{bulkTotalToPay.toFixed(2)}
                            </Button>
                        )}
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}