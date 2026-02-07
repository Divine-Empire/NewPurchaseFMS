"use client";

import React, { useState, useEffect } from "react";
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
import { Textarea } from "@/components/ui/textarea";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, RefreshCw, Upload, FileText, X } from "lucide-react";
import { toast } from "sonner";

// Helper to convert file to base64
const toBase64 = (file: File) => new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve((reader.result as string).split(',')[1]);
    reader.onerror = error => reject(error);
});

export default function Stage13() {
    const SHEET_API_URL = process.env.NEXT_PUBLIC_API_URI;
    const [activeTab, setActiveTab] = useState<"pending" | "history">("pending");
    const [sheetRecords, setSheetRecords] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [open, setOpen] = useState(false);
    const [selectedRecordId, setSelectedRecordId] = useState<string | null>(null);

    const [formData, setFormData] = useState({
        liftNumber: "",
        itemName: "",
        invoiceNumber: "", // New Read-only
        returnQty: "",     // New Read-only
        actualDate: "",
        dnNumber: "",      // New Mandatory
        returnImage: null as File | null, // New Mandatory
        remarks: "",
    });

    // Calculate delay based on Planned Date (row[76]) vs Actual Date (user input)
    const [plannedDateForDelay, setPlannedDateForDelay] = useState<Date | null>(null);

    const fetchData = async () => {
        if (!SHEET_API_URL) return;
        setIsLoading(true);
        try {
            const res = await fetch(`${SHEET_API_URL}?sheet=RECEIVING-ACCOUNTS&action=getAll`);
            const json = await res.json();
            if (json.success && Array.isArray(json.data)) {
                // Skip header (6 rows usually, but checking slice(6) in other files)
                const rows = json.data.slice(6)
                    .map((row: any, i: number) => ({ row, originalIndex: i + 7 }))
                    .filter(({ row }: any) => row[1] && String(row[1]).trim() !== "")
                    .map(({ row, originalIndex }: any) => {
                        // Stage Logic
                        // Planned: Col BY (Index 76)
                        // Actual: Col BZ (Index 77)

                        const plan76 = row[76];
                        const actual77 = row[77];

                        const hasPlan = !!plan76 && String(plan76).trim() !== "" && String(plan76).trim() !== "-";
                        const hasActual = !!actual77 && String(actual77).trim() !== "" && String(actual77).trim() !== "-";

                        let status = "not_ready";
                        if (hasPlan && hasActual) {
                            status = "completed";
                        } else if (hasPlan && !hasActual) {
                            status = "pending";
                        }

                        return {
                            id: row[1] || `row-${originalIndex}`,
                            rowIndex: originalIndex,
                            stage: 13,
                            status,
                            data: {
                                indentNumber: row[1] || "",      // B: Indent Number
                                liftNumber: row[2] || "",        // C: Lift No
                                vendorName: row[3] || "",        // D: Vendor Name
                                itemName: row[7] || "",          // H: Item Name

                                // New Fields Requested
                                invoiceNumber: row[24] || "-",   // Y: Invoice Number
                                returnQty: row[66] || "-",       // BO: Return Qty

                                // Stage Data
                                plannedDate: row[76],            // BY
                                actualDate: row[77],             // BZ
                                delay: row[78],                  // CA
                                dnNumber: row[79],               // CB: DN Number (was Status)
                                remarks: row[80],                // CC
                                returnImage: row[81],            // CD: Image
                            }
                        };
                    });
                setSheetRecords(rows);
            }
        } catch (e) {
            console.error("Fetch error:", e);
            toast.error("Failed to fetch data");
        }
        setIsLoading(false);
    };

    useEffect(() => {
        fetchData();
    }, []);

    const pending = sheetRecords.filter((r) => r.status === "pending");
    const completed = sheetRecords.filter((r) => r.status === "completed");

    const handleOpenForm = (recordId: string) => {
        const rec = sheetRecords.find((r) => r.id === recordId);
        if (!rec) return;

        setSelectedRecordId(recordId);

        // Parse Planned Date for delay calculation
        const pDate = rec.data.plannedDate ? new Date(rec.data.plannedDate) : null;
        setPlannedDateForDelay(pDate && !isNaN(pDate.getTime()) ? pDate : null);

        setFormData({
            liftNumber: rec.data.liftNumber || rec.data.indentNumber, // Prefill Lift/Indent
            itemName: rec.data.itemName,
            invoiceNumber: rec.data.invoiceNumber,
            returnQty: rec.data.returnQty,
            actualDate: new Date().toISOString().split("T")[0], // Default to Today
            dnNumber: "",
            returnImage: null,
            remarks: "",
        });
        setOpen(true);
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            setFormData({ ...formData, returnImage: e.target.files[0] });
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedRecordId || !SHEET_API_URL) return;

        // Mandatory Validation
        if (!formData.dnNumber || !formData.dnNumber.trim()) {
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
            const uploadFile = async (file: File) => {
                const uploadParams = new URLSearchParams();
                uploadParams.append("action", "uploadFile");
                uploadParams.append("base64Data", await toBase64(file));
                uploadParams.append("fileName", file.name);
                uploadParams.append("mimeType", file.type);
                const folderId = process.env.NEXT_PUBLIC_IMAGE_FOLDER_ID || "1SihRrPrgbuPGm-09fuB180QJhdxq5Nxy";
                uploadParams.append("folderId", folderId);

                const res = await fetch(SHEET_API_URL, {
                    method: "POST",
                    body: uploadParams
                });
                const json = await res.json();
                if (json.success) return json.fileUrl;
                else throw new Error("Upload failed: " + (json.error || "Unknown error"));
            };

            if (formData.returnImage) {
                imageUrl = await uploadFile(formData.returnImage);
            }

            // Calculate Delay
            let delayVal = 0;
            if (plannedDateForDelay && formData.actualDate) {
                const actual = new Date(formData.actualDate);
                const diffTime = actual.getTime() - plannedDateForDelay.getTime();
                delayVal = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                if (delayVal < 0) delayVal = 0;
            }

            // Format Date
            const d = new Date(formData.actualDate);
            const dateStr = `${d.getMonth() + 1}/${d.getDate()}/${d.getFullYear()}`;

            // Create sparse row
            // Need up to index 81 (CD)
            const rowArray = new Array(82).fill("");

            // Map to Indices
            // BZ: Actual
            rowArray[77] = dateStr;
            // CA: Delay
            rowArray[78] = delayVal.toString();
            // CB: DN Number (was Status)
            rowArray[79] = formData.dnNumber;
            // CC: Remarks
            rowArray[80] = formData.remarks;
            // CD: Image
            rowArray[81] = imageUrl;

            const params = new URLSearchParams();
            params.append("action", "update");
            params.append("sheetName", "RECEIVING-ACCOUNTS");
            params.append("rowIndex", rec.rowIndex.toString());
            params.append("rowData", JSON.stringify(rowArray));

            const res = await fetch(`${SHEET_API_URL}`, { method: "POST", body: params });
            const json = await res.json();

            if (json.success) {
                toast.success("Approved successfully!", { id: toastId });
                setOpen(false);
                fetchData();
            } else {
                throw new Error(json.error || "Update failed");
            }

        } catch (err: any) {
            toast.error(err.message || "Failed to submit", { id: toastId });
        } finally {
            setIsSubmitting(false);
        }
    };

    const formatDate = (dateStr: string) => {
        if (!dateStr) return "-";
        const d = new Date(dateStr);
        if (isNaN(d.getTime())) return dateStr;
        return d.toLocaleDateString();
    }

    const safeValue = (val: any) => {
        return val && String(val).trim() !== "" ? val : "-";
    }

    return (
        <div className="p-6">
            <div className="mb-6 p-6 bg-white border rounded-lg shadow-sm flex justify-between items-center">
                <div>
                    <h2 className="text-2xl font-bold">Stage 13: Return Approval</h2>
                    <p className="text-gray-600 mt-1">Approve return requests</p>
                </div>
                <Button variant="outline" onClick={fetchData} disabled={isLoading}>
                    {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                </Button>
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
                                        <TableHead>Action</TableHead>
                                        <TableHead>Indent #</TableHead>
                                        <TableHead>Lift #</TableHead>
                                        <TableHead>Item Name</TableHead>
                                        <TableHead>Invoice #</TableHead>
                                        <TableHead>Return Qty</TableHead>
                                        <TableHead>Planned Date</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {pending.map((rec) => (
                                        <TableRow key={rec.id}>
                                            <TableCell>
                                                <Button size="sm" onClick={() => handleOpenForm(rec.id)}>Process</Button>
                                            </TableCell>
                                            <TableCell>{rec.data.indentNumber}</TableCell>
                                            <TableCell>{rec.data.liftNumber}</TableCell>
                                            <TableCell>{rec.data.itemName}</TableCell>
                                            <TableCell>{safeValue(rec.data.invoiceNumber)}</TableCell>
                                            <TableCell>{safeValue(rec.data.returnQty)}</TableCell>
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
                        {/* 2-Column Grid for Compact Layout */}
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

                        {/* Image and Remarks - optimize vertical space */}
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
                                            onClick={() => setFormData({ ...formData, returnImage: null })}
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
        </div>
    );
}
