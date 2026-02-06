"use client";

import React, { useState, useEffect } from "react";
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
import { FileText, Upload, X, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface LiftingEntry {
    liftNumber: string;
    liftingQty: string;
    transporterName: string;
    vehicleNumber: string;
    contactNumber: string;
    lrNumber: string;
    biltyCopy: File | null;
    dispatchDate: string;
    freightAmount: string;
    advanceAmount: string;
    paymentDate: string;
}

/* --------------------------------------------------------------- */
/*  COLUMNS FOR PENDING TAB (Same as Follow-Up Vendor History)     */
/* --------------------------------------------------------------- */
const PENDING_COLUMNS = [
    { key: "indentNumber", label: "Indent #" },
    { key: "liftNo", label: "Lift No." },
    { key: "vendorName", label: "Vendor Name" },
    { key: "poNumber", label: "PO Number" },
    { key: "nextFollowUpDate", label: "Next Follow-Up" },
    { key: "remarks", label: "Remarks" },
    { key: "itemName", label: "Item Name" },
    { key: "liftingQty", label: "PO Qty" },
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
    });
    const [bulkError, setBulkError] = useState<string | null>(null);

    const formatDate = (date?: Date | string) => {
        if (!date) return "";
        const d = new Date(date);
        if (isNaN(d.getTime())) return "";
        return `${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()}`;
    };

    const parseSheetDate = (dateStr: string) => {
        if (!dateStr || dateStr === "-" || dateStr === "Invalid Date") return new Date();
        const d = new Date(dateStr);
        if (!isNaN(d.getTime())) return d;
        const dateTimeParts = dateStr.split(", ");
        const dateParts = dateTimeParts[0].split("/");
        if (dateParts.length === 3) {
            const day = parseInt(dateParts[0], 10);
            const month = parseInt(dateParts[1], 10) - 1;
            const year = parseInt(dateParts[2], 10);
            return new Date(year, month, day);
        }
        return new Date();
    };

    const fetchData = async () => {
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

                        // Look up Approved Qty from INDENT-LIFT sheet Column O (index 14)
                        const indentNum = String(row[1] || "").trim();
                        const fmsRow = fmsMap.get(indentNum);
                        const approvedQty = fmsRow ? (fmsRow[14] || "") : "";

                        return {
                            id: row[1] || `row-${originalIndex}`,
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
                                liftingQty: approvedQty,         // From INDENT-LIFT Column O (Approved Qty)
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
    };

    useEffect(() => {
        fetchData();
    }, []);

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
    });

    // Check Vendor/PO Match
    const checkVendorPOMatch = (ids: string[]) => {
        if (ids.length === 0) return { match: false, vendor: "", po: "" };
        const first = sheetRecords.find(r => r.id === ids[0]);
        if (!first) return { match: false, vendor: "", po: "" };

        const v = first.data.vendorName;
        const p = first.data.poNumber;

        for (let i = 1; i < ids.length; i++) {
            const rec = sheetRecords.find(r => r.id === ids[i]);
            if (!rec || rec.data.vendorName !== v || rec.data.poNumber !== p) {
                return { match: false, vendor: "", po: "" };
            }
        }
        return { match: true, vendor: v, po: p };
    };

    const handleBulkOpen = () => {
        if (selectedRecordIds.length === 0) return;

        const { match } = checkVendorPOMatch(selectedRecordIds);
        if (selectedRecordIds.length > 1 && !match) {
            toast.error("All selected items must have the same Vendor and PO Number.", {
                style: { background: "red", color: "white", border: "none" }
            });
            return;
        }

        setIsBulkMode(true);
        setBulkError(match ? null : "Vendor/PO Mismatch"); // Should be matched if we got here or handled above

        // Init Common Data
        setCommonData({
            invoiceNumber: "",
            invoiceDate: "",
            billAttachment: null,
            paymentAmountHydra: "",
            paymentAmountLabour: "",
            paymentAmountHamali: "",
            remarks: "",
        });

        // Init Bulk Items
        const items = selectedRecordIds.map(id => {
            const rec = sheetRecords.find(r => r.id === id);
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
    };

    const handleBulkSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        const SHEET_API_URL = process.env.NEXT_PUBLIC_API_URI;
        if (!SHEET_API_URL) return;

        setIsSubmitting(true);
        try {
            // Upload Bill Attachment (Common)
            let billUrl = "";
            const uploadFile = async (file: File) => {
                const uploadParams = new URLSearchParams();
                uploadParams.append("action", "uploadFile");
                uploadParams.append("base64Data", await toBase64(file));
                uploadParams.append("fileName", file.name);
                uploadParams.append("mimeType", file.type);
                const folderId = process.env.NEXT_PUBLIC_IMAGE_FOLDER_ID || "1SihRrPrgbuPGm-09fuB180QJhdxq5Nxy";
                uploadParams.append("folderId", folderId);

                const res = await fetch(SHEET_API_URL, { method: "POST", body: uploadParams });
                const json = await res.json();
                if (json.success) return json.fileUrl;
                return "";
            };

            if (commonData.billAttachment) {
                billUrl = await uploadFile(commonData.billAttachment);
            }

            const now = new Date();
            const dateStr = now.toISOString().split('T')[0];

            for (const item of bulkItems) {
                // Upload Item Image (Individual)
                let itemImgUrl = "";
                if (item.receivedItemImage) {
                    itemImgUrl = await uploadFile(item.receivedItemImage);
                }

                const rowArray = new Array(50).fill("");
                // Same mapping as single submit
                rowArray[20] = dateStr; // Actual1
                rowArray[22] = "independent";
                rowArray[23] = commonData.invoiceDate;
                rowArray[24] = commonData.invoiceNumber;
                rowArray[25] = item.receivedQty;
                rowArray[26] = itemImgUrl;
                rowArray[27] = ""; // SRN
                rowArray[28] = item.qcRequirement;
                rowArray[29] = billUrl;
                rowArray[30] = commonData.paymentAmountHydra;
                rowArray[31] = commonData.paymentAmountLabour;
                rowArray[32] = commonData.paymentAmountHamali;
                rowArray[33] = commonData.remarks;

                const params = new URLSearchParams();
                params.append("action", "update");
                params.append("sheetName", "RECEIVING-ACCOUNTS");
                params.append("rowData", JSON.stringify(rowArray));
                params.append("rowIndex", item.index.toString());

                // Sequential update to avoid rate limits/race conditions
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
    };

    const pending = sheetRecords.filter(
        (r) => r && r.data && r.status === "pending"
    );
    const completed = sheetRecords.filter((r) => r && r.data && r.status === "completed");

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
    const openModal = (recordId: string) => {
        const rec = sheetRecords?.find((r) => r.id === recordId);
        if (!rec) {
            toast.error("Record not found locally. Please refresh.");
            return;
        }

        setSelectedRecordIds([]);
        setIsBulkMode(false);
        setSelectedRecordId(recordId);
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
        });
        setOpen(true);
    };

    /* --------------------------------------------------------------- */
    /*  Submit                                                         */
    /* --------------------------------------------------------------- */
    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        const SHEET_API_URL = process.env.NEXT_PUBLIC_API_URI;
        if (!selectedRecordId || !SHEET_API_URL) return;

        const rec = sheetRecords?.find((r) => r.id === selectedRecordId);
        if (!rec) return;

        setIsSubmitting(true);
        try {
            // 1. Upload Files
            let billUrl = "";
            let imageUrl = "";

            // Helper for file upload
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

            if (form.billAttachment instanceof File) {
                billUrl = await uploadFile(form.billAttachment);
            } else if (typeof form.billAttachment === 'string') {
                billUrl = form.billAttachment;
            }

            if (form.receivedItemImage instanceof File) {
                imageUrl = await uploadFile(form.receivedItemImage);
            } else if (typeof form.receivedItemImage === 'string') {
                imageUrl = form.receivedItemImage;
            }

            // 2. Prepare Update Data
            const now = new Date();
            const formatISO = (date: Date) => date.toISOString().split('T')[0];
            const dateStr = formatISO(now);

            // Update lift-accounts indices 25-39
            // lift-accounts existing data is 0-24. We append/update 25-39.
            // We need a sparse array of size 50.
            // const rowArray = new Array(50).fill("");

            // Indices based on User Request Schema for Stage 7
            // 25: Plan 6 (Keeping empty/unchanged for this update)
            // 26: Actual 6
            //     rowArray[20] = dateStr;
            //     // 27: Invoice Type
            //     rowArray[22] = invoiceType;
            //     // 28: Lift # (User: 'lift')
            //     rowArray[23] = form.invoiceDate;
            //     rowArray[24] = form.invoiceNumber;
            //     rowArray[25] = form.receivedQty;
            //     rowArray[26] = form.liftNumber;
            //     // 29: Received Qty (User: 'received qty')
            //     // 30: Invoice Date (User: 'invoice data')
            //     // 31: Invoice Number (User: 'Invoice')
            //     // 32: SRN Number (User: 'srn')
            //     rowArray[28] = form.srnNumber;
            //     rowArray[27] = imageUrl || "";
            //     // 33: QC Required (User: 'Qc reqired')

            //     // 34: Received Item Image (User: 'recive item imag')
            //     // 35: Bill Attachment (User: 'bill attachment')
            //     rowArray[29] = billUrl || "";
            //     // 36: Hydra Amount (User: 'hydra Amot')
            //     rowArray[30] = form.paymentAmountHydra;
            //     // 37: Labour Amount (User: 'babour')
            //     rowArray[31] = form.paymentAmountLabour;
            //     // 38: Hamali Amount (User: 'Hemali')
            //     rowArray[32] = form.paymentAmountHamali;
            //     // 39: Remarks (User: 'remarks')
            //     // rowArray[33] = form.remarks;
            //     // 40: Plan 7 (QC Plan) - Trigger for Stage 8
            //  // create sparse row (size enough for your sheet)
            const rowArray = new Array(50).fill("");

            // ============================================================
            // RECEIVING-ACCOUNTS Sheet: Material Receipt Section (Row 7+)
            // Columns T to AH (Indices 19 to 33)
            // ============================================================

            // Column T (19): Planned1 → Already set, don't modify
            // Column U (20): Actual1 → Set current date when receipt is recorded
            rowArray[20] = dateStr;

            // Column V (21): Delay1 → Formula field, skip

            // Column W (22): Invoice Type
            rowArray[22] = "independent";

            // Column X (23): Invoice Date
            rowArray[23] = form.invoiceDate;

            // Column Y (24): Invoice No
            rowArray[24] = form.invoiceNumber;

            // Column Z (25): Received Qty
            rowArray[25] = form.receivedQty;

            // Column AA (26): Received Item Image
            rowArray[26] = imageUrl || "";

            // Column AB (27): SRN
            rowArray[27] = "";

            // Column AC (28): QC Required
            rowArray[28] = form.qcRequirement;

            // Column AD (29): Bill Attachment
            rowArray[29] = billUrl || "";

            // Column AE (30): Hydra Amount
            rowArray[30] = form.paymentAmountHydra;

            // Column AF (31): Labour Amount
            rowArray[31] = form.paymentAmountLabour;

            // Column AG (32): Hemali Amount
            rowArray[32] = form.paymentAmountHamali;

            // Column AH (33): Remarks
            rowArray[33] = form.remarks;


            const params = new URLSearchParams();
            params.append("action", "update");
            params.append("sheetName", "RECEIVING-ACCOUNTS");
            params.append("rowData", JSON.stringify(rowArray));
            params.append("rowIndex", rec.rowIndex.toString()); // Use rowIndex from fetched data

            const updateRes = await fetch(SHEET_API_URL, {
                method: "POST",
                body: params,
            });

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
    };

    const toBase64 = (file: File) => new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = error => reject(error);
    });

    const resetForm = () => {
        setForm({
            liftNumber: "",
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
        });
    };

    const removeFile = (key: "billAttachment" | "receivedItemImage") => {
        setForm((f) => ({ ...f, [key]: null }));
    };

    const formValid =
        form.receivedQty &&
        form.invoiceNumber &&
        form.invoiceDate &&
        form.qcRequirement;

    return (
        <div className="p-6">
            {/* ==================== HEADER ==================== */}
            <div className="mb-6 p-6 bg-white border rounded-lg shadow-sm">
                <div className="flex items-center justify-between">
                    <div>
                        <h2 className="text-2xl font-bold">Stage 7: Material Receipt</h2>
                        <p className="text-gray-600 mt-1">
                            Record received goods, invoice, QC & payment details
                        </p>
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
                                                        return (
                                                            <TableCell key={col.key}>
                                                                {rec.data.biltyCopy ? (
                                                                    <a
                                                                        href={rec.data.biltyCopy}
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
                                                        return (
                                                            <TableCell key={col.key}>
                                                                {rec.data.poCopy ? (
                                                                    <a
                                                                        href={rec.data.poCopy}
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
                                                            return (
                                                                <TableCell key={col.key}>
                                                                    {dateVal || "-"}
                                                                </TableCell>
                                                            );
                                                        }

                                                        // Handle file fields
                                                        if (col.key === "biltyCopy") {
                                                            return (
                                                                <TableCell key={col.key}>
                                                                    {historyData.biltyCopy ? (
                                                                        <a
                                                                            href={historyData.biltyCopy}
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
                                                            return (
                                                                <TableCell key={col.key}>
                                                                    {historyData.poCopy ? (
                                                                        <a
                                                                            href={historyData.poCopy}
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
                                                            return (
                                                                <TableCell key={col.key}>
                                                                    {file ? (
                                                                        <a
                                                                            href={typeof file === 'string' ? file : undefined}
                                                                            target="_blank"
                                                                            rel="noopener noreferrer"
                                                                            className="flex items-center gap-1 text-xs text-blue-600 hover:underline"
                                                                        >
                                                                            <FileText className="w-3.5 h-3.5" />
                                                                            <span className="truncate max-w-20">
                                                                                {typeof file === 'string' ? `View ${col.label}` : (file as File).name || col.label}
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
                                                        return (
                                                            <TableCell key={col.key}>
                                                                {String(historyData[col.key] ?? "-")}
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
                                        <Label>Bill Attachment</Label>
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
                                <Label>Bill Attachment</Label>
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
                                        <Label>Hamali Amount</Label>
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
                            disabled={isSubmitting || (!isBulkMode && !formValid)}
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