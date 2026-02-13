"use client";

import React, { useState, useEffect } from "react";
import { toast } from "sonner";
import { Loader2, RefreshCw, ArrowUpDown, Search } from "lucide-react";
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
    const [searchTerm, setSearchTerm] = useState("");

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

    // Bulk State
    const [isBulkMode, setIsBulkMode] = useState(false);
    const [bulkError, setBulkError] = useState<string | null>(null);

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
            const transportMap = new Map<string, { status: string, remarks: string, expectedDate: string }>();

            if (jsonTransport.success && Array.isArray(jsonTransport.data)) {
                // Skip header (row 1)
                jsonTransport.data.slice(1).forEach((row: any) => {
                    const liftNo = row[1]; // Column B
                    const status = row[2]; // Column C
                    const remarks = row[3]; // Column D
                    const exDate = row[4]; // Column E

                    if (liftNo) {
                        transportMap.set(liftNo, {
                            status: status || "",
                            remarks: remarks || "",
                            expectedDate: exDate || ""
                        });
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
                        // Filter: Only include rows where Column CK (Planned) has a value
                        const plannedDate = row[88]; // Column CK (index 88)
                        return plannedDate && String(plannedDate).trim() !== "" && String(plannedDate).trim() !== "-";
                    })
                    .map(({ row, originalIndex }: any) => {
                        // Status Logic
                        const plannedDate = row[88]; // Column CK
                        const actualDate = row[89];  // Column CL

                        const hasPlanned = !!plannedDate && String(plannedDate).trim() !== "" && String(plannedDate).trim() !== "-";
                        const hasActual = !!actualDate && String(actualDate).trim() !== "" && String(actualDate).trim() !== "-";

                        let status = "not_ready";
                        if (hasPlanned && !hasActual) {
                            status = "pending";
                        } else if (hasPlanned && hasActual) {
                            status = "history";
                        }

                        const liftNo = row[2]; // Column C
                        const followUpData = transportMap.get(liftNo);
                        const expectedDate = followUpData?.expectedDate || "";
                        const latestRemarks = followUpData?.remarks || "";

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
                                invoiceNumber: row[24],    // Column Y (Added for Search)
                                itemName: row[7],          // Column H (Added for Search)
                                liftingQty: row[8],        // Column I
                                transporterName: row[9],   // Column J
                                vehicleNo: row[10],        // Column K
                                contactNo: row[11],        // Column L
                                freightAmt: row[14],       // Column O
                                plannedDate: row[88],      // Column CK (Index 88)
                                actualDate: row[89],       // Column CL (Index 89)
                                expectedDate: expectedDate, // From Transport Flw-Up
                                remarks: latestRemarks,      // From Transport Flw-Up
                                lrCopy: row[18],           // Column S (LR Copy)
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
        const pendingItems = records
            .filter(r => r.status === "pending")
            .filter((r) => {
                const searchLower = searchTerm.toLowerCase();
                return (
                    r.data.indentNumber?.toLowerCase().includes(searchLower) ||
                    r.data.itemName?.toLowerCase().includes(searchLower) ||
                    r.data.vendorName?.toLowerCase().includes(searchLower) ||
                    r.data.vendorName?.toLowerCase().includes(searchLower) ||
                    String(r.data.poNumber || "").toLowerCase().includes(searchLower) ||
                    String(r.data.invoiceNumber || "").toLowerCase().includes(searchLower) ||
                    String(r.data.lrCopy || "").toLowerCase().includes(searchLower)
                );
            });

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
    }, [records, sortConfig, searchTerm]);

    const completed = records.filter(r => r.status === "history");
    const pending = sortedPending; // Use sorted list for display

    const columns = [
        { key: "indentNumber", label: "Indent No" },
        { key: "itemName", label: "Item Name" }, // Added to columns
        { key: "expectedDate", label: "Expected Date" },
        { key: "remarks", label: "Remarks" }, // Added for latest follow-up remarks
        { key: "liftNo", label: "Lift No" },
        { key: "vendorName", label: "Vendor Name" },
        { key: "poNumber", label: "PO Number" },
        { key: "liftingQty", label: "Lifting Qty" },
        { key: "transporterName", label: "Transporter Name" },
        { key: "freightAmt", label: "Freight Amt" },
        { key: "vehicleNo", label: "Vehicle No" },
        { key: "contactNo", label: "Contact Number" },
        { key: "lrCopy", label: "LR Copy" },
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
        setIsBulkMode(false);
        setBulkError(null);
        setOpen(true);
    };

    const validateBulkSelection = () => {
        if (selectedRows.size <= 1) return true;
        const selectedItems = records.filter(r => selectedRows.has(r.id));
        if (selectedItems.length === 0) return false;

        const first = selectedItems[0];
        const vendor = first.data.vendorName;
        const po = first.data.poNumber;

        for (let i = 1; i < selectedItems.length; i++) {
            if (selectedItems[i].data.vendorName !== vendor || selectedItems[i].data.poNumber !== po) {
                return false;
            }
        }
        return true;
    };

    const handleBulkOpen = () => {
        if (selectedRows.size === 0) return;

        const isValid = validateBulkSelection();
        if (!isValid) {
            toast.error("Vendor and PO No. didn't match");
            setBulkError("Vendor and PO Number mismatch. Cannot submit.");
        } else {
            setBulkError(null);
        }

        // Use the first selected record to populate common fields (or just for context)
        const firstId = Array.from(selectedRows)[0];
        const rec = records.find(r => r.id === firstId);
        if (rec) {
            setSelectedRecord(rec);
            setFormData({
                status: "",
                remarks: "",
                expectedDate: "",
            });
            setIsBulkMode(true);
            setOpen(true);
        }
    };

    // -----------------------------------------------------------------
    // SUBMIT (Writes to Transport Flw-Up sheet)
    // -----------------------------------------------------------------
    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedRecord && !isBulkMode) return;
        if (isBulkMode && bulkError) {
            toast.error(bulkError);
            return;
        }

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
        const toastId = toast.loading(isBulkMode ? "Recording Bulk Follow-Up..." : "Recording Follow-Up...");

        try {
            const recordsToProcess = isBulkMode
                ? records.filter(r => selectedRows.has(r.id))
                : [selectedRecord];

            const timestamp = new Date().toLocaleString("en-US", {
                month: "2-digit",
                day: "2-digit",
                year: "numeric",
                hour: "2-digit",
                minute: "2-digit",
                second: "2-digit",
                hour12: false
            });

            // Process sequentially to ensure order and avoid rate limits
            for (const record of recordsToProcess) {
                // Prepare row data for "Transport Flw-Up" sheet
                const rowData = [
                    timestamp,                      // Column A
                    record.data.liftNo,             // Column B
                    formData.status,                // Column C
                    formData.remarks || "",         // Column D
                    formData.expectedDate || "",    // Column E
                ];

                // Insert into "Transport Flw-Up" sheet
                const params = new URLSearchParams();
                params.append("action", "insert");
                params.append("sheetName", "Transport Flw-Up");
                params.append("rowData", JSON.stringify(rowData));

                await fetch(`${SHEET_API_URL}`, { method: "POST", body: params });

                // If status is "Received", update "RECEIVING-ACCOUNTS"
                if (formData.status === "Received" && record.rowIndex) {
                    const updateRow = new Array(95).fill("");
                    const currentDate = new Date().toLocaleDateString("en-US");
                    updateRow[89] = currentDate; // Column CL (Index 89)

                    const updateParams = new URLSearchParams();
                    updateParams.append("action", "update");
                    updateParams.append("sheetName", "RECEIVING-ACCOUNTS");
                    updateParams.append("rowIndex", record.rowIndex.toString());
                    updateParams.append("rowData", JSON.stringify(updateRow));

                    await fetch(`${SHEET_API_URL}`, { method: "POST", body: updateParams });
                }
            }

            toast.success("Follow-Up Recorded!", { id: toastId });
            setOpen(false);
            if (isBulkMode) {
                setSelectedRows(new Set());
                setIsBulkMode(false);
            }
            fetchData(); // Refresh data

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
                    {/* Bulk Button */}
                    {activeTab === "pending" && selectedRows.size > 1 && (
                        <Button
                            className="bg-blue-600 hover:bg-blue-700 text-white"
                            onClick={handleBulkOpen}
                        >
                            Bulk Follow-Up ({selectedRows.size})
                        </Button>
                    )}

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

            {/* Search Filter */}
            <div className="mb-6 flex items-center gap-4">
                <div className="relative flex-1 max-w-sm">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-500" />
                    <Input
                        placeholder="Search by Indent No, Item Name, Vendor, PO, Invoice..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="pl-9 bg-white"
                    />
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
                                                {columns.map((c) => {
                                                    const val = rec.data[c.key];

                                                    // LR Copy Logic
                                                    if (c.key === "lrCopy") {
                                                        return (
                                                            <TableCell key={c.key}>
                                                                {val && val.trim() !== "" ? (
                                                                    <a
                                                                        href={val}
                                                                        target="_blank"
                                                                        rel="noreferrer"
                                                                        className="text-blue-600 underline"
                                                                    >
                                                                        View
                                                                    </a>
                                                                ) : "-"}
                                                            </TableCell>
                                                        );
                                                    }

                                                    // Expected Date Logic
                                                    if (c.key === "expectedDate") {
                                                        let displayDate = safeValue(val);
                                                        if (displayDate !== "-") {
                                                            const dateObj = new Date(val);
                                                            if (!isNaN(dateObj.getTime())) {
                                                                displayDate = dateObj.toLocaleDateString("en-GB", {
                                                                    day: "2-digit",
                                                                    month: "short",
                                                                    year: "numeric"
                                                                });
                                                            }
                                                        }
                                                        return <TableCell key={c.key}>{displayDate}</TableCell>;
                                                    }

                                                    // Default Logic
                                                    return <TableCell key={c.key}>{safeValue(val)}</TableCell>;
                                                })}
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
                                                {columns.map((c) => {
                                                    const val = rec.data[c.key];

                                                    // LR Copy Logic
                                                    if (c.key === "lrCopy") {
                                                        return (
                                                            <TableCell key={c.key}>
                                                                {val && val.trim() !== "" ? (
                                                                    <a
                                                                        href={val}
                                                                        target="_blank"
                                                                        rel="noreferrer"
                                                                        className="text-blue-600 underline"
                                                                    >
                                                                        View
                                                                    </a>
                                                                ) : "-"}
                                                            </TableCell>
                                                        );
                                                    }

                                                    // Expected Date Logic
                                                    if (c.key === "expectedDate") {
                                                        let displayDate = safeValue(val);
                                                        if (displayDate !== "-") {
                                                            const dateObj = new Date(val);
                                                            if (!isNaN(dateObj.getTime())) {
                                                                displayDate = dateObj.toLocaleDateString("en-GB", {
                                                                    day: "2-digit",
                                                                    month: "short",
                                                                    year: "numeric"
                                                                });
                                                            }
                                                        }
                                                        return <TableCell key={c.key}>{displayDate}</TableCell>;
                                                    }

                                                    // Default Logic
                                                    return <TableCell key={c.key}>{safeValue(val)}</TableCell>;
                                                })}
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
                        <DialogTitle>{isBulkMode ? `Bulk Follow-Up (${selectedRows.size} items)` : "Transport Follow-Up"}</DialogTitle>
                    </DialogHeader>

                    {bulkError && (
                        <div className="bg-red-50 text-red-600 p-3 rounded-md text-sm mb-4 border border-red-200">
                            {bulkError}
                        </div>
                    )}

                    <form onSubmit={handleSubmit} className="space-y-4 py-2">

                        {isBulkMode ? (
                            <div className="space-y-4">
                                {/* Selected Items List */}
                                <div className="border rounded-md overflow-hidden">
                                    <div className="bg-gray-50 px-4 py-2 border-b text-sm font-medium flex justify-between">
                                        <span>Selected Items ({selectedRows.size})</span>
                                        <span className="text-gray-500 font-normal">
                                            Vendor: {selectedRecord?.data.vendorName} | PO: {selectedRecord?.data.poNumber}
                                        </span>
                                    </div>
                                    <div className="max-h-40 overflow-y-auto p-2 bg-slate-50">
                                        <table className="w-full text-sm">
                                            <thead>
                                                <tr className="text-left text-gray-500 border-b">
                                                    <th className="pb-1 font-medium">Indent No</th>
                                                    <th className="pb-1 font-medium">Lift No</th>
                                                    <th className="pb-1 font-medium">Transporter</th>
                                                    <th className="pb-1 font-medium">Vehicle</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {records
                                                    .filter(r => selectedRows.has(r.id))
                                                    .map(r => (
                                                        <tr key={r.id} className="border-b last:border-0 border-gray-100">
                                                            <td className="py-1">{r.data.indentNumber}</td>
                                                            <td className="py-1">{r.data.liftNo}</td>
                                                            <td className="py-1 truncate max-w-[100px]" title={r.data.transporterName}>{r.data.transporterName}</td>
                                                            <td className="py-1">{r.data.vehicleNo}</td>
                                                        </tr>
                                                    ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            </div>
                        ) : (
                            /* Single Item View - Read Only Fields */
                            <>
                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <Label className="text-xs text-gray-500">Transporter Name</Label>
                                        <div className="p-2 bg-gray-50 rounded text-sm font-medium truncate">
                                            {selectedRecord?.data.transporterName || "-"}
                                        </div>
                                    </div>
                                    <div>
                                        <Label className="text-xs text-gray-500">Vehicle Number</Label>
                                        <div className="p-2 bg-gray-50 rounded text-sm font-medium">
                                            {selectedRecord?.data.vehicleNo || "-"}
                                        </div>
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <Label className="text-xs text-gray-500">Contact Number</Label>
                                        <div className="p-2 bg-gray-50 rounded text-sm font-medium">
                                            {selectedRecord?.data.contactNo || "-"}
                                        </div>
                                    </div>
                                    <div>
                                        <Label className="text-xs text-gray-500">Lift No</Label>
                                        <div className="p-2 bg-gray-50 rounded text-sm font-medium">
                                            {selectedRecord?.data.liftNo || "-"}
                                        </div>
                                    </div>
                                </div>

                                <div>
                                    <Label className="text-xs text-gray-500">Indent Number</Label>
                                    <div className="p-2 bg-gray-50 rounded text-sm font-medium">
                                        {selectedRecord?.data.indentNumber || "-"}
                                    </div>
                                </div>
                            </>
                        )}

                        {/* Editable Fields - Compact Layout */}
                        <div className="p-4 bg-white border rounded-md shadow-sm space-y-3">
                            <h3 className="text-sm font-semibold text-gray-700 mb-2">Update Status</h3>
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <Label className="text-xs mb-1 block">Status <span className="text-red-500">*</span></Label>
                                    <Select value={formData.status} onValueChange={(v) => setFormData({ ...formData, status: v })}>
                                        <SelectTrigger className="h-9">
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
                                        <Label className="text-xs mb-1 block">Expected Date <span className="text-red-500">*</span></Label>
                                        <Input
                                            type="date"
                                            value={formData.expectedDate}
                                            onChange={(e) => setFormData({ ...formData, expectedDate: e.target.value })}
                                            required
                                            className="h-9"
                                        />
                                    </div>
                                )}
                            </div>

                            <div>
                                <Label className="text-xs mb-1 block">Remarks</Label>
                                <Textarea
                                    value={formData.remarks}
                                    onChange={(e) => setFormData({ ...formData, remarks: e.target.value })}
                                    placeholder="Enter any remarks..."
                                    rows={2}
                                    className="resize-none"
                                />
                            </div>
                        </div>

                        <DialogFooter className="pt-2">
                            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                                Cancel
                            </Button>
                            <Button type="submit" disabled={isSubmitting || !!bulkError} className="bg-blue-600 hover:bg-blue-700">
                                {isSubmitting ? "Submitting..." : "Submit"}
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>
        </div>
    );
}
