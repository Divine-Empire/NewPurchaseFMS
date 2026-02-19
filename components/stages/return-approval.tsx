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
import { Label } from "@/components/ui/label";
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
import { Loader2, RefreshCw, Upload, FileText, X, Search } from "lucide-react";
import { toast } from "sonner";

// --- Static Helpers ---
const toBase64 = (file: File) => new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve((reader.result as string).split(',')[1]);
    reader.onerror = error => reject(error);
});

const formatDate = (dateStr: string) => {
    if (!dateStr) return "-";
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString();
};

const safeValue = (val: any) => {
    return val && String(val).trim() !== "" ? val : "-";
};

// Extracted upload logic for reuse
const uploadFileToDrive = async (file: File, apiUrl: string) => {
    const uploadParams = new URLSearchParams();
    uploadParams.append("action", "uploadFile");
    uploadParams.append("base64Data", await toBase64(file));
    uploadParams.append("fileName", file.name);
    uploadParams.append("mimeType", file.type);
    const folderId = process.env.NEXT_PUBLIC_IMAGE_FOLDER_ID || "1SihRrPrgbuPGm-09fuB180QJhdxq5Nxy";
    uploadParams.append("folderId", folderId);

    const res = await fetch(apiUrl, {
        method: "POST",
        body: uploadParams
    });
    const json = await res.json();
    if (json.success) return json.fileUrl;
    else throw new Error("Upload failed: " + (json.error || "Unknown error"));
};

