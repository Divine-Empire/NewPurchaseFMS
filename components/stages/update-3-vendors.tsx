"use client";

import React, { useState, useEffect } from "react";
import { useWorkflow } from "@/lib/workflow-context";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Building2,
  Calendar,
  FileText,
  Package,
  Warehouse,
  User,
  Hash,
  Upload,
  X,
  Shield,
  ShieldCheck,
  DollarSign,
  Clock,
  Loader2,
  Tag,
  ClipboardList,
  History,
  Search,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { toast } from "sonner";

export default function Stage3() {
  const {
    // records,
    moveToNextStage,
    updateRecord,
  } = useWorkflow();

  const [sheetRecords, setSheetRecords] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [open, setOpen] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"pending" | "history">("pending");
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [currentRecord, setCurrentRecord] = useState<any>(null);
  const [vendorCount, setVendorCount] = useState(0);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set()); // New state for bulk selection

  // Vendor list fetched from Dropdown sheet
  const [vendorList, setVendorList] = useState<string[]>([]);
  // Search state for each vendor combobox
  const [vendorSearch1, setVendorSearch1] = useState("");
  const [vendorSearch2, setVendorSearch2] = useState("");
  const [vendorSearch3, setVendorSearch3] = useState("");
  const [showVendorDropdown1, setShowVendorDropdown1] = useState(false);
  const [showVendorDropdown2, setShowVendorDropdown2] = useState(false);
  const [showVendorDropdown3, setShowVendorDropdown3] = useState(false);
  // Payment Terms
  const [paymentTermsList, setPaymentTermsList] = useState<string[]>([]);

  const [formData, setFormData] = useState({
    vendor1Name: "",
    vendor1Rate: "",
    vendor1Terms: "",
    vendor1DeliveryDate: "",
    vendor1Attachment: null as File | null,
    vendor2Name: "",
    vendor2Rate: "",
    vendor2Terms: "",
    vendor2DeliveryDate: "",
    vendor2Attachment: null as File | null,
    vendor3Name: "",
    vendor3Rate: "",
    vendor3Terms: "",
    vendor3DeliveryDate: "",
    vendor3Attachment: null as File | null,
  });

  const [searchTerm, setSearchTerm] = useState("");

  const pending = sheetRecords
    .filter((r) => r.status === "pending")
    .filter((r) => {
      const searchLower = searchTerm.toLowerCase();
      return (
        r.data.indentNumber?.toLowerCase().includes(searchLower) ||
        r.data.itemName?.toLowerCase().includes(searchLower) ||
        r.data.vendor1Name?.toLowerCase().includes(searchLower) ||
        r.data.vendor2Name?.toLowerCase().includes(searchLower) ||
        r.data.vendor3Name?.toLowerCase().includes(searchLower) ||
        r.data.vendorType?.toLowerCase().includes(searchLower) ||
        String(r.data.poNumber || "").toLowerCase().includes(searchLower)
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
        r.data.vendorType?.toLowerCase().includes(searchLower) ||
        String(r.data.poNumber || "").toLowerCase().includes(searchLower)
      );
    });

  const formatDate = (date?: Date | string | null) => {
    if (!date || date === "-" || date === "—") return "";
    const d = (date instanceof Date) ? date : parseSheetDate(date);
    if (!d || isNaN(d.getTime())) return String(date || "");

    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${dd}/${mm}/${yyyy}`; // DD/MM/YYYY format
  };

  const formatDateTime = (date?: Date | string | null) => {
    return formatDate(date); // User requested standard DD/MM/YYYY
  };

  const parseSheetDate = (dateStr: string | Date): Date | null => {
    if (!dateStr || dateStr === "-" || dateStr === "—" || dateStr === "Invalid Date") return null;
    if (dateStr instanceof Date) return dateStr;

    // Try standard parsing
    const d = new Date(dateStr);
    if (!isNaN(d.getTime())) return d;

    // Try parsing DD/MM/YYYY or DD/MM/YYYY, HH:mm:ss (handle both comma and space separators)
    const dateTimeParts = dateStr.includes(", ") ? dateStr.split(", ") : dateStr.split(" ");
    const dateParts = dateTimeParts[0].split("/");
    if (dateParts.length === 3) {
      const day = parseInt(dateParts[0], 10);
      const month = parseInt(dateParts[1], 10) - 1;
      const year = parseInt(dateParts[2], 10);

      // Extract time if exists
      let hours = 0, mins = 0, secs = 0;
      if (dateTimeParts[1]) {
        const timeParts = dateTimeParts[1].split(":");
        if (timeParts.length >= 2) {
          hours = parseInt(timeParts[0], 10);
          mins = parseInt(timeParts[1], 10);
          if (timeParts[2]) secs = parseInt(timeParts[2], 10);

          // Handle AM/PM if present
          if (dateTimeParts[1].toLowerCase().includes("pm") && hours < 12) hours += 12;
          if (dateTimeParts[1].toLowerCase().includes("am") && hours === 12) hours = 0;
        }
      }

      const parsed = new Date(year, month, day, hours, mins, secs);
      if (!isNaN(parsed.getTime())) return parsed;
    }
    return null;
  };

  const fetchData = async () => {
    const SHEET_API_URL = process.env.NEXT_PUBLIC_API_URI;
    if (!SHEET_API_URL) {
      console.error("Stage 3: API URL is missing");
      setIsLoading(false); // Ensure loading stops
      return;
    }
    setIsLoading(true);
    try {
      console.log("Stage 3 Fetching from:", SHEET_API_URL);
      const res = await fetch(`${SHEET_API_URL}?sheet=INDENT-LIFT&action=getAll`);
      if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);

      const json = await res.json();
      if (json.success && Array.isArray(json.data)) {
        // Skip header (6 rows) -> Data starts at Row 7 (Index 6)
        const rows = json.data.slice(6)
          .map((row: any, i: number) => ({ row, originalIndex: i + 7 }))
          .filter(({ row }: any) => row[1] && String(row[1]).trim() !== "") // CHECK COL B (Index 1 - Indent #)
          .map(({ row, originalIndex }: any) => {
            const rawStatus = String(row[13] || "").toLowerCase();
            const isApproved = rawStatus === "approved";

            // A record is "completed" in Stage 3 if it has Stage 3 dates (Plan 2 & Actual 2)
            // Index 18 = Col S, Index 19 = Col T
            const hasVendorData =
              (!!row[18] && String(row[18]).trim() !== "" && String(row[18]).trim() !== "-") &&
              (!!row[19] && String(row[19]).trim() !== "" && String(row[19]).trim() !== "-");

            // Check if Stage 2 is complete & approved - RELAXED LOGIC
            // Just check if status is approved. This allows Stage 3 to start immediately.
            const isReadyForStage3 = isApproved;

            return {
              id: row[1] || `row-${originalIndex}`, // CHECK COL B (Index 1 - Indent #)
              rowIndex: originalIndex,
              stage: 3,
              status: hasVendorData ? "completed" : (isReadyForStage3 ? "pending" : "not_ready"),
              createdAt: parseSheetDate(row[0]) || new Date(), // Index 0 is Timestamp
              history: hasVendorData ? [{ stage: 3, date: parseSheetDate(row[19] || row[18] || row[0]) || new Date(), data: {} }] : [],
              pending: isReadyForStage3 && !hasVendorData,
              data: {
                indentNumber: row[1],     // Col B
                timestamp: row[0],        // Col A
                createdBy: row[2],
                category: row[3],
                itemName: row[4],
                quantity: row[5],
                warehouseLocation: row[6],
                itemCode: row[7],
                leadTime: row[8],
                planned1: row[9] ? formatDate(row[9]) : "",
                actual1: row[10] ? formatDate(row[10]) : "",
                delay1: row[11],
                approvedBy: row[12],
                status: row[13],
                approvedQty: row[14],
                vendorType: row[15],
                remarks: row[16],
                img: row[17], // Column R contains Stage 2 Attachment for pending items

                // Stage 2 Dates (Now shifted to start at S / Index 18)
                planned2: row[18],
                actual2: row[19],
                delay2: row[20],

                // Vendor 1 (Starts at U / Index 21)
                vendor1Name: row[21],
                vendor1Rate: row[22],
                vendor1Terms: row[23],
                vendor1DeliveryDate: row[24],
                vendor1WarrantyType: row[25],
                vendor1WarrantyFrom: row[26],
                vendor1WarrantyTo: row[27],
                vendor1Attachment: row[28],

                // Vendor 2 (Starts at AC / Index 29)
                vendor2Name: row[29],
                vendor2Rate: row[30],
                vendor2Terms: row[31],
                vendor2DeliveryDate: row[32],
                vendor2WarrantyType: row[33],
                vendor2WarrantyFrom: row[34],
                vendor2WarrantyTo: row[35],
                vendor2Attachment: row[36],

                // Vendor 3 (Starts at AK / Index 37)
                vendor3Name: row[37],
                vendor3Rate: row[38],
                vendor3Terms: row[39],
                vendor3DeliveryDate: row[40],
                vendor3WarrantyType: row[41],
                vendor3WarrantyFrom: row[42],
                vendor3WarrantyTo: row[43],
                vendor3Attachment: row[44],

                // Stage 5 Data (PO Number) for Search
                poNumber: row[54], // Maps to BC (Index 54)
              }
            };
          });
        setSheetRecords(rows);
      }

      // Fetch vendor list from Dropdown sheet Column G
      const vendorRes = await fetch(`${SHEET_API_URL}?sheet=Dropdown&action=getAll`);
      if (vendorRes.ok) {
        const vendorJson = await vendorRes.json();
        if (vendorJson.success && Array.isArray(vendorJson.data)) {
          // Column G is index 6, skip header row
          const vendors = vendorJson.data.slice(1)
            .map((row: any) => String(row[6] || "").trim())
            .filter((v: string) => v !== "");
          setVendorList(vendors);

          // Column H is index 7 (Payment Terms)
          const terms = vendorJson.data.slice(1)
            .map((row: any) => String(row[7] || "").trim())
            .filter((t: string) => t !== "");
          setPaymentTermsList(terms);
        }
      }
    } catch (e: any) {
      console.error("Stage 3 Fetch error details:", e.message || e);
    }
    setIsLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, []);

  const isThirdParty = true; // Use 3 vendors by default as requested
  const numVendors = 3;


  const baseColumns = [
    { header: "Indent #", accessorKey: "indentNumber" },
    { header: "Created By", accessorKey: "createdBy" },
    { header: "Category", accessorKey: "category" },
    { header: "Item Name", accessorKey: "itemName" },
    { header: "Qty", accessorKey: "quantity" },
    { header: "Warehouse", accessorKey: "warehouseLocation" },
    { header: "Item Code", accessorKey: "itemCode" },
    { header: "Lead Time", accessorKey: "leadTime" },

    { header: "Approved By", accessorKey: "approvedBy" },
    { header: "Status", accessorKey: "status" },
    { header: "Approved Qty", accessorKey: "approvedQty" },
    { header: "Vendor Type", accessorKey: "vendorType" },
    { header: "Remarks", accessorKey: "remarks" },
    { header: "Attachment", accessorKey: "img", cell: (info: any) => info.getValue() ? <a href={info.getValue()} target="_blank" className="text-blue-500 underline">View</a> : "-" },
  ];

  const [selectedColumns, setSelectedColumns] = useState<string[]>(
    baseColumns.map((c) => c.accessorKey)
  );

  // Fuzzy filter function for vendor search (case-insensitive and space-insensitive)
  const fuzzyFilter = (list: string[], search: string) => {
    if (!search.trim()) return list.slice(0, 50); // Show first 50 when no search
    const normalizedSearch = search.toLowerCase().replace(/\s+/g, "");
    return list.filter((item) => {
      const normalizedItem = item.toLowerCase().replace(/\s+/g, "");
      return normalizedItem.includes(normalizedSearch);
    }).slice(0, 50); // Limit to 50 results
  };

  // Get search state and setter for each vendor
  const getVendorSearchState = (num: number) => {
    if (num === 1) return { search: vendorSearch1, setSearch: setVendorSearch1, show: showVendorDropdown1, setShow: setShowVendorDropdown1 };
    if (num === 2) return { search: vendorSearch2, setSearch: setVendorSearch2, show: showVendorDropdown2, setShow: setShowVendorDropdown2 };
    return { search: vendorSearch3, setSearch: setVendorSearch3, show: showVendorDropdown3, setShow: setShowVendorDropdown3 };
  };

  // Hardcoded payment terms removed

  // Check and save new vendors to Dropdown sheet (Column G / Index 6)
  const checkAndSaveNewVendors = async (names: string[]) => {
    const SHEET_API_URL = process.env.NEXT_PUBLIC_API_URI;
    if (!SHEET_API_URL || names.length === 0) return;

    const newVendors: string[] = [];
    names.forEach(name => {
      if (!name) return;
      const exists = vendorList.some(v => v.toLowerCase() === name.toLowerCase());
      const alreadyQueued = newVendors.some(v => v.toLowerCase() === name.toLowerCase());
      if (!exists && !alreadyQueued) {
        newVendors.push(name);
      }
    });

    if (newVendors.length > 0) {
      console.log("Saving new vendors:", newVendors);

      // Optimistically update local state
      setVendorList(prev => [...prev, ...newVendors]);

      try {
        // Fetch last row to determine startRow
        const res = await fetch(`${SHEET_API_URL}?sheet=Dropdown&action=getAll`);
        const json = await res.json();
        const existingRows = Array.isArray(json.data) ? json.data : [];
        const nextRow = existingRows.length + 1;

        // Prepare row data: Column G is Index 6
        const rowsToAdd = newVendors.map(name => {
          const row = new Array(10).fill("");
          row[6] = name; // Column G
          return row;
        });

        const params = new URLSearchParams();
        params.append("action", "batchInsert");
        params.append("sheetName", "Dropdown");
        params.append("rowsData", JSON.stringify(rowsToAdd));
        params.append("startRow", nextRow.toString());

        await fetch(SHEET_API_URL, {
          method: "POST",
          body: params,
        });
        console.log("New vendors saved to Dropdown sheet");
      } catch (e) {
        console.error("Failed to save new vendors:", e);
      }
    }
  };


  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if ((!selectedRecord && selectedIds.size === 0) || !currentRecord) return;

    // Capture state for background execution
    const recordToUpdate = { ...currentRecord };
    const selectionId = selectedRecord;
    const submissionData = { ...formData };
    const SHEET_API_URL = process.env.NEXT_PUBLIC_API_URI;

    // Immediately close modal
    resetForm();

    if (!SHEET_API_URL) {
      toast.error("API URL is missing. Cannot save details.");
      return;
    }

    const submitPromise = (async () => {
      // Check and save new vendors first
      const vendorsToCheck = [
        submissionData.vendor1Name,
        submissionData.vendor2Name,
        submissionData.vendor3Name
      ].filter(Boolean);
      checkAndSaveNewVendors(vendorsToCheck);

      const vendorImageUrls: string[] = ["", "", ""];

      // 1. Upload Attachments (ONCE for all selected records)
      for (let i = 1; i <= numVendors; i++) {
        const attachment = submissionData[`vendor${i}Attachment` as keyof typeof submissionData];

        if (attachment instanceof File) {
          try {
            const toBase64 = (file: File) => new Promise<string>((resolve, reject) => {
              const reader = new FileReader();
              reader.readAsDataURL(file);
              reader.onload = () => resolve(reader.result as string);
              reader.onerror = error => reject(error);
            });

            const base64Data = await toBase64(attachment);

            // Use the first selected ID for the filename prefix, or a generic timestamp
            const filePrefix = selectedIds.size > 0 ? Array.from(selectedIds)[0] : "bulk";

            const uploadParams = new URLSearchParams();
            uploadParams.append("action", "uploadFile");
            uploadParams.append("sheetName", "INDENT-LIFT");
            uploadParams.append("base64Data", base64Data);
            uploadParams.append("fileName", `Stage3_V${i}_${filePrefix}_${attachment.name}`);
            uploadParams.append("mimeType", attachment.type);
            const folderId = process.env.NEXT_PUBLIC_IMAGE_FOLDER_ID || "1SihRrPrgbuPGm-09fuB180QJhdxq5Nxy";
            uploadParams.append("folderId", folderId);

            const uploadRes = await fetch(SHEET_API_URL, {
              method: "POST",
              body: uploadParams,
            });

            if (!uploadRes.ok) throw new Error(`Upload failed with status ${uploadRes.status}`);
            const uploadJson = await uploadRes.json();

            if (uploadJson.success) {
              vendorImageUrls[i - 1] = uploadJson.url || uploadJson.fileUrl;
            } else {
              throw new Error(uploadJson.error || "Upload failed");
            }
          } catch (err: any) {
            console.error(`Vendor ${i} upload error:`, err);
            throw new Error(`Vendor ${i} attachment error: ${err.message}`);
          }
        } else if (typeof attachment === 'string') {
          vendorImageUrls[i - 1] = attachment;
        }
      }

      const now = new Date();

      // Process all selected IDs
      // If opened via button (bulk), use selectedIds. If opened via row click (legacy/fallback), use selectedRecord
      const idsToProcess = selectedIds.size > 0 ? Array.from(selectedIds) : (selectedRecord ? [selectedRecord] : []);

      if (idsToProcess.length === 0) throw new Error("No records selected for update");

      const updatePromises = idsToProcess.map(async (id) => {
        const record = sheetRecords.find(r => r.id === id);
        if (!record) return;

        // IMPORTANT: Use a sparse array. Do NOT resubmit A-S (0-18) or any other existing data.
        const rowArray: any[] = [];

        // Update T (19) and Vendor blocks
        rowArray[19] = formatDate(now); // T (ACTUAL2) - Strictly DD/MM/YYYY

        // Vendor 1
        rowArray[21] = submissionData.vendor1Name || "";
        rowArray[22] = submissionData.vendor1Rate || "";
        rowArray[23] = submissionData.vendor1Terms || "";
        rowArray[24] = formatDate(submissionData.vendor1DeliveryDate);
        rowArray[25] = ""; // Warranty Type
        rowArray[26] = ""; // Warranty From
        rowArray[27] = ""; // Warranty To
        rowArray[28] = vendorImageUrls[0] || "";

        // Vendor 2
        rowArray[29] = submissionData.vendor2Name || "";
        rowArray[30] = submissionData.vendor2Rate || "";
        rowArray[31] = submissionData.vendor2Terms || "";
        rowArray[32] = formatDate(submissionData.vendor2DeliveryDate);
        rowArray[33] = ""; // Warranty Type
        rowArray[34] = ""; // Warranty From
        rowArray[35] = ""; // Warranty To
        rowArray[36] = vendorImageUrls[1] || "";

        // Vendor 3
        rowArray[37] = submissionData.vendor3Name || "";
        rowArray[38] = submissionData.vendor3Rate || "";
        rowArray[39] = submissionData.vendor3Terms || "";
        rowArray[40] = formatDate(submissionData.vendor3DeliveryDate);
        rowArray[41] = ""; // Warranty Type
        rowArray[42] = ""; // Warranty From
        rowArray[43] = ""; // Warranty To
        rowArray[44] = vendorImageUrls[2] || "";

        // 3. Update Sheet
        const params = new URLSearchParams();
        params.append("action", "update");
        params.append("sheetName", "INDENT-LIFT");
        params.append("rowIndex", record.rowIndex.toString());
        params.append("rowData", JSON.stringify(rowArray));

        const response = await fetch(SHEET_API_URL, { method: "POST", body: params });
        if (!response.ok) throw new Error(`Sync failed for ${id} with status ${response.status}`);

        const result = await response.json();
        if (!result.success) throw new Error(result.error || `Update failed for ${id}`);

        // 4. Update Local State
        updateRecord(id, { ...submissionData });
        moveToNextStage(id);
        if (!isThirdParty) moveToNextStage(id);
      });

      await Promise.all(updatePromises);
      await fetchData();
      setSelectedIds(new Set()); // Clear selection after success

      return { success: true };
    })();

    toast.promise(submitPromise, {
      loading: `Saving Vendor details for ${selectedIds.size || 1} record(s)...`,
      success: "Vendor details saved successfully!",
      error: (err) => `Failed to save: ${err.message}`,
    });
  };

  const resetForm = () => {
    setOpen(false);
    setSelectedRecord(null);
    setCurrentRecord(null);
    setVendorCount(0);
    setSubmitError(null); // Clear error on close
    setFormData({
      vendor1Name: "", vendor1Rate: "", vendor1Terms: "", vendor1DeliveryDate: "", vendor1Attachment: null,
      vendor2Name: "", vendor2Rate: "", vendor2Terms: "", vendor2DeliveryDate: "", vendor2Attachment: null,
      vendor3Name: "", vendor3Rate: "", vendor3Terms: "", vendor3DeliveryDate: "", vendor3Attachment: null,
    });
  };



  const toggleSelection = (id: string) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedIds(newSelected);
  };

  const toggleSelectAll = () => {
    // Check if we should select all or deselect all based on current visibility/filtering
    const allSelected = pending.length > 0 && pending.every(r => selectedIds.has(r.id));

    if (allSelected) {
      setSelectedIds(new Set());
    } else {
      const newSelected = new Set(selectedIds);
      pending.forEach(r => newSelected.add(r.id));
      setSelectedIds(newSelected);
    }
  };

  const handleBulkUpdate = () => {
    if (selectedIds.size === 0) return;
    // Just use the first selected record to populate defaults if needed, or clear defaults
    // The requirement says "fill a unified form", so we start with empty form
    setOpen(true);
    // You could set `currentRecord` to one of them for display purposes in the modal header/summary,
    // but the summary shows single item details. We should probably hide specific item details in bulk mode.
    // For now, let's just pick the first one so the modal doesn't crash if it tries to access currentRecord fields
    const firstId = Array.from(selectedIds)[0];
    const rec = sheetRecords.find(r => r.id === firstId);
    if (rec) setCurrentRecord(rec);
  };

  const handleOpenForm = (recordId: string) => {
    const rec = sheetRecords.find((r) => r.id === recordId);
    if (rec) {
      setSelectedRecord(recordId);
      setCurrentRecord(rec);
      setOpen(true);
      setVendorCount(0);
    }
  };

  useEffect(() => {
    let filled = 0;
    for (let i = 1; i <= numVendors; i++) {
      if (formData[`vendor${i}Name` as keyof typeof formData]) filled++;
    }
    setVendorCount(filled);
  }, [formData, numVendors]);

  const handleFileRemove = (n: number) => {
    setFormData({ ...formData, [`vendor${n}Attachment`]: null });
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
                if (c) setSelectedColumns(baseColumns.map((col) => col.accessorKey));
                else setSelectedColumns([]);
              }}
            />
            <Label className="text-sm font-medium">All Columns</Label>
          </div>
          {baseColumns.map((col) => (
            <div key={col.accessorKey} className="flex items-center space-x-2 py-1">
              <Checkbox
                checked={selectedColumns.includes(col.accessorKey)}
                onCheckedChange={(checked) => {
                  if (checked) {
                    setSelectedColumns((prev) => [...prev, col.accessorKey]);
                  } else {
                    setSelectedColumns((prev) => prev.filter((c) => c !== col.accessorKey));
                  }
                }}
              />
              <Label className="text-sm">{col.header}</Label>
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
              <Building2 className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Stage 3: Vendor Quotation</h2>
              <p className="text-slate-500 font-medium text-sm">
                {isThirdParty ? "Collect 3 vendor quotes" : "Update single vendor details"}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <Label className="text-sm font-medium">Show Columns:</Label>
            <ColumnSelector />
          </div>
        </div>
      </div>

      <div className="flex justify-end mb-4">
        {selectedIds.size > 0 && activeTab === "pending" && (
          <Button
            onClick={handleBulkUpdate}
            className="animate-in fade-in zoom-in duration-200"
          >
            Update Vendor ({selectedIds.size})
          </Button>
        )}
      </div>



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
            <div className="text-center py-12 text-gray-500">
              <p className="text-lg">No records found</p>
            </div>
          ) : (
            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[50px] sticky left-0 bg-white z-10">
                      <Checkbox
                        checked={pending.length > 0 && pending.every(r => selectedIds.has(r.id))}
                        onCheckedChange={toggleSelectAll}
                      />
                    </TableHead>
                    {baseColumns
                      .filter((c) => selectedColumns.includes(c.accessorKey))
                      .map((col) => (
                        <TableHead key={col.accessorKey}>
                          <div className="flex items-center gap-2">
                            {col.header}
                          </div>
                        </TableHead>
                      ))}
                  </TableRow>
                </TableHeader>
                <TableBody>

                  {pending.map((record) => (
                    <TableRow key={record.id} className="hover:bg-muted/50 odd:bg-white even:bg-slate-50/80 group">
                      <TableCell className="w-[50px] sticky left-0 bg-white group-even:bg-slate-50/80 z-10">
                        <Checkbox
                          checked={selectedIds.has(record.id)}
                          onCheckedChange={() => toggleSelection(record.id)}
                        />
                      </TableCell>
                      {baseColumns
                        .filter((c) => selectedColumns.includes(c.accessorKey))
                        .map((col) => (
                          <TableCell key={col.accessorKey}>
                            {col.cell ? col.cell({ getValue: () => record.data[col.accessorKey] }) : String(record.data[col.accessorKey] ?? "-")}
                          </TableCell>
                        ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </TabsContent>

        {/* HISTORY – FULL VENDOR DATA */}
        <TabsContent value="history" className="mt-6">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-24 bg-white border rounded-lg shadow-sm">
              <Loader2 className="w-12 h-12 animate-spin text-black mb-4" />
              <p className="text-lg font-medium text-gray-900">Loading History...</p>
              <p className="text-sm text-gray-500 mt-1">Fetching completed records</p>
            </div>
          ) : completed.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <p className="text-lg">No completed records</p>
            </div>
          ) : (
            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="min-w-[150px]">Completion Date</TableHead>
                    {baseColumns
                      .filter((c) => selectedColumns.includes(c.accessorKey))
                      .map((col) => (
                        <TableHead key={col.accessorKey}>{col.header}</TableHead>
                      ))}
                    <TableHead>Vendor</TableHead>
                    <TableHead>Rate/Qty</TableHead>
                    <TableHead>Payment Terms</TableHead>
                    <TableHead>Exp. Delivery</TableHead>
                    <TableHead>Warranty/Guarantee</TableHead>
                    <TableHead>Attachment</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {completed.map((record, recordIdx) => {
                    const rowBg = recordIdx % 2 === 0 ? "bg-white" : "bg-slate-50/80";
                    const vendors = [];
                    for (let i = 1; i <= 3; i++) {
                      const name = record.data[`vendor${i}Name`];
                      if (name) {
                        vendors.push({
                          name,
                          rate: record.data[`vendor${i}Rate`],
                          terms: record.data[`vendor${i}Terms`],
                          delivery: record.data[`vendor${i}DeliveryDate`],
                          warrantyType: record.data[`vendor${i}WarrantyType`],
                          warrantyFrom: record.data[`vendor${i}WarrantyFrom`],
                          warrantyTo: record.data[`vendor${i}WarrantyTo`],
                          attachment: record.data[`vendor${i}Attachment`],
                        });
                      }
                    }

                    return vendors.map((v, idx) => (
                      <TableRow key={`${record.id}-v${idx + 1}`} className={`${rowBg} hover:bg-slate-100/50 transition-colors`}>
                        {idx === 0 && (
                          <>
                            <TableCell rowSpan={vendors.length} className="font-medium whitespace-nowrap">
                              {record.data.actual2 ? formatDateTime(parseSheetDate(record.data.actual2)) : "-"}
                            </TableCell>
                            {baseColumns
                              .filter((c) => selectedColumns.includes(c.accessorKey))
                              .map((col) => (
                                <TableCell key={col.accessorKey} rowSpan={vendors.length}>
                                  {col.cell
                                    ? col.cell({ getValue: () => record.data[col.accessorKey] })
                                    : String(record.data[col.accessorKey] ?? "-")}
                                </TableCell>
                              ))}
                          </>
                        )}
                        <TableCell>{v.name}</TableCell>
                        <TableCell>
                          {v.rate ? `₹${parseFloat(v.rate).toFixed(2)}` : "-"}
                        </TableCell>
                        <TableCell>
                          {v.terms || "-"}
                        </TableCell>
                        <TableCell>
                          {v.delivery ? formatDate(v.delivery) : "-"}
                        </TableCell>
                        <TableCell>
                          {v.warrantyType ? (
                            <div className="flex flex-col text-xs">
                              <div className="flex items-center gap-1">
                                {v.warrantyType === "warranty" ? (
                                  <Shield className="w-3.5 h-3.5 text-blue-600" />
                                ) : (
                                  <ShieldCheck className="w-3.5 h-3.5 text-green-600" />
                                ) /* FIXED ICON */}
                                <span className="font-medium capitalize">{v.warrantyType}</span>
                              </div>
                              {v.warrantyFrom && v.warrantyTo && (
                                <span className="text-gray-500">
                                  {formatDate(v.warrantyFrom)} –{" "}
                                  {formatDate(v.warrantyTo)}
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
                              href={v.attachment}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center gap-1 text-blue-600 text-xs hover:underline"
                            >
                              <FileText className="w-3.5 h-3.5" />
                              <span>View</span>
                            </a>
                          ) : (
                            "-"
                          )}
                        </TableCell>
                      </TableRow>
                    ));
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
            <DialogTitle>Update {numVendors} Vendor{numVendors > 1 ? "s" : ""}</DialogTitle>
            <p className="text-sm text-gray-600">
              {isThirdParty
                ? "Enter details for 3 different vendors"
                : "Enter details for the selected vendor"}
            </p>
            {selectedIds.size > 1 && (
              <div className="mt-2 text-sm font-medium text-amber-600 bg-amber-50 p-2 rounded border border-amber-200">
                Updating {selectedIds.size} records. The same vendor details will be applied to all selected items.
              </div>
            )}
          </DialogHeader>

          <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto space-y-6 pr-2">
            {/* Item Summary */}
            <div className="border rounded-lg p-4 bg-gray-50">
              <h3 className="font-medium mb-3">Item Details</h3>
              <div className="grid grid-cols-4 gap-4 text-sm">
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
                <div>
                  <span className="font-medium">Warehouse:</span>
                  <p>{currentRecord?.data?.warehouseLocation || "—"}</p>
                </div>
                <div>
                  <span className="font-medium">Created By:</span>
                  <p>{currentRecord?.data?.createdBy || "—"}</p>
                </div>
                <div>
                  <span className="font-medium">Category:</span>
                  <p>{currentRecord?.data?.category || "—"}</p>
                </div>
                <div>
                  <span className="font-medium">Lead Time:</span>
                  <p>{currentRecord?.data?.leadTime ? `${currentRecord.data.leadTime} days` : "—"}</p>
                </div>
                <div>
                  <span className="font-medium">Item Code:</span>
                  <p>{currentRecord?.data?.itemCode || "—"}</p>
                </div>
              </div>
            </div>

            {/* Vendor Forms */}
            {Array.from({ length: numVendors }, (_, i) => i + 1).map((num) => {
              return (
                <div key={num} className="border rounded-lg p-4">
                  <h3 className="font-medium mb-4 flex items-center gap-2">
                    <Building2 className="w-5 h-5" />
                    Vendor {num}
                  </h3>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor={`vendor${num}Name`}>
                        Vendor Name
                      </Label>
                      <div className="relative">
                        <Input
                          id={`vendor${num}Name`}
                          placeholder="Type to search vendor..."
                          value={getVendorSearchState(num).search || (formData[`vendor${num}Name` as keyof typeof formData] as string) || ""}
                          onChange={(e) => {
                            const { setSearch, setShow } = getVendorSearchState(num);
                            setSearch(e.target.value);
                            setShow(true);
                            // Also update formData as user types
                            setFormData({ ...formData, [`vendor${num}Name`]: e.target.value });
                          }}
                          onFocus={() => {
                            const { setShow } = getVendorSearchState(num);
                            setShow(true);
                          }}
                          onBlur={() => {
                            // Delay hiding to allow click on dropdown
                            setTimeout(() => {
                              const { setShow } = getVendorSearchState(num);
                              setShow(false);
                            }, 200);
                          }}
                          autoComplete="off"
                        />
                        {getVendorSearchState(num).show && (
                          <div className="absolute z-50 w-full mt-1 bg-white border rounded-md shadow-lg max-h-48 overflow-y-auto">
                            {fuzzyFilter(vendorList, getVendorSearchState(num).search).length > 0 ? (
                              fuzzyFilter(vendorList, getVendorSearchState(num).search).map((v) => (
                                <div
                                  key={v}
                                  className="px-3 py-2 hover:bg-gray-100 cursor-pointer text-sm"
                                  onMouseDown={(e) => {
                                    e.preventDefault();
                                    setFormData({ ...formData, [`vendor${num}Name`]: v });
                                    const { setSearch, setShow } = getVendorSearchState(num);
                                    setSearch(v);
                                    setShow(false);
                                  }}
                                >
                                  {v}
                                </div>
                              ))
                            ) : (
                              <div
                                className="px-3 py-2 text-sm text-blue-600 hover:bg-gray-50 cursor-pointer flex items-center gap-2"
                                onMouseDown={(e) => {
                                  e.preventDefault();
                                  const newVal = getVendorSearchState(num).search;
                                  setFormData({ ...formData, [`vendor${num}Name`]: newVal });
                                  const { setSearch, setShow } = getVendorSearchState(num);
                                  setSearch(newVal); // Confirm the custom value
                                  setShow(false);
                                }}
                              >
                                <span className="font-semibold">+ Create "{getVendorSearchState(num).search}"</span>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor={`vendor${num}Rate`}>
                        Rate per Qty
                      </Label>
                      <Input
                        id={`vendor${num}Rate`}
                        type="number"
                        min="0"
                        step="0.01"
                        placeholder="0.00"
                        value={(formData[`vendor${num}Rate` as keyof typeof formData] as string) || ""}
                        onChange={(e) =>
                          setFormData({ ...formData, [`vendor${num}Rate`]: e.target.value })
                        }
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor={`vendor${num}Terms`}>
                        Payment Terms
                      </Label>
                      <Select
                        value={(formData[`vendor${num}Terms` as keyof typeof formData] as string) || ""}
                        onValueChange={(v) =>
                          setFormData({ ...formData, [`vendor${num}Terms`]: v })
                        }
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select terms" />
                        </SelectTrigger>
                        <SelectContent>
                          {paymentTermsList.map((t) => (
                            <SelectItem key={t} value={t}>
                              {t}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor={`vendor${num}DeliveryDate`}>
                        Expected Delivery
                      </Label>
                      <Input
                        id={`vendor${num}DeliveryDate`}
                        type="date"
                        value={(formData[`vendor${num}DeliveryDate` as keyof typeof formData] as string) || ""}
                        onChange={(e) =>
                          setFormData({ ...formData, [`vendor${num}DeliveryDate`]: e.target.value })
                        }
                      />
                    </div>

                    {/* Warranty/Guarantee section removed from UI */}
                  </div>

                  <div className="mt-4 space-y-2">
                    <Label>Attachment</Label>
                    <div>
                      <input
                        id={`file-${num}`}
                        type="file"
                        accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            [`vendor${num}Attachment`]: e.target.files?.[0] || null,
                          })
                        }
                        className="hidden"
                      />
                      <label
                        htmlFor={`file-${num}`}
                        className="flex items-center justify-center w-full p-4 border-2 border-dashed rounded-lg cursor-pointer hover:border-gray-400"
                      >
                        <Upload className="w-5 h-5 mr-2 text-gray-500" />
                        <span className="text-sm">Click to upload</span>
                      </label>

                      {formData[`vendor${num}Attachment` as keyof typeof formData] && (
                        <div className="mt-2 p-2 bg-gray-50 border rounded flex items-center justify-between text-sm">
                          <div className="flex items-center gap-2">
                            <FileText className="w-4 h-4" />
                            <span>
                              {(formData[`vendor${num}Attachment` as keyof typeof formData] as File).name}
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleFileRemove(num)}
                            className="text-red-600 hover:text-red-800"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}

            <div className="flex items-center justify-center gap-3 py-4">
              <span className="font-medium">Vendors Filled:</span>
              <div className="flex gap-1">
                {Array.from({ length: 3 }, (_, i) => (
                  <div
                    key={i}
                    className={`w-3 h-3 rounded-full transition-colors ${i < vendorCount ? "bg-green-600" : "bg-gray-300"
                      }`}
                  />
                ))}
              </div>
              <span className="font-medium">{vendorCount} / {numVendors}</span>
            </div>

            {submitError && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-600 rounded-md text-sm font-medium">
                ⚠️ {submitError}
              </div>
            )}

            <div className="flex justify-end pt-4 border-t">
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? "Submitting..." : `Submit ${numVendors} Vendor${numVendors > 1 ? "s" : ""}`}
              </Button>
            </div>
          </form>

          <DialogFooter className="flex-shrink-0 border-t pt-4">
            <Button type="button" variant="outline" onClick={resetForm}>
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div >
  );
}