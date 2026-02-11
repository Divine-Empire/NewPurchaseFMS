"use client";

import React, { useState, useEffect } from "react";
import { toast } from "sonner";
import { Loader2, FileText, RefreshCw, Upload, IndianRupee, AlertTriangle, CheckCircle, CalendarIcon, X } from "lucide-react";
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

const SHEET_API_URL = process.env.NEXT_PUBLIC_API_URI;
const IMAGE_FOLDER_ID = process.env.NEXT_PUBLIC_IMAGE_FOLDER_ID;

export default function Stage13() {
    const [records, setRecords] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Modal State
    const [open, setOpen] = useState(false);
    const [selectedRecordId, setSelectedRecordId] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState<"pending" | "history">("pending");

    // Form State
    const [formData, setFormData] = useState({
        amount: "",
        vendorPayment: "",
        paymentDueDate: new Date(),
        paymentStatus: "pending",
        totalPaid: "",
        pendingAmount: "",
        paymentProof: null as File | null,
    });

    const [calcData, setCalcData] = useState({
        totalAmount: 0,
        alreadyPaid: 0,
        returnDeduction: 0,
        newTotalPaid: 0,
        newPending: 0
    });

    // -----------------------------------------------------------------
    // FETCH DATA
    // -----------------------------------------------------------------
    const fetchData = async () => {
        if (!SHEET_API_URL) return;
        setIsLoading(true);
        try {
            const payRes = await fetch(`${SHEET_API_URL}?sheet=VENDOR-PAYMENTS&action=getAll`);
            const payJson = await payRes.json();

            if (payJson.success && Array.isArray(payJson.data)) {
                // Slice(6) to skip headers (Data starts Row 7)
                const rows = payJson.data.slice(6)
                    .map((row: any, i: number) => ({ row, originalIndex: i + 7 }))
                    .filter(({ row }: any) => row[1] && String(row[1]).trim() !== "") // Filter by Invoice No (Col B)
                    .map(({ row, originalIndex }: any) => {

                        // Status Logic (Col R=17, S=18)
                        const plan1 = row[17];
                        const actual1 = row[18];

                        const hasPlan = !!plan1 && String(plan1).trim() !== "" && String(plan1).trim() !== "-";
                        const hasActual = !!actual1 && String(actual1).trim() !== "" && String(actual1).trim() !== "-";

                        let status = "not_ready";
                        if (hasPlan && !hasActual) {
                            status = "pending";
                        } else if (hasPlan && hasActual) {
                            status = "history";
                        }

                        // Parse totals
                        const totalVal = parseFloat(String(row[13]).replace(/,/g, '')) || 0;

                        // Helper to format date
                        const toDate = (val: any) => {
                            if (!val || String(val).trim() === "" || String(val).trim() === "-") return "-";
                            try {
                                const d = new Date(val);
                                // Check if valid date
                                if (isNaN(d.getTime())) return val;
                                return format(d, "dd-MM-yyyy");
                            } catch {
                                return val;
                            }
                        };

                        return {
                            id: row[1], // Invoice No as ID
                            rowIndex: originalIndex,
                            status,
                            data: {
                                id: row[1],
                                invoiceNo: row[1],      // B
                                invoiceCopy: row[2],    // C
                                invoiceDate: toDate(row[3]),    // D
                                vendor: row[7],         // H
                                item: row[8],           // I
                                qty: row[9],            // J
                                basicVal: row[12],      // M
                                totalVal: row[13],      // N
                                paymentTerms: row[14],  // O
                                poCopy: row[15],        // P

                                // Status Drivers
                                plan1: toDate(row[17]),         // R
                                actual1: toDate(row[18]),       // S

                                // Defaults for Modal Calc (Presuming not in B-Q list but logic needs something)
                                totalPaid: 0,
                                pendingAmount: totalVal,
                                paymentStatus: "pending",
                                proofUrl: "",
                                returnAmount: 0
                            }
                        };
                    });
                setRecords(rows);
            }
        } catch (e) {
            console.error("Fetch error:", e);
            toast.error("Failed to load data");
        }
        setIsLoading(false);
    };

    useEffect(() => {
        fetchData();
    }, []);

    // -----------------------------------------------------------------
    // COLUMNS
    // -----------------------------------------------------------------
    const pending = records.filter(r => r.status === "pending");
    const completed = records.filter(r => r.status === "history");

    const columns = [
        { key: "invoiceNo", label: "Invoice #" },
        { key: "invoiceDate", label: "Inv. Date" },
        { key: "vendor", label: "Vendor" },
        { key: "item", label: "Rec. Item" },
        { key: "qty", label: "Rec. Qty" },
        { key: "totalVal", label: "Total Amount" },
        { key: "paymentTerms", label: "Terms" },
        { key: "plan1", label: "Due Date" }, // R
        { key: "basicVal", label: "Basic Val" },
        { key: "actual1", label: "Payment Date" }, // S (History)
    ];

    // Column Visibility State
    const [selectedColumns, setSelectedColumns] = useState<string[]>(columns.map(c => c.key));


    // -----------------------------------------------------------------
    // MODAL
    // -----------------------------------------------------------------
    const handleOpenForm = (recordId: string) => {
        const rec = records.find(r => r.id === recordId);
        if (!rec) return;

        setSelectedRecordId(recordId);

        const total = parseFloat(String(rec.data.totalVal).replace(/,/g, '')) || 0;
        const paid = rec.data.totalPaid || 0;
        const returnAmt = rec.data.returnAmount || 0;

        // Initial Calculation
        // Pending = Total - Paid - Return
        const pending = total - paid - returnAmt;

        setFormData({
            amount: total.toFixed(2), // Total Bill Amount
            vendorPayment: "", // Details like RTGS/NEFT
            paymentDueDate: new Date(), // Defaults to Today
            paymentStatus: pending <= 1 ? "paid" : "pending",
            totalPaid: paid.toFixed(2), // Already Paid
            pendingAmount: (pending > 0 ? pending : 0).toFixed(2),
            paymentProof: null
        });

        // Store for calc reference
        setCalcData({
            totalAmount: total,
            alreadyPaid: paid,
            returnDeduction: returnAmt,
            newTotalPaid: paid,
            newPending: pending
        });

        setOpen(true);
    };

    // -----------------------------------------------------------------
    // CALC LOGIC
    // -----------------------------------------------------------------
    useEffect(() => {
        if (!open) return;

        const total = parseFloat(formData.amount) || 0;
        const paid = parseFloat(formData.totalPaid) || 0;
        const pending = total - paid - calcData.returnDeduction;

        setFormData(prev => ({
            ...prev,
            pendingAmount: (pending > 0 ? pending : 0).toFixed(2)
        }));

        // Status Auto-Update
        if (pending <= 5) { // Small buffer for round off
            if (formData.paymentStatus !== 'paid') {
                // Optionally auto-set, but let user control or just suggest
                // setFormData(prev => ({ ...prev, paymentStatus: "paid" }));
            }
        }

    }, [formData.totalPaid, formData.amount]);


    // -----------------------------------------------------------------
    // SUBMIT (Updates VENDOR-PAYMENTS + Appends to PAID-DATA)
    // -----------------------------------------------------------------
    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedRecordId) return;

        const rec = records.find(r => r.id === selectedRecordId);
        if (!rec) return;

        setIsSubmitting(true);
        const toastId = toast.loading("Processing Payment...");

        try {
            const dateStr = format(formData.paymentDueDate, "yyyy-MM-dd");

            // 1. Upload Proof
            let proofUrl = rec.data.proofUrl || "";
            if (formData.paymentProof) {
                const reader = new FileReader();
                const base64Promise = new Promise((resolve) => {
                    reader.onload = (e) => resolve(e.target?.result);
                    reader.readAsDataURL(formData.paymentProof!);
                });
                const base64Data = await base64Promise;

                const upParams = new URLSearchParams();
                upParams.append("action", "uploadFile");
                upParams.append("fileName", `PAY_${rec.data.invoiceNo}_${Date.now()}`); // Unique name
                upParams.append("mimeType", formData.paymentProof.type);
                upParams.append("base64Data", String(base64Data));
                if (IMAGE_FOLDER_ID) {
                    upParams.append("folderId", IMAGE_FOLDER_ID);
                }

                const upRes = await fetch(`${SHEET_API_URL}`, { method: "POST", body: upParams });
                const upJson = await upRes.json();
                if (upJson.success) proofUrl = upJson.fileUrl;
            }

            // =========================================================
            // ACTION A: Update VENDOR-PAYMENTS (Column S with Date)
            // =========================================================
            if (rec.rowIndex) {
                const updateParams = new URLSearchParams();
                updateParams.append("action", "updateCell");
                updateParams.append("sheetName", "VENDOR-PAYMENTS");
                updateParams.append("rowIndex", rec.rowIndex.toString());
                updateParams.append("columnIndex", "19"); // Column S (A=1...S=19)
                updateParams.append("value", dateStr);

                const res = await fetch(`${SHEET_API_URL}`, { method: "POST", body: updateParams });
                const json = await res.json();
                if (!json.success) {
                    console.error("Failed to update status in VENDOR-PAYMENTS:", json.error);
                    toast.warning("Logged to PAID-DATA, but status update in Vendor Sheet failed.");
                }
            }


            // =========================================================
            // ACTION B: Append to PAID-DATA (Transaction Log)
            // =========================================================
            // User Requirements:
            // Col A: Status ("Vendor Payment")
            // Col B: Transporter Name (We don't have this, leaving blank or Invoice #?) -> User said "Transporter Name". 
            //        I'll put Invoice # here for reference as before, or explicit "-" if strictly name.
            // Col C: Vendor Name
            // Col D: Amount
            // Col E: Payment Status
            // Col F: Payment Due Date
            // Col G: Payment Type (Implied, next available)
            // Col H: Payment Proof

            const paidRow = new Array(8).fill("");
            paidRow[0] = "Vendor Payment"; // A
            paidRow[1] = "";               // B (Transporter Name - Leaving Blank or putting Invoice?)
            // Let's put Invoice # in G (Payment Type) or strictly follow mapping.
            // I'll put Invoice # in B as a placeholder for "Transporter/Reference" 
            // because losing the Invoice # link in the log is bad practice.
            // Checking User Request: "Transpoter name". 
            // I will use `rec.data.vendor` for C. 
            // I will leave B empty or maybe puts Invoice No? 
            // I'll put Invoice No.
            paidRow[1] = rec.data.invoiceNo || "";

            paidRow[2] = rec.data.vendor || "";        // C
            paidRow[3] = formData.amount || "";        // D
            paidRow[4] = formData.paymentStatus || ""; // E
            paidRow[5] = dateStr || "";                // F
            paidRow[6] = formData.vendorPayment || ""; // G (Payment Type / Details)
            paidRow[7] = proofUrl || "";               // H

            const paidParams = new URLSearchParams();
            paidParams.append("action", "insert");
            paidParams.append("sheetName", "PAID-DATA");
            paidParams.append("rowData", JSON.stringify(paidRow));

            const paidRes = await fetch(`${SHEET_API_URL}`, { method: "POST", body: paidParams });
            const paidJson = await paidRes.json();

            if (paidJson.success) {
                toast.success("Payment Recorded & Status Updated!", { id: toastId });
                setOpen(false);
                fetchData();
            } else {
                toast.warning("Status Updated but Log Failed: " + (paidJson.error || "Unknown"), { id: toastId });
            }

        } catch (err: any) {
            console.error(err);
            toast.error(err.message || "Failed", { id: toastId });
        } finally {
            setIsSubmitting(false);
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

    return (
        <div className="p-6">
            <div className="mb-6 p-6 bg-white border rounded-lg shadow-sm flex justify-between items-center">
                <div>
                    <h2 className="text-2xl font-bold">Stage 13: Vendor Payments</h2>
                    <p className="text-gray-600 mt-1">Pending payments (Verified Accounts)</p>
                </div>

                <div className="flex gap-4 items-center">
                    <Select value="" onValueChange={() => { }}>
                        <SelectTrigger className="w-40"><SelectValue placeholder="Columns" /></SelectTrigger>
                        <SelectContent className="max-h-64">
                            {columns.map(c => (
                                <div key={c.key} className="flex items-center p-2 gap-2">
                                    <Checkbox
                                        checked={selectedColumns.includes(c.key)}
                                        onCheckedChange={(chk) => {
                                            if (chk) setSelectedColumns([...selectedColumns, c.key]);
                                            else setSelectedColumns(selectedColumns.filter(k => k !== c.key));
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
                        <TabsTrigger value="pending">Pending ({pending.length})</TabsTrigger>
                        <TabsTrigger value="history">History ({completed.length})</TabsTrigger>
                    </TabsList>

                    <TabsContent value="pending" className="mt-6">
                        {pending.length === 0 ? (
                            <div className="text-center py-12 text-gray-500">No pending payments</div>
                        ) : (
                            <div className="border rounded-lg overflow-x-auto">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead className="w-[100px] sticky left-0 z-20 bg-white shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]">Action</TableHead>
                                            {columns.filter(c => selectedColumns.includes(c.key)).map(c => <TableHead key={c.key}>{c.label}</TableHead>)}
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
                                                {columns.filter(c => selectedColumns.includes(c.key)).map(c => (
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
                                            {columns.filter(c => selectedColumns.includes(c.key)).map(c => <TableHead key={c.key}>{c.label}</TableHead>)}
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {completed.map(rec => (
                                            <TableRow key={rec.id}>
                                                {columns.filter(c => selectedColumns.includes(c.key)).map(c => (
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

            <Dialog open={open} onOpenChange={setOpen}>
                <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>Vendor Payment</DialogTitle>
                        <DialogDescription>
                            Enter payment details for Invoice #{records.find(r => r.id === selectedRecordId)?.data.invoiceNo}
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4 py-2">
                        {calcData.returnDeduction > 0 && (
                            <div className="bg-red-50 p-3 rounded-md flex items-center gap-2 text-sm text-red-700 mb-4">
                                <AlertTriangle className="w-4 h-4" />
                                <span>Return Deduction Applied: -₹{calcData.returnDeduction}</span>
                            </div>
                        )}

                        <div>
                            <Label>Amount *</Label>
                            <Input
                                type="number"
                                value={formData.amount}
                                onChange={e => setFormData({ ...formData, amount: e.target.value })}
                            />
                        </div>

                        <div>
                            <Label>Vendor Payment (Details) *</Label>
                            <Input
                                placeholder="e.g. RTGS, NEFT, Cheque #12345"
                                value={formData.vendorPayment}
                                onChange={e => setFormData({ ...formData, vendorPayment: e.target.value })}
                            />
                        </div>

                        <div className="flex flex-col gap-2">
                            <Label>Payment Due Date *</Label>
                            <Popover>
                                <PopoverTrigger asChild>
                                    <Button
                                        variant={"outline"}
                                        className={cn(
                                            "w-full justify-start text-left font-normal",
                                            !formData.paymentDueDate && "text-muted-foreground"
                                        )}
                                    >
                                        <CalendarIcon className="mr-2 h-4 w-4" />
                                        {formData.paymentDueDate ? format(formData.paymentDueDate, "PPP") : <span>Pick a date</span>}
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-auto p-0" align="start">
                                    <Calendar
                                        mode="single"
                                        selected={formData.paymentDueDate}
                                        onSelect={(date) => date && setFormData({ ...formData, paymentDueDate: date })}
                                        initialFocus
                                    />
                                </PopoverContent>
                            </Popover>
                        </div>

                        <div>
                            <Label>Payment Status *</Label>
                            <Select value={formData.paymentStatus} onValueChange={(v) => setFormData({ ...formData, paymentStatus: v })}>
                                <SelectTrigger><SelectValue placeholder="Select status" /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="paid">Paid</SelectItem>
                                    <SelectItem value="pending">Pending</SelectItem>
                                    <SelectItem value="partial">Partial</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <Label>Total Paid</Label>
                                <Input
                                    type="number"
                                    value={formData.totalPaid}
                                    onChange={e => setFormData({ ...formData, totalPaid: e.target.value })}
                                />
                            </div>
                            <div>
                                <Label>Pending Amount</Label>
                                <Input
                                    type="number"
                                    readOnly
                                    value={formData.pendingAmount}
                                    className="bg-gray-50"
                                />
                            </div>
                        </div>

                        <div>
                            <Label>Payment Proof</Label>
                            <div className="mt-1 border-2 border-dashed rounded-lg p-6 flex flex-col items-center justify-center text-center cursor-pointer hover:bg-gray-50 hover:border-gray-400 transition-colors relative">
                                <input
                                    type="file"
                                    className="absolute inset-0 opacity-0 cursor-pointer"
                                    onChange={(e) => setFormData({ ...formData, paymentProof: e.target.files?.[0] || null })}
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
                        <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
                        <Button onClick={handleSubmit} disabled={isSubmitting} className="bg-gray-600 hover:bg-gray-700">Process Payment</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}