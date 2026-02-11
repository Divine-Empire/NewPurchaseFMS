"use client";

import React, { useState } from "react";
import { useWorkflow } from "@/lib/workflow-context";
import { toast } from "sonner";
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
import { Textarea } from "@/components/ui/textarea";
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
import { FileText, Upload, X, Shield, ShieldCheck, CheckCircle2, Loader2, ClipboardList, History } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export default function Stage5() {
  const { moveToNextStage, updateRecord } = useWorkflow();
  const [open, setOpen] = useState(false);
  const [selectedRecordIds, setSelectedRecordIds] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState<"pending" | "history">("pending");
  const [bulkFormData, setBulkFormData] = useState<Record<string, any>>({});
  const [sheetRecords, setSheetRecords] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Shared fields for bulk PO
  const [commonPONumber, setCommonPONumber] = useState("");
  const [commonPOCopy, setCommonPOCopy] = useState<File | null>(null);

  const formatDate = (date?: Date | string) => {
    if (!date) return "";
    const d = new Date(date);
    if (isNaN(d.getTime())) return "";
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`; // YYYY-MM-DD format
  };

  const parseSheetDate = (dateStr: string) => {
    if (!dateStr || dateStr === "-") return new Date();
    const parts = dateStr.split("/");
    if (parts.length === 3) {
      return new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]));
    }
    return new Date(dateStr);
  };

  const fetchData = async () => {
    const SHEET_API_URL = process.env.NEXT_PUBLIC_API_URI;
    if (!SHEET_API_URL) return;
    setIsLoading(true);
    try {
      const res = await fetch(`${SHEET_API_URL}?sheet=INDENT-LIFT&action=getAll`);
      const json = await res.json();
      if (json.success && Array.isArray(json.data)) {
        // Skip header and first 6 data rows (indices 0-6) -> Data starts at Row 8
        const rows = json.data.slice(6)
          .map((row: any, i: number) => ({ row, originalIndex: i + 7 }))
          .filter(({ row }: any) => row[1] && String(row[1]).trim() !== "") // Skip empty rows
          .map(({ row, originalIndex }: any) => {
            // Stage 4 completion check: Selected Vendor (Index 47 / Col AV)
            const isStage4Done = !!row[47] && String(row[47]).trim() !== "" && String(row[47]).trim() !== "-";

            // Stage 5 completion check: PO Number (Index 52 / Col BA)
            const isStage5Done = !!row[52] && String(row[52]).trim() !== "" && String(row[52]).trim() !== "-";


            // Stage 5 completion check based on User Request
            // Plan 4 (Index 51) and Actual 4 (Index 52)
            const hasPlan4 = !!row[51] && String(row[51]).trim() !== "" && String(row[51]).trim() !== "-";
            const hasActual4 = !!row[52] && String(row[52]).trim() !== "" && String(row[52]).trim() !== "-";

            return {
              id: row[1] || `row-${originalIndex}`,
              rowIndex: originalIndex,
              stage: 5,
              status: (hasPlan4 && hasActual4) ? "completed" : (hasPlan4 && !hasActual4 ? "pending" : "not_ready"),
              createdAt: parseSheetDate(row[0]),
              history: (hasPlan4 && hasActual4) ? [{ stage: 5, date: parseSheetDate(row[51] || row[50] || row[0]), data: {} }] : [],
              data: {
                timestamp: row[0],
                indentNumber: row[1],
                createdBy: row[2],
                category: row[3],
                itemName: row[4],
                quantity: row[5],
                warehouseLocation: row[6],
                deliveryDate: row[7] ? formatDate(row[7]) : "",
                leadTime: row[8],
                planned1: row[9] ? formatDate(row[9]) : "",
                actual1: row[10] ? formatDate(row[10]) : "",
                delay1: row[11],
                approvedBy: row[12],
                status: row[13],
                approvedQty: row[14],
                vendorType: row[15],
                remarks: row[16],
                img: row[17],

                // Stage 2 Dates
                planned2: row[18],
                actual2: row[19],
                delay2: row[20],

                // Vendor 1
                vendor1Name: row[21],
                vendor1Rate: row[22],
                vendor1Terms: row[23],
                vendor1DeliveryDate: row[24],
                vendor1WarrantyType: row[25],
                vendor1WarrantyFrom: row[26],
                vendor1WarrantyTo: row[27],
                vendor1Attachment: row[28],

                // Vendor 2
                vendor2Name: row[29],
                vendor2Rate: row[30],
                vendor2Terms: row[31],
                vendor2DeliveryDate: row[32],
                vendor2WarrantyType: row[33],
                vendor2WarrantyFrom: row[34],
                vendor2WarrantyTo: row[35],
                vendor2Attachment: row[36],

                // Vendor 3
                vendor3Name: row[37],
                vendor3Rate: row[38],
                vendor3Terms: row[39],
                vendor3DeliveryDate: row[40],
                vendor3WarrantyType: row[41],
                vendor3WarrantyFrom: row[42],
                vendor3WarrantyTo: row[43],
                vendor3Attachment: row[44],

                // Stage 4 Data (Negotiation)
                planned3: row[45],
                actual3: row[46],
                selectedVendor: row[47],
                finalApprovedBy: row[48],
                negotiationRemarks: row[49],
                delay3: row[50],

                // Stage 5 Data (PO) - USER Mapping
                planned4: row[51],      // AZ (Index 51)
                actual4: row[52],       // BA (Index 52)
                poNumber: row[54],      // BC (Index 54)
                basicValue: row[55],    // BD (Index 55)
                totalWithTax: row[56],  // BE (Index 56)
                paymentTerms: row[57],  // BF (Index 57)
                poCopy: row[58],        // BG (Index 58)
                poRemarks: row[59],     // BH (Index 59)
                // BG (Index 58)
              }
            };
          });
        setSheetRecords(rows);
      }
    } catch (e) {
      console.error("Fetch error Stage 5:", e);
    }
    setIsLoading(false);
  };

  React.useEffect(() => {
    fetchData();
  }, []);

  const pending = sheetRecords.filter((r) => r.status === "pending");
  const completed = sheetRecords.filter((r) => r.status === "completed");

  const baseColumns = [
    { key: "indentNumber", label: "Indent #", icon: null },
    { key: "itemName", label: "Item", icon: null },
    { key: "quantity", label: "Qty", icon: null },
  ];

  const [selectedColumns, setSelectedColumns] = useState<string[]>(
    baseColumns.map((c) => c.key)
  );

  const paymentTermsList = [
    { value: "15", label: "15 days" },
    { value: "30", label: "30 days" },
    { value: "60", label: "60 days" },
    { value: "90", label: "90 days" },
    { value: "advance", label: "Advance" },
    { value: "PI", label: "PI (Proforma Invoice)" },
  ];

  const handleOpenBulkForm = () => {
    if (selectedRecordIds.length === 0) return;

    const initialData: Record<string, any> = {};
    selectedRecordIds.forEach((id) => {
      const record = sheetRecords.find((r) => r.id === id);
      const vendorData = record ? getVendorData(record) : { rate: 0 };
      const rate = parseFloat(vendorData.rate) || 0;
      const quantity = parseFloat(record?.data?.quantity) || 0;
      const basicValue = (rate * quantity).toFixed(2);

      initialData[id] = {
        basicValue: basicValue,
        totalWithTax: basicValue, // Initially same until tax selected
        hsn: "",        // renamed from paymentTerms
        gst: "",        // new dropdown (replaces remarks)
      };
    });
    setBulkFormData(initialData);
    setCommonPONumber("");
    setCommonPOCopy(null);
    setOpen(true);
  };

  const handleBulkSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const SHEET_API_URL = process.env.NEXT_PUBLIC_API_URI;
    if (!SHEET_API_URL || selectedRecordIds.length === 0) return;

    // Validate shared PO Number
    if (!commonPONumber.trim()) {
      toast.error("Please enter the PO Number.");
      return;
    }

    let allValid = true;
    selectedRecordIds.forEach((id) => {
      const data = bulkFormData[id];
      if (!data || !data.basicValue || !data.totalWithTax || !data.hsn || !data.gst) {
        allValid = false;
      }
    });

    if (!allValid) {
      toast.error("Please fill all required fields for selected records.");
      return;
    }

    setIsSubmitting(true);
    setSubmitError(null);

    // Capture current state for processing
    const recordsToProcess = selectedRecordIds.map((id) => {
      const record = sheetRecords.find((r) => r.id === id);
      const data = bulkFormData[id];
      return { record, data };
    }).filter((item) => item.record);

    const processPromise = (async () => {
      try {
        const now = new Date();
        let successCount = 0;
        let finalFileUrl = "";

        // Upload shared PO Copy ONCE before processing all records
        if (commonPOCopy instanceof File) {
          const toBase64 = (file: File) => new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = () => resolve(reader.result as string);
            reader.onerror = error => reject(error);
          });

          const base64Data = await toBase64(commonPOCopy);

          const uploadParams = new URLSearchParams();
          uploadParams.append("action", "uploadFile");
          uploadParams.append("sheetName", "INDENT-LIFT");
          uploadParams.append("base64Data", base64Data);
          uploadParams.append("fileName", commonPOCopy.name);
          uploadParams.append("mimeType", commonPOCopy.type);
          const folderId = process.env.NEXT_PUBLIC_IMAGE_FOLDER_ID || "1SihRrPrgbuPGm-09fuB180QJhdxq5Nxy";
          uploadParams.append("folderId", folderId);

          const uploadRes = await fetch(SHEET_API_URL, {
            method: "POST",
            body: uploadParams,
          });

          const uploadJson = await uploadRes.json();
          if (uploadJson.success) {
            finalFileUrl = uploadJson.fileUrl || uploadJson.url;
          } else {
            console.error("PO Copy upload failed:", uploadJson.error);
          }
        }

        for (const { record, data } of recordsToProcess) {
          if (!record) continue;

          // Add a small delay between records for network stability
          await new Promise((r) => setTimeout(r, 300));

          try {
            // Prepare Update Data - Only update specific columns
            const rowArray = new Array(60).fill("");

            // Format current date as YYYY-MM-DD
            const yyyy = now.getFullYear();
            const mm = String(now.getMonth() + 1).padStart(2, "0");
            const dd = String(now.getDate()).padStart(2, "0");

            // Only update the required columns
            rowArray[52] = `${yyyy}-${mm}-${dd}`;                  // BA: Current Date (Actual 4)
            // BB (Index 53) - User requested skip
            rowArray[54] = commonPONumber;                         // BC: PO Number (shared)
            rowArray[55] = data.basicValue;                        // BD: Basic Value
            rowArray[56] = data.totalWithTax;                      // BE: Total with Tax
            rowArray[57] = data.hsn;                               // BF: HSN (renamed from Payment Terms)
            rowArray[58] = finalFileUrl;                           // BG: PO Copy URL (shared)
            rowArray[59] = data.gst || "";                         // BH: GST (replaces Remarks)


            const updateParams = new URLSearchParams();
            updateParams.append("action", "update");
            updateParams.append("sheetName", "INDENT-LIFT");
            updateParams.append("rowIndex", record.rowIndex.toString());
            updateParams.append("rowData", JSON.stringify(rowArray));

            const updateRes = await fetch(SHEET_API_URL, {
              method: "POST",
              body: updateParams,
            });

            const updateResult = await updateRes.json();
            if (updateResult.success) {
              successCount++;
            } else {
              throw new Error(updateResult.error || "Update failed");
            }
          } catch (err: any) {
            console.error(`Error processing record ${record.id}:`, err);
            throw new Error(`Record ${record.id}: ${err.message}`);
          }
        }

        await fetchData();
        setOpen(false);
        setSelectedRecordIds([]);
        setBulkFormData({});
        return { successCount, total: recordsToProcess.length };
      } finally {
        setIsSubmitting(false);
      }
    })();

    toast.promise(processPromise, {
      loading: `Processing ${recordsToProcess.length} POs...`,
      success: (data) => `Successfully processed ${data.successCount} of ${data.total} POs.`,
      error: (err) => `Error during bulk processing: ${err.message}`,
    });
  };

  const handleCommonFileChange = (file: File | null) => {
    setCommonPOCopy(file);
  };

  const handleCommonFileRemove = () => {
    setCommonPOCopy(null);
  };

  const getVendorData = (record: any) => {
    const selectedId = record.data.selectedVendor || "vendor1";
    const idx = parseInt(selectedId.replace("vendor", ""), 10) || 1;
    return {
      name: record.data[`vendor${idx}Name`] || "-",
      rate: record.data[`vendor${idx}Rate`],
      terms: record.data[`vendor${idx}Terms`],
      delivery: record.data[`vendor${idx}DeliveryDate`],
      warrantyType: record.data[`vendor${idx}WarrantyType`],
      attachment: record.data[`vendor${idx}Attachment`],
      approvedBy: record.data.approvedBy || "Auto-Approved",
    };
  };

  const toggleSelectAll = () => {
    if (selectedRecordIds.length === pending.length) {
      setSelectedRecordIds([]);
    } else {
      setSelectedRecordIds(pending.map((r) => r.id));
    }
  };

  const toggleSelectOne = (id: string) => {
    setSelectedRecordIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const ColumnSelector = () => (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" className="w-64 justify-start">
          {selectedColumns.length === baseColumns.length
            ? "All columns"
            : `${selectedColumns.length} column${selectedColumns.length > 1 ? "s" : ""} selected`}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-2">
        <div className="space-y-2">
          <div className="flex items-center space-x-2 pb-2 border-b">
            <Checkbox
              checked={selectedColumns.length === baseColumns.length}
              onCheckedChange={(c) => {
                if (c) setSelectedColumns(baseColumns.map((col) => col.key));
                else setSelectedColumns([]);
              }}
            />
            <Label className="text-sm font-medium">All Columns</Label>
          </div>
          {baseColumns.map((col) => (
            <div key={col.key} className="flex items-center space-x-2 py-1">
              <Checkbox
                checked={selectedColumns.includes(col.key)}
                onCheckedChange={(checked) => {
                  if (checked) {
                    setSelectedColumns((prev) => [...prev, col.key]);
                  } else {
                    setSelectedColumns((prev) => prev.filter((c) => c !== col.key));
                  }
                }}
              />
              <Label className="text-sm">{col.label}</Label>
            </div>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-6 p-6 bg-gradient-to-br from-slate-50 to-white border border-slate-200 rounded-xl shadow-sm">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-slate-900 rounded-lg shadow-slate-100 shadow-xl text-white">
              <FileText className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Stage 5: PO Creation</h2>
                {isLoading && <Loader2 className="w-5 h-5 text-black animate-spin" />}
              </div>
              <p className="text-slate-500 font-medium text-sm">
                Generate and attach purchase orders
              </p>
              {submitError && (
                <p className="text-red-600 text-sm mt-2 font-medium bg-red-50 p-2 rounded border border-red-100 flex items-center gap-2">
                  <span className="w-2 h-2 bg-red-600 rounded-full animate-pulse" />
                  {submitError}
                </p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-4">
            <Label className="text-sm font-medium">Show Columns:</Label>
            <ColumnSelector />
          </div>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)}>
        <TabsList className="bg-slate-100/50 p-1 rounded-xl h-auto grid grid-cols-2 gap-1 border border-slate-200/50">
          <TabsTrigger
            value="pending"
            className="text-base py-3 px-6 rounded-lg data-[state=active]:bg-white data-[state=active]:text-black data-[state=active]:shadow-sm flex items-center gap-3 transition-all"
          >
            <ClipboardList className="w-5 h-5" />
            <div className="flex flex-col items-start leading-none gap-1">
              <span className="font-bold">Pending</span>
              <span className="text-[10px] opacity-70">Awaiting processing</span>
            </div>
            <Badge variant="secondary" className="bg-slate-100 text-black border-slate-200 px-2">
              {pending.length}
            </Badge>
          </TabsTrigger>
          <TabsTrigger
            value="history"
            className="text-base py-3 px-6 rounded-lg data-[state=active]:bg-white data-[state=active]:text-black data-[state=active]:shadow-sm flex items-center gap-3 transition-all"
          >
            <History className="w-5 h-5" />
            <div className="flex flex-col items-start leading-none gap-1">
              <span className="font-bold">History</span>
              <span className="text-[10px] opacity-70">Completed</span>
            </div>
            <Badge variant="secondary" className="bg-slate-100 text-black border-slate-200 px-2">
              {completed.length}
            </Badge>
          </TabsTrigger>
        </TabsList>

        {/* PENDING */}
        <TabsContent value="pending" className="mt-6">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-24 bg-white border rounded-lg shadow-sm">
              <Loader2 className="w-12 h-12 animate-spin text-black mb-4" />
              <p className="text-lg font-medium text-gray-900">Loading...</p>
            </div>
          ) : pending.length === 0 ? (
            <div className="text-center py-12 text-gray-500 border rounded-lg bg-gray-50">
              <p className="text-lg">No pending PO entries</p>
              <p className="text-sm mt-1">All purchase orders are created!</p>
            </div>
          ) : (
            <>
              <div className="mb-4 flex items-center justify-between">
                <p className="text-sm text-gray-600">
                  {selectedRecordIds.length} item{selectedRecordIds.length !== 1 ? "s" : ""} selected
                </p>
                <Button
                  onClick={handleOpenBulkForm}
                  disabled={selectedRecordIds.length === 0}
                  size="sm"
                >
                  Create PO for Selected
                </Button>
              </div>

              <div className="border rounded-lg overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12">
                        <Checkbox
                          checked={selectedRecordIds.length === pending.length && pending.length > 0}
                          onCheckedChange={toggleSelectAll}
                        />
                      </TableHead>
                      {baseColumns
                        .filter((c) => selectedColumns.includes(c.key))
                        .map((col) => (
                          <TableHead key={col.key}>{col.label}</TableHead>
                        ))}
                      <TableHead>Vendor</TableHead>
                      <TableHead>Rate/Qty</TableHead>
                      <TableHead>Payment Terms</TableHead>
                      <TableHead>Exp. Delivery</TableHead>
                      <TableHead>Warranty</TableHead>
                      <TableHead>Attachment</TableHead>
                      <TableHead>Approved By</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pending.map((record) => {
                      const v = getVendorData(record);
                      const isSelected = selectedRecordIds.includes(record.id);
                      return (
                        <TableRow
                          key={record.id}
                          className={isSelected ? "bg-blue-50" : ""}
                        >
                          <TableCell>
                            <Checkbox
                              checked={isSelected}
                              onCheckedChange={() => toggleSelectOne(record.id)}
                            />
                          </TableCell>
                          {baseColumns
                            .filter((c) => selectedColumns.includes(c.key))
                            .map((col) => (
                              <TableCell key={col.key}>{record.data[col.key] || "-"}</TableCell>
                            ))}
                          <TableCell className="font-medium">{v.name}</TableCell>
                          <TableCell>₹{v.rate || "-"}</TableCell>
                          <TableCell>
                            {paymentTermsList.find((t) => t.value === v.terms)?.label || v.terms || "-"}
                          </TableCell>
                          <TableCell>
                            {v.delivery ? new Date(v.delivery).toLocaleDateString("en-IN") : "-"}
                          </TableCell>
                          <TableCell>
                            {v.warrantyType ? (
                              <div className="flex items-center gap-1 text-xs">
                                {v.warrantyType === "warranty" ? (
                                  <Shield className="w-3.5 h-3.5 text-blue-600" />
                                ) : (
                                  <ShieldCheck className="w-3.5 h-3.5 text-green-600" />
                                )}
                                <span className="capitalize">{v.warrantyType}</span>
                              </div>
                            ) : (
                              "-"
                            )}
                          </TableCell>
                          <TableCell>
                            {v.attachment ? (
                              <a
                                href={typeof v.attachment === 'string' ? v.attachment : undefined}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-1 text-blue-600 hover:underline text-xs"
                              >
                                <FileText className="w-3.5 h-3.5" />
                                <span className="truncate max-w-20">
                                  {typeof v.attachment === 'string' ? "View File" : (v.attachment as any).name}
                                </span>
                              </a>
                            ) : (
                              "-"
                            )}
                          </TableCell>
                          <TableCell>{v.approvedBy}</TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </>
          )}
        </TabsContent>

        {/* HISTORY */}
        <TabsContent value="history" className="mt-6">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-24 bg-white border rounded-lg shadow-sm">
              <Loader2 className="w-12 h-12 animate-spin text-black mb-4" />
              <p className="text-lg font-medium text-gray-900">Loading History...</p>
              <p className="text-sm text-gray-500 mt-1">Fetching completed orders</p>
            </div>
          ) : completed.length === 0 ? (
            <div className="text-center py-12 text-gray-500 border rounded-lg bg-gray-50">
              <p className="text-lg">No completed POs</p>
            </div>
          ) : (
            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Item Details</TableHead>
                    <TableHead>Vendor Info</TableHead>
                    <TableHead>Terms & Delivery</TableHead>
                    <TableHead>Warranty/Quot.</TableHead>
                    <TableHead>Approved By</TableHead>
                    <TableHead>PO Details</TableHead>
                    <TableHead>Financials (₹)</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {completed.map((record) => {
                    const v = getVendorData(record);
                    return (
                      <TableRow key={record.id} className="bg-green-50/50 hover:bg-green-100/50">
                        <TableCell className="max-w-[200px]">
                          <div className="space-y-1">
                            <div className="font-semibold text-blue-900">#{record.data.indentNumber || "-"}</div>
                            <div className="text-sm font-medium truncate" title={record.data.itemName}>{record.data.itemName}</div>
                            <div className="text-xs text-gray-500">Qty: {record.data.quantity}</div>
                          </div>
                        </TableCell>

                        <TableCell>
                          <div className="space-y-1">
                            <div className="font-medium text-gray-900">{v.name}</div>
                            <div className="text-xs text-gray-500">Rate: ₹{v.rate || "-"}</div>
                          </div>
                        </TableCell>

                        <TableCell>
                          <div className="space-y-1 text-sm">
                            <div className="flex items-center gap-1">
                              <span className="text-xs text-gray-500">Terms:</span>
                              <span>{paymentTermsList.find((t) => t.value === v.terms)?.label || v.terms || "-"}</span>
                            </div>
                            <div className="flex items-center gap-1">
                              <span className="text-xs text-gray-500">Delivery:</span>
                              <span className={!v.delivery ? "text-gray-400" : ""}>
                                {v.delivery ? formatDate(parseSheetDate(v.delivery)) : "-"}
                              </span>
                            </div>
                          </div>
                        </TableCell>

                        <TableCell>
                          <div className="space-y-1">
                            {v.warrantyType ? (
                              <div className="flex items-center gap-1 text-xs">
                                {v.warrantyType === "warranty" ? (
                                  <Shield className="w-3.5 h-3.5 text-blue-600" />
                                ) : (
                                  <ShieldCheck className="w-3.5 h-3.5 text-green-600" />
                                )}
                                <span className="capitalize">{v.warrantyType}</span>
                              </div>
                            ) : (
                              <span className="text-xs text-gray-400">-</span>
                            )}
                            {v.attachment && (
                              <a
                                href={typeof v.attachment === 'string' ? v.attachment : undefined}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-1 text-blue-600 hover:underline text-[10px]"
                              >
                                <FileText className="w-3 h-3" />
                                <span>Quot.</span>
                              </a>
                            )}
                          </div>
                        </TableCell>

                        <TableCell>
                          <div className="space-y-1 text-[11px]">
                            <div className="flex flex-col">
                              <span className="text-gray-400">Approved:</span>
                              <span className="font-medium truncate max-w-[100px]">{v.approvedBy}</span>
                            </div>
                          </div>
                        </TableCell>

                        <TableCell className="bg-white/50">
                          <div className="space-y-1">
                            <div className="font-mono text-sm font-bold text-green-700">{record.data.poNumber || "-"}</div>
                            {record.data.poCopy && (
                              <a
                                href={typeof record.data.poCopy === 'string' ? record.data.poCopy : undefined}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-1 text-green-600 hover:underline text-[11px]"
                              >
                                <FileText className="w-3.5 h-3.5" />
                                <span>View PO Copy</span>
                              </a>
                            )}
                          </div>
                        </TableCell>

                        <TableCell className="bg-white/50">
                          <div className="space-y-1 text-sm">
                            <div className="flex justify-between gap-4">
                              <span className="text-xs text-gray-500">Basic:</span>
                              <span className="font-medium">₹{record.data.basicValue || "-"}</span>
                            </div>
                            <div className="flex justify-between gap-4 border-t pt-1">
                              <span className="text-xs text-gray-500 font-semibold">Total:</span>
                              <span className="font-bold text-green-800">₹{record.data.totalWithTax || "-"}</span>
                            </div>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* BULK PO MODAL */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-5xl max-h-[90vh] flex flex-col">
          <DialogHeader className="flex-shrink-0">
            <DialogTitle>Bulk PO Creation ({selectedRecordIds.length} items)</DialogTitle>
            <p className="text-sm text-gray-600">Fill PO details for all selected items</p>
          </DialogHeader>

          <form onSubmit={handleBulkSubmit} className="flex-1 overflow-y-auto space-y-6 pr-2">
            {/* SHARED PO NUMBER - AT TOP */}
            <div className="border rounded-lg p-4 bg-blue-50">
              <div className="space-y-2">
                <Label htmlFor="common-poNumber" className="text-base font-semibold">
                  PO Number <span className="text-red-500">*</span>
                  <span className="text-xs font-normal text-gray-500 ml-2">(applies to all items)</span>
                </Label>
                <Input
                  id="common-poNumber"
                  value={commonPONumber}
                  onChange={(e) => setCommonPONumber(e.target.value)}
                  required
                  placeholder="PO-2025-001"
                  className="bg-white"
                />
              </div>
            </div>

            {/* PER-ITEM SECTIONS */}
            {selectedRecordIds.map((recordId) => {
              const record = sheetRecords.find((r) => r.id === recordId);
              if (!record) return null;
              const v = getVendorData(record);
              const data = bulkFormData[recordId] || {};

              return (
                <div key={recordId} className="border rounded-lg p-4 bg-gray-50">
                  <div className="mb-4 pb-3 border-b">
                    <div className="grid grid-cols-3 gap-2 text-sm">
                      <div><strong>Indent #:</strong> {record.data.indentNumber}</div>
                      <div><strong>Item:</strong> {record.data.itemName}</div>
                      <div><strong>Qty:</strong> {record.data.quantity}</div>
                    </div>
                    <div className="mt-1 text-xs text-gray-600">
                      Vendor: <span className="font-medium">{v.name}</span> | Rate: ₹{v.rate}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor={`${recordId}-basicValue`}>
                        Basic Value <span className="text-red-500">*</span>
                      </Label>
                      <Input
                        id={`${recordId}-basicValue`}
                        type="number"
                        step="0.01"
                        value={data.basicValue || ""}
                        readOnly
                        className="bg-gray-100 cursor-not-allowed"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor={`${recordId}-gst`}>
                        GST <span className="text-red-500">*</span>
                      </Label>
                      <Select
                        value={data.gst || ""}
                        onValueChange={(val) => {
                          const basic = parseFloat(data.basicValue) || 0;
                          let taxRate = 0;
                          if (val === "5%") taxRate = 0.05;
                          if (val === "12%") taxRate = 0.12;
                          if (val === "18%") taxRate = 0.18;
                          if (val === "28%") taxRate = 0.28;

                          const total = (basic + (basic * taxRate)).toFixed(2);

                          setBulkFormData((prev) => ({
                            ...prev,
                            [recordId]: {
                              ...prev[recordId],
                              gst: val,
                              totalWithTax: total
                            },
                          }))
                        }}
                      >
                        <SelectTrigger id={`${recordId}-gst`}>
                          <SelectValue placeholder="Select GST" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="5%">5%</SelectItem>
                          <SelectItem value="12%">12%</SelectItem>
                          <SelectItem value="18%">18%</SelectItem>
                          <SelectItem value="28%">28%</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor={`${recordId}-totalWithTax`}>
                        Total With Tax <span className="text-red-500">*</span>
                      </Label>
                      <Input
                        id={`${recordId}-totalWithTax`}
                        type="number"
                        step="0.01"
                        value={data.totalWithTax || ""}
                        readOnly
                        className="bg-gray-100 cursor-not-allowed"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor={`${recordId}-hsn`}>
                        HSN <span className="text-red-500">*</span>
                      </Label>
                      <Input
                        id={`${recordId}-hsn`}
                        value={data.hsn || ""}
                        onChange={(e) =>
                          setBulkFormData((prev) => ({
                            ...prev,
                            [recordId]: { ...prev[recordId], hsn: e.target.value },
                          }))
                        }
                        required
                        placeholder="HSN Code"
                      />
                    </div>


                  </div>
                </div>
              );
            })}

            {/* SHARED PO COPY - AT BOTTOM */}
            <div className="border rounded-lg p-4 bg-blue-50">
              <div className="space-y-2">
                <Label className="text-base font-semibold">
                  PO Copy
                  <span className="text-xs font-normal text-gray-500 ml-2">(applies to all items)</span>
                </Label>
                <div>
                  <input
                    type="file"
                    accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                    onChange={(e) => handleCommonFileChange(e.target.files?.[0] || null)}
                    className="hidden"
                    id="common-file"
                  />
                  <label
                    htmlFor="common-file"
                    className="flex items-center justify-center w-full p-3 border-2 border-dashed border-gray-300 bg-white rounded-lg cursor-pointer hover:border-gray-400 text-sm"
                  >
                    <Upload className="w-4 h-4 mr-2" />
                    Upload PO copy
                  </label>
                  {commonPOCopy && (
                    <div className="mt-2 p-2 bg-white border rounded flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2">
                        <FileText className="w-4 h-4" />
                        <span>{commonPOCopy.name}</span>
                        <span className="text-gray-500">
                          ({(commonPOCopy.size / 1024).toFixed(1)} KB)
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={handleCommonFileRemove}
                        className="text-red-600"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </form>

          <DialogFooter className="flex-shrink-0 border-t pt-4">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleBulkSubmit}
              disabled={
                isSubmitting ||
                selectedRecordIds.length === 0 ||
                !commonPONumber.trim() ||
                !selectedRecordIds.every((id) => {
                  const d = bulkFormData[id];
                  return d?.basicValue && d?.totalWithTax && d?.hsn && d?.gst;
                })
              }
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Creating POs...
                </>
              ) : (
                `Create ${selectedRecordIds.length} PO${selectedRecordIds.length > 1 ? "s" : ""}`
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}