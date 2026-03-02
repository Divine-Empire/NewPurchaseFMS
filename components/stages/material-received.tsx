"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { StageTable } from "./stage-table";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from "@/components/ui/dialog";
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
import { Checkbox } from "@/components/ui/checkbox";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FileText, Upload, X, Loader2, Search } from "lucide-react";
import { toast } from "sonner";

// ─── Module-level helpers (stable references, no re-creation on render) ────
const GST_RATES: Record<string, number> = {
    "5%": 0.05,
    "12%": 0.12,
    "18%": 0.18,
    "28%": 0.28,
};

const toBase64 = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = (error) => reject(error);
    });

const uploadFileToDrive = async (
    file: File,
    apiUrl: string,
    folderId: string
): Promise<string> => {
    const uploadParams = new URLSearchParams();
    uploadParams.append("action", "uploadFile");
    uploadParams.append("base64Data", await toBase64(file));
    uploadParams.append("fileName", file.name);
    uploadParams.append("mimeType", file.type);
    uploadParams.append("folderId", folderId);
    const res = await fetch(apiUrl, { method: "POST", body: uploadParams });
    const json = await res.json();
    return json.success ? json.fileUrl : "";
};

/* --------------------------------------------------------------- */
/*  COLUMNS FOR PENDING TAB (Same as Follow-Up Vendor History)     */
/* --------------------------------------------------------------- */
const PENDING_COLUMNS = [
    { key: "indentNumber", label: "Indent #" },
    { key: "liftNo", label: "Lift No." },
    { key: "warehouse", label: "Warehouse" },
    { key: "vendorName", label: "Vendor Name" },
    { key: "poNumber", label: "PO Number" },
    { key: "nextFollowUpDate", label: "Next Follow-Up" },
    { key: "remarks", label: "Remarks" },
    { key: "itemName", label: "Item Name" },
    { key: "liftingQty", label: "Lifting Qty" },
    { key: "transporterName", label: "Transporter" },
    { key: "vehicleNo", label: "Vehicle No" },
    { key: "contactNo", label: "Contact No" },
    { key: "lrNo", label: "LR No" },
    { key: "dispatchDate", label: "Dispatch Date" },
    { key: "freightAmount", label: "Freight Amt" },
    { key: "advanceAmount", label: "Advance Amt" },
    { key: "paymentDate", label: "Payment Date" },
    { key: "paymentStatus", label: "Payment Status" },
    { key: "biltyCopy", label: "Bilty Copy" },
    { key: "poCopy", label: "PO Copy" },
] as const;

/* --------------------------------------------------------------- */
/*  COLUMNS FOR HISTORY TAB (SHOW ALL)                             */
/* --------------------------------------------------------------- */
const HISTORY_COLUMNS = [
    ...PENDING_COLUMNS,
    { key: "actual6", label: "Actual 6" },
    { key: "invoiceType", label: "Invoice Type" },
    { key: "receiptLiftNumber", label: "Receipt Lift #" },
    { key: "receivedQty", label: "Received Qty" },
    { key: "invoiceDate", label: "Invoice Date" },
    { key: "invoiceNumber", label: "Invoice #" },
    { key: "srnNumber", label: "SRN #" },
    { key: "qcRequirement", label: "QC Required" },
    { key: "receivedItemImage", label: "Rec. Item Img" },
    { key: "billAttachment", label: "Bill Attach" },
    { key: "paymentAmountHydra", label: "Hydra Amt" },
    { key: "paymentAmountLabour", label: "Labour Amt" },
    { key: "paymentAmountHamali", label: "Hamali Amt" },
] as const;