export default function Stage13() {
    const SHEET_API_URL = process.env.NEXT_PUBLIC_API_URI;
    const [activeTab, setActiveTab] = useState<"pending" | "history">("pending");
    const [sheetRecords, setSheetRecords] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Single Approval State
    const [open, setOpen] = useState(false);
    const [selectedRecordId, setSelectedRecordId] = useState<string | null>(null);
    const [searchTerm, setSearchTerm] = useState("");
    const [formData, setFormData] = useState({
        liftNumber: "",
        itemName: "",
        invoiceNumber: "",
        returnQty: "",
        actualDate: "",
        dnNumber: "",
        returnImage: null as File | null,
        remarks: "",
    });

    // Bulk Approval State
    const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set());
    const [bulkOpen, setBulkOpen] = useState(false);
    const [bulkFormData, setBulkFormData] = useState({
        actualDate: new Date().toISOString().split("T")[0],
        dnNumber: "",
        returnImage: null as File | null,
        remarks: "",
    });

    // --- Data Fetching ---
    const fetchData = useCallback(async () => {
        if (!SHEET_API_URL) return;
        setIsLoading(true);
        try {
            const [partialRes, accRes] = await Promise.all([
                fetch(`${SHEET_API_URL}?sheet=${encodeURIComponent("Partial QC")}&action=getAll`),
                fetch(`${SHEET_API_URL}?sheet=RECEIVING-ACCOUNTS&action=getAll`)
            ]);

            const [partialJson, accJson] = await Promise.all([
                partialRes.json(),
                accRes.json()
            ]);

            if (!partialJson.success || !accJson.success) {
                throw new Error("Failed to load sheet data");
            }

            // 1. Build Lookup Map
            const indentMap = new Map<string, any>();
            if (Array.isArray(accJson.data)) {
                accJson.data.slice(6).forEach((row: any) => {
                    const indentNo = String(row[1] || "").trim();
                    if (!indentNo) return;
                    indentMap.set(indentNo, {
                        indentNumber: indentNo,
                        liftNumber: row[2] || "",
                        vendorName: row[3] || "",
                        itemName: row[7] || "",
                        invoiceNumber: row[24] || "-",
                        poNumber: row[4],
                    });
                });
            }

            // 2. Process Partial QC Rows
            if (Array.isArray(partialJson.data)) {
                const rows = partialJson.data.slice(1)
                    .map((row: any, i: number) => ({ row, rowIndex: i + 2 }))
                    .filter(({ row }: any) => row[1] && String(row[1]).trim() !== "")
                    .map(({ row, rowIndex }: any) => {
                        const indentNo = String(row[1]).trim();

                        // Indices: X=23, Y=24...
                        const plan = row[23];  // X
                        const actual = row[24];// Y

                        const hasPlan = !!plan && String(plan).trim() !== "" && String(plan).trim() !== "-";
                        const hasActual = !!actual && String(actual).trim() !== "" && String(actual).trim() !== "-";

                        let status = "not_ready";
                        if (hasPlan && hasActual) {
                            status = "completed";
                        } else if (hasPlan && !hasActual) {
                            status = "pending";
                        }

                        const details = indentMap.get(indentNo) || {};

                        return {
                            id: `partial-${rowIndex}`,
                            rowIndex,
                            stage: 13,
                            status,
                            data: {
                                ...details,
                                indentNumber: indentNo,
                                returnQty: row[16] || "-",
                                plannedDate: row[23],            // X
                                actualDate: row[24],             // Y
                                delay: row[25],                  // Z
                                dnNumber: row[26],               // AA
                                remarks: row[27],                // AB
                                returnImage: row[28],            // AC
                                returnStatus: row[20],           // U
                            }
                        };
                    })
                    .filter((r: any) => r.status !== "not_ready");

                setSheetRecords(rows);
            }
        } catch (e) {
            console.error("Fetch error:", e);
            toast.error("Failed to fetch data");
        }
        setIsLoading(false);
    }, [SHEET_API_URL]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    // --- Memoized Filters ---
    const pending = useMemo(() => {
        const lowerSearch = searchTerm.toLowerCase();
        return sheetRecords
            .filter((r) => r.status === "pending")
            .filter((r) => {
                if (!lowerSearch) return true;
                return (
                    r.data.indentNumber?.toLowerCase().includes(lowerSearch) ||
                    r.data.itemName?.toLowerCase().includes(lowerSearch) ||
                    r.data.vendorName?.toLowerCase().includes(lowerSearch) ||
                    String(r.data.poNumber || "").toLowerCase().includes(lowerSearch) ||
                    String(r.data.invoiceNumber || "").toLowerCase().includes(lowerSearch)
                );
            });
    }, [sheetRecords, searchTerm]);

    const completed = useMemo(() => {
        const lowerSearch = searchTerm.toLowerCase();
        return sheetRecords
            .filter((r) => r.status === "completed")
            .filter((r) => {
                if (!lowerSearch) return true;
                return (
                    r.data.indentNumber?.toLowerCase().includes(lowerSearch) ||
                    r.data.itemName?.toLowerCase().includes(lowerSearch) ||
                    r.data.vendorName?.toLowerCase().includes(lowerSearch) ||
                    String(r.data.invoiceNumber || "").toLowerCase().includes(lowerSearch)
                );
            });
    }, [sheetRecords, searchTerm]);

    const selectedRecords = useMemo(() =>
        pending.filter((r) => selectedRows.has(r.id)),
        [pending, selectedRows]);

    // --- Handlers ---

    const toggleRow = useCallback((id: string) => {
        setSelectedRows(prev => {
            const newSet = new Set(prev);
            if (newSet.has(id)) newSet.delete(id);
            else newSet.add(id);
            return newSet;
        });
    }, []);

    const toggleAll = useCallback(() => {
        if (selectedRows.size === pending.length) {
            setSelectedRows(new Set());
        } else {
            setSelectedRows(new Set(pending.map((r) => r.id)));
        }
    }, [selectedRows.size, pending]);

    const handleOpenForm = useCallback((recordId: string) => {
        const rec = sheetRecords.find((r) => r.id === recordId);
        if (!rec) return;

        setSelectedRecordId(recordId);
        setFormData({
            liftNumber: rec.data.liftNumber || rec.data.indentNumber,
            itemName: rec.data.itemName,
            invoiceNumber: rec.data.invoiceNumber,
            returnQty: rec.data.returnQty,
            actualDate: new Date().toISOString().split("T")[0],
            dnNumber: "",
            returnImage: null,
            remarks: "",
        });
        setOpen(true);
    }, [sheetRecords]);

    const handleOpenBulkForm = useCallback(() => {
        if (selectedRows.size === 0) return;

        // Validation
        const invoices = new Set(selectedRecords.map((r) => r.data.invoiceNumber));
        if (invoices.size > 1) {
            toast.error("Cannot proceed: All selected items must have the same Invoice #", {
                style: { background: '#fee2e2', border: '1px solid #ef4444', color: '#b91c1c' }
            });
            return;
        }

        setBulkFormData({
            actualDate: new Date().toISOString().split("T")[0],
            dnNumber: "",
            returnImage: null,
            remarks: "",
        });
        setBulkOpen(true);
    }, [selectedRows.size, selectedRecords]);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            setFormData(prev => ({ ...prev, returnImage: e.target.files![0] }));
        }
    };

    // --- Submit Logic (Parallelized) ---
    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedRecordId || !SHEET_API_URL) return;

        if (!formData.dnNumber?.trim()) {
            toast.error("Debit Note / DN No. is mandatory.");
            return;
        }
        if (!formData.returnImage) {
            toast.error("Image upload is mandatory.");
            return;
        }

        const rec = sheetRecords.find((r) => r.id === selectedRecordId);
        if (!rec) return;

        setIsSubmitting(true);
        const toastId = toast.loading("Submitting approval...");

        try {
            // Upload Image
            let imageUrl = "";
            if (formData.returnImage) {
                imageUrl = await uploadFileToDrive(formData.returnImage, SHEET_API_URL);
            }

            const d = new Date(formData.actualDate);
            const dateStr = `${d.getMonth() + 1}/${d.getDate()}/${d.getFullYear()}`;

            // 1-based Write Indices: Y=25, AA=27, AB=28, AC=29
            const updates = [
                { col: "25", val: dateStr },
                { col: "27", val: formData.dnNumber },
                { col: "28", val: formData.remarks },
                { col: "29", val: imageUrl }
            ];

            // Parallel updates
            await Promise.all(updates.map(u => {
                const params = new URLSearchParams();
                params.append("action", "updateCell");
                params.append("sheetName", "Partial QC");
                params.append("rowIndex", rec.rowIndex.toString());
                params.append("columnIndex", u.col);
                params.append("value", u.val);
                return fetch(SHEET_API_URL, { method: "POST", body: params });
            }));

            toast.success("Approved successfully!", { id: toastId });
            setOpen(false);
            fetchData();
        } catch (err: any) {
            toast.error(err.message || "Failed to submit", { id: toastId });
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleBulkSubmit = async () => {
        if (selectedRows.size === 0 || !SHEET_API_URL) return;

        if (!bulkFormData.dnNumber?.trim()) {
            toast.error("Debit Note / DN No. is mandatory.");
            return;
        }
        if (!bulkFormData.returnImage) {
            toast.error("Image upload is mandatory.");
            return;
        }

        setIsSubmitting(true);
        const toastId = toast.loading(`Processing ${selectedRows.size} approvals...`);
        let successCount = 0;
        let failCount = 0;

        try {
            // Upload once
            const imageUrl = await uploadFileToDrive(bulkFormData.returnImage, SHEET_API_URL);

            const d = new Date(bulkFormData.actualDate);
            const dateStr = `${d.getMonth() + 1}/${d.getDate()}/${d.getFullYear()}`;

            // Process all selected records in parallel (limit concurrency if needed, but here simple parallel is fine)
            // Note: Parallelizing updates across *rows* and *columns* simultaneously
            // might hit rate limits if too many. But usually okay for small batches.
            // We'll process each ROW largely in parallel.

            const promises = Array.from(selectedRows).map(async (id) => {
                const rec = sheetRecords.find((r) => r.id === id);
                if (!rec) return;

                try {
                    const updates = [
                        { col: "25", val: dateStr },
                        { col: "27", val: bulkFormData.dnNumber },
                        { col: "28", val: bulkFormData.remarks },
                        { col: "29", val: imageUrl }
                    ];

                    await Promise.all(updates.map(u => {
                        const params = new URLSearchParams();
                        params.append("action", "updateCell");
                        params.append("sheetName", "Partial QC");
                        params.append("rowIndex", rec.rowIndex.toString());
                        params.append("columnIndex", u.col);
                        params.append("value", u.val);
                        return fetch(SHEET_API_URL, { method: "POST", body: params });
                    }));
                    successCount++;
                } catch {
                    failCount++;
                }
            });

            await Promise.all(promises);

            if (successCount > 0) {
                toast.success(`Successfully approved ${successCount} record(s)!`, { id: toastId });
                setSelectedRows(new Set());
                setBulkOpen(false);
                fetchData();
            }
            if (failCount > 0) {
                toast.error(`Failed to approve ${failCount} record(s).`);
            }
        } catch (err: any) {
            toast.error(err.message || "Failed to submit", { id: toastId });
        } finally {
            setIsSubmitting(false);
        }
    };

    // --- Helper for Invoice Display ---
    const getFirstSelectedInvoice = useCallback(() => {
        if (selectedRows.size === 0) return null;
        const firstId = Array.from(selectedRows)[0];
        const rec = sheetRecords.find((r) => r.id === firstId);
        return rec?.data.invoiceNumber || null;
    }, [selectedRows, sheetRecords]);

    return (
        <div className="p-6">
            <div className="mb-6 p-6 bg-white border rounded-lg shadow-sm">
                <div className="flex justify-between items-center">
                    <div>
                        <h2 className="text-2xl font-bold">Stage 13: Return Approval</h2>
                        <p className="text-gray-600 mt-1">Approve return requests (Partial QC)</p>
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
                        <Button variant="outline" onClick={fetchData} disabled={isLoading}>
                            {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                        </Button>
                    </div>
                </div>

                {/* Bulk Approval Controls */}
                {selectedRows.size > 0 && (
                    <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded-lg">
                        <div className="flex items-center gap-4 flex-wrap">
                            <div className="flex items-center gap-2">
                                <Checkbox checked={true} disabled />
                                <span className="font-medium">{selectedRows.size} selected</span>
                                <span className="text-xs text-gray-500">
                                    (Invoice: {getFirstSelectedInvoice()})
                                </span>
                            </div>
                            <Button onClick={handleOpenBulkForm}>
                                Bulk Approval
                            </Button>
                        </div>
                    </div>
                )}
            </div>

            <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)}>
                <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="pending">Pending ({pending.length})</TabsTrigger>
                    <TabsTrigger value="history">History ({completed.length})</TabsTrigger>
                </TabsList>

                {/* PENDING TAB */}
                <TabsContent value="pending" className="mt-6">
                    {pending.length === 0 ? (
                        <div className="text-center py-12 text-gray-500">No pending approvals</div>
                    ) : (
                        <div className="border rounded-lg overflow-x-auto">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead className="w-12">
                                            <Checkbox
                                                checked={selectedRows.size === pending.length && pending.length > 0}
                                                onCheckedChange={toggleAll}
                                            />
                                        </TableHead>
                                        <TableHead>Action</TableHead>
                                        <TableHead>Indent #</TableHead>
                                        <TableHead>Lift #</TableHead>
                                        <TableHead>Item Name</TableHead>
                                        <TableHead>Invoice #</TableHead>
                                        <TableHead>Return Qty</TableHead>
                                        <TableHead>Status</TableHead>
                                        <TableHead>Planned Date</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {pending.map((rec) => (
                                        <TableRow key={rec.id}>
                                            <TableCell className="w-12">
                                                <Checkbox
                                                    checked={selectedRows.has(rec.id)}
                                                    onCheckedChange={() => toggleRow(rec.id)}
                                                />
                                            </TableCell>
                                            <TableCell>
                                                <Button size="sm" onClick={() => handleOpenForm(rec.id)}>Process</Button>
                                            </TableCell>
                                            <TableCell>{rec.data.indentNumber}</TableCell>
                                            <TableCell>{rec.data.liftNumber}</TableCell>
                                            <TableCell>{rec.data.itemName}</TableCell>
                                            <TableCell>{safeValue(rec.data.invoiceNumber)}</TableCell>
                                            <TableCell>{safeValue(rec.data.returnQty)}</TableCell>
                                            <TableCell>{safeValue(rec.data.returnStatus)}</TableCell>
                                            <TableCell>{formatDate(rec.data.plannedDate)}</TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>
                    )}
                </TabsContent>

                {/* HISTORY TAB */}
                <TabsContent value="history" className="mt-6">
                    {completed.length === 0 ? (
                        <div className="text-center py-12 text-gray-500">No history</div>
                    ) : (
                        <div className="border rounded-lg overflow-x-auto">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Indent #</TableHead>
                                        <TableHead>Item Name</TableHead>
                                        <TableHead>Invoice #</TableHead>
                                        <TableHead>Return Qty</TableHead>
                                        <TableHead>Status</TableHead>
                                        <TableHead>Planned Date</TableHead>
                                        <TableHead>Actual Date</TableHead>
                                        <TableHead>Delay</TableHead>
                                        <TableHead>DN Number</TableHead>
                                        <TableHead>Image</TableHead>
                                        <TableHead>Remarks</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {completed.map((rec) => (
                                        <TableRow key={rec.id}>
                                            <TableCell>{rec.data.indentNumber}</TableCell>
                                            <TableCell>{rec.data.itemName}</TableCell>
                                            <TableCell>{safeValue(rec.data.invoiceNumber)}</TableCell>
                                            <TableCell>{safeValue(rec.data.returnQty)}</TableCell>
                                            <TableCell>{safeValue(rec.data.returnStatus)}</TableCell>
                                            <TableCell>{formatDate(rec.data.plannedDate)}</TableCell>
                                            <TableCell>{formatDate(rec.data.actualDate)}</TableCell>
                                            <TableCell>{rec.data.delay}</TableCell>
                                            <TableCell>{rec.data.dnNumber}</TableCell>
                                            <TableCell>
                                                {rec.data.returnImage ? (
                                                    <a href={rec.data.returnImage} target="_blank" rel="noopener noreferrer" className="text-blue-500 underline flex items-center gap-1">
                                                        <FileText className="w-3 h-3" /> View
                                                    </a>
                                                ) : "-"}
                                            </TableCell>
                                            <TableCell>{rec.data.remarks}</TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>
                    )}
                </TabsContent>
            </Tabs>

            {/* FORM MODAL */}
            <Dialog open={open} onOpenChange={setOpen}>
                <DialogContent className="max-w-lg">
                    <DialogHeader>
                        <DialogTitle>Return Approval</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>Lift Number</Label>
                                <Input value={formData.liftNumber} disabled className="bg-gray-100 h-8 text-xs" />
                            </div>
                            <div className="space-y-2">
                                <Label>Invoice Number</Label>
                                <Input value={formData.invoiceNumber} disabled className="bg-gray-100 h-8 text-xs" />
                            </div>

                            <div className="space-y-2">
                                <Label>Item Name</Label>
                                <Input value={formData.itemName} disabled className="bg-gray-100 h-8 text-xs" />
                            </div>
                            <div className="space-y-2">
                                <Label>Return Qty</Label>
                                <Input value={formData.returnQty} disabled className="bg-gray-100 h-8 text-xs" />
                            </div>

                            <div className="space-y-2">
                                <Label>Approval Date *</Label>
                                <Input
                                    type="date"
                                    value={formData.actualDate}
                                    onChange={(e) => setFormData({ ...formData, actualDate: e.target.value })}
                                    className="h-8 text-xs"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>Debit Note / DN No. *</Label>
                                <Input
                                    placeholder="Enter DN Number"
                                    value={formData.dnNumber}
                                    onChange={(e) => setFormData({ ...formData, dnNumber: e.target.value })}
                                    className="h-8 text-xs"
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>Image *</Label>
                                <div className="flex items-center gap-2">
                                    <Input
                                        id="image-upload"
                                        type="file"
                                        accept="image/*,.pdf"
                                        onChange={handleFileChange}
                                        className="hidden"
                                    />
                                    <Button
                                        type="button"
                                        variant="outline"
                                        className="flex-1 flex items-center justify-center gap-2 h-8 border-dashed text-xs px-2"
                                        onClick={() => document.getElementById("image-upload")?.click()}
                                    >
                                        {formData.returnImage ? (
                                            <div className="flex items-center gap-2 text-green-600 truncate">
                                                <FileText className="w-3 h-3 flex-shrink-0" />
                                                <span className="truncate">{formData.returnImage.name}</span>
                                            </div>
                                        ) : (
                                            <>
                                                <Upload className="w-3 h-3 text-gray-400 flex-shrink-0" />
                                                <span className="text-gray-500 truncate">Upload</span>
                                            </>
                                        )}
                                    </Button>
                                    {formData.returnImage && (
                                        <Button
                                            type="button"
                                            variant="ghost"
                                            size="icon"
                                            className="h-8 w-8 flex-shrink-0"
                                            onClick={() => setFormData(prev => ({ ...prev, returnImage: null }))}
                                        >
                                            <X className="w-3 h-3 text-red-500" />
                                        </Button>
                                    )}
                                </div>
                            </div>
                            <div className="space-y-2">
                                <Label>Remarks</Label>
                                <Input
                                    placeholder="Enter remarks..."
                                    value={formData.remarks}
                                    onChange={(e) => setFormData({ ...formData, remarks: e.target.value })}
                                    className="h-8 text-xs"
                                />
                            </div>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
                        <Button
                            onClick={handleSubmit}
                            disabled={isSubmitting || !formData.dnNumber || !formData.dnNumber.trim() || !formData.returnImage}
                        >
                            {isSubmitting ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Submitting...
                                </>
                            ) : "Submit"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* BULK APPROVAL MODAL */}
            <Dialog open={bulkOpen} onOpenChange={setBulkOpen}>
                <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>Bulk Return Approval ({selectedRows.size} items)</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        {/* Selected Items Table */}
                        <div>
                            <Label className="text-sm font-medium mb-2 block">Selected Items</Label>
                            <div className="border rounded-lg overflow-hidden max-h-48 overflow-y-auto">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Indent #</TableHead>
                                            <TableHead>Item Name</TableHead>
                                            <TableHead>Return Qty</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {selectedRecords.map((rec) => (
                                            <TableRow key={rec.id}>
                                                <TableCell className="py-2">{rec.data.indentNumber}</TableCell>
                                                <TableCell className="py-2">{rec.data.itemName}</TableCell>
                                                <TableCell className="py-2">{safeValue(rec.data.returnQty)}</TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </div>
                        </div>

                        {/* Common Fields */}
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>Approval Date *</Label>
                                <Input
                                    type="date"
                                    value={bulkFormData.actualDate}
                                    onChange={(e) => setBulkFormData({ ...bulkFormData, actualDate: e.target.value })}
                                    className="h-8 text-xs"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>Debit Note / DN No. *</Label>
                                <Input
                                    placeholder="Enter DN Number"
                                    value={bulkFormData.dnNumber}
                                    onChange={(e) => setBulkFormData({ ...bulkFormData, dnNumber: e.target.value })}
                                    className="h-8 text-xs"
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>Image *</Label>
                                <div className="flex items-center gap-2">
                                    <Input
                                        id="bulk-image-upload"
                                        type="file"
                                        accept="image/*,.pdf"
                                        onChange={(e) => {
                                            if (e.target.files && e.target.files[0]) {
                                                setBulkFormData({ ...bulkFormData, returnImage: e.target.files[0] });
                                            }
                                        }}
                                        className="hidden"
                                    />
                                    <Button
                                        type="button"
                                        variant="outline"
                                        className="flex-1 flex items-center justify-center gap-2 h-8 border-dashed text-xs px-2"
                                        onClick={() => document.getElementById("bulk-image-upload")?.click()}
                                    >
                                        {bulkFormData.returnImage ? (
                                            <div className="flex items-center gap-2 text-green-600 truncate">
                                                <FileText className="w-3 h-3 flex-shrink-0" />
                                                <span className="truncate">{bulkFormData.returnImage.name}</span>
                                            </div>
                                        ) : (
                                            <>
                                                <Upload className="w-3 h-3 text-gray-400 flex-shrink-0" />
                                                <span className="text-gray-500 truncate">Upload</span>
                                            </>
                                        )}
                                    </Button>
                                    {bulkFormData.returnImage && (
                                        <Button
                                            type="button"
                                            variant="ghost"
                                            size="icon"
                                            className="h-8 w-8 flex-shrink-0"
                                            onClick={() => setBulkFormData({ ...bulkFormData, returnImage: null })}
                                        >
                                            <X className="w-3 h-3 text-red-500" />
                                        </Button>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setBulkOpen(false)}>Cancel</Button>
                        <Button
                            onClick={handleBulkSubmit}
                            disabled={isSubmitting || !bulkFormData.dnNumber || !bulkFormData.dnNumber.trim() || !bulkFormData.returnImage}
                        >
                            {isSubmitting ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Submitting...
                                </>
                            ) : "Submit"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
