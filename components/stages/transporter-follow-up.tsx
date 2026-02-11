"use client";

import React, { useState, useEffect } from "react";
import { toast } from "sonner";
import { Loader2, RefreshCw, ArrowUpDown } from "lucide-react";
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
import { Textarea } from "@/components/ui/textarea";
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
import { Checkbox } from "@/components/ui/checkbox";

const SHEET_API_URL = process.env.NEXT_PUBLIC_API_URI;

export default function TransporterFollowUp() {
    const [records, setRecords] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [activeTab, setActiveTab] = useState<"pending" | "history">("pending");

    // Modal State
    const [open, setOpen] = useState(false);
    const [selectedRecord, setSelectedRecord] = useState<any | null>(null);

    // Form State
    const [formData, setFormData] = useState({
        status: "",
        remarks: "",
        expectedDate: "",
    });

    // Sorting State
    const [sortConfig, setSortConfig] = useState<{ key: string; direction: "asc" | "desc" } | null>(null);

    // Selection State
    const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set());

    // -----------------------------------------------------------------
    // FETCH DATA
    // -----------------------------------------------------------------
    const fetchData = async () => {
        if (!SHEET_API_URL) return;
        setIsLoading(true);
        try {
            // Fetch Transport Follow-Up Data for Expected Dates
            const resTransport = await fetch(`${SHEET_API_URL}?sheet=Transport Flw-Up&action=getAll`);
            const jsonTransport = await resTransport.json();
            const transportMap = new Map<string, string>();

            if (jsonTransport.success && Array.isArray(jsonTransport.data)) {
                // Skip header (row 1)
                jsonTransport.data.slice(1).forEach((row: any) => {
                    const liftNo = row[1]; // Column B
                    const exDate = row[4]; // Column E
                    // Store the expected date for this lift number (later rows overwrite earlier ones)
                    if (liftNo) {
                        transportMap.set(liftNo, exDate || "");
                    }
                });
            }

            const res = await fetch(`${SHEET_API_URL}?sheet=RECEIVING-ACCOUNTS&action=getAll`);
            const json = await res.json();

            if (json.success && Array.isArray(json.data)) {
                // Data starts from row 7 (index 6) - skip 6 header rows
                const rows = json.data.slice(6)
                    .map((row: any, i: number) => ({ row, originalIndex: i + 7 }))
                    .filter(({ row }: any) => {
                        // Filter: Only include rows where Column CG (Planned) has a value
                        const plannedDate = row[84]; // Column CG (index 84)
                        return plannedDate && String(plannedDate).trim() !== "" && String(plannedDate).trim() !== "-";
                    })
                    .map(({ row, originalIndex }: any) => {
                        // Status Logic
                        const plannedDate = row[84]; // Column CG
                        const actualDate = row[85];  // Column CH

                        const hasPlanned = !!plannedDate && String(plannedDate).trim() !== "" && String(plannedDate).trim() !== "-";
                        const hasActual = !!actualDate && String(actualDate).trim() !== "" && String(actualDate).trim() !== "-";

                        let status = "not_ready";
                        if (hasPlanned && !hasActual) {
                            status = "pending";
                        } else if (hasPlanned && hasActual) {
                            status = "history";
                        }

                        const liftNo = row[2]; // Column C
                        const expectedDate = transportMap.get(liftNo) || "";

                        return {
                            id: `${liftNo}_${originalIndex}`, // Lift No + row index as unique ID
                            rowIndex: originalIndex,
                            status,
                            rawRow: row,
                            data: {
                                indentNumber: row[1],      // Column B
                                liftNo: liftNo,            // Column C
                                vendorName: row[3],        // Column D
                                poNumber: row[4],          // Column E
                                liftingQty: row[8],        // Column I
                                transporterName: row[9],   // Column J
                                vehicleNo: row[10],        // Column K
                                contactNo: row[11],        // Column L
                                freightAmt: row[14],       // Column O
                                plannedDate: row[84],      // Column CG
                                actualDate: row[85],       // Column CH
                                expectedDate: expectedDate, // From Transport Flw-Up
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
    // COLUMNS & SORTING
    // -----------------------------------------------------------------
    const handleSort = (key: string) => {
        let direction: "asc" | "desc" = "asc";
        if (sortConfig && sortConfig.key === key && sortConfig.direction === "asc") {
            direction = "desc";
        }
        setSortConfig({ key, direction });
    };

    const sortedPending = React.useMemo(() => {
        const pendingItems = records.filter(r => r.status === "pending");
        if (!sortConfig) return pendingItems;

        return [...pendingItems].sort((a, b) => {
            const aValue = a.data[sortConfig.key] || "";
            const bValue = b.data[sortConfig.key] || "";

            // Date sorting for Expected Date
            if (sortConfig.key === "expectedDate") {
                const dateA = new Date(aValue).getTime() || 0;
                const dateB = new Date(bValue).getTime() || 0;
                if (dateA < dateB) return sortConfig.direction === "asc" ? -1 : 1;
                if (dateA > dateB) return sortConfig.direction === "asc" ? 1 : -1;
                return 0;
            }

            // General string/number sorting
            if (aValue < bValue) return sortConfig.direction === "asc" ? -1 : 1;
            if (aValue > bValue) return sortConfig.direction === "asc" ? 1 : -1;
            return 0;
        });
    }, [records, sortConfig]);

    const completed = records.filter(r => r.status === "history");
    const pending = sortedPending; // Use sorted list for display

    const columns = [
        { key: "indentNumber", label: "Indent No" },
        { key: "expectedDate", label: "Expected Date" },
        { key: "liftNo", label: "Lift No" },
        { key: "vendorName", label: "Vendor Name" },
        { key: "poNumber", label: "PO Number" },
        { key: "liftingQty", label: "Lifting Qty" },
        { key: "transporterName", label: "Transporter Name" },
        { key: "freightAmt", label: "Freight Amt" },
        { key: "vehicleNo", label: "Vehicle No" },
        { key: "contactNo", label: "Contact Number" },
    ];

    // -----------------------------------------------------------------
    // MODAL
    // -----------------------------------------------------------------
    const handleOpenForm = (record: any) => {
        setSelectedRecord(record);
        setFormData({
            status: "",
            remarks: "",
            expectedDate: "",
        });
        setOpen(true);
    };

    // -----------------------------------------------------------------
    // SUBMIT (Writes to Transport Flw-Up sheet)
    // -----------------------------------------------------------------
    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedRecord) return;

        // Validation
        if (!formData.status) {
            toast.error("Status is required");
            return;
        }

        // Validate Expected Date when status is Intransit
        if (formData.status === "Intransit" && !formData.expectedDate) {
            toast.error("Expected Date is required when status is Intransit");
            return;
        }

        setIsSubmitting(true);
        const toastId = toast.loading("Recording Follow-Up...");

        try {
            // Prepare row data for "Transport Flw-Up" sheet
            // Columns: A=Timestamp, B=Lift No, C=Status, D=Remarks, E=Expected Date
            const timestamp = new Date().toLocaleString("en-US", {
                month: "2-digit",
                day: "2-digit",
                year: "numeric",
                hour: "2-digit",
                minute: "2-digit",
                second: "2-digit",
                hour12: false
            });

            const rowData = [
                timestamp,                      // Column A
                selectedRecord.data.liftNo,     // Column B
                formData.status,                // Column C
                formData.remarks || "",         // Column D
                formData.expectedDate || "",    // Column E (only populated when status is Intransit)
            ];

            // Insert into "Transport Flw-Up" sheet
            const params = new URLSearchParams();
            params.append("action", "insert");
            params.append("sheetName", "Transport Flw-Up");
            params.append("rowData", JSON.stringify(rowData));

            const res = await fetch(`${SHEET_API_URL}`, { method: "POST", body: params });
            const json = await res.json();

            if (json.success) {
                // If status is "Received", we also need to update Column CH in "RECEIVING-ACCOUNTS"
                if (formData.status === "Received" && selectedRecord.rowIndex) {
                    // Create sparse array with only Column CH (index 85) populated
                    // This ensures we ONLY update Column CH and don't disturb other columns
                    const updateRow = new Array(86).fill("");

                    // Update ONLY Column CH (index 85) with current date
                    const currentDate = new Date().toLocaleDateString("en-US");
                    updateRow[85] = currentDate;

                    const updateParams = new URLSearchParams();
                    updateParams.append("action", "update");
                    updateParams.append("sheetName", "RECEIVING-ACCOUNTS");
                    updateParams.append("rowIndex", selectedRecord.rowIndex.toString());
                    updateParams.append("rowData", JSON.stringify(updateRow));

                    await fetch(`${SHEET_API_URL}`, { method: "POST", body: updateParams });
                }

                toast.success("Follow-Up Recorded!", { id: toastId });
                setOpen(false);
                fetchData(); // Refresh data
            } else {
                toast.error("Failed: " + (json.error || "Unknown"), { id: toastId });
            }

        } catch (err: any) {
            console.error(err);
            toast.error(err.message || "Failed", { id: toastId });
        } finally {
            setIsSubmitting(false);
        }
    };

    // -----------------------------------------------------------------
    // SELECTION
    // -----------------------------------------------------------------
    const toggleRow = (id: string) => {
        const newSelected = new Set(selectedRows);
        if (newSelected.has(id)) {
            newSelected.delete(id);
        } else {
            newSelected.add(id);
        }
        setSelectedRows(newSelected);
    };

    const toggleAll = () => {
        const currentList = activeTab === "pending" ? pending : completed;
        if (selectedRows.size === currentList.length) {
            setSelectedRows(new Set());
        } else {
            setSelectedRows(new Set(currentList.map(r => r.id)));
        }
    };

    const safeValue = (val: any) => {
        if (!val || val === "-" || val === "") return "-";
        return String(val);
    };

    return (
        <div className="p-6">
            <div className="mb-6 p-6 bg-white border rounded-lg shadow-sm flex justify-between items-center">
                <div>
                    <h2 className="text-2xl font-bold">Transporter Follow-Up</h2>
                    <p className="text-gray-600 mt-1">Track transportation status and updates</p>
                </div>

                <div className="flex gap-4 items-center">
                    {/* Sorting Dropdown - Only for Pending Tab */}
                    {activeTab === "pending" && (
                        <Select
                            value={sortConfig?.key || ""}
                            onValueChange={(value) => handleSort(value)}
                        >
                            <SelectTrigger className="w-[180px]">
                                <SelectValue placeholder="Sort by..." />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="indentNumber">Sort by Indent No</SelectItem>
                                <SelectItem value="expectedDate">Sort by Expected Date</SelectItem>
                            </SelectContent>
                        </Select>
                    )}

                    <Button variant="outline" onClick={fetchData} disabled={isLoading}>
                        {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                    </Button>
                </div>
            </div>

            {isLoading ? (
                <div className="flex justify-center items-center h-64">
                    <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
                    <span className="ml-2 text-gray-500">Loading transport records...</span>
                </div>
            ) : (
                <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)}>
                    <TabsList className="grid w-full grid-cols-2">
                        <TabsTrigger value="pending">Pending ({pending.length})</TabsTrigger>
                        <TabsTrigger value="history">History ({completed.length})</TabsTrigger>
                    </TabsList>

                    <TabsContent value="pending" className="mt-6">
                        {pending.length === 0 ? (
                            <div className="text-center py-12 text-gray-500">No pending transporter follow-ups</div>
                        ) : (
                            <div className="border rounded-lg overflow-x-auto">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead className="w-[50px]">
                                                <Checkbox
                                                    checked={selectedRows.size === pending.length && pending.length > 0}
                                                    onCheckedChange={toggleAll}
                                                />
                                            </TableHead>
                                            <TableHead className="w-[100px] sticky left-0 z-20 bg-white shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]">Actions</TableHead>
                                            {columns.map(c => (
                                                <TableHead key={c.key}>{c.label}</TableHead>
                                            ))}
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {pending.map(rec => (
                                            <TableRow key={rec.id}>
                                                <TableCell>
                                                    <Checkbox
                                                        checked={selectedRows.has(rec.id)}
                                                        onCheckedChange={() => toggleRow(rec.id)}
                                                    />
                                                </TableCell>
                                                <TableCell className="sticky left-0 z-20 bg-white shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]">
                                                    <Button size="sm" onClick={() => handleOpenForm(rec)} className="bg-blue-600 hover:bg-blue-700">
                                                        Follow-Up
                                                    </Button>
                                                </TableCell>
                                                {columns.map(c => (
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
                            <div className="text-center py-12 text-gray-500">No follow-up history</div>
                        ) : (
                            <div className="border rounded-lg overflow-x-auto">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead className="w-[50px]">
                                                <Checkbox
                                                    checked={selectedRows.size === completed.length && completed.length > 0}
                                                    onCheckedChange={toggleAll}
                                                />
                                            </TableHead>
                                            {columns.map(c => <TableHead key={c.key}>{c.label}</TableHead>)}
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {completed.map(rec => (
                                            <TableRow key={rec.id}>
                                                <TableCell>
                                                    <Checkbox
                                                        checked={selectedRows.has(rec.id)}
                                                        onCheckedChange={() => toggleRow(rec.id)}
                                                    />
                                                </TableCell>
                                                {columns.map(c => (
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
                        <DialogTitle>Transport Follow-Up</DialogTitle>
                    </DialogHeader>

                    <form onSubmit={handleSubmit} className="space-y-4 py-2">
                        {/* Read-Only Fields */}
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <Label className="text-sm font-medium">Transporter Name</Label>
                                <Input
                                    value={selectedRecord?.data.transporterName || ""}
                                    readOnly
                                    className="bg-gray-50"
                                />
                            </div>
                            <div>
                                <Label className="text-sm font-medium">Vehicle Number</Label>
                                <Input
                                    value={selectedRecord?.data.vehicleNo || ""}
                                    readOnly
                                    className="bg-gray-50"
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <Label className="text-sm font-medium">Contact Number</Label>
                                <Input
                                    value={selectedRecord?.data.contactNo || ""}
                                    readOnly
                                    className="bg-gray-50"
                                />
                            </div>
                            <div>
                                <Label className="text-sm font-medium">Lift No</Label>
                                <Input
                                    value={selectedRecord?.data.liftNo || ""}
                                    readOnly
                                    className="bg-gray-50"
                                />
                            </div>
                        </div>

                        <div>
                            <Label className="text-sm font-medium">Indent Number</Label>
                            <Input
                                value={selectedRecord?.data.indentNumber || ""}
                                readOnly
                                className="bg-gray-50"
                            />
                        </div>

                        {/* Editable Fields - Inline Layout */}
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <Label>Status <span className="text-red-500">*</span></Label>
                                <Select value={formData.status} onValueChange={(v) => setFormData({ ...formData, status: v })}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select status" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="Intransit">Intransit</SelectItem>
                                        <SelectItem value="Received">Received</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>

                            {/* Expected Date - Only show when Status is Intransit */}
                            {formData.status === "Intransit" && (
                                <div>
                                    <Label>Expected Date <span className="text-red-500">*</span></Label>
                                    <Input
                                        type="date"
                                        value={formData.expectedDate}
                                        onChange={(e) => setFormData({ ...formData, expectedDate: e.target.value })}
                                        required
                                    />
                                </div>
                            )}
                        </div>

                        <div>
                            <Label>Remarks</Label>
                            <Textarea
                                value={formData.remarks}
                                onChange={(e) => setFormData({ ...formData, remarks: e.target.value })}
                                placeholder="Enter any remarks..."
                                rows={3}
                            />
                        </div>

                        <DialogFooter>
                            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                                Cancel
                            </Button>
                            <Button type="submit" disabled={isSubmitting} className="bg-blue-600 hover:bg-blue-700">
                                {isSubmitting ? "Submitting..." : "Submit"}
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>
        </div>
    );
}