export default function Stage7() {

    const [open, setOpen] = useState(false);
    const [selectedRecordId, setSelectedRecordId] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState<"pending" | "history">("pending");
    const [selectedPendingColumns, setSelectedPendingColumns] = useState<
        string[]
    >(PENDING_COLUMNS.map((c) => c.key));
    const [selectedHistoryColumns, setSelectedHistoryColumns] = useState<
        string[]
    >(HISTORY_COLUMNS.map((c) => c.key));

    const [sheetRecords, setSheetRecords] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [searchTerm, setSearchTerm] = useState("");
    const [warehouseFilter, setWarehouseFilter] = useState("All");

    // Bulk State
    const [selectedRecordIds, setSelectedRecordIds] = useState<string[]>([]);
    const [isBulkMode, setIsBulkMode] = useState(false);
    const [bulkItems, setBulkItems] = useState<{
        recordId: string;
        indentNumber: string;
        liftNumber: string;
        itemName: string;
        receivedQty: string;
        qcRequirement: string;
        receivedItemImage: File | null;
        index: number;
    }[]>([]);
    const [commonData, setCommonData] = useState({
        invoiceNumber: "",
        invoiceDate: "",
        billAttachment: null as File | null,
        paymentAmountHydra: "",
        paymentAmountLabour: "",
        paymentAmountHamali: "",
        remarks: "",
        pkgAmount: "",
        pkgGST: "",
    });

    // Stable helper: Packaging/Forwarding totals
    const getPkgTotals = useCallback((
        pkgAmount: string, pkgGST: string, count: number
    ) => {
        const base = parseFloat(pkgAmount) || 0;
        const gstRate = GST_RATES[pkgGST] ?? 0;
        const totalPkg = base + base * gstRate;
        const perItemPkgTotal = count > 0 ? totalPkg / count : 0;
        const perItemPkgBase = count > 0 ? base / count : 0;
        return { totalPkg, perItemPkgTotal, perItemPkgBase };
    }, []);

    // Stable helper: format date for display
    const formatDate = useCallback((date?: Date | string) => {
        if (!date) return "";
        const d = new Date(date);
        if (isNaN(d.getTime())) return "";
        return `${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()}`;
    }, []);

    const fetchData = useCallback(async () => {
        const SHEET_API_URL = process.env.NEXT_PUBLIC_API_URI;
        if (!SHEET_API_URL) return;
        setIsLoading(true);
        try {
            const [liftRes, fmsRes] = await Promise.all([
                fetch(`${SHEET_API_URL}?sheet=RECEIVING-ACCOUNTS&action=getAll`),
                fetch(`${SHEET_API_URL}?sheet=INDENT-LIFT&action=getAll`)
            ]);

            const liftJson = await liftRes.json();
            const fmsJson = await fmsRes.json();

            // Create FMS Map (Indent # -> Row)
            const fmsMap = new Map<string, any[]>();
            if (fmsJson.success && Array.isArray(fmsJson.data)) {
                // FMS data usually starts after header rows, typically slice(7) based on other stages
                fmsJson.data.slice(7).forEach((r: any) => {
                    if (r[1] && String(r[1]).trim()) {
                        fmsMap.set(String(r[1]).trim(), r);
                    }
                });
            }

            if (liftJson.success && Array.isArray(liftJson.data)) {
                // Data starts from row 7 (index 6)
                const rows = liftJson.data.slice(6)
                    .map((row: any, i: number) => ({ row, originalIndex: i + 7 }))
                    .filter(({ row }: any) => row[1] && String(row[1]).trim() !== "")
                    .map(({ row, originalIndex }: any) => {
                        // Column T (index 19) = Planned
                        // Column U (index 20) = Actual
                        const hasColumnT = !!row[19] && String(row[19]).trim() !== "";
                        const hasColumnU = !!row[20] && String(row[20]).trim() !== "";

                        // Filtering logic:
                        // - If column T is not null AND column U is null => pending
                        // - If both columns T and U are not null => completed
                        let status = "not_ready";
                        if (hasColumnT && !hasColumnU) {
                            status = "pending";
                        } else if (hasColumnT && hasColumnU) {
                            status = "completed";
                        }

                        const indentNum = String(row[1] || "").trim();
                        const fmsRow = fmsMap.get(indentNum);

                        // Use composite key (indentNumber + "_" + liftNo) for uniqueness
                        const liftNoKey = String(row[2] || "").trim();
                        const indentKey = String(row[1] || "").trim();
                        const compositeId = indentKey && liftNoKey ? `${indentKey}_${liftNoKey}` : (indentKey || `row-${originalIndex}`);
                        return {
                            id: compositeId,
                            rowIndex: originalIndex,
                            stage: 7,
                            status: status,
                            data: {
                                // RECEIVING-ACCOUNTS Columns (B-S)
                                indentNumber: row[1] || "",     // B: Indent Number
                                liftNo: row[2] || "",            // C: Lift No.
                                vendorName: row[3] || "",        // D: Vendor Name
                                poNumber: row[4] || "",          // E: PO Number
                                nextFollowUpDate: row[5] || "", // F: Next Follow-Up Date
                                remarks: row[6] || "",           // G: Remarks
                                itemName: row[7] || "",          // H: Item Name
                                liftingQty: row[8] || "",        // I: Lifting Qty
                                transporterName: row[9] || "",  // J: Transporter Name
                                vehicleNo: row[10] || "",        // K: Vehicle No
                                contactNo: row[11] || "",        // L: Contact No
                                lrNo: row[12] || "",             // M: LR No
                                dispatchDate: row[13] || "",     // N: Dispatch Date
                                freightAmount: row[14] || "",    // O: Freight Amount
                                advanceAmount: row[15] || "",    // P: Advance Amount
                                paymentDate: row[16] || "",      // Q: Payment Date
                                paymentStatus: row[17] || "",    // R: Payment Status
                                biltyCopy: row[18] || "",        // S: Bilty Copy
                                poCopy: fmsRow ? (fmsRow[58] || "") : "", // From INDENT-LIFT Column BG (index 58)
                                warehouse: fmsRow ? (fmsRow[6] || "") : "", // From INDENT-LIFT Column G (index 6)
                                invoiceNumber: row[24] || "",    // Y: Invoice Number
                                qcRequirement: row[28] || "",    // AC: QC Required

                                // Columns T and U for status determination
                                columnT: row[19] || "",          // T: Planned
                                columnU: row[20] || "",          // U: Actual
                            }
                        };
                    });
                setSheetRecords(rows);
            }
        } catch (e) {
            console.error("Fetch error:", e);
        }
        setIsLoading(false);
    }, []);

    useEffect(() => { fetchData(); }, [fetchData]);

    const [form, setForm] = useState({
        liftNumber: "",
        receivedQty: "",
        invoiceNumber: "",
        invoiceDate: "",
        billAttachment: null as File | null,
        receivedItemImage: null as File | null,
        paymentAmountHydra: "",
        paymentAmountLabour: "",
        paymentAmountHamali: "",
        qcRequirement: "",
        remarks: "",
        pkgAmount: "",
        pkgGST: "",
    });

    // Build a fast lookup map for records
    const recordMap = useMemo(
        () => new Map(sheetRecords.map((r) => [r.id, r])),
        [sheetRecords]
    );

    // Check Vendor/PO Match
    const checkVendorPOMatch = useCallback((ids: string[]) => {
        if (ids.length === 0) return { match: false, vendor: "", po: "" };
        const first = recordMap.get(ids[0]);
        if (!first) return { match: false, vendor: "", po: "" };
        const v = first.data.vendorName;
        const p = first.data.poNumber;
        for (let i = 1; i < ids.length; i++) {
            const rec = recordMap.get(ids[i]);
            if (!rec || rec.data.vendorName !== v || rec.data.poNumber !== p)
                return { match: false, vendor: "", po: "" };
        }
        return { match: true, vendor: v, po: p };
    }, [recordMap]);

    const handleBulkOpen = useCallback(() => {
        if (selectedRecordIds.length === 0) return;
        const { match } = checkVendorPOMatch(selectedRecordIds);
        if (selectedRecordIds.length > 1 && !match) {
            toast.error("All selected items must have the same Vendor and PO Number.", {
                style: { background: "red", color: "white", border: "none" }
            });
            return;
        }
        setIsBulkMode(true);
        setCommonData({
            invoiceNumber: "",
            invoiceDate: "",
            billAttachment: null,
            paymentAmountHydra: "",
            paymentAmountLabour: "",
            paymentAmountHamali: "",
            remarks: "",
            pkgAmount: "",
            pkgGST: "",
        });
        const items = selectedRecordIds.map(id => {
            const rec = recordMap.get(id);
            return {
                recordId: id,
                indentNumber: rec?.data?.indentNumber || "",
                liftNumber: rec?.data?.liftNo || "",
                itemName: rec?.data?.itemName || "",
                receivedQty: "",
                qcRequirement: "no",
                receivedItemImage: null,
                index: rec?.rowIndex || 0
            };
        });
        setBulkItems(items);
        setOpen(true);
    }, [selectedRecordIds, checkVendorPOMatch, recordMap]);

    const handleBulkSubmit = useCallback(async (e: React.FormEvent) => {
        e.preventDefault();
        const SHEET_API_URL = process.env.NEXT_PUBLIC_API_URI;
        if (!SHEET_API_URL) return;
        const folderId = process.env.NEXT_PUBLIC_IMAGE_FOLDER_ID || "1SihRrPrgbuPGm-09fuB180QJhdxq5Nxy";
        setIsSubmitting(true);
        try {
            // Upload bill attachment once (shared across all items)
            const billUrl = commonData.billAttachment
                ? await uploadFileToDrive(commonData.billAttachment, SHEET_API_URL, folderId)
                : "";

            const dateStr = new Date().toISOString().split('T')[0];

            // Pre-calculate packaging split once (same for every item)
            const { perItemPkgBase } = getPkgTotals(
                commonData.pkgAmount,
                commonData.pkgGST,
                bulkItems.length
            );
            const pkgBaseStr = perItemPkgBase > 0 ? perItemPkgBase.toFixed(2) : "";

            for (const item of bulkItems) {
                const itemImgUrl = item.receivedItemImage
                    ? await uploadFileToDrive(item.receivedItemImage, SHEET_API_URL, folderId)
                    : "";

                const rowArray = new Array(101).fill("");
                rowArray[20] = dateStr;
                rowArray[22] = "independent";
                rowArray[23] = commonData.invoiceDate;
                rowArray[24] = commonData.invoiceNumber;
                rowArray[25] = item.receivedQty;
                rowArray[26] = itemImgUrl;
                rowArray[27] = "";
                rowArray[28] = item.qcRequirement;
                rowArray[29] = billUrl;
                rowArray[30] = commonData.paymentAmountHydra;
                rowArray[31] = commonData.paymentAmountLabour;
                rowArray[32] = commonData.paymentAmountHamali;
                rowArray[33] = commonData.remarks;
                rowArray[99] = pkgBaseStr;
                rowArray[100] = commonData.pkgGST || "";

                const params = new URLSearchParams();
                params.append("action", "update");
                params.append("sheetName", "RECEIVING-ACCOUNTS");
                params.append("rowData", JSON.stringify(rowArray));
                params.append("rowIndex", item.index.toString());
                await fetch(SHEET_API_URL, { method: "POST", body: params });
            }

            toast.success("Bulk Receipt recorded successfully!");
            setOpen(false);
            setSelectedRecordIds([]);
            setIsBulkMode(false);
            fetchData();
        } catch (error) {
            console.error(error);
            toast.error("Error submitting bulk form");
        } finally {
            setIsSubmitting(false);
        }
    }, [commonData, bulkItems, getPkgTotals, fetchData]);


    /* --------------------------------------------------------------- */
    /*  Get Vendor Data from Stage-6                                   */
    /* --------------------------------------------------------------- */
    const getVendorData = (record: any) => {
        const selectedId = record?.data?.selectedVendor || "vendor1";
        const idx = parseInt(selectedId.replace("vendor", ""), 10) || 1;
        return {
            name: record?.data?.[`vendor${idx}Name`] || record?.data?.vendorName || "-",
            rate: record?.data?.[`vendor${idx}Rate`] || record?.data?.ratePerQty,
            terms: record?.data?.[`vendor${idx}Terms`] || record?.data?.paymentTerms,
            delivery:
                record?.data?.[`vendor${idx}DeliveryDate`] || record?.data?.deliveryDate,
            warrantyType:
                record?.data?.[`vendor${idx}WarrantyType`] || record?.data?.warrantyType,
            attachment:
                record?.data?.[`vendor${idx}Attachment`] || record?.data?.vendorAttachment,
            approvedBy: record?.data?.approvedBy || "-",
            poNumber: record?.data?.poNumber || "-",
            basicValue: record?.data?.basicValue || "-",
            totalWithTax: record?.data?.totalWithTax || "-",
            poCopy: record?.data?.poCopy,
        };
    };

    /* --------------------------------------------------------------- */
    /*  Open Modal                                                     */
    /* --------------------------------------------------------------- */
    const openModal = useCallback((recordId: string) => {
        const rec = recordMap.get(recordId);
        if (!rec) {
            toast.error("Record not found locally. Please refresh.");
            return;
        }
        setSelectedRecordIds([]);
        setIsBulkMode(false);
        setSelectedRecordId(recordId);
        setForm({
            liftNumber: rec.data.liftNo || "",
            receivedQty: "",
            invoiceNumber: "",
            invoiceDate: "",
            billAttachment: null,
            receivedItemImage: null,
            paymentAmountHydra: "",
            paymentAmountLabour: "",
            paymentAmountHamali: "",
            qcRequirement: "",
            remarks: "",
            pkgAmount: "",
            pkgGST: "",
        });
        setOpen(true);
    }, [recordMap]);

    /* --------------------------------------------------------------- */
    /*  Submit                                                         */
    /* --------------------------------------------------------------- */
    const handleSubmit = useCallback(async (e: React.FormEvent) => {
        e.preventDefault();
        const SHEET_API_URL = process.env.NEXT_PUBLIC_API_URI;
        if (!selectedRecordId || !SHEET_API_URL) return;
        const rec = recordMap.get(selectedRecordId);
        if (!rec) return;
        const folderId = process.env.NEXT_PUBLIC_IMAGE_FOLDER_ID || "1SihRrPrgbuPGm-09fuB180QJhdxq5Nxy";
        setIsSubmitting(true);
        try {
            const billUrl = form.billAttachment instanceof File
                ? await uploadFileToDrive(form.billAttachment, SHEET_API_URL, folderId)
                : typeof form.billAttachment === "string" ? form.billAttachment : "";

            const imageUrl = form.receivedItemImage instanceof File
                ? await uploadFileToDrive(form.receivedItemImage, SHEET_API_URL, folderId)
                : typeof form.receivedItemImage === "string" ? form.receivedItemImage : "";

            const dateStr = new Date().toISOString().split('T')[0];
            const rowArray = new Array(101).fill("");
            rowArray[20] = dateStr;               // U: Actual1
            rowArray[22] = "independent";         // W: Invoice Type
            rowArray[23] = form.invoiceDate;      // X
            rowArray[24] = form.invoiceNumber;    // Y
            rowArray[25] = form.receivedQty;      // Z
            rowArray[26] = imageUrl;              // AA
            rowArray[27] = "";                    // AB: SRN
            rowArray[28] = form.qcRequirement;   // AC
            rowArray[29] = billUrl;               // AD
            rowArray[30] = form.paymentAmountHydra;  // AE
            rowArray[31] = form.paymentAmountLabour; // AF
            rowArray[32] = form.paymentAmountHamali; // AG
            rowArray[33] = form.remarks;          // AH
            rowArray[99] = form.pkgAmount || "";  // CV
            rowArray[100] = form.pkgGST || "";     // CW

            const params = new URLSearchParams();
            params.append("action", "update");
            params.append("sheetName", "RECEIVING-ACCOUNTS");
            params.append("rowData", JSON.stringify(rowArray));
            params.append("rowIndex", rec.rowIndex.toString());

            const updateRes = await fetch(SHEET_API_URL, { method: "POST", body: params });
            const updateJson = await updateRes.json();
            if (updateJson.success) {
                toast.success("Receipt recorded successfully!");
                setOpen(false);
                fetchData();
            } else {
                toast.error("Failed to update sheet: " + (updateJson.error || "Unknown error"));
            }
        } catch (error: any) {
            console.error(error);
            toast.error("Error submitting form");
        } finally {
            setIsSubmitting(false);
        }
    }, [selectedRecordId, recordMap, form, fetchData]);

    const removeFile = useCallback((key: "billAttachment" | "receivedItemImage") => {
        setForm((f) => ({ ...f, [key]: null }));
    }, []);

    const formValid = useMemo(() =>
        form.receivedQty &&
        form.invoiceNumber &&
        form.invoiceDate &&
        form.qcRequirement &&
        form.billAttachment,
        [form.receivedQty, form.invoiceNumber, form.invoiceDate, form.qcRequirement, form.billAttachment]);

    // Memoized filtered lists – only recompute when records or search change
    const pending = useMemo(() => {
        const lower = searchTerm.toLowerCase();
        return sheetRecords.filter((r) => {
            if (!r?.data || r.status !== "pending") return false;

            if (warehouseFilter === "NE Warehouse" && r.data.warehouse !== "NE Warehouse") return false;
            if (warehouseFilter === "Others" && r.data.warehouse === "NE Warehouse") return false;

            if (!lower) return true;
            return (
                r.data.indentNumber?.toLowerCase().includes(lower) ||
                r.data.itemName?.toLowerCase().includes(lower) ||
                r.data.vendorName?.toLowerCase().includes(lower) ||
                String(r.data.poNumber || "").toLowerCase().includes(lower) ||
                String(r.data.invoiceNumber || "").toLowerCase().includes(lower)
            );
        });
    }, [sheetRecords, searchTerm, warehouseFilter]);

    const completed = useMemo(() => {
        const lower = searchTerm.toLowerCase();
        return sheetRecords.filter((r) => {
            if (!r?.data || r.status !== "completed") return false;

            if (warehouseFilter === "NE Warehouse" && r.data.warehouse !== "NE Warehouse") return false;
            if (warehouseFilter === "Others" && r.data.warehouse === "NE Warehouse") return false;

            if (!lower) return true;
            return (
                r.data.indentNumber?.toLowerCase().includes(lower) ||
                r.data.itemName?.toLowerCase().includes(lower) ||
                r.data.vendorName?.toLowerCase().includes(lower) ||
                String(r.data.poNumber || "").toLowerCase().includes(lower) ||
                String(r.data.invoiceNumber || "").toLowerCase().includes(lower)
            );
        });
    }, [sheetRecords, searchTerm, warehouseFilter]);

    return (
        <div className="p-6">
            {/* ==================== HEADER ==================== */}
            <div className="mb-6 p-6 bg-white border rounded-lg shadow-sm">
                <div className="flex items-center justify-between">
                    <div>
                        <h2 className="text-2xl font-bold">Stage 7: Material Receipt</h2>
                    </div>

                    <div className="flex items-center gap-4">
                        {/* Bulk Button */}
                        {activeTab === "pending" && selectedRecordIds.length > 1 && (
                            <Button onClick={handleBulkOpen}>
                                Bulk Record ({selectedRecordIds.length})
                            </Button>
                        )}

                        <Label className="text-sm font-medium">Show Columns:</Label>
                        <Select value="" onValueChange={() => { }}>
                            <SelectTrigger className="w-64">
                                <SelectValue
                                    placeholder={
                                        activeTab === "pending"
                                            ? `${selectedPendingColumns.length} selected`
                                            : `${selectedHistoryColumns.length} selected`
                                    }
                                />
                            </SelectTrigger>
                            <SelectContent className="w-64">
                                <div className="p-2">
                                    <div className="flex items-center space-x-2 mb-2 pb-2 border-b">
                                        <Checkbox
                                            checked={
                                                activeTab === "pending"
                                                    ? selectedPendingColumns.length ===
                                                    PENDING_COLUMNS.length
                                                    : selectedHistoryColumns.length ===
                                                    HISTORY_COLUMNS.length
                                            }
                                            onCheckedChange={(c) => {
                                                if (activeTab === "pending") {
                                                    setSelectedPendingColumns(
                                                        c ? PENDING_COLUMNS.map((col) => col.key) : []
                                                    );
                                                } else {
                                                    setSelectedHistoryColumns(
                                                        c ? HISTORY_COLUMNS.map((col) => col.key) : []
                                                    );
                                                }
                                            }}
                                        />
                                        <Label className="text-sm font-medium">All Columns</Label>
                                    </div>
                                    {(activeTab === "pending"
                                        ? PENDING_COLUMNS
                                        : HISTORY_COLUMNS
                                    ).map((col) => (
                                        <div
                                            key={col.key}
                                            className="flex items-center space-x-2 py-1"
                                        >
                                            <Checkbox
                                                checked={
                                                    activeTab === "pending"
                                                        ? selectedPendingColumns.includes(col.key)
                                                        : selectedHistoryColumns.includes(col.key)
                                                }
                                                onCheckedChange={(checked) => {
                                                    if (activeTab === "pending") {
                                                        setSelectedPendingColumns((prev) =>
                                                            checked
                                                                ? [...prev, col.key]
                                                                : prev.filter((c) => c !== col.key)
                                                        );
                                                    } else {
                                                        setSelectedHistoryColumns((prev) =>
                                                            checked
                                                                ? [...prev, col.key]
                                                                : prev.filter((c) => c !== col.key)
                                                        );
                                                    }
                                                }}
                                            />
                                            <Label className="text-sm">{col.label}</Label>
                                        </div>
                                    ))}
                                </div>
                            </SelectContent>
                        </Select>
                    </div>
                </div>

                {/* Search Filter */}
                <div className="mt-4 flex flex-wrap items-center gap-4">
                    <div className="relative flex-1 max-w-sm">
                        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-500" />
                        <Input
                            placeholder="Search by Indent No, Item Name, Vendor, PO, Invoice..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="pl-9 bg-white"
                        />
                    </div>

                    {/* Warehouse Filter */}
                    <Select value={warehouseFilter} onValueChange={setWarehouseFilter}>
                        <SelectTrigger className="w-[200px] bg-white">
                            <SelectValue placeholder="Select warehouse" />
                        </SelectTrigger>
                        <SelectContent className="bg-white">
                            <SelectItem value="All">All Warehouses</SelectItem>
                            <SelectItem value="NE Warehouse">NE Warehouse</SelectItem>
                            <SelectItem value="Others">Others</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
            </div>

            {/* ==================== TABS ==================== */}
            {isLoading ? (
                <div className="flex flex-col items-center justify-center py-24 text-gray-500">
                    <Loader2 className="w-8 h-8 animate-spin mb-4 text-black" />
                    <p className="text-lg animate-pulse text-black font-medium">Loading records...</p>
                </div>
            ) : (
                <Tabs
                    value={activeTab}
                    onValueChange={(v) => setActiveTab(v as any)}
                    className="w-full"
                >
                    <TabsList className="grid w-full grid-cols-2">
                        <TabsTrigger value="pending">Pending ({pending.length})</TabsTrigger>
                        <TabsTrigger value="history">
                            History ({completed.length})
                        </TabsTrigger>
                    </TabsList>

                    {/* ---------- PENDING ---------- */}
                    <TabsContent value="pending" className="mt-6">
                        {pending.length === 0 ? (
                            <div className="text-center py-12 text-gray-500">
                                <p className="text-lg">No pending receipts</p>
                            </div>
                        ) : (
                            <div className="border rounded-lg overflow-x-auto">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            {activeTab === "pending" && (
                                                <TableHead>
                                                    <Checkbox
                                                        checked={
                                                            pending.length > 0 &&
                                                            selectedRecordIds.length === pending.length
                                                        }
                                                        onCheckedChange={(checked) => {
                                                            if (checked) {
                                                                setSelectedRecordIds(pending.map((r) => r.id));
                                                            } else {
                                                                setSelectedRecordIds([]);
                                                            }
                                                        }}
                                                    />
                                                </TableHead>
                                            )}
                                            <TableHead>Actions</TableHead>
                                            {PENDING_COLUMNS.filter((c) =>
                                                selectedPendingColumns.includes(c.key)
                                            ).map((c) => (
                                                <TableHead key={c.key}>{c.label}</TableHead>
                                            ))}
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {pending.map((rec) => (
                                            <TableRow key={rec.id} className="hover:bg-gray-50">
                                                {activeTab === "pending" && (
                                                    <TableCell>
                                                        <Checkbox
                                                            checked={selectedRecordIds.includes(rec.id)}
                                                            onCheckedChange={(checked) => {
                                                                setSelectedRecordIds((prev) =>
                                                                    checked
                                                                        ? [...prev, rec.id]
                                                                        : prev.filter((id) => id !== rec.id)
                                                                );
                                                            }}
                                                        />
                                                    </TableCell>
                                                )}
                                                <TableCell>
                                                    <Button
                                                        variant="outline"
                                                        size="sm"
                                                        onClick={() => openModal(rec.id)}
                                                    >
                                                        Record Receipt
                                                    </Button>
                                                </TableCell>

                                                {PENDING_COLUMNS.filter((c) =>
                                                    selectedPendingColumns.includes(c.key)
                                                ).map((col) => {
                                                    // Handle Bilty Copy as a link
                                                    if (col.key === "biltyCopy") {
                                                        const biltyRaw = rec.data.biltyCopy;
                                                        let biltyUrl = biltyRaw;
                                                        if (biltyUrl && biltyUrl.includes("drive.google.com/uc")) {
                                                            const m = biltyUrl.match(/[?&]id=([a-zA-Z0-9_-]+)/);
                                                            if (m?.[1]) biltyUrl = `https://drive.google.com/file/d/${m[1]}/view`;
                                                        }
                                                        return (
                                                            <TableCell key={col.key}>
                                                                {biltyUrl ? (
                                                                    <a
                                                                        href={biltyUrl}
                                                                        target="_blank"
                                                                        rel="noopener noreferrer"
                                                                        className="flex items-center gap-1 text-xs text-green-600 hover:underline"
                                                                    >
                                                                        <FileText className="w-3.5 h-3.5" />
                                                                        <span>View Bilty</span>
                                                                    </a>
                                                                ) : "-"}
                                                            </TableCell>
                                                        );
                                                    }

                                                    // Handle PO Copy as a link
                                                    if (col.key === "poCopy") {
                                                        const poRaw = rec.data.poCopy;
                                                        let poUrl = poRaw;
                                                        if (poUrl && poUrl.includes("drive.google.com/uc")) {
                                                            const m = poUrl.match(/[?&]id=([a-zA-Z0-9_-]+)/);
                                                            if (m?.[1]) poUrl = `https://drive.google.com/file/d/${m[1]}/view`;
                                                        }
                                                        return (
                                                            <TableCell key={col.key}>
                                                                {poUrl ? (
                                                                    <a
                                                                        href={poUrl}
                                                                        target="_blank"
                                                                        rel="noopener noreferrer"
                                                                        className="flex items-center gap-1 text-xs text-blue-600 hover:underline"
                                                                    >
                                                                        <FileText className="w-3.5 h-3.5" />
                                                                        <span>View PO</span>
                                                                    </a>
                                                                ) : "-"}
                                                            </TableCell>
                                                        );
                                                    }

                                                    // Handle date columns - format as date only (no timestamp)
                                                    if (col.key === "nextFollowUpDate" || col.key === "dispatchDate" || col.key === "paymentDate") {
                                                        return (
                                                            <TableCell key={col.key}>
                                                                {rec.data[col.key] ? formatDate(rec.data[col.key]) : "-"}
                                                            </TableCell>
                                                        );
                                                    }

                                                    // Handle currency columns
                                                    if (col.key === "freightAmount" || col.key === "advanceAmount") {
                                                        return (
                                                            <TableCell key={col.key}>
                                                                {rec.data[col.key] ? `₹${rec.data[col.key]}` : "-"}
                                                            </TableCell>
                                                        );
                                                    }

                                                    // Default rendering
                                                    return (
                                                        <TableCell key={col.key}>
                                                            {rec.data[col.key] || "-"}
                                                        </TableCell>
                                                    );
                                                })}
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </div>
                        )}
                    </TabsContent>

                    {/* ---------- HISTORY ---------- */}
                    <TabsContent value="history" className="mt-6">
                        {completed.length === 0 ? (
                            <div className="text-center py-12 text-gray-500">
                                <p className="text-lg">No completed receipts</p>
                            </div>
                        ) : (
                            <div className="border rounded-lg overflow-x-auto">
                                <Table>
                                    <TableHeader className="bg-gray-100 sticky top-0">
                                        <TableRow className="border-b-2">
                                            {HISTORY_COLUMNS.filter((c) =>
                                                selectedHistoryColumns.includes(c.key)
                                            ).map((c) => (
                                                <TableHead key={c.key} className="font-semibold">
                                                    {c.label}
                                                </TableHead>
                                            ))}
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {completed.map((record) => {
                                            // Get data from stage 7 history entry
                                            const stage7History = record.history?.find(
                                                (h: any) => h.stage === 7
                                            );
                                            const historyData = stage7History
                                                ? stage7History.data
                                                : record.data;
                                            const lift =
                                                ((historyData.liftingData as any[]) ?? [])[0] ??
                                                {};
                                            const vendor = getVendorData({
                                                ...record,
                                                data: historyData,
                                            });

                                            return (
                                                <TableRow key={record.id} className="bg-green-50">
                                                    {HISTORY_COLUMNS.filter((c) =>
                                                        selectedHistoryColumns.includes(c.key)
                                                    ).map((col) => {
                                                        // Handle date fields (dispatchDate, paymentDate, etc.)
                                                        if (
                                                            col.key === "dispatchDate" ||
                                                            col.key === "paymentDate" ||
                                                            col.key === "nextFollowUpDate" ||
                                                            col.key === "invoiceDate" ||
                                                            col.key === "actual6"
                                                        ) {
                                                            const dateVal = historyData[col.key];
                                                            let formattedDate = "-";
                                                            if (dateVal) {
                                                                const d = new Date(dateVal);
                                                                if (!isNaN(d.getTime())) {
                                                                    formattedDate = `${d.getDate().toString().padStart(2, "0")}/${(d.getMonth() + 1).toString().padStart(2, "0")}/${d.getFullYear()}`;
                                                                } else {
                                                                    formattedDate = String(dateVal);
                                                                }
                                                            }
                                                            return (
                                                                <TableCell key={col.key}>
                                                                    {formattedDate}
                                                                </TableCell>
                                                            );
                                                        }

                                                        // Handle file fields
                                                        if (col.key === "biltyCopy") {
                                                            const biltyRaw = historyData.biltyCopy;
                                                            let biltyUrl = biltyRaw;
                                                            if (biltyUrl && biltyUrl.includes("drive.google.com/uc")) {
                                                                const m = biltyUrl.match(/[?&]id=([a-zA-Z0-9_-]+)/);
                                                                if (m?.[1]) biltyUrl = `https://drive.google.com/file/d/${m[1]}/view`;
                                                            }
                                                            return (
                                                                <TableCell key={col.key}>
                                                                    {biltyUrl ? (
                                                                        <a
                                                                            href={biltyUrl}
                                                                            target="_blank"
                                                                            rel="noopener noreferrer"
                                                                            className="flex items-center gap-1 text-xs text-green-600 hover:underline"
                                                                        >
                                                                            <FileText className="w-3.5 h-3.5" />
                                                                            <span>View Bilty</span>
                                                                        </a>
                                                                    ) : "-"}
                                                                </TableCell>
                                                            );
                                                        }

                                                        // Handle PO Copy as a link
                                                        if (col.key === "poCopy") {
                                                            const poRaw = historyData.poCopy;
                                                            let poUrl = poRaw;
                                                            if (poUrl && poUrl.includes("drive.google.com/uc")) {
                                                                const m = poUrl.match(/[?&]id=([a-zA-Z0-9_-]+)/);
                                                                if (m?.[1]) poUrl = `https://drive.google.com/file/d/${m[1]}/view`;
                                                            }
                                                            return (
                                                                <TableCell key={col.key}>
                                                                    {poUrl ? (
                                                                        <a
                                                                            href={poUrl}
                                                                            target="_blank"
                                                                            rel="noopener noreferrer"
                                                                            className="flex items-center gap-1 text-xs text-blue-600 hover:underline"
                                                                        >
                                                                            <FileText className="w-3.5 h-3.5" />
                                                                            <span>View PO</span>
                                                                        </a>
                                                                    ) : "-"}
                                                                </TableCell>
                                                            );
                                                        }

                                                        if (
                                                            col.key === "receivedItemImage" ||
                                                            col.key === "billAttachment"
                                                        ) {
                                                            const file = historyData[col.key];
                                                            let fileUrl = typeof file === "string" ? file : undefined;
                                                            if (fileUrl && fileUrl.includes("drive.google.com/uc")) {
                                                                const m = fileUrl.match(/[?&]id=([a-zA-Z0-9_-]+)/);
                                                                if (m?.[1]) fileUrl = `https://drive.google.com/file/d/${m[1]}/view`;
                                                            }
                                                            return (
                                                                <TableCell key={col.key}>
                                                                    {fileUrl ? (
                                                                        <a
                                                                            href={fileUrl}
                                                                            target="_blank"
                                                                            rel="noopener noreferrer"
                                                                            className="flex items-center gap-1 text-xs text-blue-600 hover:underline"
                                                                        >
                                                                            <FileText className="w-3.5 h-3.5" />
                                                                            <span className="truncate max-w-20">
                                                                                View {col.label}
                                                                            </span>
                                                                        </a>
                                                                    ) : (
                                                                        "-"
                                                                    )}
                                                                </TableCell>
                                                            );
                                                        }

                                                        // Handle currency columns
                                                        if (
                                                            col.key === "freightAmount" ||
                                                            col.key === "advanceAmount" ||
                                                            col.key === "paymentAmountHydra" ||
                                                            col.key === "paymentAmountLabour" ||
                                                            col.key === "paymentAmountHamali"
                                                        ) {
                                                            return (
                                                                <TableCell key={col.key}>
                                                                    {historyData[col.key]
                                                                        ? `₹${historyData[col.key]}`
                                                                        : "-"}
                                                                </TableCell>
                                                            );
                                                        }

                                                        // Default: show from historyData
                                                        const val = (historyData[col.key] !== undefined && historyData[col.key] !== "")
                                                            ? historyData[col.key]
                                                            : record.data[col.key];
                                                        return (
                                                            <TableCell key={col.key}>
                                                                {val ? String(val) : "-"}
                                                            </TableCell>
                                                        );
                                                    })}
                                                </TableRow>
                                            );
                                        })}
                                    </TableBody>
                                </Table>
                            </div>
                        )}
                    </TabsContent>
                </Tabs>
            )}

            {/* ==================== MODAL ==================== */}
            <Dialog open={open} onOpenChange={setOpen}>
                <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col">
                    <DialogHeader className="flex-shrink-0">
                        <DialogTitle>
                            {isBulkMode
                                ? "Bulk Material Receipt"
                                : "Record Material Receipt"}
                        </DialogTitle>
                        <p className="text-sm text-gray-600">
                            Confirm delivery, attach documents, and update QC/payment.
                        </p>
                    </DialogHeader>

                    {isBulkMode ? (
                        /* BULK FORM */
                        <form onSubmit={handleBulkSubmit} className="flex-1 overflow-y-auto space-y-6 pr-2">
                            {/* Individual Items */}
                            <div className="space-y-4">
                                <h3 className="font-semibold text-lg border-b pb-2">Items ({bulkItems.length})</h3>
                                {bulkItems.map((item, idx) => (
                                    <div key={item.recordId} className="border p-4 rounded-lg space-y-4">
                                        <div className="flex items-center gap-4 text-sm font-medium bg-gray-100 p-2 rounded">
                                            <span>Indent: {item.indentNumber}</span>
                                            <span>|</span>
                                            <span>Lift: {item.liftNumber}</span>
                                            <span>|</span>
                                            <span>Item: {item.itemName}</span>
                                        </div>
                                        <div className="grid grid-cols-3 gap-4">
                                            <div className="space-y-2">
                                                <Label>Received Qty <span className="text-red-500">*</span></Label>
                                                <Input
                                                    type="number"
                                                    value={item.receivedQty}
                                                    onChange={(e) => {
                                                        const newItems = [...bulkItems];
                                                        newItems[idx].receivedQty = e.target.value;
                                                        setBulkItems(newItems);
                                                    }}
                                                    required
                                                />
                                            </div>
                                            <div className="space-y-2">
                                                <Label>QC Required <span className="text-red-500">*</span></Label>
                                                <Select
                                                    value={item.qcRequirement}
                                                    onValueChange={(v) => {
                                                        const newItems = [...bulkItems];
                                                        newItems[idx].qcRequirement = v;
                                                        setBulkItems(newItems);
                                                    }}
                                                >
                                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="yes">Yes</SelectItem>
                                                        <SelectItem value="no">No</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                            <div className="space-y-2">
                                                <Label>Item Image</Label>
                                                <input
                                                    id={`bulkItemImage-${idx}`}
                                                    type="file"
                                                    accept="image/*"
                                                    onChange={(e) => {
                                                        const newItems = [...bulkItems];
                                                        newItems[idx].receivedItemImage = e.target.files?.[0] || null;
                                                        setBulkItems(newItems);
                                                    }}
                                                    className="hidden"
                                                />
                                                <label
                                                    htmlFor={`bulkItemImage-${idx}`}
                                                    className="flex items-center justify-center w-full p-4 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:border-gray-400"
                                                >
                                                    <Upload className="w-6 h-6 text-gray-400 mr-2" />
                                                    <span className="text-sm text-gray-600">Upload Image</span>
                                                </label>
                                                {item.receivedItemImage && (
                                                    <div className="mt-2 p-2 bg-gray-50 border rounded flex items-center justify-between">
                                                        <div className="flex items-center">
                                                            <FileText className="w-4 h-4 text-gray-500 mr-2" />
                                                            <span className="text-sm text-gray-700">
                                                                {item.receivedItemImage.name}
                                                            </span>
                                                        </div>
                                                        <button
                                                            type="button"
                                                            onClick={() => {
                                                                const newItems = [...bulkItems];
                                                                newItems[idx].receivedItemImage = null;
                                                                setBulkItems(newItems);
                                                            }}
                                                            className="text-red-600 hover:text-red-800"
                                                        >
                                                            <X className="w-4 h-4" />
                                                        </button>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>

                            {/* Common Details */}
                            <div className="bg-gray-50 p-4 rounded-lg space-y-4">
                                <h3 className="font-semibold text-lg border-b pb-2">Common Details</h3>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label>Invoice Date <span className="text-red-500">*</span></Label>
                                        <Input
                                            type="date"
                                            value={commonData.invoiceDate}
                                            onChange={(e) => setCommonData({ ...commonData, invoiceDate: e.target.value })}
                                            required
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Invoice # <span className="text-red-500">*</span></Label>
                                        <Input
                                            value={commonData.invoiceNumber}
                                            onChange={(e) => setCommonData({ ...commonData, invoiceNumber: e.target.value })}
                                            required
                                        />
                                    </div>

                                    <div className="space-y-2 col-span-2">
                                        <Label>Bill Attachment <span className="text-red-500">*</span></Label>
                                        <input
                                            id="bulkBillAttachment"
                                            type="file"
                                            accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                                            onChange={(e) => setCommonData({ ...commonData, billAttachment: e.target.files?.[0] || null })}
                                            className="hidden"
                                        />
                                        <label
                                            htmlFor="bulkBillAttachment"
                                            className="flex items-center justify-center w-full p-4 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:border-gray-400"
                                        >
                                            <Upload className="w-6 h-6 text-gray-400 mr-2" />
                                            <span className="text-sm text-gray-600">Upload Bill</span>
                                        </label>
                                        {commonData.billAttachment && (
                                            <div className="mt-2 p-2 bg-gray-50 border rounded flex items-center justify-between">
                                                <div className="flex items-center">
                                                    <FileText className="w-4 h-4 text-gray-500 mr-2" />
                                                    <span className="text-sm text-gray-700">
                                                        {commonData.billAttachment.name}
                                                    </span>
                                                </div>
                                                <button
                                                    type="button"
                                                    onClick={() => setCommonData(prev => ({ ...prev, billAttachment: null }))}
                                                    className="text-red-600 hover:text-red-800"
                                                >
                                                    <X className="w-4 h-4" />
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* Packaging/Forwarding - Bulk */}
                                <div className="border rounded-lg p-4 bg-amber-50 space-y-3">
                                    <h4 className="font-semibold text-sm">Packaging / Forwarding
                                        <span className="text-xs font-normal text-gray-500 ml-2">(shared, divided equally among selected indents)</span>
                                    </h4>
                                    <div className="grid grid-cols-3 gap-4">
                                        <div className="space-y-2">
                                            <Label>Amount</Label>
                                            <Input
                                                type="number"
                                                step="0.01"
                                                value={commonData.pkgAmount}
                                                onChange={(e) => setCommonData({ ...commonData, pkgAmount: e.target.value })}
                                                placeholder="0.00"
                                                className="bg-white"
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <Label>GST on Packaging</Label>
                                            <Select value={commonData.pkgGST} onValueChange={(v) => setCommonData({ ...commonData, pkgGST: v })}>
                                                <SelectTrigger className="bg-white"><SelectValue placeholder="Select GST" /></SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="0%">0%</SelectItem>
                                                    <SelectItem value="5%">5%</SelectItem>
                                                    <SelectItem value="12%">12%</SelectItem>
                                                    <SelectItem value="18%">18%</SelectItem>
                                                    <SelectItem value="28%">28%</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>
                                        <div className="space-y-2">
                                            <Label>Total Packaging</Label>
                                            <Input
                                                type="number"
                                                step="0.01"
                                                value={getPkgTotals(commonData.pkgAmount, commonData.pkgGST, bulkItems.length).totalPkg.toFixed(2)}
                                                readOnly
                                                className="bg-gray-100 cursor-not-allowed font-semibold"
                                            />
                                        </div>
                                    </div>
                                    <p className="text-xs text-amber-700">Per item share: ₹{getPkgTotals(commonData.pkgAmount, commonData.pkgGST, bulkItems.length).perItemPkgTotal.toFixed(2)}</p>
                                </div>

                                <div className="grid grid-cols-3 gap-4">
                                    <div className="space-y-2">
                                        <Label>Hydra Amt</Label>
                                        <Input
                                            type="number"
                                            step="0.01"
                                            value={commonData.paymentAmountHydra}
                                            onChange={(e) => setCommonData({ ...commonData, paymentAmountHydra: e.target.value })}
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Labour Amt</Label>
                                        <Input
                                            type="number"
                                            step="0.01"
                                            value={commonData.paymentAmountLabour}
                                            onChange={(e) => setCommonData({ ...commonData, paymentAmountLabour: e.target.value })}
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Hamali Amt</Label>
                                        <Input
                                            type="number"
                                            step="0.01"
                                            value={commonData.paymentAmountHamali}
                                            onChange={(e) => setCommonData({ ...commonData, paymentAmountHamali: e.target.value })}
                                        />
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <Label>Remarks</Label>
                                    <textarea
                                        value={commonData.remarks}
                                        onChange={(e) => setCommonData({ ...commonData, remarks: e.target.value })}
                                        className="w-full min-h-24 px-3 py-2 border border-gray-300 rounded resize-none"
                                        rows={3}
                                    />
                                </div>
                            </div>
                        </form>
                    ) : (
                        /* SINGLE FORM (Existing) */
                        <form
                            onSubmit={handleSubmit}
                            className="flex-1 overflow-y-auto space-y-6 pr-2"
                        >
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label>Lift #</Label>
                                    <Input
                                        value={form.liftNumber}
                                        readOnly
                                        className="bg-gray-50"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label>
                                        Received Qty <span className="text-red-500">*</span>
                                    </Label>
                                    <Input
                                        type="number"
                                        value={form.receivedQty}
                                        onChange={(e) =>
                                            setForm({ ...form, receivedQty: e.target.value })
                                        }
                                        required
                                        placeholder="0"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label>
                                        Invoice Date <span className="text-red-500">*</span>
                                    </Label>
                                    <Input
                                        type="date"
                                        value={form.invoiceDate}
                                        onChange={(e) =>
                                            setForm({ ...form, invoiceDate: e.target.value })
                                        }
                                        required
                                    />
                                </div>

                                <div className="space-y-2">
                                    <Label>
                                        Invoice # <span className="text-red-500">*</span>
                                    </Label>
                                    <Input
                                        value={form.invoiceNumber}
                                        onChange={(e) =>
                                            setForm({ ...form, invoiceNumber: e.target.value })
                                        }
                                        required
                                    />
                                </div>

                                <div className="space-y-2">
                                    <Label>
                                        QC Required <span className="text-red-500">*</span>
                                    </Label>
                                    <Select
                                        value={form.qcRequirement}
                                        onValueChange={(v) => setForm({ ...form, qcRequirement: v })}
                                    >
                                        <SelectTrigger>
                                            <SelectValue placeholder="Select..." />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="yes">Yes</SelectItem>
                                            <SelectItem value="no">No</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>

                            {/* Received Item Image */}
                            <div className="space-y-2">
                                <Label>Received Item Image</Label>
                                <input
                                    id="receivedItemImage"
                                    type="file"
                                    accept=".jpg,.jpeg,.png"
                                    onChange={(e) =>
                                        setForm({
                                            ...form,
                                            receivedItemImage: e.target.files?.[0] ?? null,
                                        })
                                    }
                                    className="hidden"
                                />
                                <label
                                    htmlFor="receivedItemImage"
                                    className="flex items-center justify-center w-full p-4 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:border-gray-400"
                                >
                                    <Upload className="w-6 h-6 text-gray-400 mr-2" />
                                    <span className="text-sm text-gray-600">Upload Image</span>
                                </label>
                                {form.receivedItemImage && (
                                    <div className="mt-2 p-2 bg-gray-50 border rounded flex items-center justify-between">
                                        <div className="flex items-center">
                                            <FileText className="w-4 h-4 text-gray-500 mr-2" />
                                            <span className="text-sm text-gray-700">
                                                {form.receivedItemImage.name}
                                            </span>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => removeFile("receivedItemImage")}
                                            className="text-red-600 hover:text-red-800"
                                        >
                                            <X className="w-4 h-4" />
                                        </button>
                                    </div>
                                )}
                            </div>

                            {/* Bill Attachment */}
                            <div className="space-y-2">
                                <Label>Bill Attachment <span className="text-red-500">*</span></Label>
                                <input
                                    id="billAttachment"
                                    type="file"
                                    accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                                    onChange={(e) =>
                                        setForm({
                                            ...form,
                                            billAttachment: e.target.files?.[0] ?? null,
                                        })
                                    }
                                    className="hidden"
                                />
                                <label
                                    htmlFor="billAttachment"
                                    className="flex items-center justify-center w-full p-4 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:border-gray-400"
                                >
                                    <Upload className="w-6 h-6 text-gray-400 mr-2" />
                                    <span className="text-sm text-gray-600">Upload Bill</span>
                                </label>
                                {form.billAttachment && (
                                    <div className="mt-2 p-2 bg-gray-50 border rounded flex items-center justify-between">
                                        <div className="flex items-center">
                                            <FileText className="w-4 h-4 text-gray-500 mr-2" />
                                            <span className="text-sm text-gray-700">
                                                {form.billAttachment.name}
                                            </span>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => removeFile("billAttachment")}
                                            className="text-red-600 hover:text-red-800"
                                        >
                                            <X className="w-4 h-4" />
                                        </button>
                                    </div>
                                )}
                            </div>

                            {/* Payment Heads */}
                            <div className="space-y-4">
                                <h3 className="font-medium">Others Payment Head</h3>
                                <div className="grid grid-cols-3 gap-4">
                                    <div className="space-y-2">
                                        <Label>Hydra Amount</Label>
                                        <Input
                                            type="number"
                                            step="0.01"
                                            value={form.paymentAmountHydra}
                                            onChange={(e) =>
                                                setForm({ ...form, paymentAmountHydra: e.target.value })
                                            }
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Labour Amount</Label>
                                        <Input
                                            type="number"
                                            step="0.01"
                                            value={form.paymentAmountLabour}
                                            onChange={(e) =>
                                                setForm({
                                                    ...form,
                                                    paymentAmountLabour: e.target.value,
                                                })
                                            }
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Auto Charge</Label>
                                        <Input
                                            type="number"
                                            step="0.01"
                                            value={form.paymentAmountHamali}
                                            onChange={(e) =>
                                                setForm({
                                                    ...form,
                                                    paymentAmountHamali: e.target.value,
                                                })
                                            }
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Packaging/Forwarding - Single Form */}
                            <div className="border rounded-lg p-4 bg-amber-50 space-y-3">
                                <h3 className="font-medium text-sm">Packaging / Forwarding</h3>
                                <div className="grid grid-cols-3 gap-4">
                                    <div className="space-y-2">
                                        <Label>Amount</Label>
                                        <Input
                                            type="number"
                                            step="0.01"
                                            value={form.pkgAmount}
                                            onChange={(e) => setForm({ ...form, pkgAmount: e.target.value })}
                                            placeholder="0.00"
                                            className="bg-white"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>GST on Packaging</Label>
                                        <Select value={form.pkgGST} onValueChange={(v) => setForm({ ...form, pkgGST: v })}>
                                            <SelectTrigger className="bg-white"><SelectValue placeholder="Select GST" /></SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="0%">0%</SelectItem>
                                                <SelectItem value="5%">5%</SelectItem>
                                                <SelectItem value="12%">12%</SelectItem>
                                                <SelectItem value="18%">18%</SelectItem>
                                                <SelectItem value="28%">28%</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Total Packaging</Label>
                                        <Input
                                            type="number"
                                            step="0.01"
                                            value={getPkgTotals(form.pkgAmount, form.pkgGST, 1).totalPkg.toFixed(2)}
                                            readOnly
                                            className="bg-gray-100 cursor-not-allowed font-semibold"
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Remarks */}
                            <div className="space-y-2">
                                <Label>Remarks</Label>
                                <textarea
                                    value={form.remarks}
                                    onChange={(e) => setForm({ ...form, remarks: e.target.value })}
                                    className="w-full min-h-24 px-3 py-2 border border-gray-300 rounded resize-none"
                                    rows={3}
                                />
                            </div>
                        </form>
                    )}

                    <DialogFooter className="flex-shrink-0 border-t pt-4">
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => setOpen(false)}
                            disabled={isSubmitting}
                        >
                            Cancel
                        </Button>
                        <Button
                            onClick={isBulkMode ? handleBulkSubmit : handleSubmit}
                            disabled={
                                isSubmitting ||
                                (isBulkMode
                                    ? !(
                                        commonData.invoiceDate &&
                                        commonData.invoiceNumber &&
                                        commonData.billAttachment &&
                                        bulkItems.every((item) => item.receivedQty && item.qcRequirement)
                                    )
                                    : !formValid)
                            }
                        >
                            {isSubmitting ? (
                                <>
                                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                    Submitting...
                                </>
                            ) : (
                                "Record Receipt"
                            )}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}                                                                                   