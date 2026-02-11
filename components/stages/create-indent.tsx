"use client";

import React, { useState, useEffect } from "react";
import { useWorkflow } from "@/lib/workflow-context";
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
import { Badge } from "@/components/ui/badge";
import { X, Loader2, PlusCircle, History as HistoryIcon, LayoutGrid, ClipboardList, FileText, Upload } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Check, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

export default function Stage1() {
  const {
    // records,
    // addRecord,
    // moveToNextStage,
    indentCounter,
    setIndentCounter,
  } = useWorkflow();

  const [sheetRecords, setSheetRecords] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<"pending" | "history">("pending");

  const parseSheetDate = (dateStr: string) => {
    if (!dateStr || dateStr === "-" || dateStr === "Invalid Date") return new Date();
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
    return new Date();
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
        let autoIdCounter = 1;
        const rows = json.data.slice(6)
          .filter((row: any) => row[1] && String(row[1]).trim() !== "") // Skip empty rows
          .map((row: any, i: number) => {
            const rawId = row[1] ? String(row[1]).trim() : "";
            const originalIndex = i + 7;
            let indentNum: string;

            if (rawId) {
              indentNum = rawId;
            } else {
              indentNum = `IN-${String(autoIdCounter).padStart(3, "0")}A`;
              autoIdCounter++;
            }

            const isApproved = !!row[13] &&
              String(row[13]).trim() !== "" &&
              String(row[13]).trim() !== "-" &&
              String(row[13]).trim().toLowerCase() !== "pending";

            return {
              id: `${indentNum}-${originalIndex}`,
              rowIndex: originalIndex,
              stage: 1,
              status: isApproved ? "completed" : "pending",
              createdAt: parseSheetDate(row[0]),
              history: [{ stage: 1, date: parseSheetDate(row[0]), data: {} }],
              data: {
                indentNumber: indentNum,
                createdBy: row[2],
                category: row[3],
                warehouseLocation: row[6],
                leadTime: row[8],
                itemName: row[4],
                quantity: row[5],
                itemCode: row[7],
                uom: row[69] || "",
                status: row[13] || "pending",
                remarks: row[16],
                attachment: row[17] || ""
              }
            };
          });


        // Calculate max ID from loaded rows to sync counter
        let maxId = 0;
        rows.forEach((r: any) => {
          if (r.id) {
            const match = r.id.match(/IN-(\d+)/);
            if (match) {
              const num = parseInt(match[1], 10);
              if (num > maxId) maxId = num;
            }
          }
        });
        setIndentCounter(maxId > 0 ? maxId + 1 : 1);

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

  const pending = sheetRecords.filter((r) => r.status === "pending");
  const history = sheetRecords.filter((r) => r.status === "completed");

  const Combobox = ({
    options,
    value,
    onChange,
    placeholder,
    searchPlaceholder,
    disabled,
  }: {
    options: string[];
    value: string;
    onChange: (value: string) => void;
    placeholder: string;
    searchPlaceholder: string;
    disabled?: boolean;
  }) => {
    const [open, setOpen] = useState(false);

    return (
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className={cn("w-full justify-between font-normal", !value && "text-muted-foreground")}
            disabled={disabled}
          >
            {value
              ? options.find((option) => option === value) || value
              : placeholder}
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
          <Command>
            <CommandInput placeholder={searchPlaceholder} />
            <CommandList>
              <CommandEmpty>No option found.</CommandEmpty>
              <CommandGroup>
                {options.map((option) => (
                  <CommandItem
                    key={option}
                    value={option}
                    onSelect={() => {
                      onChange(option);
                      setOpen(false);
                    }}
                  >
                    <Check
                      className={cn(
                        "mr-2 h-4 w-4",
                        value === option ? "opacity-100" : "opacity-0"
                      )}
                    />
                    {option}
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    );
  };

  // === Existing Indent Creation Modal ===
  const [open, setOpen] = useState(false);
  const [addItemOpen, setAddItemOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // === Edit Modal State ===
  const [editOpen, setEditOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState<any>(null);
  const [isEditSubmitting, setIsEditSubmitting] = useState(false);
  const [editFormData, setEditFormData] = useState({
    createdBy: "",
    warehouseLocation: "",
    leadTime: "",
    category: "",
    itemName: "",
    quantity: "",
    uom: "",
    itemCode: "",
    attachment: null as File | null,
    existingAttachmentUrl: "",
  });

  const [formData, setFormData] = useState({
    createdBy: "",
    warehouseLocation: "",
    leadTime: "",
    attachment: null as File | null,
    items: [] as Array<{
      category: string;
      itemName: string;
      quantity: string;
      uom: string;
      itemCode: string;
    }>,
  });

  const [itemForm, setItemForm] = useState({
    items: [
      {
        category: "",
        itemName: "",
        quantity: "",
        uom: "",
        itemCode: "",
      },
    ],
  });





  // Fetch "Created By" options from Dropdown sheet column A
  const [createdByOptions, setCreatedByOptions] = useState<string[]>([]);
  // Fetch "Warehouse Location" options from Dropdown sheet column B
  const [warehouseOptions, setWarehouseOptions] = useState<string[]>([]);
  // Fetch "UOM" options from Dropdown sheet column N (Index 13)
  const [uomOptions, setUomOptions] = useState<string[]>([]);
  // Fetch dropdown data for Category (D), Item Name (E), Item Code (C)
  const [dropdownData, setDropdownData] = useState<Array<{ itemCode: string; category: string; itemName: string }>>([]);

  useEffect(() => {
    const fetchDropdownOptions = async () => {
      const SHEET_API_URL = process.env.NEXT_PUBLIC_API_URI;
      if (!SHEET_API_URL) return;
      try {
        const res = await fetch(`${SHEET_API_URL}?sheet=Dropdown&action=getAll`);
        const json = await res.json();
        if (json.success && Array.isArray(json.data)) {
          // Get values from column A starting from row 2 (index 1)
          const createdByOpts = json.data
            .slice(1) // Skip header row
            .map((row: any) => row[0]) // Column A is index 0
            .filter((val: any) => val && String(val).trim() !== "");
          setCreatedByOptions(createdByOpts);

          // Get values from column B starting from row 2 (index 1)
          const warehouseOpts = json.data
            .slice(1) // Skip header row
            .map((row: any) => row[1]) // Column B is index 1
            .filter((val: any) => val && String(val).trim() !== "");
          setWarehouseOptions(warehouseOpts);

          // Get UOM options from column N (Index 13)
          const uoms = json.data
            .slice(1)
            .map((row: any) => row[13]) // Column N is index 13
            .filter((val: any) => val && String(val).trim() !== "");
          setUomOptions(uoms);

          // Get Category (D), Item Name (E), Item Code (C) from columns
          const itemData = json.data
            .slice(1) // Skip header row
            .filter((row: any) => row[3] && String(row[3]).trim() !== "") // Filter rows with category
            .map((row: any) => ({
              itemCode: row[2] ? String(row[2]).trim() : "", // Column C (index 2)
              category: row[3] ? String(row[3]).trim() : "", // Column D (index 3)
              itemName: row[4] ? String(row[4]).trim() : "", // Column E (index 4)
            }));
          setDropdownData(itemData);
        }
      } catch (e) {
        console.error("Error fetching dropdown options:", e);
      }
    };
    fetchDropdownOptions();
  }, []);

  // Get unique categories from dropdown data
  const categoryOptions = [...new Set(dropdownData.map(item => item.category))].filter(Boolean);

  // Get items filtered by selected category
  const getItemsByCategory = (category: string) => {
    const items = dropdownData.filter(item => item.category === category);
    // Deduplicate by itemName to prevent duplicate key errors in the dropdown
    return Array.from(new Map(items.map(item => [item.itemName, item])).values());
  };


  const submitToSheet = async (data: any, rootIndentNumber: string) => {
    try {
      const SHEET_API_URL = process.env.NEXT_PUBLIC_API_URI;

      if (!SHEET_API_URL) {
        console.error("Sheet API URL is not defined");
        return;
      }

      // 1. Prepare data rows (Array of Arrays)
      const rows = data.items.map((item: any, i: number) => {
        const d = new Date(new Date().getTime() + i * 1000);
        const day = d.getDate();
        const month = d.getMonth() + 1;
        const year = d.getFullYear();
        const hours = String(d.getHours()).padStart(2, "0");
        const minutes = String(d.getMinutes()).padStart(2, "0");
        const seconds = String(d.getSeconds()).padStart(2, "0");
        const timestamp = `${day}/${month}/${year}`;

        const indentNum = item.indentNumber || rootIndentNumber;
        // Column Order: Timestamp(A), Indent(B), CreatedBy(C), Category(D), ItemName(E), Qty(F), Warehouse(G), ItemCode(H), LeadTime(I)

        const row = new Array(70).fill(""); // Ensure enough columns for UOM (Index 69)

        row[0] = timestamp;
        row[1] = indentNum;
        row[2] = data.createdBy;
        row[3] = item.category;
        row[4] = item.itemName;
        row[5] = item.quantity;
        row[6] = data.warehouseLocation;
        row[7] = item.itemCode || "";
        row[8] = data.leadTime;
        row[17] = data.attachmentUrl || "";
        row[69] = item.uom || ""; // Column BR (Index 69)

        return row;
      });

      console.log(`Submitting ${rows.length} rows to Sheet...`);

      // 2. Check if this is first-time insert (no data after row 6)
      const checkRes = await fetch(`${SHEET_API_URL}?sheet=INDENT-LIFT&action=getAll`);
      const checkJson = await checkRes.json();
      const existingRows = Array.isArray(checkJson.data) ? checkJson.data : [];
      const dataRowsCount = existingRows.slice(6).filter((r: any) => r[1] && String(r[1]).trim() !== "").length;

      if (dataRowsCount === 0) {
        // First time insert - use update action to place at row 7
        console.log("First time insert - placing data starting at row 7");
        let successCount = 0;
        for (let i = 0; i < rows.length; i++) {
          const rowIndex = 7 + i;
          const params = new URLSearchParams();
          params.append("action", "update");
          params.append("sheetName", "INDENT-LIFT");
          params.append("rowIndex", rowIndex.toString());
          params.append("rowData", JSON.stringify(rows[i]));

          const res = await fetch(SHEET_API_URL, {
            method: "POST",
            body: params,
          });
          const result = await res.json();
          if (result && result.success) successCount++;
        }
        console.log(`Saved ${successCount}/${rows.length} rows at row 7+ ✅`);
      } else {
        // Data exists - use batchInsert to append
        const params = new URLSearchParams();
        params.append("action", "batchInsert");
        params.append("sheetName", "INDENT-LIFT");
        params.append("rowsData", JSON.stringify(rows));
        params.append("startRow", "7");

        const res = await fetch(SHEET_API_URL, {
          method: "POST",
          body: params,
        });

        const text = await res.text();
        let result;
        try {
          result = JSON.parse(text);
        } catch (e) {
          console.error("Failed to parse response JSON:", text);
          return;
        }

        if (result && result.success === true) {
          console.log("Saved in sheet ✅");
        } else {
          console.error("Sheet error:", JSON.stringify(result, null, 2));
        }
      }
    } catch (error) {
      console.error("Error submitting to sheet:", error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (
      formData.createdBy &&
      formData.warehouseLocation &&
      formData.leadTime &&
      formData.items.length > 0
    ) {
      setIsSubmitting(true);

      const createdRecords = formData.items.map((item, index) => {
        const indentNumber = `IN-${indentCounter
          .toString()
          .padStart(3, "0")}${String.fromCharCode(65 + index)}`;
        return { indentNumber, ...item };
      });

      const submitPromise = (async () => {
        // Handle file upload if exists
        let attachmentUrl = "";
        if (formData.attachment) {
          const SHEET_API_URL = process.env.NEXT_PUBLIC_API_URI;
          if (!SHEET_API_URL) throw new Error("API URL is missing");

          const toBase64 = (file: File) => new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = () => resolve(reader.result as string);
            reader.onerror = error => reject(error);
          });

          const base64Data = await toBase64(formData.attachment);
          const uploadParams = new URLSearchParams();
          uploadParams.append("action", "uploadFile");
          uploadParams.append("sheetName", "INDENT-LIFT");
          uploadParams.append("base64Data", base64Data);
          uploadParams.append("fileName", `Stage1_${createdRecords[0].indentNumber}_${formData.attachment.name}`);
          uploadParams.append("mimeType", formData.attachment.type);
          const folderId = process.env.NEXT_PUBLIC_IMAGE_FOLDER_ID || "1SihRrPrgbuPGm-09fuB180QJhdxq5Nxy";
          uploadParams.append("folderId", folderId);

          const uploadRes = await fetch(SHEET_API_URL, {
            method: "POST",
            body: uploadParams,
          });

          if (!uploadRes.ok) throw new Error(`Upload failed with status ${uploadRes.status}`);

          const uploadJson = await uploadRes.json();
          if (uploadJson.success) {
            attachmentUrl = uploadJson.url || uploadJson.fileUrl;
          } else {
            throw new Error(uploadJson.error || "Upload failed");
          }
        }

        await submitToSheet({
          ...formData,
          items: createdRecords,
          attachmentUrl: attachmentUrl
        }, createdRecords[0].indentNumber);

        setIndentCounter((prev) => prev + createdRecords.length);
        fetchData();

        setFormData({
          createdBy: "",
          warehouseLocation: "",
          leadTime: "",
          attachment: null,
          items: [],
        });
        setOpen(false);
        return true;
      })();

      toast.promise(submitPromise, {
        loading: "Creating indent and uploading attachment...",
        success: "Indent created successfully!",
        error: (err) => `Failed to create indent: ${err.message}`,
      });

      try {
        await submitPromise;
      } catch (err) {
        console.error("Submission failed:", err);
      } finally {
        setIsSubmitting(false);
      }
    }
  };

  const handleAddItem = (e: React.FormEvent) => {
    e.preventDefault();
    if (
      itemForm.items.every(
        (item) =>
          item.category && item.itemName && item.quantity && item.itemCode && item.uom
      )
    ) {
      setFormData((prev) => ({
        ...prev,
        items: [...prev.items, ...itemForm.items],
      }));
      setItemForm({
        items: [
          {
            category: "",
            itemName: "",
            quantity: "",
            uom: "",
            itemCode: "",
          },
        ],
      });
      setAddItemOpen(false);
    }
  };

  const addNewItem = () => {
    setItemForm({
      ...itemForm,
      items: [
        ...itemForm.items,
        {
          category: "",
          itemName: "",
          quantity: "",
          uom: "",
          itemCode: "",
        },
      ],
    });
  };

  const removeItem = (index: number) => {
    if (itemForm.items.length > 1) {
      setItemForm({
        ...itemForm,
        items: itemForm.items.filter((_, i) => i !== index),
      });
    }
  };

  const updateItem = (index: number, field: string, value: string) => {
    const updatedItems = itemForm.items.map((item, i) => {
      if (i !== index) return item;

      if (field === "category") {
        // Reset itemName and itemCode when category changes
        return { ...item, category: value, itemName: "", itemCode: "" };
      }

      if (field === "itemName") {
        // Auto-fill itemCode when item name is selected
        const selectedItem = dropdownData.find(
          d => d.category === item.category && d.itemName === value
        );
        return {
          ...item,
          itemName: value,
          itemCode: selectedItem?.itemCode || ""
        };
      }

      return { ...item, [field]: value };
    });
    setItemForm({ ...itemForm, items: updatedItems });
  };

  // === Edit Record Handler ===
  const handleEditRecord = (record: any) => {
    setEditingRecord(record);
    setEditFormData({
      createdBy: record.data.createdBy || "",
      warehouseLocation: record.data.warehouseLocation || "",
      leadTime: record.data.leadTime || "",
      category: record.data.category || "",
      itemName: record.data.itemName || "",
      quantity: record.data.quantity || "",
      uom: record.data.uom || "",
      itemCode: record.data.itemCode || "",
      attachment: null,
      existingAttachmentUrl: record.data.attachment || "",
    });
    setEditOpen(true);
  };

  // === Update Record in Sheet ===
  const updateRecordInSheet = async () => {
    if (!editingRecord) return;

    const SHEET_API_URL = process.env.NEXT_PUBLIC_API_URI;
    if (!SHEET_API_URL) {
      console.error("Sheet API URL is not defined");
      return;
    }

    setIsEditSubmitting(true);

    try {
      // Handle file upload if new file selected
      let finalAttachmentUrl = editFormData.existingAttachmentUrl;
      if (editFormData.attachment) {
        try {
          const toBase64 = (file: File) => new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = () => resolve(reader.result as string);
            reader.onerror = error => reject(error);
          });

          const base64Data = await toBase64(editFormData.attachment);
          const uploadParams = new URLSearchParams();
          uploadParams.append("action", "uploadFile");
          uploadParams.append("sheetName", "INDENT-LIFT");
          uploadParams.append("base64Data", base64Data);
          uploadParams.append("fileName", `Stage1_Edit_${editingRecord.id}_${editFormData.attachment.name}`);
          uploadParams.append("mimeType", editFormData.attachment.type);
          const folderId = process.env.NEXT_PUBLIC_IMAGE_FOLDER_ID || "1SihRrPrgbuPGm-09fuB180QJhdxq5Nxy";
          uploadParams.append("folderId", folderId);

          const uploadRes = await fetch(SHEET_API_URL, {
            method: "POST",
            body: uploadParams,
          });
          const uploadJson = await uploadRes.json();
          if (uploadJson.success) {
            finalAttachmentUrl = uploadJson.url || uploadJson.fileUrl;
          }
        } catch (uploadErr) {
          console.error("Upload error during edit:", uploadErr);
        }
      }

      // Build the row data array - only update specific columns
      const rowArray = new Array(70).fill(""); // Increase size to accommodate UOM at index 69

      // Update columns: C (index 2), D (index 3), E (index 4), F (index 5), G (index 6), H (index 7), I (index 8), R (index 17), BR (index 69)
      rowArray[2] = editFormData.createdBy;      // Col C: Created By
      rowArray[3] = editFormData.category;        // Col D: Category
      rowArray[4] = editFormData.itemName;        // Col E: Item Name
      rowArray[5] = editFormData.quantity;        // Col F: Quantity
      rowArray[6] = editFormData.warehouseLocation; // Col G: Warehouse Location
      rowArray[7] = editFormData.itemCode;        // Col H: Item Code
      rowArray[8] = editFormData.leadTime;        // Col I: Lead Time
      rowArray[17] = finalAttachmentUrl;          // Col R: Attachment URL
      rowArray[69] = editFormData.uom;            // Col BR: UOM

      const params = new URLSearchParams();
      params.append("action", "update");
      params.append("sheetName", "INDENT-LIFT");
      params.append("rowIndex", editingRecord.rowIndex.toString());
      params.append("rowData", JSON.stringify(rowArray));

      const res = await fetch(SHEET_API_URL, {
        method: "POST",
        body: params,
      });

      const result = await res.json();

      if (result.success) {
        console.log("Record updated successfully ✅");
        setEditOpen(false);
        setEditingRecord(null);
        fetchData(); // Refresh data
      } else {
        console.error("Update failed:", result.error);
        alert("Failed to update record. Please try again.");
      }
    } catch (error) {
      console.error("Error updating record:", error);
      alert("Error updating record. Please check console.");
    } finally {
      setIsEditSubmitting(false);
    }
  };

  return (
    <div className="p-6">
      {/* Header Card */}
      <div className="mb-6 p-6 bg-linear-to-br from-slate-50 to-white border border-slate-200 rounded-xl shadow-sm">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-slate-900 rounded-lg shadow-slate-100 shadow-xl text-white">
              <LayoutGrid className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Stage 1: Create Indent</h2>
              <p className="text-slate-500 font-medium text-sm">
                Initiate and manage purchase indents & orders
              </p>
            </div>
          </div>

          {activeTab === "pending" && (
            <div className="flex items-center gap-2 w-full md:w-auto">
              <Button
                onClick={() => setOpen(true)}
                className="px-6 h-11 bg-slate-900 hover:bg-slate-800 shadow-lg shadow-slate-100 transition-all rounded-lg text-white font-semibold"
              >
                <PlusCircle className="w-4 h-4 mr-2" />
                Create Indent
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Content Area */}
      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-24 text-gray-500">
          <Loader2 className="w-8 h-8 animate-spin mb-4 text-black" />
          <p className="text-lg animate-pulse text-black font-medium">Loading records...</p>
        </div>
      ) : (
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)} className="space-y-6">
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
              <HistoryIcon className="w-5 h-5" />
              <div className="flex flex-col items-start leading-none gap-1">
                <span className="font-bold">History</span>
                <span className="text-[10px] opacity-70">Completed records</span>
              </div>
              <Badge variant="secondary" className="bg-slate-100 text-black border-slate-200 px-2">
                {history.length}
              </Badge>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="pending" className="mt-0 outline-none">
            <StageTable
              title=""
              stage={1}
              pending={pending}
              history={[]} // Strictly hide history
              onOpenForm={() => setOpen(true)}
              onSelectRecord={(record) => handleEditRecord(record)}
              showPending={true}
              columns={[
                { key: "indentNumber", label: "Indent #" },
                { key: "createdBy", label: "Created By" },
                { key: "category", label: "Category" },
                { key: "warehouseLocation", label: "Warehouse" },
                { key: "leadTime", label: "Lead Time" },
                { key: "itemName", label: "Item" },
                { key: "quantity", label: "Qty" },
                { key: "uom", label: "UOM" },
                { key: "itemCode", label: "Item Code" },
                { key: "status", label: "Status" },
                { key: "attachment", label: "Attachment" },
              ]}
            />
          </TabsContent>

          <TabsContent value="history" className="mt-0 outline-none">
            <StageTable
              title=""
              stage={1}
              pending={[]} // Strictly hide pending
              history={history}
              onOpenForm={() => setOpen(true)}
              onSelectRecord={() => { }}
              showPending={false}
              columns={[
                { key: "indentNumber", label: "Indent #" },
                { key: "createdBy", label: "Created By" },
                { key: "category", label: "Category" },
                { key: "warehouseLocation", label: "Warehouse" },
                { key: "leadTime", label: "Lead Time" },
                { key: "itemName", label: "Item" },
                { key: "quantity", label: "Qty" },
                { key: "uom", label: "UOM" },
                { key: "itemCode", label: "Item Code" },
                { key: "status", label: "Status" },
                { key: "attachment", label: "Attachment" },
              ]}
            />
          </TabsContent>
        </Tabs>
      )}


      {/* === ORIGINAL INDENT CREATION MODAL (UNCHANGED) === */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col p-4 sm:p-6">
          <DialogHeader className="flex-shrink-0">
            <DialogTitle>Create New Indent</DialogTitle>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto space-y-3 pr-2">
            <form onSubmit={handleSubmit} className="space-y-3">
              <div className="space-y-2">
                <Label htmlFor="createdBy">Created By</Label>
                <Select
                  value={formData.createdBy}
                  onValueChange={(val) =>
                    setFormData({ ...formData, createdBy: val })
                  }
                >
                  <SelectTrigger id="createdBy">
                    <SelectValue placeholder="Select creator" />
                  </SelectTrigger>
                  <SelectContent>
                    {createdByOptions.map((option) => (
                      <SelectItem key={option} value={option}>
                        {option}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="warehouseLocation">Warehouse Location</Label>
                <Select
                  value={formData.warehouseLocation}
                  onValueChange={(val) =>
                    setFormData({ ...formData, warehouseLocation: val })
                  }
                >
                  <SelectTrigger id="warehouseLocation">
                    <SelectValue placeholder="Select warehouse" />
                  </SelectTrigger>
                  <SelectContent>
                    {warehouseOptions.map((option) => (
                      <SelectItem key={option} value={option}>
                        {option}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="leadTime">Lead Time (Days)</Label>
                <Input
                  id="leadTime"
                  type="number"
                  min="1"
                  placeholder="e.g. 7"
                  value={formData.leadTime}
                  onChange={(e) =>
                    setFormData({ ...formData, leadTime: e.target.value })
                  }
                />
              </div>

              <div className="space-y-2">
                <Label>Attachment (Optional)</Label>
                <div className="flex flex-col gap-2">
                  <input
                    id="indent-attachment"
                    type="file"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) setFormData({ ...formData, attachment: file });
                    }}
                    className="hidden"
                  />
                  <label
                    htmlFor="indent-attachment"
                    className="flex items-center justify-center w-full p-6 border-2 border-dashed border-slate-200 rounded-xl cursor-pointer hover:border-slate-400 hover:bg-slate-50 transition-all group"
                  >
                    <div className="flex flex-col items-center gap-2">
                      <div className="p-2 bg-slate-100 rounded-full group-hover:bg-slate-200 transition-colors">
                        <Upload className="w-5 h-5 text-slate-600" />
                      </div>
                      <div className="text-center">
                        <p className="text-sm font-semibold text-slate-700">Click to upload document</p>
                        <p className="text-xs text-slate-500">PDF, JPG, PNG or DOC (max 10MB)</p>
                      </div>
                    </div>
                  </label>

                  {formData.attachment && (
                    <div className="flex items-center justify-between p-3 bg-blue-50/50 border border-blue-100 rounded-lg animate-in fade-in slide-in-from-top-1">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-blue-100 rounded-lg">
                          <FileText className="w-4 h-4 text-blue-600" />
                        </div>
                        <div className="flex flex-col">
                          <span className="text-sm font-medium text-slate-900 truncate max-w-[250px]">
                            {formData.attachment.name}
                          </span>
                          <span className="text-[10px] text-slate-500">
                            {(formData.attachment.size / 1024 / 1024).toFixed(2)} MB
                          </span>
                        </div>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                        onClick={() => setFormData({ ...formData, attachment: null })}
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Items</Label>
                  <Button
                    type="button"
                    onClick={() => setAddItemOpen(true)}
                    size="sm"
                  >
                    Add Item
                  </Button>
                </div>

                {formData.items.length === 0 ? (
                  <div className="p-4 sm:p-6 text-center border rounded-lg border-dashed">
                    <p className="text-sm text-gray-500">
                      No items added yet. Click "Add Item" to begin.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {formData.items.map((item, index) => (
                      <div key={index} className="p-3 border rounded-lg">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
                            <div>
                              <span className="font-medium">
                                {item.itemName}
                              </span>
                            </div>
                            <div>
                              <Badge variant="secondary" className="text-xs">
                                {item.category}
                              </Badge>
                            </div>
                            <div>
                              <span>Qty: {item.quantity} {item.uom}</span>
                            </div>
                            <div className="col-span-2">
                              <span>
                                Item Code: {item.itemCode}
                              </span>
                            </div>
                          </div>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => {
                              setFormData({
                                ...formData,
                                items: formData.items.filter(
                                  (_, i) => i !== index
                                ),
                              });
                            }}
                          >
                            <X className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </form>
          </div>

          <DialogFooter className="flex-shrink-0 border-t pt-3 flex-col sm:flex-row gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              className="w-full sm:w-auto"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={
                !formData.createdBy ||
                !formData.warehouseLocation ||
                !formData.leadTime ||
                formData.items.length === 0 ||
                isSubmitting
              }
              onClick={handleSubmit}
              className="w-full sm:w-auto"
            >
              {isSubmitting ? (
                <>
                  <span className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                  Creating...
                </>
              ) : (
                <>
                  Create Indent ({formData.items.length} item
                  {formData.items.length !== 1 ? "s" : ""})
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* === ADD ITEM SUB-MODAL (UNCHANGED) === */}
      <Dialog open={addItemOpen} onOpenChange={setAddItemOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col p-4 sm:p-6">
          <DialogHeader className="flex-shrink-0">
            <DialogTitle>Add Multiple Items</DialogTitle>
            <p className="text-sm text-gray-600">
              Add one or more items to the indent.
            </p>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto space-y-3 pr-2">
            <form onSubmit={handleAddItem} className="space-y-3">
              {itemForm.items.map((item, index) => (
                <div key={index} className="border rounded-lg p-3 relative">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-medium text-sm">Item {index + 1}</h3>
                    {itemForm.items.length > 1 && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => removeItem(index)}
                        className="text-red-600 hover:text-red-700 h-8"
                      >
                        Remove
                      </Button>
                    )}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <Label>Category</Label>
                      <Combobox
                        options={categoryOptions}
                        value={item.category}
                        onChange={(val) => updateItem(index, "category", val)}
                        placeholder="Select category"
                        searchPlaceholder="Search category..."
                      />
                    </div>

                    <div className="space-y-2">
                      <Label>Item Name</Label>
                      <Combobox
                        options={item.category ? getItemsByCategory(item.category).map(i => i.itemName) : []}
                        value={item.itemName}
                        onChange={(val) => updateItem(index, "itemName", val)}
                        placeholder={item.category ? "Select item" : "Select category first"}
                        searchPlaceholder="Search item..."
                        disabled={!item.category}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label>Quantity</Label>
                      <Input
                        type="number"
                        min="1"
                        placeholder="e.g. 5"
                        value={item.quantity}
                        onChange={(e) =>
                          updateItem(index, "quantity", e.target.value)
                        }
                        required
                      />
                    </div>

                    <div className="space-y-2">
                      <Label>UOM</Label>
                      <Select
                        value={item.uom}
                        onValueChange={(val) =>
                          updateItem(index, "uom", val)
                        }
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Unit" />
                        </SelectTrigger>
                        <SelectContent>
                          {uomOptions.map((opt) => (
                            <SelectItem key={opt} value={opt}>
                              {opt}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label>Item Code</Label>
                      <Input
                        type="text"
                        placeholder="e.g. IC-001"
                        value={item.itemCode}
                        onChange={(e) =>
                          updateItem(index, "itemCode", e.target.value)
                        }
                        required
                      />
                    </div>
                  </div>
                </div>
              ))}

              <div className="flex justify-center pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={addNewItem}
                  className="w-full"
                  size="sm"
                >
                  + Add Another Item
                </Button>
              </div>

              <DialogFooter className="flex-col sm:flex-row gap-2 pt-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setAddItemOpen(false)}
                  className="w-full sm:w-auto"
                >
                  Cancel
                </Button>
                <Button type="submit" className="w-full sm:w-auto">
                  Add {itemForm.items.length} Item
                  {itemForm.items.length > 1 ? "s" : ""} to Indent
                </Button>
              </DialogFooter>
            </form>
          </div>
        </DialogContent>
      </Dialog>

      {/* === EDIT RECORD MODAL === */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] flex flex-col p-4 sm:p-6">
          <DialogHeader className="flex-shrink-0">
            <DialogTitle>Edit Indent Record</DialogTitle>
            <p className="text-sm text-gray-600">
              {editingRecord ? `Editing: ${editingRecord.data.indentNumber}` : ""}
            </p>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto space-y-4 pr-2">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                updateRecordInSheet();
              }}
              className="space-y-4"
            >
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Created By</Label>
                  <Select
                    value={editFormData.createdBy}
                    onValueChange={(val) =>
                      setEditFormData({ ...editFormData, createdBy: val })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select creator" />
                    </SelectTrigger>
                    <SelectContent>
                      {createdByOptions.map((option) => (
                        <SelectItem key={option} value={option}>
                          {option}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Warehouse Location</Label>
                  <Select
                    value={editFormData.warehouseLocation}
                    onValueChange={(val) =>
                      setEditFormData({ ...editFormData, warehouseLocation: val })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select warehouse" />
                    </SelectTrigger>
                    <SelectContent>
                      {warehouseOptions.map((option) => (
                        <SelectItem key={option} value={option}>
                          {option}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Category</Label>
                  <Combobox
                    options={categoryOptions}
                    value={editFormData.category}
                    onChange={(val) =>
                      setEditFormData({
                        ...editFormData,
                        category: val,
                        itemName: "",
                        itemCode: ""
                      })
                    }
                    placeholder="Select category"
                    searchPlaceholder="Search category..."
                  />
                </div>

                <div className="space-y-2">
                  <Label>Item Name</Label>
                  <Combobox
                    options={editFormData.category ? getItemsByCategory(editFormData.category).map(i => i.itemName) : []}
                    value={editFormData.itemName}
                    onChange={(val) => {
                      const selectedItem = dropdownData.find(
                        d => d.category === editFormData.category && d.itemName === val
                      );
                      setEditFormData({
                        ...editFormData,
                        itemName: val,
                        itemCode: selectedItem?.itemCode || ""
                      });
                    }}
                    placeholder={editFormData.category ? "Select item" : "Select category first"}
                    searchPlaceholder="Search item..."
                    disabled={!editFormData.category}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Quantity</Label>
                  <Input
                    type="number"
                    min="1"
                    placeholder="Enter quantity"
                    value={editFormData.quantity}
                    onChange={(e) =>
                      setEditFormData({ ...editFormData, quantity: e.target.value })
                    }
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label>UOM</Label>
                  <Select
                    value={editFormData.uom}
                    onValueChange={(val) =>
                      setEditFormData({ ...editFormData, uom: val })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select UOM" />
                    </SelectTrigger>
                    <SelectContent>
                      {uomOptions.map((opt) => (
                        <SelectItem key={opt} value={opt}>
                          {opt}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Lead Time (Days)</Label>
                  <Input
                    type="number"
                    min="0"
                    placeholder="Enter lead time"
                    value={editFormData.leadTime}
                    onChange={(e) =>
                      setEditFormData({ ...editFormData, leadTime: e.target.value })
                    }
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Item Code</Label>
                <Input
                  type="text"
                  placeholder="Auto-filled"
                  value={editFormData.itemCode}
                  readOnly
                  className="bg-slate-50 font-mono"
                />
              </div>

              <div className="space-y-2">
                <Label>Attachment</Label>
                <div className="flex flex-col gap-3">
                  {editFormData.existingAttachmentUrl && !editFormData.attachment && (() => {
                    const isImage = editFormData.existingAttachmentUrl.match(/\.(jpg|jpeg|png|gif|webp)|(drive\.google\.com.*(id=|\/d\/))/i);
                    let previewUrl = editFormData.existingAttachmentUrl;

                    // Convert Google Drive link to direct image link for preview if possible
                    if (previewUrl.includes('drive.google.com')) {
                      const fileId = previewUrl.match(/\/d\/(.+?)\//)?.[1] || previewUrl.match(/id=(.+?)(&|$)/)?.[1];
                      if (fileId) {
                        previewUrl = `https://drive.google.com/uc?export=view&id=${fileId}`;
                      }
                    }

                    return (
                      <div className="relative group overflow-hidden rounded-xl border border-slate-200 bg-slate-100/50 aspect-video flex flex-col items-center justify-center transition-all hover:bg-slate-100">
                        {isImage ? (
                          <img
                            src={previewUrl}
                            alt="Previous attachment"
                            className="absolute inset-0 w-full h-full object-cover opacity-60 group-hover:opacity-100 transition-opacity"
                            onError={(e) => {
                              (e.target as HTMLImageElement).style.display = 'none';
                            }}
                          />
                        ) : null}

                        <div className="relative z-10 flex flex-col items-center gap-3">
                          <a
                            href={editFormData.existingAttachmentUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-2 bg-white/90 backdrop-blur-sm border border-slate-200 px-4 py-2 rounded-lg shadow-sm font-semibold text-slate-900 hover:bg-white hover:scale-105 transition-all text-sm"
                          >
                            <FileText className="w-4 h-4" />
                            Open Previous Attachment
                          </a>
                          {!isImage && (
                            <p className="text-[10px] text-slate-500 font-medium bg-slate-200/50 px-2 py-1 rounded">No image preview available</p>
                          )}
                        </div>
                      </div>
                    );
                  })()}

                  <input
                    id="edit-indent-attachment"
                    type="file"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) setEditFormData({ ...editFormData, attachment: file });
                    }}
                    className="hidden"
                  />
                  <label
                    htmlFor="edit-indent-attachment"
                    className="flex items-center justify-center w-full py-4 px-4 border-2 border-dashed border-slate-200 rounded-xl cursor-pointer hover:border-slate-400 hover:bg-slate-50 transition-all group"
                  >
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-slate-100 rounded-lg group-hover:bg-slate-200 transition-colors">
                        <Upload className="w-4 h-4 text-slate-600" />
                      </div>
                      <div className="text-left leading-tight">
                        <p className="text-sm font-semibold text-slate-700">
                          {editFormData.attachment ? "Change Document" : "Update Document"}
                        </p>
                        <p className="text-[10px] text-slate-500">PDF, JPG, PNG or DOC (max 10MB)</p>
                      </div>
                    </div>
                  </label>

                  {editFormData.attachment && (
                    <div className="flex items-center justify-between p-3 bg-blue-50/50 border border-blue-100 rounded-lg animate-in fade-in slide-in-from-top-1">
                      <div className="flex items-center gap-3">
                        <div className="p-1 bg-blue-100 rounded-md">
                          <FileText className="w-4 h-4 text-blue-600" />
                        </div>
                        <div className="flex flex-col leading-none">
                          <span className="text-xs font-semibold text-slate-900 truncate max-w-[200px]">
                            {editFormData.attachment.name}
                          </span>
                          <span className="text-[10px] text-slate-500 font-medium">New document selected</span>
                        </div>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-slate-400 hover:text-red-600"
                        onClick={() => setEditFormData({ ...editFormData, attachment: null })}
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                  )}
                </div>
              </div>

              <DialogFooter className="flex-col sm:flex-row gap-2 pt-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setEditOpen(false);
                    setEditingRecord(null);
                  }}
                  className="w-full sm:w-auto"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  className="w-full sm:w-auto"
                  disabled={isEditSubmitting}
                >
                  {isEditSubmitting ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    "Save Changes"
                  )}
                </Button>
              </DialogFooter>
            </form>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
