"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { toast } from "sonner";
import { Loader2, FileText, RefreshCw, Upload, CalendarIcon, Search } from "lucide-react";
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
import { Checkbox } from "@/components/ui/checkbox";
import { format } from "date-fns";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

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
    { key: "advanceAmount", label: "Advance Amt" },
    { key: "totalPaid", label: "Total Paid" },
    { key: "pendingAmount", label: "Pending Amt" },
    { key: "invoiceNo", label: "Invoice No." },
    { key: "invoiceCopy", label: "Invoice" },
    { key: "plan1", label: "Planned Date" },
    { key: "actual1", label: "Payment Date" },
] as const;

const ALL_COLUMN_KEYS = COLUMNS.map(c => c.key);

// Stable date formatter — defined outside component, not re-created each row
const formatDate = (d: any): string => {
    if (!d) return "";
    const str = String(d);
    if (str.includes("T")) return str.split("T")[0];
    return str;
};

// Stable float parser
const parseNum = (val: any): number =>
    parseFloat(String(val || 0).replace(/,/g, "")) || 0;

// Google Sheets compatible timestamp  (M/D/YYYY H:MM:SS)
const gsNow = (): string => {
    const n = new Date();
    return `${n.getMonth() + 1}/${n.getDate()}/${n.getFullYear()} ${n.getHours()}:${String(n.getMinutes()).padStart(2, "0")}:${String(n.getSeconds()).padStart(2, "0")}`;
};

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
            const res = await fetch(`${SHEET_API_URL}?sheet=FREIGHT-PAYMENTS&action=getAll`);
            const json = await res.json();

            if (json.success && Array.isArray(json.data)) {
                // New sheet structure — data starts row 7 (slice 6, index base 7)
                // A(0)=Timestamp, B(1)=LR No, C(2)=Bilty Image, D(3)=Freight Amount
                // E(4)=Transporter Name, F(5)=Vehicle No, G(6)=Contact, H(7)=Advance Amount
                // I(8)=Payment Date, J(9)=Planned1, K(10)=Actual1, L(11)=Delay1
                // M(12)=Total Paid, N(13)=Pending Amount
                const rows = json.data
                    .slice(6)
                    .map((row: any, i: number) => ({ row, originalIndex: i + 7 }))
                    .filter(({ row }: any) => row[1] && String(row[1]).trim() !== "")
                    .map(({ row, originalIndex }: any) => {
                        const plan1 = row[9];
                        const actual1 = row[10];
                        const hasPlan = !!plan1 && String(plan1).trim() !== "" && String(plan1).trim() !== "-";
                        const hasActual = !!actual1 && String(actual1).trim() !== "" && String(actual1).trim() !== "-";

                        const freightAmt = parseNum(row[3]);
                        const pendingRaw = row[13];
                        const currentPending = (pendingRaw !== undefined && pendingRaw !== "" && pendingRaw !== "-")
                            ? parseNum(pendingRaw)
                            : freightAmt;
                        const totalPaid = parseNum(row[12]);

                        let status = "not_ready";
                        if (hasPlan) {
                            status = (!hasActual || currentPending > 1) ? "pending" : "history";
                        }

                        return {
                            id: `${String(row[1]).trim()}_${originalIndex}`,
                            rowIndex: originalIndex,
                            status,
                            data: {
                                lrNo: row[1] || "",          // B
                                biltyImage: row[2] || "",          // C
                                freightAmount: row[3] || "",          // D
                                transporter: row[4] || "",          // E
                                vehicleNo: row[5] || "",          // F
                                contact: row[6] || "",          // G
                                advanceAmount: row[7] || "",          // H
                                paymentDate: formatDate(row[8]),     // I
                                plan1: formatDate(plan1),      // J
                                actual1: formatDate(actual1),    // K
                                totalPaid,                             // M
                                pendingAmount: currentPending,         // N
                                invoiceNo: row[14] || "", // O
                                invoiceCopy: row[15] || "", // P
                                // Calculated for modal
                                freightVal: freightAmt,
                                advanceVal: parseNum(row[7]),
                            },
                        };
                    });

                setRecords(rows);
            }
        } catch (e) {
            console.error("Fetch error:", e);
            toast.error("Failed to load data");
        }
        setIsLoading(false);
    }, []); // SHEET_API_URL is module-level constant — safe as dep

    useEffect(() => { fetchData(); }, [fetchData]);

    // ── Derived state (memoized) ──────────────────────────────────────────────
    const searchLower = useMemo(() => searchTerm.toLowerCase(), [searchTerm]);

    const pending = useMemo(() =>
        records.filter(r => {
            if (r.status !== "pending") return false;
            if (!searchLower) return true;
            return (
                String(r.data.lrNo || "").toLowerCase().includes(searchLower) ||
                String(r.data.transporter || "").toLowerCase().includes(searchLower) ||
                String(r.data.vehicleNo || "").toLowerCase().includes(searchLower) ||
                String(r.data.contact || "").toLowerCase().includes(searchLower)
            );
        }),
        [records, searchLower]);

    const completed = useMemo(() =>
        records.filter(r => {
            if (r.status !== "history") return false;
            if (!searchLower) return true;
            return (
                String(r.data.lrNo || "").toLowerCase().includes(searchLower) ||
                String(r.data.transporter || "").toLowerCase().includes(searchLower) ||
                String(r.data.vehicleNo || "").toLowerCase().includes(searchLower) ||
                String(r.data.contact || "").toLowerCase().includes(searchLower)
            );
        }),
        [records, searchLower]);

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

    // ── Render ────────────────────────────────────────────────────────────────
    return (
        <div className="p-6">
            {/* Header */}
            <div className="mb-6 p-6 bg-white border rounded-lg shadow-sm flex justify-between items-center">
                <div>
                    <h2 className="text-2xl font-bold">Stage 14: Freight Payments</h2>
                    <p className="text-gray-600 mt-1">Pending freight charges (Transporters)</p>
                </div>

                <div className="flex gap-4 items-center">
                    <div className="relative flex-1 max-w-sm">
                        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-500" />
                        <Input
                            placeholder="Search by LR, Transporter, Vehicle, Contact..."
                            value={searchTerm}
                            onChange={handleSearchChange}
                            className="pl-9 bg-white w-[300px]"
                        />
                    </div>

                    <Select value="" onValueChange={() => { }}>
                        <SelectTrigger className="w-40"><SelectValue placeholder="Columns" /></SelectTrigger>
                        <SelectContent className="max-h-64">
                            {COLUMNS.map(c => (
                                <div key={c.key} className="flex items-center p-2 gap-2">
                                    <Checkbox
                                        checked={selectedColumns.includes(c.key)}
                                        onCheckedChange={(chk) => handleColumnToggle(c.key, !!chk)}
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
                    <span className="ml-2 text-gray-500">Loading freight records...</span>
                </div>
            ) : (
                <Tabs value={activeTab} onValueChange={handleTabChange}>
                    <TabsList className="grid w-full grid-cols-2">
                        <TabsTrigger value="pending">Pending ({pending.length})</TabsTrigger>
                        <TabsTrigger value="history">History ({completed.length})</TabsTrigger>
                    </TabsList>

                    <TabsContent value="pending" className="mt-6">
                        {pending.length === 0 ? (
                            <div className="text-center py-12 text-gray-500">No pending freight payments</div>
                        ) : (
                            <div className="border rounded-lg overflow-x-auto">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead className="w-[100px] sticky left-0 z-20 bg-white shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]">Action</TableHead>
                                            {visibleColumns.map(c => <TableHead key={c.key}>{c.label}</TableHead>)}
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {pending.map(rec => (
                                            <TableRow key={rec.id}>
                                                <TableCell className="sticky left-0 z-20 bg-white shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]">
                                                    <Button size="sm" onClick={() => handleOpenForm(rec.id)} className="bg-blue-600 hover:bg-blue-700">
                                                        Pay
                                                    </Button>
                                                </TableCell>
                                                {visibleColumns.map(c => (
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
                        {completed.length === 0 ? (
                            <div className="text-center py-12 text-gray-500">No payment history</div>
                        ) : (
                            <div className="border rounded-lg overflow-x-auto">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            {visibleColumns.map(c => <TableHead key={c.key}>{c.label}</TableHead>)}
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {completed.map(rec => (
                                            <TableRow key={rec.id}>
                                                {visibleColumns.map(c => (
                                                    <TableCell key={c.key}>{safeValue(rec.data[c.key])}</TableCell>
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