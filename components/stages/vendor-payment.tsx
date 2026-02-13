"use client";

import React, { useState, useEffect, useMemo } from "react";
import { toast } from "sonner";
import { Loader2, FileText, RefreshCw, Upload, CheckCircle, CalendarIcon, Banknote, Search } from "lucide-react";
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

const SHEET_API_URL = process.env.NEXT_PUBLIC_API_URI;
const IMAGE_FOLDER_ID = process.env.NEXT_PUBLIC_IMAGE_FOLDER_ID;

// --- Helper Functions (Moved outside to prevent re-creation) ---

const toDate = (val: any) => {
    if (!val || String(val).trim() === "" || String(val).trim() === "-") return "-";
    try {
        const d = new Date(val);
        if (isNaN(d.getTime())) return val;
        return format(d, "dd-MM-yyyy");
    } catch {
        return val;
    }
};

const safeValue = (val: any) => {
    if (!val || val === "-" || val === "") return "-";
    if (typeof val === 'string' && (val.startsWith("http") || val.includes("drive.google"))) {
        return (
            <a href={val} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline flex items-center gap-1">
                <FileText className="w-3 h-3" /> View
            </a>
        );
    }
    return String(val);
};

// --- Main Component ---

export default function Stage13() {
    const [records, setRecords] = useState<any[]>([]);
    const [historyRecords, setHistoryRecords] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [activeTab, setActiveTab] = useState<"pending" | "history">("pending");
    const [searchTerm, setSearchTerm] = useState("");

    // Modal State
    const [bulkOpen, setBulkOpen] = useState(false);
    const [bulkStep, setBulkStep] = useState<"vendor" | "invoices">("vendor");
    const [selectedVendor, setSelectedVendor] = useState("");
    const [vendorSearch, setVendorSearch] = useState("");
    const [bulkInvoices, setBulkInvoices] = useState<Record<string, { selected: boolean, payAmount: string, originalPending: number }>>({});
    const [bulkFormData, setBulkFormData] = useState<{
        paymentMode: string;
        paymentDate: Date | undefined;
        proof: File | null;
    }>({
        paymentMode: "",
        paymentDate: new Date(),
        proof: null,
    });

    const fetchData = async () => {
        if (!SHEET_API_URL) return;
        setIsLoading(true);
        try {
            const [payRes, histRes] = await Promise.all([
                fetch(`${SHEET_API_URL}?sheet=VENDOR-PAYMENTS&action=getAll`),
                fetch(`${SHEET_API_URL}?sheet=PAID-DATA&action=getAll`)
            ]);

            const payJson = await payRes.json();
            const histJson = await histRes.json();

            // 1. Process Pending
            if (payJson.success && Array.isArray(payJson.data)) {
                const rows = payJson.data.slice(6)
                    .map((row: any, i: number) => ({ row, originalIndex: i + 7 }))
                    .filter(({ row }: any) => row[1] && String(row[1]).trim() !== "")
                    .map(({ row, originalIndex }: any) => {
                        const plan1 = row[17];
                        const actual1 = row[18];
                        const storedPaid = parseFloat(String(row[20]).replace(/,/g, '')) || 0;
                        const storedPendingRaw = row[21];
                        const totalVal = parseFloat(String(row[13]).replace(/,/g, '')) || 0;

                        let currentPending = 0;
                        if (storedPendingRaw !== undefined && storedPendingRaw !== "" && storedPendingRaw !== "-") {
                            currentPending = parseFloat(String(storedPendingRaw).replace(/,/g, ''));
                        } else {
                            currentPending = totalVal - storedPaid;
                        }

                        const hasPlan = !!plan1 && String(plan1).trim() !== "" && String(plan1).trim() !== "-";
                        const hasActual = !!actual1 && String(actual1).trim() !== "" && String(actual1).trim() !== "-";

                        let status = "not_ready";
                        if (hasPlan) {
                            if (!hasActual) {
                                status = "pending";
                            } else {
                                if (currentPending > 1) {
                                    status = "pending";
                                } else {
                                    status = "history";
                                }
                            }
                        }

                        // Trim keys to avoid mismatch
                        const invNo = String(row[1] || "").trim();
                        const vendorName = String(row[7] || "").trim();

                        return {
                            id: invNo,
                            rowIndex: originalIndex,
                            status,
                            data: {
                                id: invNo,
                                invoiceNo: invNo,
                                invoiceCopy: row[2],
                                invoiceDate: toDate(row[3]),
                                vendor: vendorName,
                                item: row[8],
                                qty: row[9],
                                basicVal: row[12],
                                totalVal: totalVal,
                                paymentTerms: row[14],
                                poCopy: row[15],
                                plan1: toDate(row[17]),
                                actual1: toDate(row[18]),
                                totalPaid: storedPaid,
                                pendingAmount: currentPending,
                                paymentStatus: currentPending <= 1 ? "paid" : (storedPaid > 0 ? "partial" : "pending"),
                                proofUrl: "",
                                returnAmount: 0
                            }
                        };
                    });

                setRecords(
                    rows.filter((r: any) => r.status === "pending")
                );
            }

            // 2. Process History
            if (histJson.success && Array.isArray(histJson.data)) {
                const hRows = histJson.data.slice(1)
                    .map((row: any, i: number) => ({ row, id: `HIST_${i}` }))
                    .filter(({ row }: any) => row[0] === "Vendor Payment")
                    .map(({ row, id }: any) => ({
                        id: id,
                        invoiceNo: row[1],
                        vendor: row[2],
                        amountPaid: row[3],
                        status: row[4],
                        date: toDate(row[5]),
                        mode: row[6],
                        proof: row[7]
                    }));

                setHistoryRecords(hRows.reverse());
            }

        } catch (e) {
            console.error(e);
            toast.error("Failed to load data");
        }
        setIsLoading(false);
    };

    useEffect(() => {
        fetchData();
    }, []);

    const pendingColumns = [
        { key: "invoiceNo", label: "Invoice #" },
        { key: "invoiceDate", label: "Inv. Date" },
        { key: "vendor", label: "Vendor" },
        { key: "item", label: "Rec. Item" },
        { key: "qty", label: "Rec. Qty" },
        { key: "totalVal", label: "Total Amt" },
        { key: "totalPaid", label: "Paid" },
        { key: "pendingAmount", label: "Pending" },
        { key: "paymentTerms", label: "Terms" },
        { key: "plan1", label: "Due Date" },
    ];

    const historyColumns = [
        { key: "date", label: "Payment Date" },
        { key: "invoiceNo", label: "Invoice #" },
        { key: "vendor", label: "Vendor" },
        { key: "amountPaid", label: "Amount Paid" },
        { key: "mode", label: "Payment Mode" },
        { key: "status", label: "Status" },
        { key: "proof", label: "Proof" },
    ];

    const [selectedPendingColumns, setSelectedPendingColumns] = useState<string[]>(pendingColumns.map(c => c.key));

    const filteredRecords = useMemo(() => {
        return records.filter((r) => {
            const searchLower = searchTerm.toLowerCase();
            return (
                r.data.invoiceNo?.toLowerCase().includes(searchLower) ||
                r.data.vendor?.toLowerCase().includes(searchLower) ||
                r.data.item?.toLowerCase().includes(searchLower) ||
                String(r.data.poCopy || "").toLowerCase().includes(searchLower)
            );
        });
    }, [records, searchTerm]);

    const uniqueVendors = useMemo(() => {
        const names = Array.from(new Set(records.map(r => r.data.vendor).filter(Boolean)));
        return names.sort();
    }, [records]);

    const filteredVendors = useMemo(() => {
        if (!vendorSearch) return uniqueVendors;
        return uniqueVendors.filter(v => v.toLowerCase().includes(vendorSearch.toLowerCase()));
    }, [uniqueVendors, vendorSearch]);

    const handleBulkOpen = () => {
        setBulkOpen(true);
        setBulkStep("vendor");
        setSelectedVendor("");
        setVendorSearch("");
        setBulkInvoices({});
        setBulkFormData({
            paymentMode: "",
            paymentDate: new Date(),
            proof: null
        });
    };

    const handleVendorSelect = (vendorName: string) => {
        setSelectedVendor(vendorName);
        const vendorInvoices = records.filter(r => r.data.vendor === vendorName);
        const initialMap: Record<string, { selected: boolean, payAmount: string, originalPending: number }> = {};
        vendorInvoices.forEach(inv => {
            initialMap[inv.id] = {
                selected: false,
                payAmount: inv.data.pendingAmount.toFixed(2),
                originalPending: inv.data.pendingAmount
            };
        });
        setBulkInvoices(initialMap);
        setBulkStep("invoices");
    };

    const handleBulkInvoiceToggle = (id: string, checked: boolean) => {
        setBulkInvoices(prev => ({
            ...prev,
            [id]: { ...prev[id], selected: checked }
        }));
    };

    const handleBulkAmountChange = (id: string, val: string) => {
        setBulkInvoices(prev => ({
            ...prev,
            [id]: { ...prev[id], payAmount: val }
        }));
    };

    const bulkTotalToPay = useMemo(() => {
        return Object.values(bulkInvoices)
            .filter(i => i.selected)
            .reduce((sum, item) => sum + (parseFloat(item.payAmount) || 0), 0);
    }, [bulkInvoices]);

    const handleBulkSubmit = async () => {
        const selectedIds = Object.keys(bulkInvoices).filter(id => bulkInvoices[id].selected);

        if (selectedIds.length === 0) {
            toast.error("Please select at least one invoice.");
            return;
        }
        if (bulkTotalToPay <= 0) {
            toast.error("Total payment amount must be greater than 0.");
            return;
        }
        if (!bulkFormData.paymentMode) {
            toast.error("Please enter payment details (Mode).");
            return;
        }

        setIsSubmitting(true);
        const toastId = toast.loading("Processing Bulk Payment...");

        try {
            const dateStr = bulkFormData.paymentDate ? format(bulkFormData.paymentDate, "yyyy-MM-dd") : format(new Date(), "yyyy-MM-dd");
            let proofUrl = "";

            if (bulkFormData.proof) {
                const reader = new FileReader();
                const base64Promise = new Promise((resolve) => {
                    reader.onload = (e) => resolve(e.target?.result);
                    reader.readAsDataURL(bulkFormData.proof!);
                });
                const base64Data = await base64Promise;

                const upParams = new URLSearchParams();
                upParams.append("action", "uploadFile");
                upParams.append("fileName", `BULKPAY_${selectedVendor}_${Date.now()}`);
                upParams.append("mimeType", bulkFormData.proof!.type);
                upParams.append("base64Data", String(base64Data));
                if (IMAGE_FOLDER_ID) upParams.append("folderId", IMAGE_FOLDER_ID);

                const upRes = await fetch(`${SHEET_API_URL}`, { method: "POST", body: upParams });
                const upJson = await upRes.json();
                if (upJson.success) proofUrl = upJson.fileUrl;
            }

            let successCount = 0;
            for (const id of selectedIds) {
                const rec = records.find(r => r.id === id);
                if (!rec) continue;

                const payInfo = bulkInvoices[id];
                const payAmount = parseFloat(payInfo.payAmount) || 0;
                if (payAmount <= 0) continue;

                const oldPaid = rec.data.totalPaid || 0;
                const totalVal = rec.data.totalVal || 0;
                const newTotalPaid = oldPaid + payAmount;
                const newPending = totalVal - newTotalPaid;

                if (rec.rowIndex) {
                    const updates = [
                        { col: "19", val: dateStr },
                        { col: "21", val: newTotalPaid.toString() },
                        { col: "22", val: (newPending > 0 ? newPending : 0).toString() }
                    ];

                    for (const u of updates) {
                        const p = new URLSearchParams();
                        p.append("action", "updateCell");
                        p.append("sheetName", "VENDOR-PAYMENTS");
                        p.append("rowIndex", rec.rowIndex.toString());
                        p.append("columnIndex", u.col);
                        p.append("value", u.val);
                        await fetch(`${SHEET_API_URL}`, { method: "POST", body: p });
                    }
                }

                const paidRow = [
                    "Vendor Payment", rec.data.invoiceNo || "", rec.data.vendor || "",
                    payAmount.toString(), newPending <= 1 ? "Paid" : "Partial",
                    dateStr, bulkFormData.paymentMode, proofUrl
                ];

                const paidParams = new URLSearchParams();
                paidParams.append("action", "insert");
                paidParams.append("sheetName", "PAID-DATA");
                paidParams.append("rowData", JSON.stringify(paidRow));
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
    };

    return (
        <div className="p-6">
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
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="pl-9 bg-white w-[300px]"
                        />
                    </div>

                    <Select value="" onValueChange={() => { }}>
                        <SelectTrigger className="w-40"><SelectValue placeholder="Columns" /></SelectTrigger>
                        <SelectContent className="max-h-64">
                            {pendingColumns.map(c => (
                                <div key={c.key} className="flex items-center p-2 gap-2">
                                    <Checkbox
                                        checked={selectedPendingColumns.includes(c.key)}
                                        onCheckedChange={(chk) => {
                                            if (chk) setSelectedPendingColumns([...selectedPendingColumns, c.key]);
                                            else setSelectedPendingColumns(selectedPendingColumns.filter(k => k !== c.key));
                                        }}
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

            {isLoading ? (
                <div className="flex justify-center items-center h-64">
                    <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
                    <span className="ml-2 text-gray-500">Loading verified invoices...</span>
                </div>
            ) : (
                <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)}>
                    <TabsList className="grid w-full grid-cols-2">
                        <TabsTrigger value="pending">Pending ({filteredRecords.length})</TabsTrigger>
                        <TabsTrigger value="history">History ({historyRecords.length})</TabsTrigger>
                    </TabsList>

                    <TabsContent value="pending" className="mt-6">
                        {filteredRecords.length === 0 ? (
                            <div className="text-center py-12 text-gray-500">No pending payments</div>
                        ) : (
                            <div className="border rounded-lg overflow-x-auto">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            {pendingColumns.filter(c => selectedPendingColumns.includes(c.key)).map(c => <TableHead key={c.key}>{c.label}</TableHead>)}
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {filteredRecords.map(rec => (
                                            <TableRow key={rec.id}>
                                                {pendingColumns.filter(c => selectedPendingColumns.includes(c.key)).map(c => (
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
                        {historyRecords.length === 0 ? (
                            <div className="text-center py-12 text-gray-500">No payment transaction history</div>
                        ) : (
                            <div className="border rounded-lg overflow-x-auto">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            {historyColumns.map(c => <TableHead key={c.key}>{c.label}</TableHead>)}
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {historyRecords.map(rec => (
                                            <TableRow key={rec.id}>
                                                {historyColumns.map(c => (
                                                    <TableCell key={c.key}>
                                                        {c.key === 'amountPaid' ? (
                                                            <span className="font-medium">₹ {rec[c.key]}</span>
                                                        ) : c.key === 'status' ? (
                                                            <Badge variant={rec[c.key] === 'Paid' ? 'default' : 'secondary'}>
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

            <Dialog open={bulkOpen} onOpenChange={setBulkOpen}>
                <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>Processing Payment</DialogTitle>
                        <DialogDescription>
                            {bulkStep === 'vendor' ? 'Select a vendor to view pending invoices.' : `Process payments for ${selectedVendor}`}
                        </DialogDescription>
                    </DialogHeader>

                    {bulkStep === 'vendor' ? (
                        <div className="space-y-4 py-4 min-h-[300px]">
                            <Input
                                placeholder="Search vendor..."
                                value={vendorSearch}
                                onChange={e => setVendorSearch(e.target.value)}
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
                                            <TableHead className="text-right">Paid So Far</TableHead>
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
                                                            onCheckedChange={(c) => handleBulkInvoiceToggle(id, !!c)}
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
                                                            onChange={(e) => handleBulkAmountChange(id, e.target.value)}
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
                                            onChange={e => setBulkFormData(prev => ({ ...prev, paymentMode: e.target.value }))}
                                        />
                                    </div>
                                    <div className="flex flex-col gap-2">
                                        <Label>Payment Date *</Label>
                                        <Popover>
                                            <PopoverTrigger asChild>
                                                <Button
                                                    variant={"outline"}
                                                    className={cn(
                                                        "w-full justify-start text-left font-normal bg-white",
                                                        !bulkFormData.paymentDate && "text-muted-foreground"
                                                    )}
                                                >
                                                    <CalendarIcon className="mr-2 h-4 w-4" />
                                                    {bulkFormData.paymentDate ? format(bulkFormData.paymentDate, "PPP") : <span>Pick a date</span>}
                                                </Button>
                                            </PopoverTrigger>
                                            <PopoverContent className="w-auto p-0" align="start">
                                                <Calendar
                                                    mode="single"
                                                    selected={bulkFormData.paymentDate}
                                                    onSelect={(date) => date && setBulkFormData(prev => ({ ...prev, paymentDate: date }))}
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
                                                onChange={(e) => setBulkFormData(prev => ({ ...prev, proof: e.target.files?.[0] || null }))}
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
                        {bulkStep === 'invoices' && (
                            <Button variant="outline" onClick={() => setBulkStep("vendor")} className="mr-auto">
                                Back to Vendors
                            </Button>
                        )}
                        <Button variant="ghost" onClick={() => setBulkOpen(false)}>Cancel</Button>
                        {bulkStep === 'vendor' ? (
                            <Button disabled className="opacity-50">Select a Vendor</Button>
                        ) : (
                            <Button
                                onClick={handleBulkSubmit}
                                disabled={isSubmitting || bulkTotalToPay <= 0}
                                className="bg-green-600 hover:bg-green-700 min-w-[150px]"
                            >
                                {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <CheckCircle className="w-4 h-4 mr-2" />}
                                Pay ₹{bulkTotalToPay.toFixed(2)}
                            </Button>
                        )}
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}