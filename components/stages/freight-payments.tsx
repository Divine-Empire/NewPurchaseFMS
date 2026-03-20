"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { toast } from "sonner";
import { Loader2, FileText, RefreshCw, Upload, CalendarIcon, Search } from "lucide-react";
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
import { Checkbox } from "@/components/ui/checkbox";
import { format } from "date-fns";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn, formatDate as sharedFormatDate, getFmsTimestamp } from "@/lib/utils";

// ─── Module-level constants (never re-created on render) ──────────────────────
const SHEET_API_URL = process.env.NEXT_PUBLIC_API_URI;
const IMAGE_FOLDER_ID = process.env.NEXT_PUBLIC_IMAGE_FOLDER_ID;

// Column definitions are stable — defined outside component to avoid recreation
const COLUMNS = [
    { key: "lrNo", label: "LR No." },
    { key: "biltyImage", label: "Bilty" },
    { key: "freightAmount", label: "Freight Amt" },
    { key: "transporter", label: "Transporter" },
    { key: "vehicleNo", label: "Vehicle No." },
    { key: "contact", label: "Contact" },
    { key: "advanceAmount", label: "Advance" },
    { key: "totalPaid", label: "Paid" },
    { key: "pendingAmount", label: "Pending" },
    { key: "plan1", label: "Planned" },
    { key: "actual1", label: "Actual" },
    { key: "planned", label: "Planned" }, // for history
    { key: "actual", label: "Actual" },   // for history
    { key: "amountPaid", label: "Amount Paid" }, // for history
    { key: "date", label: "Payment Date" },
    { key: "mode", label: "Mode" },
    { key: "status", label: "Status" },
    { key: "proof", label: "Proof" },
    { key: "invoiceNo", label: "Invoice No." },
    { key: "invoiceCopy", label: "Invoice" },
] as const;

const ALL_COLUMN_KEYS = COLUMNS.map(c => c.key);

// Stable date formatter — defined outside component, not re-created each row
const formatDate = (d: any): string => sharedFormatDate(d);

// Stable float parser
const parseNum = (val: any): number =>
    parseFloat(String(val || 0).replace(/,/g, "")) || 0;

const gsNow = (): string => getFmsTimestamp();

// Default form state factory — avoids sharing mutable reference
const defaultForm = () => ({
    amount: "",
    paymentDetails: "",
    paymentDate: new Date(),
    paymentStatus: "pending",
    totalPaid: "",
    pendingAmount: "",
    paymentProof: null as File | null,
});

