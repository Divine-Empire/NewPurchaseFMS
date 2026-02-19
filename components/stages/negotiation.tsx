"use client";

import React, { useState } from "react";
import { useWorkflow } from "@/lib/workflow-context";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CheckCircle2, FileText, Image, Shield, ShieldCheck, Loader2, Users, ClipboardList, History, Square, CheckSquare, Search } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

export default function Stage4() {
  const { moveToNextStage, updateRecord } = useWorkflow();
  const [open, setOpen] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"pending" | "history">("pending");
  const [currentRecord, setCurrentRecord] = useState<any>(null);
  const [sheetRecords, setSheetRecords] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Bulk Negotiate State
  const [selectedIndents, setSelectedIndents] = useState<string[]>([]);
  const [bulkModalOpen, setBulkModalOpen] = useState(false);
  const [bulkRecords, setBulkRecords] = useState<any[]>([]);

  const [formData, setFormData] = useState({
    selectedVendor: "",
    approvedBy: "",
    remarks: "",
  });

  const [approverList, setApproverList] = useState<string[]>([]);



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
          .filter(({ row }: any) => row[1] && String(row[1]).trim() !== "") // CHECK COL B (Index 1) for Indent ID
          .map(({ row, originalIndex }: any) => {
            // Stage 3 completion check: Plan 2 and Actual 2 (Indices 18, 19)
            const isStage3Done =
              (!!row[18] && String(row[18]).trim() !== "" && String(row[18]).trim() !== "-") &&
              (!!row[19] && String(row[19]).trim() !== "" && String(row[19]).trim() !== "-");

            // Stage 4 completion check based on User Request
            // Plan 3 (Index 45) and Actual 3 (Index 46)
            const hasPlan3 = !!row[45] && String(row[45]).trim() !== "" && String(row[45]).trim() !== "-";
            const hasActual3 = !!row[46] && String(row[46]).trim() !== "" && String(row[46]).trim() !== "-";

            return {
              id: row[1] || `row-${originalIndex}`, // CHECK COL B (Index 1)
              rowIndex: originalIndex,
              stage: 4,
              status: (hasPlan3 && hasActual3) ? "completed" : (hasPlan3 && !hasActual3 ? "pending" : "not_ready"),
              createdAt: parseSheetDate(row[0]), // Index 0 is Timestamp
              history: (hasPlan3 && hasActual3) ? [{ stage: 4, date: parseSheetDate(row[46] || row[45] || row[0]), data: {} }] : [],
              data: {
                indentNumber: row[1],     // Col B
                timestamp: row[0],        // Col A
                createdBy: row[2],
                category: row[3],
                itemName: row[4],
                quantity: row[14], // O: Qty (was F:5)
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

                // Stage 4 Data (Safe Mapping)
                planned3: row[45],           // AT
                actual3: row[46],            // AU
                selectedVendor: row[47],     // AV
                selectedVendorName: row[48], // AW
                finalApprovedBy: row[49],    // AX
                negotiationRemarks: row[50], // AY
                delay3: row[51],             // AZ

                // Stage 5 Data (PO Number) for Search
                poNumber: row[54], // Maps to BC (Index 54)
              }
            };
          });
        setSheetRecords(rows);
      }

      // Fetch Dropdown sheet for Approvers (Column I / Index 8)
      const dropRes = await fetch(`${SHEET_API_URL}?sheet=Dropdown&action=getAll`);
      const dropJson = await dropRes.json();
      if (dropJson.success && Array.isArray(dropJson.data)) {
        const approvers = dropJson.data.slice(1)
          .map((row: any) => String(row[8] || "").trim())
          .filter((a: string) => a !== "");
        setApproverList(approvers);
      }

    } catch (e) {
      console.error("Fetch error Stage 4:", e);
    }
    setIsLoading(false);
  };

  React.useEffect(() => {
    fetchData();
  }, []);

  const [searchTerm, setSearchTerm] = useState("");

  const pending = sheetRecords
    .filter((r) => r.status === "pending")
    .filter((r) => {
      const searchLower = searchTerm.toLowerCase();
      // Combine relevant fields for search
      // Note: 'vendor1Name' etc might not be the 'Selected Vendor'.
      // Usually users search by Indent, Item, or the vendor they are negotiating with.
      // But let's include all 3 vendors just in case, plus Selected Vendor.
      return (
        r.data.indentNumber?.toLowerCase().includes(searchLower) ||
        r.data.itemName?.toLowerCase().includes(searchLower) ||
        r.data.selectedVendor?.toLowerCase().includes(searchLower) ||
        r.data.selectedVendorName?.toLowerCase().includes(searchLower) ||
        r.data.vendor1Name?.toLowerCase().includes(searchLower) ||
        r.data.vendor2Name?.toLowerCase().includes(searchLower) ||
        r.data.vendor3Name?.toLowerCase().includes(searchLower) ||
        r.data.vendor3Name?.toLowerCase().includes(searchLower) ||
        String(r.data.poNumber || "").toLowerCase().includes(searchLower) // Added PO Number search
      );
    });
  const completed = sheetRecords
    .filter((r) => r.status === "completed")
    .filter((r) => {
      const searchLower = searchTerm.toLowerCase();
      if (!searchLower) return true;
      return (
        r.data.indentNumber?.toLowerCase().includes(searchLower) ||
        r.data.itemName?.toLowerCase().includes(searchLower) ||
        r.data.vendor1Name?.toLowerCase().includes(searchLower) ||
        r.data.vendor2Name?.toLowerCase().includes(searchLower) ||
        r.data.vendor3Name?.toLowerCase().includes(searchLower) ||
        String(r.data.poNumber || "").toLowerCase().includes(searchLower)
      );
    });

  const baseColumns = [
    { key: "indentNumber", label: "Indent #", icon: null },
    { key: "itemName", label: "Item", icon: null },
    { key: "quantity", label: "Qty", icon: null },
  ];

  const [selectedColumns, setSelectedColumns] = useState<string[]>(
    baseColumns.map((c) => c.key)
  );

  const paymentTerms = [
    { value: "15", label: "15 days" },
    { value: "30", label: "30 days" },
    { value: "60", label: "60 days" },
    { value: "90", label: "90 days" },
    { value: "advance", label: "Advance" },
    { value: "PI", label: "PI (Proforma Invoice)" },
  ];

  const handleOpenForm = (recordId: string) => {
    const record = sheetRecords.find((r) => r.id === recordId);
    if (!record) return;

    setSelectedRecord(recordId);
    setCurrentRecord(record);
    setFormData({ selectedVendor: "", approvedBy: "", remarks: "" });

    // If only one vendor exists, consider auto-selecting it (optional logic)
    // For now, keep it manual as requested by the negotiation flow
    setOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentRecord || !formData.selectedVendor || !formData.approvedBy) return;

    const SHEET_API_URL = process.env.NEXT_PUBLIC_API_URI;
    if (!SHEET_API_URL) return;

    setIsSubmitting(true);
    setSubmitError(null);

    try {
      const now = new Date();
      const yyyy = now.getFullYear();
      const mm = String(now.getMonth() + 1).padStart(2, "0");
      const dd = String(now.getDate()).padStart(2, "0");

      // FIX: Start with empty strings to prevent overwriting/reformatting existing cells
      // Only update columns AU (46), AV (47), AW (48), AX (49), AY (50)
      const rowArray = new Array(60).fill("");

      const params = new URLSearchParams();
      params.append("action", "update");
      params.append("sheetName", "INDENT-LIFT");
      params.append("rowIndex", currentRecord.rowIndex.toString());

      // Update ONLY the required Negotiation Fields
      const currentVendors = getVendors(currentRecord);
      const selectedVendorObj = currentVendors.find(v => v && v.id === formData.selectedVendor);
      const selectedVendorName = selectedVendorObj ? selectedVendorObj.name : "";

      rowArray[46] = `${yyyy}-${mm}-${dd}`;       // AU: Current Date (YYYY-MM-DD)
      // Index 47 is AV - User requested NOT to submit data here
      rowArray[48] = selectedVendorName;         // AW: Vendor Name
      rowArray[49] = formData.approvedBy;        // AX: Approved By
      rowArray[50] = formData.remarks;           // AY: Negotiation Remarks

      params.append("rowData", JSON.stringify(rowArray));

      console.log("Submitting Stage 4 (Full Row Merge):", Object.fromEntries(params.entries()));

      const response = await fetch(SHEET_API_URL, {
        method: "POST",
        body: params,
      });

      if (!response.ok) throw new Error("Update failed");

      const result = await response.json();
      if (result.success) {
        await fetchData();
        resetForm();
      } else {
        throw new Error(result.error || "Unknown error");
      }
    } catch (err: any) {
      console.error("Stage 4 Submit Error:", err);
      setSubmitError(err.message || "Something went wrong during submission");
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetForm = () => {
    setOpen(false);
    setSelectedRecord(null);
    setCurrentRecord(null);
    setFormData({ selectedVendor: "", approvedBy: "", remarks: "" });
  };

  const getVendors = (record: any) => {
    return Array.from({ length: 3 }, (_, i) => {
      const idx = i + 1;
      const name = record.data[`vendor${idx}Name`];
      if (!name) return null;
      return {
        id: `vendor${idx}`,
        name,
        rate: record.data[`vendor${idx}Rate`],
        terms: record.data[`vendor${idx}Terms`],
        delivery: record.data[`vendor${idx}DeliveryDate`],
        warrantyType: record.data[`vendor${idx}WarrantyType`],
        warrantyFrom: record.data[`vendor${idx}WarrantyFrom`],
        warrantyTo: record.data[`vendor${idx}WarrantyTo`],
        attachment: record.data[`vendor${idx}Attachment`],
      };
    }).filter(Boolean);
  };

  // Bulk Negotiate Helper Functions
  const toggleIndentSelection = (indentId: string) => {
    setSelectedIndents(prev =>
      prev.includes(indentId)
        ? prev.filter(id => id !== indentId)
        : [...prev, indentId]
    );
  };

  const getCommonVendors = (records: any[]) => {
    if (records.length === 0) return [];

    // Get vendor names for each record
    const vendorNameSets = records.map(record => {
      const vendors = getVendors(record);
      return vendors.map((v: any) => v?.name).filter(Boolean);
    });

    // Find intersection of all vendor names
    const commonNames = vendorNameSets.reduce((acc, names) =>
      acc.filter(name => names.includes(name))
    );

    // Return unique vendor objects from first record that match common names (for radio selection)
    const firstRecordVendors = getVendors(records[0]);
    return firstRecordVendors.filter((v: any) => v && commonNames.includes(v.name));
  };

  // Get all vendors from ALL records for the comparison table
  const getAllVendorsForComparison = (records: any[]) => {
    if (records.length === 0) return [];

    // Get common vendor names first
    const vendorNameSets = records.map(record => {
      const vendors = getVendors(record);
      return vendors.map((v: any) => v?.name).filter(Boolean);
    });
    const commonNames = vendorNameSets.reduce((acc, names) =>
      acc.filter(name => names.includes(name))
    );

    // Collect vendors from ALL records, adding indent info for display
    const allVendors: any[] = [];
    records.forEach(record => {
      const vendors = getVendors(record);
      vendors.forEach((v: any) => {
        if (v && commonNames.includes(v.name)) {
          allVendors.push({
            ...v,
            indentNumber: record.data?.indentNumber || record.id,
          });
        }
      });
    });
    return allVendors;
  };

  const handleOpenBulkModal = () => {
    const records = selectedIndents.map(id => sheetRecords.find(r => r.id === id)).filter(Boolean);
    setBulkRecords(records);
    setFormData({ selectedVendor: "", approvedBy: "", remarks: "" });
    setBulkModalOpen(true);
  };

  const handleBulkSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (bulkRecords.length === 0 || !formData.selectedVendor || !formData.approvedBy) return;

    const SHEET_API_URL = process.env.NEXT_PUBLIC_API_URI;
    if (!SHEET_API_URL) return;

    setIsSubmitting(true);
    setSubmitError(null);

    try {
      const now = new Date();
      const yyyy = now.getFullYear();
      const mm = String(now.getMonth() + 1).padStart(2, "0");
      const dd = String(now.getDate()).padStart(2, "0");

      // Get selected vendor name from common vendors
      const commonVendors = getCommonVendors(bulkRecords);
      const selectedVendorObj = commonVendors.find((v: any) => v?.id === formData.selectedVendor);
      const selectedVendorName = selectedVendorObj ? selectedVendorObj.name : "";

      // Process each record sequentially
      for (const record of bulkRecords) {
        const rowArray = new Array(60).fill("");
        rowArray[46] = `${yyyy}-${mm}-${dd}`;       // AU: Current Date
        rowArray[48] = selectedVendorName;          // AW: Vendor Name
        rowArray[49] = formData.approvedBy;         // AX: Approved By
        rowArray[50] = formData.remarks;            // AY: Remarks

        const params = new URLSearchParams();
        params.append("action", "update");
        params.append("sheetName", "INDENT-LIFT");
        params.append("rowIndex", record.rowIndex.toString());
        params.append("rowData", JSON.stringify(rowArray));

        const response = await fetch(SHEET_API_URL, {
          method: "POST",
          body: params,
        });

        if (!response.ok) throw new Error(`Failed to update row ${record.id}`);

        const result = await response.json();
        if (!result.success) throw new Error(result.error || `Failed to update ${record.id}`);
      }

      // Success - refresh and reset
      await fetchData();
      setBulkModalOpen(false);
      setSelectedIndents([]);
      setBulkRecords([]);
      setFormData({ selectedVendor: "", approvedBy: "", remarks: "" });
    } catch (err: any) {
      console.error("Bulk Submit Error:", err);
      setSubmitError(err.message || "Bulk submission failed");
    } finally {
      setIsSubmitting(false);
    }
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

  const vendors = currentRecord ? getVendors(currentRecord) : [];

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-6 p-6 bg-gradient-to-br from-slate-50 to-white border border-slate-200 rounded-xl shadow-sm">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-slate-900 rounded-lg shadow-slate-100 shadow-xl text-white">
              <Users className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Stage 4: Vendor Negotiation</h2>
              <p className="text-slate-500 font-medium text-sm">
                Compare quotes and select the best vendor
              </p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            {isLoading && <Loader2 className="w-5 h-5 animate-spin text-black" />}
            <Label className="text-sm font-medium">Show Columns:</Label>
            <ColumnSelector />
          </div>
        </div>
      </div>

      {submitError && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 text-red-600 rounded-lg flex items-center gap-2">
          <span className="font-medium">Error:</span> {submitError}
        </div>
      )}

      {/* Search Filter */}
      <div className="mb-6 flex items-center gap-4 z-10 relative">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
          <Input
            placeholder="Search by Indent No, Item Name, Vendor..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9 bg-white shadow-sm border-slate-200 w-full"
          />
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
              <p className="text-lg">No pending negotiations</p>
              <p className="text-sm mt-1">All caught up!</p>
            </div>
          ) : (
            <div className="border rounded-lg overflow-hidden">
              {/* Bulk Negotiate Button - appears when >= 2 selected */}
              {selectedIndents.length >= 2 && (
                <div className="flex items-center justify-between p-3 bg-blue-50 border-b">
                  <span className="text-sm font-medium text-blue-800">
                    {selectedIndents.length} items selected
                  </span>
                  <Button
                    onClick={handleOpenBulkModal}
                    className="bg-blue-600 hover:bg-blue-700 text-white"
                  >
                    Bulk Negotiate
                  </Button>
                </div>
              )}
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[50px] text-center">Select</TableHead>
                    <TableHead className="sticky left-0 bg-white z-10 w-[120px]">Actions</TableHead>
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
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pending.map((record) => {
                    const vendors = getVendors(record);
                    const isSelected = selectedIndents.includes(record.id);
                    return vendors.map((v, idx) => {
                      if (!v) return null;
                      return (
                        <TableRow key={`${record.id}-v${idx + 1}`} className={isSelected ? "bg-blue-50" : ""}>
                          {idx === 0 && (
                            <TableCell rowSpan={vendors.length} className="text-center w-[50px]">
                              <button
                                type="button"
                                onClick={() => toggleIndentSelection(record.id)}
                                className="p-1 hover:bg-gray-100 rounded transition-colors"
                              >
                                {isSelected ? (
                                  <CheckSquare className="w-5 h-5 text-blue-600" />
                                ) : (
                                  <Square className="w-5 h-5 text-gray-400" />
                                )}
                              </button>
                            </TableCell>
                          )}
                          {idx === 0 && (
                            <TableCell rowSpan={vendors.length} className="sticky left-0 bg-white z-10 w-[120px]">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleOpenForm(record.id)}
                              >
                                Negotiate
                              </Button>
                            </TableCell>
                          )}
                          {idx === 0 && (
                            <>
                              {baseColumns
                                .filter((c) => selectedColumns.includes(c.key))
                                .map((col) => (
                                  <TableCell key={col.key} rowSpan={vendors.length}>
                                    {record.data[col.key] || "-"}
                                  </TableCell>
                                ))}
                            </>
                          )}
                          <TableCell>{v.name}</TableCell>
                          <TableCell>₹{v.rate || "-"}</TableCell>
                          <TableCell>
                            {paymentTerms.find((t) => t.value === v.terms)?.label || v.terms || "-"}
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
                                <span className="truncate max-w-24">
                                  {typeof v.attachment === 'string' ? "View Attachment" : (v.attachment as any).name}
                                </span>
                              </a>
                            ) : (
                              "-"
                            )}
                          </TableCell>

                        </TableRow>
                      );
                    });
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </TabsContent>

        {/* HISTORY */}
        <TabsContent value="history" className="mt-6">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-24 bg-white border rounded-lg shadow-sm">
              <Loader2 className="w-12 h-12 animate-spin text-black mb-4" />
              <p className="text-lg font-medium text-gray-900">Loading History...</p>
              <p className="text-sm text-gray-500 mt-1">Fetching completed records</p>
            </div>
          ) : completed.length === 0 ? (
            <div className="text-center py-12 text-gray-500 border rounded-lg bg-gray-50">
              <p className="text-lg">No completed negotiations</p>
            </div>
          ) : (
            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
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
                  {completed.map((record) => {
                    // Try to find which vendor index matches the name in AW
                    const selectedName = record.data.selectedVendorName;
                    let idx = 1;
                    if (selectedName === record.data.vendor2Name) idx = 2;
                    else if (selectedName === record.data.vendor3Name) idx = 3;

                    const v = {
                      name: record.data[`vendor${idx}Name`] || "-",
                      rate: record.data[`vendor${idx}Rate`],
                      terms: record.data[`vendor${idx}Terms`],
                      delivery: record.data[`vendor${idx}DeliveryDate`],
                      warrantyType: record.data[`vendor${idx}WarrantyType`],
                      warrantyFrom: record.data[`vendor${idx}WarrantyFrom`],
                      warrantyTo: record.data[`vendor${idx}WarrantyTo`],
                      attachment: record.data[`vendor${idx}Attachment`],
                      approvedBy: record.data.finalApprovedBy || "Auto-Approved",
                    };

                    return (
                      <TableRow key={record.id} className="bg-green-50">
                        {baseColumns
                          .filter((c) => selectedColumns.includes(c.key))
                          .map((col) => (
                            <TableCell key={col.key}>{record.data[col.key] || "-"}</TableCell>
                          ))}
                        <TableCell className="font-medium flex items-center gap-1">
                          <CheckCircle2 className="w-4 h-4 text-green-600" />
                          {v.name}
                        </TableCell>
                        <TableCell>₹{v.rate || "-"}</TableCell>
                        <TableCell>
                          {paymentTerms.find((t) => t.value === v.terms)?.label || v.terms || "-"}
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
                              <span className="truncate max-w-24">
                                {typeof v.attachment === 'string' ? "View Attachment" : (v.attachment as any).name}
                              </span>
                            </a>
                          ) : (
                            "-"
                          )}
                        </TableCell>
                        <TableCell className="font-medium">{v.approvedBy}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* MODAL */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-5xl max-h-[90vh] flex flex-col">
          <DialogHeader className="flex-shrink-0">
            <DialogTitle>Vendor Negotiation & Final Selection</DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto space-y-6 pr-2">
            {/* 1. SELECT VENDOR FIRST */}
            <div className="space-y-3 border-b pb-4">
              <Label className="text-lg font-semibold">
                Select Vendor <span className="text-red-500">*</span>
              </Label>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {vendors.map((v) => {
                  if (!v) return null;
                  return (
                    <label
                      key={v.id}
                      className={`flex items-center p-3 border rounded-lg cursor-pointer transition-all ${formData.selectedVendor === v.id
                        ? "border-blue-500 bg-blue-50"
                        : "border-gray-300 hover:border-gray-400"
                        }`}
                    >
                      <input
                        type="radio"
                        name="selectedVendor"
                        value={v.id}
                        checked={formData.selectedVendor === v.id}
                        onChange={(e) => setFormData({ ...formData, selectedVendor: e.target.value })}
                        className="mr-3"
                      />
                      <span className="font-medium">{v.name}</span>
                    </label>
                  );
                })}
              </div>
            </div>

            {/* 2. APPROVED BY */}
            <div className="space-y-2">
              <Label htmlFor="approvedBy">
                Approved By <span className="text-red-500">*</span>
              </Label>
              <Select
                value={formData.approvedBy}
                onValueChange={(v) => setFormData({ ...formData, approvedBy: v })}
                required
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select approver..." />
                </SelectTrigger>
                <SelectContent>
                  {approverList.map((a) => (
                    <SelectItem key={a} value={a}>{a}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* 3. ITEM DETAILS (NO DUPLICATE) */}
            <div className="border rounded-lg p-4 bg-gray-50">
              <h3 className="font-medium mb-3">Item Details</h3>
              <div className="grid grid-cols-3 gap-4 text-sm">
                <div>
                  <span className="font-medium">Indent #:</span>
                  <p>{currentRecord?.data?.indentNumber || "—"}</p>
                </div>
                <div>
                  <span className="font-medium">Item:</span>
                  <p>{currentRecord?.data?.itemName || "—"}</p>
                </div>
                <div>
                  <span className="font-medium">Quantity:</span>
                  <p>{currentRecord?.data?.quantity || "—"}</p>
                </div>
              </div>
            </div>

            {/* 4. COMPARISON SHEET */}
            <div className="border rounded-lg">
              <div className="p-4 border-b bg-muted/50">
                <h3 className="font-medium">Vendor Comparison Sheet</h3>
              </div>
              <div className="p-4">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Vendor Name</TableHead>
                      <TableHead>Rate/Qty</TableHead>
                      <TableHead>Payment Terms</TableHead>
                      <TableHead>Exp. Delivery</TableHead>
                      <TableHead>Warranty</TableHead>
                      <TableHead>Attachment</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {vendors.map((v) => {
                      if (!v) return null;
                      return (
                        <TableRow
                          key={v.id}
                          className={formData.selectedVendor === v.id ? "bg-blue-50" : ""}
                        >
                          <TableCell className="font-medium">{v.name}</TableCell>
                          <TableCell>₹{v.rate || "-"}</TableCell>
                          <TableCell>
                            {paymentTerms.find((t) => t.value === v.terms)?.label || v.terms || "-"}
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
                                {v.warrantyFrom && v.warrantyTo && (
                                  <span className="text-gray-500 ml-1">
                                    ({new Date(v.warrantyFrom).toLocaleDateString("en-IN")} -{" "}
                                    {new Date(v.warrantyTo).toLocaleDateString("en-IN")})
                                  </span>
                                )}
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
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </div>

            {/* 5. REMARKS */}
            <div className="space-y-2">
              <Label htmlFor="remarks">Negotiation Remarks</Label>
              <Textarea
                id="remarks"
                value={formData.remarks}
                onChange={(e) => setFormData({ ...formData, remarks: e.target.value })}
                placeholder="Any special terms, discounts, or notes..."
                className="min-h-24"
              />
            </div>

            <DialogFooter className="flex-shrink-0 border-t pt-4">
              <Button type="button" variant="outline" onClick={resetForm} disabled={isSubmitting}>
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isSubmitting || !formData.selectedVendor || !formData.approvedBy}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Saving...
                  </>
                ) : (
                  "Confirm & Proceed"
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* BULK NEGOTIATE MODAL */}
      <Dialog open={bulkModalOpen} onOpenChange={setBulkModalOpen}>
        <DialogContent className="max-w-5xl max-h-[90vh] flex flex-col">
          <DialogHeader className="flex-shrink-0">
            <DialogTitle>Bulk Vendor Negotiation & Final Selection</DialogTitle>
            <p className="text-sm text-gray-500">
              Applying negotiation to {bulkRecords.length} items
            </p>
          </DialogHeader>

          <form onSubmit={handleBulkSubmit} className="flex-1 overflow-y-auto space-y-6 pr-2">
            {/* 1. SELECT VENDOR (Common Vendors Only) */}
            <div className="space-y-3 border-b pb-4">
              <Label className="text-lg font-semibold">
                Select Vendor <span className="text-red-500">*</span>
              </Label>
              {(() => {
                const commonVendors = getCommonVendors(bulkRecords);
                if (commonVendors.length === 0 && bulkRecords.length > 0) {
                  return (
                    <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg text-yellow-800 text-sm">
                      ⚠️ No common vendors found across selected items. Please select items with at least one common vendor.
                    </div>
                  );
                }
                return (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    {commonVendors.map((v: any) => {
                      if (!v) return null;
                      return (
                        <label
                          key={v.id}
                          className={`flex items-center p-3 border rounded-lg cursor-pointer transition-all ${formData.selectedVendor === v.id
                            ? "border-blue-500 bg-blue-50"
                            : "border-gray-300 hover:border-gray-400"
                            }`}
                        >
                          <input
                            type="radio"
                            name="bulkSelectedVendor"
                            value={v.id}
                            checked={formData.selectedVendor === v.id}
                            onChange={(e) => setFormData({ ...formData, selectedVendor: e.target.value })}
                            className="mr-3"
                          />
                          <span className="font-medium">{v.name}</span>
                        </label>
                      );
                    })}
                  </div>
                );
              })()}
            </div>

            {/* 2. APPROVED BY */}
            <div className="space-y-2">
              <Label htmlFor="bulkApprovedBy">
                Approved By <span className="text-red-500">*</span>
              </Label>
              <Select
                value={formData.approvedBy}
                onValueChange={(v) => setFormData({ ...formData, approvedBy: v })}
                required
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select approver..." />
                </SelectTrigger>
                <SelectContent>
                  {approverList.map((a) => (
                    <SelectItem key={a} value={a}>{a}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* 3. ITEM DETAILS (Multiple Items) */}
            <div className="border rounded-lg p-4 bg-gray-50">
              <h3 className="font-medium mb-3">Item Details ({bulkRecords.length} items selected)</h3>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Indent #</TableHead>
                    <TableHead>Item</TableHead>
                    <TableHead>Quantity</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {bulkRecords.map((record) => (
                    <TableRow key={record.id}>
                      <TableCell className="font-medium">{record.data?.indentNumber || "—"}</TableCell>
                      <TableCell>{record.data?.itemName || "—"}</TableCell>
                      <TableCell>{record.data?.quantity || "—"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {/* 4. VENDOR COMPARISON (Aggregated) */}
            <div className="border rounded-lg">
              <div className="p-4 border-b bg-muted/50">
                <h3 className="font-medium">Vendor Comparison Sheet (Common Vendors)</h3>
              </div>
              <div className="p-4">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Indent #</TableHead>
                      <TableHead>Vendor Name</TableHead>
                      <TableHead>Rate/Qty</TableHead>
                      <TableHead>Payment Terms</TableHead>
                      <TableHead>Exp. Delivery</TableHead>
                      <TableHead>Attachment</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {getAllVendorsForComparison(bulkRecords).map((v: any, index: number) => {
                      if (!v) return null;
                      return (
                        <TableRow
                          key={`${v.indentNumber}-${v.id}-${index}`}
                          className={formData.selectedVendor === v.id ? "bg-blue-50" : ""}
                        >
                          <TableCell className="font-medium">{v.indentNumber}</TableCell>
                          <TableCell>{v.name}</TableCell>
                          <TableCell>₹{v.rate || "-"}</TableCell>
                          <TableCell>
                            {paymentTerms.find((t) => t.value === v.terms)?.label || v.terms || "-"}
                          </TableCell>
                          <TableCell>
                            {v.delivery ? new Date(v.delivery).toLocaleDateString("en-IN") : "-"}
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
                                <span>View</span>
                              </a>
                            ) : (
                              "-"
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </div>

            {/* 5. REMARKS */}
            <div className="space-y-2">
              <Label htmlFor="bulkRemarks">Negotiation Remarks</Label>
              <Textarea
                id="bulkRemarks"
                value={formData.remarks}
                onChange={(e) => setFormData({ ...formData, remarks: e.target.value })}
                placeholder="Any special terms, discounts, or notes..."
                className="min-h-24"
              />
            </div>

            {submitError && (
              <div className="p-3 bg-red-50 border border-red-200 text-red-600 rounded-lg text-sm">
                ⚠️ {submitError}
              </div>
            )}

            <DialogFooter className="flex-shrink-0 border-t pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setBulkModalOpen(false);
                  setFormData({ selectedVendor: "", approvedBy: "", remarks: "" });
                }}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isSubmitting || !formData.selectedVendor || !formData.approvedBy || getCommonVendors(bulkRecords).length === 0}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Saving {bulkRecords.length} items...
                  </>
                ) : (
                  `Confirm & Proceed (${bulkRecords.length} items)`
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}