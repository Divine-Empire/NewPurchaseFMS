"use client";

import React, { useState, useEffect } from "react";
import { toast } from "sonner";
import { Loader2, FileText, RefreshCw, Upload, CalendarIcon, AlertTriangle, Search } from "lucide-react";
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

const SHEET_API_URL = process.env.NEXT_PUBLIC_API_URI;
const IMAGE_FOLDER_ID = process.env.NEXT_PUBLIC_IMAGE_FOLDER_ID;

export default function Stage14() {
    const [records, setRecords] = useState<any[]>([]);
    const [searchTerm, setSearchTerm] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Modal State
    const [open, setOpen] = useState(false);
    const [selectedRecordId, setSelectedRecordId] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState<"pending" | "history">("pending");

    // Form State
    const [formData, setFormData] = useState({
        amount: "",
        paymentDetails: "",
        paymentDate: new Date(),
        paymentStatus: "pending",
        totalPaid: "",
        pendingAmount: "",
        paymentProof: null as File | null,
    });

    const [calcData, setCalcData] = useState({
        freightAmount: 0,
        advanceAmount: 0
    });

    // -----------------------------------------------------------------
    // FETCH DATA
    // -----------------------------------------------------------------
    const fetchData = async () => {
        if (!SHEET_API_URL) return;
        setIsLoading(true);
        try {
            const res = await fetch(`${SHEET_API_URL}?sheet=FREIGHT-PAYMENTS&action=getAll`);
            const json = await res.json();

            if (json.success && Array.isArray(json.data)) {
                // Slice(6) to skip headers (Data starts Row 7)
                const rows = json.data.slice(6)
                    .map((row: any, i: number) => ({ row, originalIndex: i + 7 }))
                    .filter(({ row }: any) => row[1] && String(row[1]).trim() !== "") // Filter by LR No (Col B)
                    .map(({ row, originalIndex }: any) => {

                        // Status Logic (Col N=13, O=14)
                        const plan1 = row[13];
                        const actual1 = row[14];

                        const hasPlan = !!plan1 && String(plan1).trim() !== "" && String(plan1).trim() !== "-";
                        const hasActual = !!actual1 && String(actual1).trim() !== "" && String(actual1).trim() !== "-";

                        let status = "not_ready";
                        if (hasPlan && !hasActual) {
                            status = "pending";
                        } else if (hasPlan && hasActual) {
                            status = "history";
                        }

                        // Parse totals
                        const freightAmt = parseFloat(String(row[3]).replace(/,/g, '')) || 0; // Col D (Index 3)
                        const advanceAmt = parseFloat(String(row[4]).replace(/,/g, '')) || 0; // Col E (Index 4)

                        // Format Dates (Remove timestamp)
                        const formatDate = (d: any) => {
                            if (!d) return "";
                            const str = String(d);
                            // If it contains 'T' (ISO format), split it
                            if (str.includes("T")) return str.split("T")[0];
                            return str;
                        };

                        return {
                            id: row[1], // LR No as ID
                            rowIndex: originalIndex,
                            status,
                            rawRow: row,
                            data: {
                                id: row[1],
                                lrNo: row[1],           // B
                                biltyImage: row[2],     // C
                                freightAmount: row[3],  // D
                                advanceAmount: row[4],  // E
                                paymentDate: formatDate(row[5]),    // F
                                vendorName: row[6],     // G
                                subItem: row[7],        // H
                                qty: row[8],            // I
                                srn: row[9],            // J
                                transporter: row[10],   // K
                                vehicleNo: row[11],     // L
                                contact: row[12],       // M

                                // Status Drivers
                                plan1: formatDate(row[13]),         // N
                                actual1: formatDate(row[14]),       // O

                                // Calculated for modal
                                freightVal: freightAmt,
                                advanceVal: advanceAmt
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
    // -----------------------------------------------------------------
    // COLUMNS
    // -----------------------------------------------------------------
    const pending = records
        .filter(r => r.status === "pending")
        .filter(r => {
            const searchLower = searchTerm.toLowerCase();
            return (
                String(r.data.lrNo || "").toLowerCase().includes(searchLower) ||
                String(r.data.transporter || "").toLowerCase().includes(searchLower) ||
                String(r.data.vendorName || "").toLowerCase().includes(searchLower) ||
                String(r.data.subItem || "").toLowerCase().includes(searchLower)
            );
        });
    const completed = records.filter(r => r.status === "history");

    const columns = [
        { key: "lrNo", label: "LR No." },
        { key: "transporter", label: "Transporter" },
        { key: "vehicleNo", label: "Vehicle No." },
        { key: "contact", label: "Contact" },
        { key: "vendorName", label: "Vendor" },
        { key: "subItem", label: "Item" },
        { key: "qty", label: "Qty" },
        { key: "srn", label: "SRN" },
        { key: "freightAmount", label: "Freight Amt" },
        { key: "advanceAmount", label: "Advance Amt" },
        { key: "plan1", label: "Planned Date" }, // N
        { key: "actual1", label: "Payment Date" }, // O (History)
        { key: "biltyImage", label: "Bilty" }, // C
    ];

    const [selectedColumns, setSelectedColumns] = useState<string[]>(columns.map(c => c.key));


    // -----------------------------------------------------------------
    // MODAL
    // -----------------------------------------------------------------
    const handleOpenForm = (recordId: string) => {
        const rec = records.find(r => r.id === recordId);
        if (!rec) return;

        setSelectedRecordId(recordId);

        const freight = rec.data.freightVal;
        const advance = rec.data.advanceVal;
        const pending = freight - advance;

        setFormData({
            amount: (pending > 0 ? pending : 0).toFixed(2), // Payment Amount
            paymentDetails: "",
            paymentDate: new Date(),
            paymentStatus: pending <= 1 ? "paid" : "pending",
            totalPaid: advance.toFixed(2), // Advance is "already paid"
            pendingAmount: (pending > 0 ? pending : 0).toFixed(2),
            paymentProof: null
        });

        setCalcData({
            freightAmount: freight,
            advanceAmount: advance
        });

        setOpen(true);
    };

    // -----------------------------------------------------------------
    // SUBMIT (Updates FREIGHT-PAYMENTS + Appends to PAID-DATA)
    // -----------------------------------------------------------------
    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedRecordId) return;

        const rec = records.find(r => r.id === selectedRecordId);
        if (!rec) return;

        setIsSubmitting(true);
        const toastId = toast.loading("Processing Freight Payment...");

        try {
            const dateStr = format(formData.paymentDate, "yyyy-MM-dd");

            // 1. Upload Proof
            let proofUrl = "";
            if (formData.paymentProof) {
                const reader = new FileReader();
                const base64Promise = new Promise((resolve) => {
                    reader.onload = (e) => resolve(e.target?.result);
                    reader.readAsDataURL(formData.paymentProof!);
                });
                const base64Data = await base64Promise;

                const upParams = new URLSearchParams();
                upParams.append("action", "uploadFile");
                upParams.append("fileName", `FRT_${rec.data.lrNo}_${Date.now()}`); // Unique name
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
            // ACTION A: Update FREIGHT-PAYMENTS (Column O with Date)
            // =========================================================
            if (rec.rowIndex) {
                // Initialize rowArray from rawRow or create new if missing
                const rowArray = rec.rawRow ? [...rec.rawRow] : new Array(15).fill("");

                // Ensure array has enough columns (up to Index 14/Col O)
                while (rowArray.length <= 14) rowArray.push("");

                // Update Column O (Index 14) with Payment Date
                rowArray[14] = dateStr;

                const updateParams = new URLSearchParams();
                updateParams.append("action", "update");
                updateParams.append("sheetName", "FREIGHT-PAYMENTS");
                updateParams.append("rowIndex", rec.rowIndex.toString());
                updateParams.append("rowData", JSON.stringify(rowArray));

                const res = await fetch(`${SHEET_API_URL}`, { method: "POST", body: updateParams });
                const json = await res.json();
                if (!json.success) {
                    console.error("Failed to update status in FREIGHT-PAYMENTS:", json.error);
                    toast.error("Failed to update Freight sheet status");
                }
            }


            // =========================================================
            // ACTION B: Append to PAID-DATA (Transaction Log)
            // =========================================================
            // Using same structure as Stage 13 but tailored for Freight
            const paidRow = new Array(8).fill("");
            paidRow[0] = "Freight Payment"; // A
            paidRow[1] = rec.data.lrNo || ""; // B (Transporter/Ref - Using LR No)
            paidRow[2] = rec.data.transporter || ""; // C (Vendor/Transporter Name)
            paidRow[3] = formData.amount || "";      // D
            paidRow[4] = formData.paymentStatus || ""; // E
            paidRow[5] = dateStr || "";                // F
            paidRow[6] = formData.paymentDetails || ""; // G
            paidRow[7] = proofUrl || "";               // H

            const paidParams = new URLSearchParams();
            paidParams.append("action", "insert");
            paidParams.append("sheetName", "PAID-DATA");
            paidParams.append("rowData", JSON.stringify(paidRow));

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
                    <h2 className="text-2xl font-bold">Stage 14: Freight Payments</h2>
                    <p className="text-gray-600 mt-1">Pending freight charges (Transporters)</p>
                </div>

                <div className="flex gap-4 items-center">
                    <div className="relative flex-1 max-w-sm">
                        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-500" />
                        <Input
                            placeholder="Search by LR, Transporter, Vendor, Item..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="pl-9 bg-white w-[300px]"
                        />
                    </div>
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
                    <span className="ml-2 text-gray-500">Loading freight records...</span>
                </div>
            ) : (
                <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)}>
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
                        <DialogTitle>Freight Payment</DialogTitle>
                        <DialogDescription>
                            Enter payment details for LR #{records.find(r => r.id === selectedRecordId)?.data.lrNo}
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
                                onChange={e => setFormData({ ...formData, amount: e.target.value })}
                            />
                        </div>

                        <div>
                            <Label>Payment Details *</Label>
                            <Input
                                placeholder="e.g. Bank Transfer, Cash, Cheque"
                                value={formData.paymentDetails}
                                onChange={e => setFormData({ ...formData, paymentDetails: e.target.value })}
                            />
                        </div>

                        <div className="flex flex-col gap-2">
                            <Label>Payment Date *</Label>
                            <Popover>
                                <PopoverTrigger asChild>
                                    <Button
                                        variant={"outline"}
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
                                        onSelect={(date) => date && setFormData({ ...formData, paymentDate: date })}
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