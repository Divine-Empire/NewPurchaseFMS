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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FileText, Loader2, Upload, X } from "lucide-react";
import { toast } from "sonner";



export default function Stage8() {
  const SHEET_API_URL = process.env.NEXT_PUBLIC_API_URI;
  const [open, setOpen] = useState(false);
  const [selectedRecordId, setSelectedRecordId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"pending" | "history">("pending");
  const [sheetRecords, setSheetRecords] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [srnDetailsOpen, setSrnDetailsOpen] = useState(false);
  const [srnDetailsData, setSrnDetailsData] = useState<{ serialNo: number; srn: string; image: string }[]>([]);
  const [qcEngineerList, setQcEngineerList] = useState<string[]>([]);

  const [formData, setFormData] = useState({
    qcBy: "",
    qcDate: "",
    qcStatus: "",
    rejectRemarks: "",
    rejectQty: "",
    returnStatus: "",
    qcRemarks: "",
    rejectPhoto: null as File | null,
    approvedQty: "",
    srnEntries: [] as { serialNo: number; srn: string; image: File | null }[],
  });

  const fetchData = async () => {
    if (!SHEET_API_URL) return;
    setIsLoading(true);
    try {
      const res = await fetch(`${SHEET_API_URL}?sheet=RECEIVING-ACCOUNTS&action=getAll`);
      const json = await res.json();
      if (json.success && Array.isArray(json.data)) {
        const rows = json.data.slice(6)
          .map((row: any, i: number) => ({ row, originalIndex: i + 7 }))
          .filter(({ row }: any) => row[1] && String(row[1]).trim() !== "")
          .map(({ row, originalIndex }: any) => {
            // Stage 8 Status Logic based on User Request:
            // Pending: Plan 7 (Index 40) exists AND Actual 7 (Index 41) does not exist
            // Completed: Plan 7 (Index 40) exists AND Actual 7 (Index 41) exists
            const hasPlan7 = !!row[34] && String(row[34]).trim() !== "" && String(row[34]).trim() !== "-";
            const hasActual7 = !!row[35] && String(row[35]).trim() !== "" && String(row[35]).trim() !== "-";

            const status = (hasPlan7 && hasActual7) ? "completed" : (hasPlan7 && !hasActual7 ? "pending" : "not_ready");

            return {
              id: row[1] || `row-${originalIndex}`,
              rowIndex: originalIndex,
              stage: 8,
              status,
              data: {
                indentNumber: row[1] || "",      // B: Indent Number
                liftNo: row[2] || "",            // C: Lift No.
                vendorName: row[3] || "",        // D: Vendor Name
                poNumber: row[4] || "",          // E: PO Number
                nextFollowUpDate: row[5] || "", // F: Next Follow-Up Date
                remarksStage6: row[6] || "",     // G: Remarks (Stage 6)
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

                invoiceType: row[22] || "-",    // W
                invoiceDate: row[23] || "-",    // X
                invoiceNumber: row[24] || "-",  // Y
                receivedQty: row[25] || "-",     // Z
                receivedItemImage: row[26] || "",// AA
                srnNumber: row[27] || "-",       // AB
                qcRequirement: row[28] || "-",   // AC
                billAttachment: row[29] || "",   // AD
                paymentAmountHydra: row[30] || "", // AE
                paymentAmountLabour: row[31] || "",// AF
                paymentAmountHamali: row[32] || "",// AG
                remarksStage7: row[33] || "",      // AH

                // Stage 8 Data (Columns AI to AR)
                plan7: row[34],                  // AI: Planned QC
                actual7: row[35],                // AJ: Actual QC (Completes Status)
                qcBy: row[37],                   // AL: QC Done By (Updated)
                qcDate: row[38],                 // AM: QC Date (Updated)
                qcStatus: row[39],               // AN: QC Status (Updated)
                qcRemarks: row[40],              // AO: QC Remarks (Updated)
                // Remaining fields
                returnStatus: row[73],           // BV: Return Status
                rejectQty: row[41],              // AP (Updated)
                rejectPhoto: row[42],            // AQ (Updated)
                rejectRemarks: row[43],          // AR (Updated)
                srnJson: row[74] || "",          // BW: SRN Details JSON
              }
            };
          });
        setSheetRecords(rows);
      }

      // Fetch Dropdown sheet for QC Engineers (Column L / Index 11)
      const dropRes = await fetch(`${SHEET_API_URL}?sheet=Dropdown&action=getAll`);
      const dropJson = await dropRes.json();
      if (dropJson.success && Array.isArray(dropJson.data)) {
        const qcList = dropJson.data.slice(1)
          .map((row: any) => String(row[11] || "").trim())
          .filter((q: string) => q !== "");
        setQcEngineerList(qcList);
      }

    } catch (e) {
      console.error("Fetch error:", e);
    }
    setIsLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Fixed columns for both Pending and History tables
  const FIXED_COLUMNS = [
    { key: "indentNumber", label: "Indent #" },
    { key: "vendorName", label: "Vendor" },
    { key: "invoiceNumber", label: "Invoice #" },
    { key: "itemName", label: "Item" },
    { key: "receivedQty", label: "Received Qty" },
  ];

  // Filtering
  const pending = sheetRecords.filter((r) => r.status === "pending");
  const completed = sheetRecords.filter((r) => r.status === "completed");

  const handleOpenForm = (recordId: string) => {
    const today = new Date().toISOString().split("T")[0];
    setSelectedRecordId(recordId);
    setFormData({
      qcBy: "",
      qcDate: today,
      qcStatus: "",
      rejectRemarks: "",
      rejectQty: "",
      returnStatus: "",
      qcRemarks: "",
      rejectPhoto: null,
      approvedQty: "",
      srnEntries: [],
    });
    setOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRecordId || !SHEET_API_URL) return;

    const rec = sheetRecords.find((r) => r.id === selectedRecordId);
    if (!rec) return;

    setIsSubmitting(true);
    try {
      let photoUrl = "";
      if (formData.rejectPhoto instanceof File) {
        const uploadParams = new URLSearchParams();
        uploadParams.append("action", "uploadFile");
        uploadParams.append("base64Data", await toBase64(formData.rejectPhoto));
        uploadParams.append("fileName", formData.rejectPhoto.name);
        uploadParams.append("mimeType", formData.rejectPhoto.type);
        const folderId = process.env.NEXT_PUBLIC_IMAGE_FOLDER_ID || "1SihRrPrgbuPGm-09fuB180QJhdxq5Nxy";
        uploadParams.append("folderId", folderId);

        const res = await fetch(SHEET_API_URL, { method: "POST", body: uploadParams });
        const json = await res.json();
        if (json.success) photoUrl = json.fileUrl;
        else throw new Error("Photo upload failed");
      }

      // Process SRN entries for approved status
      let approvedQtyJson = "";
      if (formData.qcStatus === "approved" && formData.srnEntries.length > 0) {
        const srnData = [];
        const folderId = process.env.NEXT_PUBLIC_IMAGE_FOLDER_ID || "1SihRrPrgbuPGm-09fuB180QJhdxq5Nxy";

        for (const entry of formData.srnEntries) {
          let imageUrl = "";
          if (entry.image instanceof File) {
            const uploadParams = new URLSearchParams();
            uploadParams.append("action", "uploadFile");
            uploadParams.append("base64Data", await toBase64(entry.image));
            uploadParams.append("fileName", `SRN_${entry.serialNo}_${entry.image.name}`);
            uploadParams.append("mimeType", entry.image.type);
            uploadParams.append("folderId", folderId);

            const res = await fetch(SHEET_API_URL, { method: "POST", body: uploadParams });
            const json = await res.json();
            if (json.success) imageUrl = json.fileUrl || "";
          }
          srnData.push({
            serialNo: entry.serialNo,
            srn: entry.srn,
            image: imageUrl,
          });
        }
        approvedQtyJson = JSON.stringify(srnData);
      }

      // Prepare Date Strings in M/D/YYYY format strictly
      const now = new Date();
      const mDYYYY = `${now.getMonth() + 1}/${now.getDate()}/${now.getFullYear()}`;

      let qcDateFormatted = "";
      if (formData.qcDate) {
        const d = new Date(formData.qcDate);
        qcDateFormatted = `${d.getMonth() + 1}/${d.getDate()}/${d.getFullYear()}`;
      }

      // Sparse Row Update based on USER Request
      const rowArray = new Array(80).fill("");
      rowArray[35] = mDYYYY;                  // AJ: Actual QC Date (Status trigger)
      // AK (36) is skipped as requested
      rowArray[37] = formData.qcBy;           // AL: QC Done By
      rowArray[38] = qcDateFormatted;         // AM: QC Date
      rowArray[39] = formData.qcStatus;       // AN: QC Status
      rowArray[40] = formData.qcRemarks;      // AO: QC Remarks

      rowArray[73] = formData.returnStatus;   // BV: Return Status
      rowArray[41] = formData.rejectQty;      // AP: Reject Qty (Updated)
      rowArray[42] = photoUrl || "";          // AQ: Reject Photo (Updated)
      rowArray[43] = formData.rejectRemarks;  // AR: Reject Remarks (Updated)

      // Column BW (index 74): Approved Qty with SRN and Image JSON
      rowArray[74] = approvedQtyJson;

      const params = new URLSearchParams();
      params.append("action", "update");
      params.append("sheetName", "RECEIVING-ACCOUNTS");
      params.append("rowIndex", rec.rowIndex.toString());
      params.append("rowData", JSON.stringify(rowArray));

      const updateRes = await fetch(SHEET_API_URL, { method: "POST", body: params });
      const updateJson = await updateRes.json();

      if (updateJson.success) {
        toast.success("QC Record updated successfully!");
        setOpen(false);
        fetchData();
      } else {
        throw new Error(updateJson.error || "Update failed");
      }
    } catch (error: any) {
      toast.error(error.message || "Submission failed");
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

  const isFormValid =
    formData.qcBy &&
    formData.qcDate &&
    formData.qcStatus &&
    formData.returnStatus &&
    (formData.qcStatus === "approved"
      ? formData.approvedQty &&
      parseInt(formData.approvedQty) > 0 &&
      formData.srnEntries.length > 0 &&
      formData.srnEntries.every((e) => e.srn.trim() !== "")
      : formData.qcStatus === "rejected" &&
      formData.rejectQty &&
      formData.rejectRemarks);

  const formatDisplayDate = (d: any) => {
    if (!d || d === "" || d === "-" || d === "Invalid Date") return "-";
    const date = new Date(d);
    if (isNaN(date.getTime())) return d;
    return date.toLocaleDateString("en-IN");
  };

  // Open SRN Details modal with parsed JSON
  const openSrnDetails = (jsonStr: string) => {
    try {
      const data = JSON.parse(jsonStr);
      if (Array.isArray(data)) {
        setSrnDetailsData(data);
        setSrnDetailsOpen(true);
      }
    } catch (e) {
      console.error("Failed to parse SRN JSON:", e);
    }
  };

  // Safe data access with lifting data support
  const safeValue = (record: any, key: string, isHistory = false) => {
    try {
      const data = record?.data;
      if (!data) return "-";

      // Handle file attachments with clickable links
      const fileFields = ["poCopy", "receivedItemImage", "billAttachment", "rejectPhoto"];
      if (fileFields.includes(key)) {
        const url = data[key];
        if (!url || String(url).trim() === "" || url === "-") return "-";
        return (
          <a
            href={String(url)}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 text-xs text-blue-600 hover:underline"
          >
            <FileText className="w-3.5 h-3.5" />
            <span className="truncate max-w-20">View</span>
          </a>
        );
      }

      // Handle QC Status mapping
      if (key === "qcStatus") {
        const status = data.qcStatus;
        if (!status || status === "-" || status === "") return "-";
        return status.charAt(0).toUpperCase() + status.slice(1);
      }

      // Handle currency columns
      if (["freightAmount", "advanceAmount", "basicValue", "totalWithTax", "ratePerQty", "paymentAmountHydra", "paymentAmountLabour", "paymentAmountHamali"].includes(key)) {
        const amount = data[key];
        return amount && amount !== "-" && amount !== "" ? `₹${amount}` : "-";
      }

      const val = data[key];
      const lowKey = key.toLowerCase();
      if (lowKey.includes("date") || lowKey.includes("plan") || lowKey.includes("actual")) {
        return formatDisplayDate(val);
      }

      if (val === undefined || val === null || String(val).trim() === "") return "-";
      return String(val);
    } catch (err) {
      return "-";
    }
  };



  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-6 p-6 bg-white border rounded-lg shadow-sm">
        <div>
          <h2 className="text-2xl font-bold">Stage 8: Quality Control</h2>
          <p className="text-gray-600 mt-1">
            Inspect and approve/reject received materials
          </p>
        </div>
      </div>

      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-24 text-gray-500">
          <Loader2 className="w-8 h-8 animate-spin mb-4 text-black" />
          <p className="text-lg animate-pulse text-black font-medium">Loading records...</p>
        </div>
      ) : (
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="pending">Pending ({pending.length})</TabsTrigger>
            <TabsTrigger value="history">
              History ({completed.length})
            </TabsTrigger>
          </TabsList>

          {/* Pending */}
          <TabsContent value="pending" className="mt-6">
            {pending.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                <p className="text-lg">No pending QC checks</p>
                <p className="text-sm mt-1">All items are inspected!</p>
              </div>
            ) : (
              <div className="border rounded-lg overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="sticky left-0 bg-white z-10">
                        ID
                      </TableHead>
                      <TableHead className="bg-white z-10">Actions</TableHead>
                      {FIXED_COLUMNS.map((col) => (
                        <TableHead key={col.key}>{col.label}</TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pending.map((record: any) => (
                      <TableRow key={record.id}>
                        <TableCell className="font-mono text-xs sticky left-0 bg-white z-10">
                          {record.id || "-"}
                        </TableCell>
                        <TableCell className="bg-white z-10">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleOpenForm(record.id)}
                          >
                            Perform QC
                          </Button>
                        </TableCell>
                        {FIXED_COLUMNS.map((col) => (
                          <TableCell key={col.key}>
                            {safeValue(record, col.key)}
                          </TableCell>
                        ))}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </TabsContent>

          {/* History */}
          <TabsContent value="history" className="mt-6">
            {completed.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                <p className="text-lg">No QC history</p>
              </div>
            ) : (
              <div className="border rounded-lg overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="sticky left-0 bg-white z-10">
                        ID
                      </TableHead>
                      {FIXED_COLUMNS.map((col) => (
                        <TableHead key={col.key}>{col.label}</TableHead>
                      ))}
                      <TableHead>SRN Details</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {completed.map((record: any) => (
                      <TableRow key={record.id}>
                        <TableCell className="font-mono text-xs sticky left-0 bg-white z-10">
                          {record.id || "-"}
                        </TableCell>
                        {FIXED_COLUMNS.map((col) => (
                          <TableCell key={col.key}>
                            {safeValue(record, col.key, true)}
                          </TableCell>
                        ))}
                        <TableCell>
                          {record.data?.srnJson && record.data.srnJson.trim() !== "" ? (
                            <Button
                              variant="outline"
                              size="sm"
                              className="text-xs"
                              onClick={() => openSrnDetails(record.data.srnJson)}
                            >
                              View SRN
                            </Button>
                          ) : (
                            <span className="text-gray-400 text-xs">-</span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </TabsContent>
        </Tabs>
      )}

      {/* Modal */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Quality Control Inspection</DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Planned QC Date</Label>
                  <Input
                    value={formatDisplayDate(sheetRecords.find(r => r.id === selectedRecordId)?.data?.plan7)}
                    readOnly
                    className="bg-gray-50"
                  />
                </div>
                <div>
                  <Label>QC Done By *</Label>
                  <Select
                    value={formData.qcBy}
                    onValueChange={(v) => setFormData({ ...formData, qcBy: v })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select engineer" />
                    </SelectTrigger>
                    <SelectContent>
                      {qcEngineerList.map((n) => (
                        <SelectItem key={n} value={n}>
                          {n}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>QC Date *</Label>
                  <input
                    type="date"
                    className="w-full px-3 py-2 border rounded"
                    value={formData.qcDate}
                    onChange={(e) =>
                      setFormData({ ...formData, qcDate: e.target.value })
                    }
                    required
                  />
                </div>
                <div>
                  <Label>QC Status *</Label>
                  <Select
                    value={formData.qcStatus}
                    onValueChange={(v) =>
                      setFormData({
                        ...formData,
                        qcStatus: v,
                        rejectQty: v === "approved" ? "" : formData.rejectQty,
                        rejectRemarks:
                          v === "approved" ? "" : formData.rejectRemarks,
                        approvedQty: v === "rejected" ? "" : formData.approvedQty,
                        srnEntries: v === "rejected" ? [] : formData.srnEntries,
                      })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="approved">Approved</SelectItem>
                      <SelectItem value="rejected">Rejected</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Approved Qty - appears when status is approved */}
                {formData.qcStatus === "approved" && (
                  <div>
                    <Label>Approved Qty *</Label>
                    <input
                      type="number"
                      min="1"
                      max={sheetRecords.find(r => r.id === selectedRecordId)?.data?.receivedQty || 999}
                      className="w-full px-3 py-2 border rounded"
                      placeholder={`Max: ${sheetRecords.find(r => r.id === selectedRecordId)?.data?.receivedQty || "-"}`}
                      value={formData.approvedQty}
                      onChange={(e) => {
                        const qty = parseInt(e.target.value) || 0;
                        const maxQty = parseInt(sheetRecords.find(r => r.id === selectedRecordId)?.data?.receivedQty) || 999;
                        const validQty = Math.min(Math.max(0, qty), maxQty);

                        // Generate SRN entries based on qty
                        const newEntries = Array.from({ length: validQty }, (_, i) => ({
                          serialNo: i + 1,
                          srn: formData.srnEntries[i]?.srn || "",
                          image: formData.srnEntries[i]?.image || null,
                        }));

                        setFormData({
                          ...formData,
                          approvedQty: e.target.value,
                          srnEntries: newEntries,
                        });
                      }}
                      required
                    />
                  </div>
                )}

                <div>
                  <Label>Return Status *</Label>
                  <Select
                    value={formData.returnStatus}
                    onValueChange={(v) =>
                      setFormData({ ...formData, returnStatus: v })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="return">Return</SelectItem>
                      <SelectItem value="not return">Not Return</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* SRN Entries Section - appears when approved qty > 0 */}
              {formData.qcStatus === "approved" && formData.srnEntries.length > 0 && (
                <div className="p-4 border rounded bg-green-50 space-y-3">
                  <h3 className="font-semibold text-green-800">
                    SRN Details ({formData.srnEntries.length} items)
                  </h3>
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    <div className="grid grid-cols-12 gap-2 text-xs font-medium text-gray-600 sticky top-0 bg-green-50 py-1">
                      <div className="col-span-1">S.No</div>
                      <div className="col-span-5">SRN *</div>
                      <div className="col-span-6">Image</div>
                    </div>
                    {formData.srnEntries.map((entry, idx) => (
                      <div key={entry.serialNo} className="grid grid-cols-12 gap-2 items-center">
                        <div className="col-span-1 text-sm font-medium text-gray-700">
                          {entry.serialNo}
                        </div>
                        <div className="col-span-5">
                          <input
                            type="text"
                            className="w-full px-2 py-1.5 border rounded text-sm"
                            placeholder="Enter SRN..."
                            value={entry.srn}
                            onChange={(e) => {
                              const updated = [...formData.srnEntries];
                              updated[idx] = { ...updated[idx], srn: e.target.value };
                              setFormData({ ...formData, srnEntries: updated });
                            }}
                            required
                          />
                        </div>
                        <div className="col-span-6 flex items-center gap-2">
                          <input
                            type="file"
                            accept="image/*"
                            id={`srn-image-${idx}`}
                            className="hidden"
                            onChange={(e) => {
                              const file = e.target.files?.[0] || null;
                              const updated = [...formData.srnEntries];
                              updated[idx] = { ...updated[idx], image: file };
                              setFormData({ ...formData, srnEntries: updated });
                            }}
                          />
                          <label
                            htmlFor={`srn-image-${idx}`}
                            className="flex-1 px-2 py-1.5 border rounded bg-white cursor-pointer hover:bg-gray-50 text-sm text-center"
                          >
                            {entry.image ? (
                              <span className="text-green-600 truncate block">
                                {entry.image.name}
                              </span>
                            ) : (
                              <span className="text-gray-500">Upload</span>
                            )}
                          </label>
                          {entry.image && (
                            <button
                              type="button"
                              className="text-red-500 hover:text-red-700 text-xs"
                              onClick={() => {
                                const updated = [...formData.srnEntries];
                                updated[idx] = { ...updated[idx], image: null };
                                setFormData({ ...formData, srnEntries: updated });
                              }}
                            >
                              ✕
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {formData.qcStatus === "rejected" && (
                <div className="p-4 border rounded bg-red-50 space-y-3">
                  <h3 className="font-semibold text-red-800">
                    Rejection Details
                  </h3>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label>Reject Qty *</Label>
                      <input
                        type="number"
                        className="w-full px-3 py-2 border rounded"
                        placeholder="0"
                        value={formData.rejectQty}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            rejectQty: e.target.value,
                          })
                        }
                        required
                      />
                    </div>
                    <div>
                      <Label>Reject Photo</Label>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            setFormData({ ...formData, rejectPhoto: file });
                          }
                        }}
                        className="hidden"
                        id="reject-photo"
                      />
                      <label
                        htmlFor="reject-photo"
                        className="flex items-center justify-center w-full p-2 border rounded cursor-pointer hover:bg-gray-50"
                      >
                        {formData.rejectPhoto ? (
                          <span className="text-green-600">
                            {" "}
                            Photo Selected
                          </span>
                        ) : (
                          <span> Upload Photo</span>
                        )}
                      </label>
                    </div>
                    <div className="col-span-2">
                      <Label>Reject Remarks *</Label>
                      <textarea
                        className="w-full px-3 py-2 border rounded resize-none"
                        rows={3}
                        value={formData.rejectRemarks}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            rejectRemarks: e.target.value,
                          })
                        }
                        required
                      />
                    </div>
                  </div>
                </div>
              )}

              <div>
                <Label>QC Remarks</Label>
                <textarea
                  className="w-full px-3 py-2 border rounded resize-none"
                  rows={3}
                  value={formData.qcRemarks}
                  onChange={(e) =>
                    setFormData({ ...formData, qcRemarks: e.target.value })
                  }
                />
              </div>
            </form>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button onClick={handleSubmit} disabled={!isFormValid || isSubmitting}>
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Submitting...
                </>
              ) : (
                "Complete QC"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* SRN Details Modal */}
      <Dialog open={srnDetailsOpen} onOpenChange={setSrnDetailsOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle>SRN Details</DialogTitle>
          </DialogHeader>
          <div className="overflow-y-auto max-h-[60vh]">
            {srnDetailsData.length === 0 ? (
              <p className="text-gray-500 text-center py-4">No SRN data available</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-16">S.No</TableHead>
                    <TableHead>SRN</TableHead>
                    <TableHead>Image</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {srnDetailsData.map((entry) => (
                    <TableRow key={entry.serialNo}>
                      <TableCell className="font-medium">{entry.serialNo}</TableCell>
                      <TableCell>{entry.srn || "-"}</TableCell>
                      <TableCell>
                        {entry.image && entry.image.trim() !== "" ? (
                          <a
                            href={entry.image}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1 text-blue-600 hover:underline text-sm"
                          >
                            <FileText className="w-4 h-4" />
                            View Image
                          </a>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSrnDetailsOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