// ─── Component ────────────────────────────────────────────────────────────────
export default function Stage14() {
    const [records, setRecords] = useState<any[]>([]);
    const [historyRecords, setHistoryRecords] = useState<any[]>([]);
    const [searchTerm, setSearchTerm] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [open, setOpen] = useState(false);
    const [selectedRecordId, setSelectedRecordId] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState<"pending" | "history">("pending");
    const [formData, setFormData] = useState(defaultForm);
    const [calcData, setCalcData] = useState({ freightAmount: 0, advanceAmount: 0 });
    const [selectedColumns, setSelectedColumns] = useState<string[]>(ALL_COLUMN_KEYS);

    // ── Fetch ─────────────────────────────────────────────────────────────────
    const fetchData = useCallback(async () => {
        if (!SHEET_API_URL) return;
        setIsLoading(true);
        try {
            const [frtRes, histRes] = await Promise.all([
                fetch(`${SHEET_API_URL}?sheet=FREIGHT-PAYMENTS&action=getAll`),
                fetch(`${SHEET_API_URL}?sheet=PAID-DATA&action=getAll`)
            ]);
            const [frtJson, histJson] = await Promise.all([frtRes.json(), histRes.json()]);

            if (frtJson.success && Array.isArray(frtJson.data)) {
                // FREIGHT-PAYMENTS mapping
                const rows = frtJson.data
                    .slice(6)
                        .map((row: any, i: number) => ({ row, originalIndex: i + 7 }))
                        .filter(({ row }: any) => row[1] && String(row[1]).trim() !== "")
                        .map(({ row, originalIndex }: any) => {
                            const plan1 = row[9];
                            const actual1 = row[10];
                            const freightAmt = parseNum(row[3]);
                        const pendingRaw = row[13];
                        const currentPending = (pendingRaw !== undefined && pendingRaw !== "" && pendingRaw !== "-")
                            ? parseNum(pendingRaw)
                            : freightAmt;
                        const totalPaid = parseNum(row[12]);

                        return {
                            id: `${String(row[1]).trim()}_${originalIndex}`,
                            rowIndex: originalIndex,
                            status: "pending", // we'll filter below
                            data: {
                                lrNo: row[1] || "",
                                biltyImage: row[2] || "",
                                freightAmount: row[3] || "",
                                transporter: row[4] || "",
                                vehicleNo: row[5] || "",
                                contact: row[6] || "",
                                advanceAmount: row[7] || "",
                                paymentDate: formatDate(row[8]),
                                plan1: formatDate(plan1),
                                actual1: formatDate(actual1),
                                totalPaid,
                                pendingAmount: currentPending,
                                invoiceNo: row[14] || "",
                                invoiceCopy: row[15] || "",
                                freightVal: freightAmt,
                                advanceVal: parseNum(row[7]),
                            },
                        };
                    });

                setRecords(rows.filter((r: any) => r.data.pendingAmount > 1));

                // Join with PAID-DATA for History
                if (histJson.success && Array.isArray(histJson.data)) {
                    const lookupMap = new Map();
                    frtJson.data.slice(6).forEach((row: any) => {
                        const lrNo = String(row[1] || "").trim();
                        if (lrNo) {
                            lookupMap.set(lrNo, {
                                planned: formatDate(row[9]),
                                actual: formatDate(row[10])
                            });
                        }
                    });

                    const hRows = histJson.data
                        .slice(1)
                        .map((row: any, i: number) => ({ row, id: `HIST_${i}` }))
                        .filter(({ row }: any) => row[1] === "Freight Payment")
                        .map(({ row, id }: any) => {
                            const lrNo = String(row[2] || "").trim();
                            const extra = lookupMap.get(lrNo) || { planned: "-", actual: "-" };
                            return {
                                id,
                                lrNo: row[2],
                                transporter: row[3],
                                amountPaid: row[4],
                                status: row[5],
                                date: formatDate(row[6]),
                                planned: extra.planned,
                                actual: extra.actual,
                                mode: row[7],
                                proof: row[8],
                            };
                        });
                    setHistoryRecords(hRows.reverse());
                }
            }
        } catch (e) {
            console.error("Fetch error:", e);
            toast.error("Failed to load data");
        }
        setIsLoading(false);
    }, []);

    useEffect(() => { fetchData(); }, [fetchData]);

    // ── Derived state (memoized) ──────────────────────────────────────────────
    const searchLower = useMemo(() => searchTerm.toLowerCase(), [searchTerm]);

    const filteredPending = useMemo(() =>
        records.filter(r => {
            if (!searchLower) return true;
            return (
                String(r.data.lrNo || "").toLowerCase().includes(searchLower) ||
                String(r.data.transporter || "").toLowerCase().includes(searchLower) ||
                String(r.data.vehicleNo || "").toLowerCase().includes(searchLower) ||
                String(r.data.contact || "").toLowerCase().includes(searchLower)
            );
        }),
        [records, searchLower]);

    const filteredHistory = useMemo(() =>
        historyRecords.filter(r => {
            if (!searchLower) return true;
            return (
                String(r.lrNo || "").toLowerCase().includes(searchLower) ||
                String(r.transporter || "").toLowerCase().includes(searchLower)
            );
        }),
        [historyRecords, searchLower]);

    // Only the visible columns (memoized to avoid re-filtering on every render)
    const visibleColumns = useMemo(() =>
        COLUMNS.filter(c => selectedColumns.includes(c.key)),
        [selectedColumns]);

    // ── Column toggle ─────────────────────────────────────────────────────────
    const handleColumnToggle = useCallback((key: string, checked: boolean) => {
        setSelectedColumns(prev =>
            checked ? [...prev, key] : prev.filter(k => k !== key)
        );
    }, []);

    // ── Modal open ────────────────────────────────────────────────────────────
    const handleOpenForm = useCallback((recordId: string) => {
        const rec = records.find(r => r.id === recordId);
        if (!rec) return;

        const freight = rec.data.freightVal;
        const advance = rec.data.advanceVal;
        const pendingAmt = rec.data.pendingAmount > 0
            ? rec.data.pendingAmount
            : (freight - advance);

        setSelectedRecordId(recordId);
        setFormData({
            amount: (pendingAmt > 0 ? pendingAmt : 0).toFixed(2),
            paymentDetails: "",
            paymentDate: new Date(),
            paymentStatus: pendingAmt <= 1 ? "paid" : "pending",
            totalPaid: rec.data.totalPaid.toString(),
            pendingAmount: (pendingAmt > 0 ? pendingAmt : 0).toFixed(2),
            paymentProof: null,
        });
        setCalcData({ freightAmount: freight, advanceAmount: advance });
        setOpen(true);
    }, [records]);

    // ── Submit ────────────────────────────────────────────────────────────────
    const handleSubmit = useCallback(async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedRecordId) return;

        const rec = records.find(r => r.id === selectedRecordId);
        if (!rec) return;

        setIsSubmitting(true);
        const toastId = toast.loading("Processing Freight Payment...");

        try {
            const dateStr = format(formData.paymentDate, "yyyy-MM-dd");

            // 1. Upload proof (if any)
            let proofUrl = "";
            if (formData.paymentProof) {
                const base64Data = await new Promise<string>(resolve => {
                    const reader = new FileReader();
                    reader.onload = e => resolve(e.target?.result as string);
                    reader.readAsDataURL(formData.paymentProof!);
                });

                const upParams = new URLSearchParams({
                    action: "uploadFile",
                    fileName: `FRT_${rec.data.lrNo}_${Date.now()}`,
                    mimeType: formData.paymentProof.type,
                    base64Data,
                    ...(IMAGE_FOLDER_ID ? { folderId: IMAGE_FOLDER_ID } : {}),
                });
                const upRes = await fetch(`${SHEET_API_URL}`, { method: "POST", body: upParams });
                const upJson = await upRes.json();
                if (upJson.success) proofUrl = upJson.fileUrl;
            }

            // 2. Write ONLY to PAID-DATA (no writes to FREIGHT-PAYMENTS)
            // PAID-DATA schema: A=Timestamp, B=Status, C=LR No, D=Transporter,
            //                   E=Amount, F=Payment Status, G=Payment Due Date, H=Payment Type, I=Proof
            const payAmount = parseNum(formData.amount);
            const newTotalPaid = (rec.data.totalPaid || 0) + payAmount;
            const newPending = rec.data.freightVal - newTotalPaid;
            const paymentStatus = newPending <= 1 ? "Paid" : "Partial";

            const paidRow = [
                gsNow(),                       // A: Timestamp (M/D/YYYY H:MM:SS)
                "Freight Payment",             // B: Status tag
                rec.data.lrNo || "",    // C: LR No
                rec.data.transporter || "",    // D: Transporter
                payAmount.toString(),          // E: Amount
                paymentStatus,                 // F: Payment Status
                dateStr,                       // G: Payment Due Date
                formData.paymentDetails || "", // H: Payment Type/Details
                proofUrl,                      // I: Payment Proof
            ];

            const paidParams = new URLSearchParams({
                action: "insert",
                sheetName: "PAID-DATA",
                rowData: JSON.stringify(paidRow),
            });
            const paidRes = await fetch(`${SHEET_API_URL}`, { method: "POST", body: paidParams });
            const paidJson = await paidRes.json();

            if (paidJson.success) {
                toast.success("Freight Payment Recorded!", { id: toastId });
                setOpen(false);
                fetchData();
            } else {
                toast.warning("Logged, but update failed: " + (paidJson.error || "Unknown"), { id: toastId });
            }
        } catch (err: any) {
            console.error(err);
            toast.error(err.message || "Failed", { id: toastId });
        } finally {
            setIsSubmitting(false);
        }
    }, [selectedRecordId, records, formData, fetchData]);

    // ── Stable form field updaters ────────────────────────────────────────────
    const handleAmountChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) =>
        setFormData(prev => ({ ...prev, amount: e.target.value })), []);
    const handleDetailsChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) =>
        setFormData(prev => ({ ...prev, paymentDetails: e.target.value })), []);
    const handleDateChange = useCallback((date: Date | undefined) =>
        date && setFormData(prev => ({ ...prev, paymentDate: date })), []);
    const handleStatusChange = useCallback((v: string) =>
        setFormData(prev => ({ ...prev, paymentStatus: v })), []);
    const handleProofChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) =>
        setFormData(prev => ({ ...prev, paymentProof: e.target.files?.[0] || null })), []);
    const handleTabChange = useCallback((v: string) =>
        setActiveTab(v as "pending" | "history"), []);
    const handleSearchChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) =>
        setSearchTerm(e.target.value), []);
    const handleCloseDialog = useCallback(() => setOpen(false), []);

    // ── safeValue renderer (stable reference) ────────────────────────────────
    const safeValue = useCallback((val: any) => {
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
    }, []);

    // Memoize the selected record's LR No for the dialog description
    const selectedLrNo = useMemo(() =>
        records.find(r => r.id === selectedRecordId)?.data.lrNo ?? "",
        [records, selectedRecordId]);

    const visibleHistoryColumns = useMemo(() => {
        // Force the essential history columns strictly
        const historyKeys = ["lrNo", "transporter", "amountPaid", "date", "planned", "actual", "mode", "status", "proof"];
        return COLUMNS.filter(c => historyKeys.includes(c.key as string));
    }, []);

    const visiblePendingColumns = useMemo(() => {
        const pendingKeys = ["lrNo", "biltyImage", "freightAmount", "transporter", "vehicleNo", "contact", "advanceAmount", "totalPaid", "pendingAmount", "plan1", "actual1", "invoiceNo", "invoiceCopy"];
        return COLUMNS.filter(c => pendingKeys.includes(c.key as string) && selectedColumns.includes(c.key)).map(c => 
            c.key === "plan1" ? { ...c, label: "Planned" } : 
            c.key === "actual1" ? { ...c, label: "Actual" } : c
        );
    }, [selectedColumns]);

    // ── Render ────────────────────────────────────────────────────────────────
    return (
        <div className="flex flex-col min-h-screen bg-slate-50/30">
            {/* Sticky Header */}
            <div className="sticky top-0 z-30 bg-white/80 backdrop-blur-md border-b shadow-sm">
                <div className="max-w-[1600px] mx-auto">
                    <div className="p-4 md:p-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                        <div>
                            <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-3">
                                <span className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center shadow-blue-200 shadow-lg">
                                    <RefreshCw className="w-6 h-6 text-white" />
                                </span>
                                Stage 14: Freight Payments
                            </h1>
                            <p className="text-slate-500 text-sm mt-1 ml-13">Track and process transporter freight payments</p>
                        </div>

                        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
                            <div className="relative flex-1 md:w-80 group">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 group-focus-within:text-blue-500 transition-colors" />
                                <Input
                                    placeholder="Search by LR, Transporter, Vehicle..."
                                    value={searchTerm}
                                    onChange={handleSearchChange}
                                    className="pl-10 bg-slate-50 border-slate-200 focus:bg-white focus:ring-2 focus:ring-blue-100 transition-all h-10 rounded-xl shadow-none w-full"
                                />
                            </div>

                            <Select value="" onValueChange={() => { }}>
                                <SelectTrigger className="h-10 w-32 rounded-xl border-slate-200 bg-white hover:bg-slate-50">
                                    <SelectValue placeholder="Columns" />
                                </SelectTrigger>
                                <SelectContent className="max-h-80 min-w-[200px] p-2">
                                    <div className="mb-2 px-2 py-1 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Visible Columns</div>
                                    {COLUMNS.map(c => (
                                        <div key={c.key} className="flex items-center p-2 gap-2 hover:bg-slate-50 rounded-lg cursor-pointer transition-colors" onClick={() => handleColumnToggle(c.key, !selectedColumns.includes(c.key))}>
                                            <Checkbox
                                                checked={selectedColumns.includes(c.key)}
                                                onCheckedChange={(chk) => handleColumnToggle(c.key, !!chk)}
                                                className="data-[state=checked]:bg-blue-600 border-slate-300"
                                            />
                                            <span className="text-sm text-slate-600 font-medium leading-none">{c.label}</span>
                                        </div>
                                    ))}
                                </SelectContent>
                            </Select>

                            <Button 
                                variant="outline" 
                                size="icon"
                                onClick={fetchData} 
                                disabled={isLoading}
                                className="h-10 w-10 rounded-xl bg-white hover:bg-slate-50 border-slate-200 flex-shrink-0"
                            >
                                <RefreshCw className={`w-4 h-4 text-slate-600 ${isLoading ? "animate-spin" : ""}`} />
                            </Button>
                        </div>
                    </div>

                    <div className="px-6 pb-2">
                        <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
                            <TabsList className="bg-slate-200/50 p-1 rounded-xl h-11 inline-flex w-auto mb-2">
                                <TabsTrigger 
                                    value="pending" 
                                    className="rounded-lg px-6 data-[state=active]:bg-white data-[state=active]:shadow-sm data-[state=active]:text-blue-600 transition-all font-medium"
                                >
                                    Pending ({filteredPending.length})
                                </TabsTrigger>
                                <TabsTrigger 
                                    value="history"
                                    className="rounded-lg px-6 data-[state=active]:bg-white data-[state=active]:shadow-sm data-[state=active]:text-blue-600 transition-all font-medium"
                                >
                                    History ({filteredHistory.length})
                                </TabsTrigger>
                            </TabsList>
                        </Tabs>
                    </div>
                </div>
            </div>

            {/* Main Content Area */}
            <div className="p-4 md:p-6 max-w-[1600px] mx-auto w-full flex-1">
                {isLoading && records.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-80 bg-white border border-slate-200 rounded-3xl shadow-sm">
                        <div className="relative mb-6">
                            <div className="w-16 h-16 border-4 border-blue-50 border-t-blue-600 rounded-full animate-spin"></div>
                            <RefreshCw className="w-7 h-7 text-blue-600 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 animate-pulse" />
                        </div>
                        <h3 className="text-lg font-bold text-slate-900">Syncing Freight Records</h3>
                        <p className="text-slate-500 mt-1 max-w-sm text-center">Fetching pending and history data from server...</p>
                    </div>
                ) : (
                    <div className="bg-white border border-slate-100 rounded-3xl shadow-sm overflow-hidden flex flex-col h-full ring-1 ring-slate-400/5">
                        <Tabs value={activeTab} className="w-full flex flex-col h-full">
                            {/* PENDING TAB */}
                            <TabsContent value="pending" className="flex-1 mt-0 focus-visible:outline-none">
                                {filteredPending.length === 0 ? (
                                    <div className="py-24 flex flex-col items-center justify-center text-center">
                                        <div className="w-24 h-24 bg-slate-50 rounded-full flex items-center justify-center mb-6">
                                            <FileText className="w-12 h-12 text-slate-300" />
                                        </div>
                                        <h3 className="text-2xl font-bold text-slate-900">No pending freight</h3>
                                        <p className="text-slate-500 mt-2">All transporter payments are up to date.</p>
                                    </div>
                                ) : (
                                    <div className="overflow-x-auto overflow-y-auto max-h-[calc(100vh-320px)] custom-scrollbar">
                                        <table className="w-full text-sm text-left border-separate border-spacing-0 min-w-[1800px]">
                                            <thead className="sticky top-0 z-[50]">
                                                <tr className="bg-slate-200">
                                                    <th className="px-5 py-4 font-bold text-slate-900 bg-slate-200 sticky left-0 top-0 z-[60] border-b border-r border-slate-300 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]">Action</th>
                                                    {visiblePendingColumns.map(c => (
                                                        <th key={c.key} className="px-5 py-4 font-bold text-slate-900 whitespace-nowrap tracking-tight bg-slate-200 sticky top-0 z-[50] border-b border-slate-300">
                                                            {c.label}
                                                        </th>
                                                    ))}
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-100">
                                                {filteredPending.map(rec => (
                                                    <tr key={rec.id} className="hover:bg-blue-50/30 transition-all duration-150 group">
                                                        <td className="px-5 py-4 sticky left-0 z-[40] bg-white border-b border-r border-slate-100 group-hover:bg-blue-50 transition-colors shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]">
                                                            <Button size="sm" onClick={() => handleOpenForm(rec.id)} className="bg-blue-600 hover:bg-blue-700 h-8 px-4 rounded-lg shadow-sm">
                                                                Pay
                                                            </Button>
                                                        </td>
                                                        {visiblePendingColumns.map(c => (
                                                            <td key={c.key} className={cn(
                                                                "px-5 py-4 whitespace-nowrap font-medium transition-colors border-b border-slate-100",
                                                                c.key === "lrNo" ? "text-slate-900 font-bold" : "text-slate-600",
                                                                c.key === "pendingAmount" && rec.data[c.key] > 0 ? "text-red-600 font-bold bg-red-50/30" : ""
                                                            )}>
                                                                {c.key === "pendingAmount" || c.key === "freightAmount" || c.key === "advanceAmount" 
                                                                    ? `₹ ${parseNum(rec.data[c.key]).toLocaleString()}` 
                                                                    : safeValue(rec.data[c.key])}
                                                            </td>
                                                        ))}
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                )}
                            </TabsContent>

                            {/* HISTORY TAB */}
                            <TabsContent value="history" className="flex-1 mt-0 focus-visible:outline-none">
                                {filteredHistory.length === 0 ? (
                                    <div className="py-24 flex flex-col items-center justify-center text-center">
                                        <div className="w-24 h-24 bg-slate-50 rounded-full flex items-center justify-center mb-6">
                                            <FileText className="w-12 h-12 text-slate-200" />
                                        </div>
                                        <h3 className="text-lg font-semibold text-slate-900">No history found</h3>
                                        <p className="text-slate-500 mt-2">Processed payments will appear here.</p>
                                    </div>
                                ) : (
                                    <div className="overflow-x-auto overflow-y-auto max-h-[calc(100vh-320px)] custom-scrollbar">
                                        <table className="w-full text-sm text-left border-separate border-spacing-0 min-w-[1800px]">
                                            <thead className="sticky top-0 z-[50]">
                                                <tr className="bg-slate-200">
                                                    {visibleHistoryColumns.map(c => (
                                                        <th key={c.key} className={cn(
                                                            "px-5 py-4 font-bold text-slate-900 whitespace-nowrap tracking-tight bg-slate-200 sticky top-0 z-[50] border-b border-slate-300",
                                                            c.key === "lrNo" ? "!z-[60] left-0 border-r shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]" : ""
                                                        )}>
                                                            {c.label}
                                                        </th>
                                                    ))}
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-100">
                                                {filteredHistory.map(rec => (
                                                    <tr key={rec.id} className="hover:bg-slate-50/80 transition-all duration-150 group">
                                                        {visibleHistoryColumns.map(c => (
                                                            <td key={c.key} className={cn(
                                                                "px-5 py-4 whitespace-nowrap font-medium transition-colors border-b border-slate-100",
                                                                c.key === "lrNo" ? "text-slate-900 font-bold sticky left-0 z-[40] bg-white border-r shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]" : "text-slate-600 group-hover:bg-slate-50 transition-colors"
                                                            )}>
                                                                {c.key === "planned" || c.key === "actual" 
                                                                    ? safeValue((rec as any)[c.key])
                                                                    : c.key === "amountPaid"
                                                                        ? `₹ ${parseNum((rec as any)[c.key]).toLocaleString()}` 
                                                                        : safeValue((rec as any)[c.key])}
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
                )}
            </div>

            {/* Payment Dialog */}
            <Dialog open={open} onOpenChange={setOpen}>
                <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>Freight Payment</DialogTitle>
                        <DialogDescription>
                            Enter payment details for LR #{selectedLrNo}
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4 py-2">
                        <div className="grid grid-cols-2 gap-4 bg-gray-50 p-3 rounded-md border">
                            <div>
                                <Label className="text-xs text-gray-500">Freight Amount</Label>
                                <div className="font-semibold">₹{calcData.freightAmount}</div>
                            </div>
                            <div>
                                <Label className="text-xs text-gray-500">Advance Given</Label>
                                <div className="font-semibold">₹{calcData.advanceAmount}</div>
                            </div>
                        </div>

                        <div>
                            <Label>Payment Amount *</Label>
                            <Input
                                type="number"
                                value={formData.amount}
                                onChange={handleAmountChange}
                            />
                        </div>

                        <div>
                            <Label>Payment Details *</Label>
                            <Input
                                placeholder="e.g. Bank Transfer, Cash, Cheque"
                                value={formData.paymentDetails}
                                onChange={handleDetailsChange}
                            />
                        </div>

                        <div className="flex flex-col gap-2">
                            <Label>Payment Date *</Label>
                            <Popover>
                                <PopoverTrigger asChild>
                                    <Button
                                        variant="outline"
                                        className={cn(
                                            "w-full justify-start text-left font-normal",
                                            !formData.paymentDate && "text-muted-foreground"
                                        )}
                                    >
                                        <CalendarIcon className="mr-2 h-4 w-4" />
                                        {formData.paymentDate ? format(formData.paymentDate, "PPP") : <span>Pick a date</span>}
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-auto p-0" align="start">
                                    <Calendar
                                        mode="single"
                                        selected={formData.paymentDate}
                                        onSelect={handleDateChange}
                                        initialFocus
                                    />
                                </PopoverContent>
                            </Popover>
                        </div>

                        <div>
                            <Label>Payment Status *</Label>
                            <Select value={formData.paymentStatus} onValueChange={handleStatusChange}>
                                <SelectTrigger><SelectValue placeholder="Select status" /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="paid">Paid</SelectItem>
                                    <SelectItem value="pending">Pending</SelectItem>
                                    <SelectItem value="partial">Partial</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        <div>
                            <Label>Payment Proof</Label>
                            <div className="mt-1 border-2 border-dashed rounded-lg p-6 flex flex-col items-center justify-center text-center cursor-pointer hover:bg-gray-50 hover:border-gray-400 transition-colors relative">
                                <input
                                    type="file"
                                    className="absolute inset-0 opacity-0 cursor-pointer"
                                    onChange={handleProofChange}
                                    accept="image/*,application/pdf"
                                />
                                <Upload className="w-6 h-6 text-gray-400 mb-2" />
                                <span className="text-sm font-medium text-gray-700">
                                    {formData.paymentProof ? formData.paymentProof.name : "Upload file"}
                                </span>
                            </div>
                        </div>
                    </div>

                    <DialogFooter>
                        <Button variant="outline" onClick={handleCloseDialog}>Cancel</Button>
                        <Button onClick={handleSubmit} disabled={isSubmitting} className="bg-gray-600 hover:bg-gray-700">
                            Process Payment
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}