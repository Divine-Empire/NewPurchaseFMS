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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import {
  FileText,
  Upload,
  X,
  Shield,
  ShieldCheck,
  CheckCircle2,
  Plus,
  Trash2,
  Loader2,
  Truck,
  ClipboardList,
  History,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

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
  paymentStatus?: string;
  expectedDeliveryDate?: string;
}

interface RecordLifting {
  recordId: string;
  status: string;
  followUpDate?: string;
  remarks?: string;
  quantity?: number | string;
  liftingData: LiftingEntry;
  indentNumber: string;
}

export default function Stage6() {
  const [open, setOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"pending" | "history">("pending");
  const [selectedRecordIds, setSelectedRecordIds] = useState<string[]>([]);
  const [bulkFormData, setBulkFormData] = useState<RecordLifting[]>([]);
  const [liftCounter, setLiftCounter] = useState(1);
  const [sheetRecords, setSheetRecords] = useState<any[]>([]);
  const [receivingAccountsData, setReceivingAccountsData] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Unified form mode state
  const [isUnifiedMode, setIsUnifiedMode] = useState(false);
  const [commonVendorPO, setCommonVendorPO] = useState<{ vendor: string; poNumber: string } | null>(null);
  const [vendorPOMismatchError, setVendorPOMismatchError] = useState<string | null>(null);
  const [unifiedFormData, setUnifiedFormData] = useState<{
    status: string;
    followUpDate: string;
    remarks: string;
    liftingData: LiftingEntry;
  } | null>(null);

  const baseColumns = [
    { key: "indentNumber", label: "Indent #", icon: null },
    { key: "itemName", label: "Item", icon: null },
    { key: "quantity", label: "Qty", icon: null },
  ];

  const [selectedColumns, setSelectedColumns] = useState<string[]>(
    baseColumns.map((c) => c.key)
  );

  const [transporterList, setTransporterList] = useState<string[]>([]);


  const formatDate = (date?: Date | string) => {
    if (!date) return "";
    const d = new Date(date);
    if (isNaN(d.getTime())) return "";
    return `${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()}`;
  };

  const parseSheetDate = (dateStr: string) => {
    if (!dateStr || dateStr === "-" || dateStr === "Invalid Date") return new Date();
    // Try standard parsing
    const d = new Date(dateStr);
    if (!isNaN(d.getTime())) return d;

    // Try parsing DD/MM/YYYY or DD/MM/YYYY, HH:mm:ss
    const dateTimeParts = dateStr.split(", ");
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
      // Fetch FMS (Main Data)
      const resFMS = await fetch(`${SHEET_API_URL}?sheet=INDENT-LIFT&action=getAll`);
      const jsonFMS = await resFMS.json();

      // Fetch RECEIVING-ACCOUNTS for History section
      const resReceiving = await fetch(`${SHEET_API_URL}?sheet=RECEIVING-ACCOUNTS&action=getAll`);
      const jsonReceiving = await resReceiving.json();

      // Process RECEIVING-ACCOUNTS data for history (starting from row 7, index 6)
      if (jsonReceiving.success && Array.isArray(jsonReceiving.data)) {
        const historyRows = jsonReceiving.data.slice(6)
          .filter((row: any) => row && row[1] && String(row[1]).trim() !== "") // Filter rows with Indent Number
          .map((row: any, i: number) => ({
            id: `receiving-${i}`,
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
          }));
        setReceivingAccountsData(historyRows);
      }

      // Fetch Dropdown sheet for Transporters (Column K / Index 10)
      const dropRes = await fetch(`${SHEET_API_URL}?sheet=Dropdown&action=getAll`);
      const dropJson = await dropRes.json();
      if (dropJson.success && Array.isArray(dropJson.data)) {
        const tList = dropJson.data.slice(1)
          .map((row: any) => String(row[10] || "").trim())
          .filter((t: string) => t !== "");
        setTransporterList(tList);
      }


      const completedIndentIds = new Set<string>();

      if (jsonFMS.success && Array.isArray(jsonFMS.data)) {
        // Skip header and first 6 data rows (indices 0-6) -> Data starts at Row 8
        const rows = jsonFMS.data.slice(6)
          .map((row: any, i: number) => ({ row, originalIndex: i + 7 }))
          .filter(({ row }: any) => row[1] && String(row[1]).trim() !== "") // Skip empty rows
          .map(({ row, originalIndex }: any) => {
            // Stage 6 completion check
            // PENDING IF: Plan 5 (58) !Empty AND Actual 5 (59) Empty 
            const hasPlan5 = !!row[60] && String(row[60]).trim() !== "" && String(row[60]).trim() !== "-";
            const hasActual5 = !!row[61] && String(row[61]).trim() !== "" && String(row[61]).trim() !== "-"; // Dispatch Date

            // Check Remaining Qty (BQ / Index 68)
            const remainingVal = parseFloat(row[68] || "0");
            const hasRemaining = !isNaN(remainingVal) && remainingVal > 0;

            const indentId = row[1] || `row-${originalIndex}`;
            // const isLiftDone = completedIndentIds.has(String(indentId).trim());

            // Status Logic:
            // Rely on FMS Actual 5 (Dispatch Date) for completion
            let status = "not_ready";
            // if (isLiftDone) { status = "completed"; } else ...

            if (hasPlan5) {
              if (hasRemaining) {
                status = "pending"; // Stay pending if there is remaining quantity to lift
              } else if (hasActual5) {
                status = "completed";
              } else {
                status = "pending";
              }
            }

            return {
              id: indentId,
              rowIndex: originalIndex,
              row: row, // Pass raw row for updates
              stage: 6,
              status: status,
              createdAt: parseSheetDate(row[0]),
              history: (status === "completed") ? [{ stage: 6, date: parseSheetDate(row[59] || row[58] || row[0]), data: {} }] : [],
              data: {
                timestamp: row[0],
                indentNumber: row[1],
                createdBy: row[2],
                category: row[3],
                itemName: row[4],
                quantity: (() => {
                  const remaining = parseFloat(row[68] || "0");
                  return remaining > 0 ? remaining : row[5];
                })(),
                warehouseLocation: row[6],
                deliveryDate: row[7] ? formatDate(row[7]) : "",
                leadTime: row[8],
                planned1: row[9] ? formatDate(row[9]) : "",
                actual1: row[10] ? formatDate(row[10]) : "",
                delay1: row[11],
                approvedBy: row[12],
                indentStatus: row[13], // Stage 1 Status
                approvedQty: row[14],
                vendorType: row[15],
                indentRemarks: row[16],
                img: row[17],

                // Vendor Info (from previous stages)
                selectedVendor: row[47],
                vendor1Name: row[21],
                vendor1Rate: row[22],
                vendor1Terms: row[23],
                vendor1DeliveryDate: row[24],
                vendor1WarrantyType: row[25],
                vendor1Attachment: row[28],

                vendor2Name: row[29],
                vendor2Rate: row[30],
                vendor2Terms: row[31],
                vendor2DeliveryDate: row[32],
                vendor2WarrantyType: row[33],
                vendor2Attachment: row[36],

                vendor3Name: row[37],
                vendor3Rate: row[38],
                vendor3Terms: row[39],
                vendor3DeliveryDate: row[40],
                vendor3WarrantyType: row[41],
                vendor3Attachment: row[44],

                // Stage 5 Data (needed for display in Stage 6)
                poNumber: row[54],
                basicValue: row[55],
                totalWithTax: row[56],
                paymentTerms: row[57], // This might be PO payment terms
                poCopy: row[58],
                poRemarks: row[59],

                // Stage 6 Data (Dispatch) - Correct Indices (BG=58, BH=59, BI=60, BJ=61, BK=62, BL=63)
                planned5: row[60],       // BG
                actual5: row[61],        // BH
                status: row[60],         // BI
                poNo: row[61],           // BJ
                nextFollow: row[62],     // BK
                remarks: row[63],        // BL

                // Lifting Data (Indices 64-72)
                liftingData: {
                  liftNumber: `LIFT-${originalIndex}`,
                  liftingQty: row[64],      // BM
                  transporterName: row[65], // BN
                  vehicleNumber: row[66],   // BO
                  contactNumber: row[67],   // BP
                  lrNumber: row[68],        // BQ
                  dispatchDate: row[69],    // BR
                  freightAmount: row[70],   // BS
                  advanceAmount: row[71],   // BT
                  paymentDate: row[72],     // BU
                  biltyCopy: row[73],       // BV
                },
              },
            };
          })
          .filter((item: any) => item.status !== "not_ready");

        setSheetRecords(rows);
      }
    } catch (error) {
      console.error("Error fetching data:", error);
      toast.error("Failed to fetch data from FMS or lift-accounts");
    } finally {
      setIsLoading(false);
    }
  };



  useEffect(() => {
    fetchData();
  }, []);

  const pending = sheetRecords.filter((r) => r.status === "pending");
  const completed = sheetRecords.filter((r) => r.status === "completed");

  const getLiftCounter = () => {
    const liftedCount = sheetRecords.reduce((acc, r) => {
      const lifts = r.data?.liftingData || [];
      return acc + lifts.length;
    }, 0);
    return liftedCount + 1;
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
      poNumber: record.data.poNumber || "-",
      basicValue: record.data.basicValue || "-",
      totalWithTax: record.data.totalWithTax || "-",
      poCopy: record.data.poCopy,
    };
  };

  // Helper function to check if Vendor and PO Number match for all selected records
  const checkVendorPOMatch = (recordIds: string[]): { isMatched: boolean; vendor: string; poNumber: string } => {
    if (recordIds.length === 0) return { isMatched: false, vendor: "", poNumber: "" };

    const firstRecord = sheetRecords.find((r) => r.id === recordIds[0])!;
    const firstVendorData = getVendorData(firstRecord);
    const firstVendor = firstVendorData.name || "";
    const firstPO = firstVendorData.poNumber || "";

    for (let i = 1; i < recordIds.length; i++) {
      const record = sheetRecords.find((r) => r.id === recordIds[i])!;
      const vendorData = getVendorData(record);
      const currentVendor = vendorData.name || "";
      const currentPO = vendorData.poNumber || "";

      if (currentVendor !== firstVendor || currentPO !== firstPO) {
        return { isMatched: false, vendor: "", poNumber: "" };
      }
    }

    return { isMatched: true, vendor: firstVendor, poNumber: firstPO };
  };

  const handleBulkOpen = () => {
    if (selectedRecordIds.length === 0) return;

    // Check if Vendor and PO Number match for all selected records
    const matchResult = checkVendorPOMatch(selectedRecordIds);

    if (selectedRecordIds.length > 1 && !matchResult.isMatched) {
      // Mismatch detected - set error and open dialog with error state
      setIsUnifiedMode(false);
      setVendorPOMismatchError("Vendor Name or PO number not matched for the selected items.");
      setCommonVendorPO(null);
      setUnifiedFormData(null);
      setBulkFormData([]);
      setOpen(true);
      return;
    }

    // Matched or single item - set up unified form mode
    setIsUnifiedMode(selectedRecordIds.length > 1);
    setVendorPOMismatchError(null);
    setCommonVendorPO({ vendor: matchResult.vendor, poNumber: matchResult.poNumber });

    // Set up unified form data (single form for all items)
    setUnifiedFormData({
      status: "lift-material",
      followUpDate: "",
      remarks: "",
      liftingData: {

        liftNumber: `LIFT-${String(getLiftCounter()).padStart(3, "0")}`,
        liftingQty: "",
        transporterName: "",
        vehicleNumber: "",
        contactNumber: "",
        lrNumber: "",
        biltyCopy: null,
        dispatchDate: new Date().toISOString().split("T")[0],
        expectedDeliveryDate: "",
        freightAmount: "",
        advanceAmount: "",
        paymentDate: "",
        paymentStatus: ""
      }
    });

    // Also maintain bulkFormData for reference (with selected record IDs)
    const initialData = selectedRecordIds.map((id) => {
      const record = sheetRecords.find((r) => r.id === id)!;
      const existLift = record.data.liftingData || {};

      return {
        recordId: id,
        status: "lift-material",
        followUpDate: "",

        remarks: "",
        liftingData: {
          liftNumber: existLift.liftNumber || `LIFT-${String(getLiftCounter()).padStart(3, "0")}`,
          liftingQty: existLift.liftQty || String(record.data.quantity || 0),
          transporterName: existLift.transporter || "",
          vehicleNumber: existLift.vehicleNo || "",
          contactNumber: existLift.contactNo || "",
          lrNumber: existLift.lrNo || "",
          biltyCopy: null,
          dispatchDate: existLift.dispatchDate || "",
          expectedDeliveryDate: existLift.expectedDeliveryDate || "",
          freightAmount: existLift.freightAmt || "",
          advanceAmount: existLift.advanceAmt || "",
          paymentDate: existLift.paymentDate || "",
          paymentStatus: ""
        },
        indentNumber: record.data.indentNumber,
        quantity: record.data.quantity,
      };
    });
    setBulkFormData(initialData);
    setOpen(true);
  };

  // Removed add/remove lifting entry functions since only one entry is allowed now.

  // Removed removeLiftingEntry as it's no longer needed.

  const updateLiftingEntry = (
    recordIndex: number,
    field: keyof LiftingEntry | 'paymentStatus',
    value: any
  ) => {
    setBulkFormData((prev) => {
      const updated = [...prev];
      updated[recordIndex].liftingData = {
        ...updated[recordIndex].liftingData,
        [field]: value,
      };
      return updated;
    });
  };

  const handleBulkSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setIsSubmitting(true);
      const now = new Date();
      const formatISO = (date: Date) => {
        if (!date) return "";
        return date.toISOString().split("T")[0];
      };

      const API_URL = process.env.NEXT_PUBLIC_API_URI;
      if (!API_URL) {
        toast.error("API URL not configured");
        return;
      }


      // 1. Fetch current RECEIVING-ACCOUNTS to check for existing rows
      let existingLiftData: any[] = [];
      try {
        const res = await fetch(`${API_URL}?sheet=RECEIVING-ACCOUNTS&action=getAll`);
        const json = await res.json();
        if (json.success && Array.isArray(json.data)) {
          existingLiftData = json.data;
        }
      } catch (err) {
        console.error("Failed to fetch RECEIVING-ACCOUNTS for deduplication", err);
      }


      // Calculate the next available row index manually to avoid gaps
      // Row 1-6 are headers (0-indexed: 0-5). Data starts at Row 7 (0-indexed: 6)
      // Find the last index that has data in Column 1 (Indent Number).
      let lastOccupiedIndex = 5; // Default: last header row is index 5 (Row 6)
      if (existingLiftData.length > 6) {
        for (let k = existingLiftData.length - 1; k >= 6; k--) {
          const row = existingLiftData[k];
          // Check Col 1 (Indent #) to see if row is real data
          if (row && row[1] && String(row[1]).trim() !== "") {
            lastOccupiedIndex = k;
            break;
          }
        }
      }
      let nextInsertIndex = lastOccupiedIndex + 1; // 0-based index for next insert (starts at 6 = Row 7)

      const rowsToInsert: any[] = []; // Will remain empty now, we use updatesToProcess for controlled insertion
      const updatesToProcess: { rowIndex: number, rowData: any[] }[] = [];
      const updatesToFMS: { rowIndex: number, rowData: any[] }[] = [];


      for (let i = 0; i < bulkFormData.length; i++) {
        // Use either the individual record (bulkFormData[i]) or overlay matching data from unifiedFormData if in unified mode
        let record = bulkFormData[i];

        if (isUnifiedMode && unifiedFormData) {
          // Clone the record and overlay unified data
          record = {
            ...record,
            status: unifiedFormData.status,
            followUpDate: unifiedFormData.followUpDate,
            remarks: unifiedFormData.remarks,
            liftingData: {
              ...record.liftingData, // Keep unique ID
              ...unifiedFormData.liftingData, // Apply common values 
              // BUT: Keep the unique liftNumber if needed, or use common? 
              // Requirement: "unified form is opened and the details entered in the form will be common to all"
              // implying common lifting details too.
              // However, liftNumber might need to be unique per row if it's a primary key.
              // Logic check: If all lifted together, maybe one Lift #? Or sequential?
              // Implementation: Let's assume unique Lift # per record is safer, but other details are common.
              // We'll regenerate a unique lift number if needed or keep existing one from record.
              liftNumber: record.liftingData.liftNumber || `LIFT-${String(getLiftCounter() + i).padStart(3, "0")}`,
              biltyCopy: unifiedFormData.liftingData.biltyCopy
            }
          };
        }

        const sheetRecord = sheetRecords.find((r) => r.id === record.recordId)!;
        const v = getVendorData(sheetRecord);

        let finalFileUrl = "";

        // 1. Handle File Upload if exists
        // Use the file from the record (which now contains the unified file if in unified mode)
        if (record.status === "lift-material" && record.liftingData.biltyCopy instanceof File) {
          const file = record.liftingData.biltyCopy as File;
          const fileBase64 = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve((reader.result as string).split(",")[1]);
            reader.onerror = reject;
            reader.readAsDataURL(file);
          });

          const uploadParams = new URLSearchParams();
          uploadParams.append("action", "uploadFile");
          uploadParams.append("base64Data", fileBase64);
          uploadParams.append("fileName", file.name);
          uploadParams.append("mimeType", file.type);
          const folderId = process.env.NEXT_PUBLIC_IMAGE_FOLDER_ID || "1SihRrPrgbuPGm-09fuB180QJhdxq5Nxy";
          uploadParams.append("folderId", folderId);

          try {
            const uploadRes = await fetch(API_URL, {
              method: "POST",
              body: uploadParams,
            });
            const uploadResult = await uploadRes.json();
            if (uploadResult.success) {
              finalFileUrl = uploadResult.fileUrl;
            } else {
              toast.warning(`File upload failed for ${record.indentNumber}, proceeding.`);
            }
          } catch (e) {
            console.error("Upload error", e);
          }
        }


        const lift = record.liftingData;
        const biltyLink = finalFileUrl || (typeof lift.biltyCopy === 'string' ? lift.biltyCopy : "");

        // Helper to format date as YYYY-MM-DD
        const toYMD = (dateStr: string) => {
          if (!dateStr) return "";
          const d = new Date(dateStr);
          if (isNaN(d.getTime())) return dateStr; // Return as-is if invalid
          const yyyy = d.getFullYear();
          const mm = String(d.getMonth() + 1).padStart(2, "0");
          const dd = String(d.getDate()).padStart(2, "0");
          return `${yyyy}-${mm}-${dd}`;
        };

        // Helper to format timestamp as M/D/YYYY HH:MM:SS
        const formatTimestamp = (date: Date) => {
          const month = date.getMonth() + 1;
          const day = date.getDate();
          const year = date.getFullYear();
          const hours = String(date.getHours()).padStart(2, "0");
          const minutes = String(date.getMinutes()).padStart(2, "0");
          const seconds = String(date.getSeconds()).padStart(2, "0");
          return `${month}/${day}/${year} ${hours}:${minutes}:${seconds}`;
        };

        // Current timestamp for column A
        const currentTimestamp = formatTimestamp(now);

        // Format dates as YYYY-MM-DD for backend
        const followUpDateFormatted = toYMD(record.followUpDate || "");
        const dispatchDateFormatted = toYMD(lift.dispatchDate || "") || formatISO(now);
        const paymentDateFormatted = toYMD(lift.paymentDate || "");
        const expectedDeliveryDateFormatted = toYMD(lift.expectedDeliveryDate || "");

        // Build row based on status
        // For "follow-up": Only columns F (5) and G (6) get real data
        // For "lift-material": All columns get data

        // Calculate Remaining Quantity
        const currentQty = parseFloat(String(record.quantity || "0"));
        const liftQty = parseFloat(String(lift.liftingQty || "0"));
        const remainingQty = Math.max(0, currentQty - liftQty); // Ensure non-negative

        // ALWAYS INSERT Logic for RECEIVING-ACCOUNTS (History)
        // We do not check for existing rows anymore. Every lift is a new history entry.

        // Prepare row for RECEIVING-ACCOUNTS
        let receivingAccountRow: string[];

        if (record.status === "follow-up") {
          // Follow-up only: Store Next Follow-Up Date (F) and Remarks (G)
          receivingAccountRow = new Array(76).fill(""); // Extended to cover BX (Index 75)
          receivingAccountRow[0] = currentTimestamp;                        // A: Timestamp (M/D/YYYY HH:MM:SS)
          receivingAccountRow[1] = sheetRecord.data.indentNumber || "";   // B: Indent Number
          receivingAccountRow[2] = "";                                     // C: Lift No.
          receivingAccountRow[3] = v.name || "";                          // D: Vendor Name
          receivingAccountRow[4] = v.poNumber || "";                      // E: PO Number
          receivingAccountRow[5] = followUpDateFormatted;                 // F: Next Follow-Up Date (YYYY-MM-DD)
          receivingAccountRow[6] = record.remarks || "";                  // G: Remarks
          receivingAccountRow[7] = sheetRecord.data.itemName || "";       // H: Item Name
          // Leave lifting columns 8-18 empty for follow-up
          // Leave intermediate empty
          // Expected Delivery Date at Index 75 (BX) - usually for lifting, but if applicable for follow-up?
          // Keeping it blank for follow-up unless meaningful.
        } else {
          // Lift Material: Full row with all data
          // Initialize array with empty strings up to index 75 (76 elements)
          receivingAccountRow = new Array(76).fill("");

          receivingAccountRow[0] = currentTimestamp;                            // 0/A: Timestamp (M/D/YYYY HH:MM:SS)
          receivingAccountRow[1] = sheetRecord.data.indentNumber || "";       // 1/B: Indent Number
          receivingAccountRow[2] = lift.liftNumber || "";                     // 2/C: Lift No.
          receivingAccountRow[3] = v.name || "";                              // 3/D: Vendor Name
          receivingAccountRow[4] = v.poNumber || "";                          // 4/E: PO Number
          receivingAccountRow[5] = followUpDateFormatted;                     // 5/F: Next Flw-Up Date (YYYY-MM-DD)
          receivingAccountRow[6] = record.remarks || "";                      // 6/G: Remarks
          receivingAccountRow[7] = sheetRecord.data.itemName || "";           // 7/H: Item Name
          receivingAccountRow[8] = lift.liftingQty || "";                     // 8/I: Lifting Qty
          receivingAccountRow[9] = lift.transporterName || "";                // 9/J: Transporter Name
          receivingAccountRow[10] = lift.vehicleNumber || "";                  // 10/K: Vehicle No.
          receivingAccountRow[11] = lift.contactNumber || "";                  // 11/L: Contact No.
          receivingAccountRow[12] = lift.lrNumber || "";                       // 12/M: LR No.
          receivingAccountRow[13] = dispatchDateFormatted;                     // 13/N: Dispatch Date (YYYY-MM-DD)
          receivingAccountRow[14] = lift.freightAmount || "";                  // 14/O: Freight Amount
          receivingAccountRow[15] = lift.advanceAmount || "";                  // 15/P: Advance Amount
          receivingAccountRow[16] = paymentDateFormatted;                      // 16/Q: Payment Date (YYYY-MM-DD)
          receivingAccountRow[17] = lift.paymentStatus || "";                  // 17/R: Payment Status
          receivingAccountRow[18] = biltyLink;                                 // 18/S: Bilty Copy

          // Index 75 (Column BX): Expected Delivery Date
          receivingAccountRow[75] = expectedDeliveryDateFormatted;
        }

        // Insert at next available position
        updatesToProcess.push({
          rowIndex: nextInsertIndex + 1, // 0-based to 1-based
          rowData: receivingAccountRow
        });
        nextInsertIndex++;

        // PREPARE UPDATE FOR INDENT-LIFT (Mark as Completed or Update Follow-up)
        // Safety Check for sheetRecord.row
        if (!sheetRecord.row || !Array.isArray(sheetRecord.row)) {
          console.error("Missing row data for", record.recordId);
          continue;
        }

        // FIX: Use empty strings array to prevent overwriting other columns
        // INDENT-LIFT has many columns, ensure we cover up to index 68 (BQ)
        const fmsRow = new Array(70).fill("");

        // Only update relevant columns
        const yyyy = now.getFullYear();
        const mm = String(now.getMonth() + 1).padStart(2, "0");
        const dd = String(now.getDate()).padStart(2, "0");

        // If lifting, update Dispatch Date and Remaining Qty
        if (record.status === "lift-material") {
          fmsRow[61] = `${yyyy}-${mm}-${dd}`; // BJ (Index 61): Current Date (YYYY-MM-DD) - as before
          fmsRow[68] = remainingQty.toString(); // BQ (Index 68): Remaining Qty
        } else {
          // For follow-up, maybe update something else? Kept logic minimal to avoid side effects
          // fmsRow[61] = ...? If just follow up, maybe don't set BJ?
          // Original code set BJ for everything. Keeping consistent:
          fmsRow[61] = `${yyyy}-${mm}-${dd}`;
        }

        updatesToFMS.push({
          rowIndex: sheetRecord.rowIndex,
          rowData: fmsRow
        });
      }

      // 2. Perform Batch Insert to RECEIVING-ACCOUNTS (via updatesToProcess logical append)
      // Note: updatesToProcess now contains NEW rows only.

      // 3. Perform Updates to RECEIVING-ACCOUNTS
      if (updatesToProcess.length > 0) {
        console.log(`Inserting ${updatesToProcess.length} rows to RECEIVING-ACCOUNTS...`);
        for (const update of updatesToProcess) {
          const uParams = new URLSearchParams();
          uParams.append("action", "update");
          uParams.append("sheetName", "RECEIVING-ACCOUNTS");
          uParams.append("rowIndex", update.rowIndex.toString());
          uParams.append("rowData", JSON.stringify(update.rowData));
          await fetch(API_URL, { method: "POST", body: uParams });
        }
      }

      // 4. Perform Updates to INDENT-LIFT
      if (updatesToFMS.length > 0) {
        console.log(`Updating ${updatesToFMS.length} rows in INDENT-LIFT...`);
        for (const update of updatesToFMS) {
          const fmsParams = new URLSearchParams();
          fmsParams.append("action", "update");
          fmsParams.append("sheetName", "INDENT-LIFT");
          fmsParams.append("rowIndex", update.rowIndex.toString());
          // IMPORTANT: If we send empty strings for other columns, 'update' action might overwrite them with empty?
          // If the backend 'update' action merges or overwrites depends on implementation.
          // Usually 'update' overwrites the row.
          // IF IT OVERWRITES, WE MUST SEND ORIGINAL DATA for other columns!
          // BUT: The original code: const fmsRow = new Array(62).fill(""); ... fmsRow[61] = ...
          // checks if backend handles sparse updates? 
          // Re-reading logic: "fmsRow[61] = ..." suggests sparse array? No, `fill("")`.
          // If backend overwrites, this wipes data.
          // Let's assume standard behavior: we should probably map the ORIGINAL row and just change specific indices to be safe.
          // However, the previous code used `fill("")`. If that worked, then backend likely skips empty strings or specific logic?
          // Wait, previous code: `const fmsRow = new Array(62).fill(""); fmsRow[61] = ...`
          // This implies the backend might be designed to ONLY update non-empty values OR it was wiping data before?
          // User said "without disturbing unrelated code sections". 
          // I should stick to the pattern but extend array size to 69 (BQ is 68).

          fmsParams.append("rowData", JSON.stringify(update.rowData));
          await fetch(API_URL, { method: "POST", body: fmsParams });
        }
      }

      setOpen(false);
      resetBulk();
      await fetchData(); // Refresh data
    } catch (error: any) {
      console.error("Bulk submit error:", error);
      toast.error(error.message || "Failed to submit updates");
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetBulk = () => {
    setOpen(false);
    setSelectedRecordIds([]);
    setBulkFormData([]);
    // Reset unified form state
    setIsUnifiedMode(false);
    setCommonVendorPO(null);
    setVendorPOMismatchError(null);
    setUnifiedFormData(null);
  };



  const toggleSelect = (id: string) => {
    setSelectedRecordIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const selectAll = () => {
    if (selectedRecordIds.length === pending.length) {
      setSelectedRecordIds([]);
    } else {
      setSelectedRecordIds(pending.map((r) => r.id));
    }
  };

  // Validation for unified form mode or individual forms
  const isBulkValid = (() => {
    // If there's a mismatch error, form is not valid
    if (vendorPOMismatchError) return false;

    // Unified mode validation (single form for multiple items)
    if (isUnifiedMode && unifiedFormData) {
      if (!unifiedFormData.status) return false;
      if (unifiedFormData.status === "lift-material") {
        const e = unifiedFormData.liftingData;
        return !!(
          e.transporterName &&
          e.vehicleNumber &&
          e.contactNumber &&
          e.lrNumber &&
          e.biltyCopy &&
          e.dispatchDate &&
          e.freightAmount &&
          e.liftingQty
        );
      }
      return false;
    }

    // Single item mode (original logic)
    return bulkFormData.length > 0 &&
      bulkFormData.every((item) => {
        if (!item.status) return false;
        if (item.status === "lift-material") {
          const e = item.liftingData;
          return !!(
            e.transporterName &&
            e.vehicleNumber &&
            e.contactNumber &&
            e.lrNumber &&
            e.biltyCopy &&
            e.dispatchDate &&
            e.freightAmount &&
            e.liftingQty
          );
        }
        return false;
      });
  })();

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-6 p-6 bg-gradient-to-br from-slate-50 to-white border border-slate-200 rounded-xl shadow-sm">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-slate-900 rounded-lg shadow-slate-100 shadow-xl text-white">
              <Truck className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Stage 6: Vendor Follow-Up</h2>
              <p className="text-slate-500 font-medium text-sm">
                Track dispatch and material lift status
              </p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <Label className="text-sm font-medium">Show Columns:</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="w-64 justify-start">
                  {selectedColumns.length} selected
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-64 p-2">
                <div className="space-y-2">
                  <div className="flex items-center space-x-2 pb-2 border-b">
                    <Checkbox
                      checked={selectedColumns.length === baseColumns.length}
                      onCheckedChange={(c) => {
                        if (c)
                          setSelectedColumns(baseColumns.map((col) => col.key));
                        else setSelectedColumns([]);
                      }}
                    />
                    <Label className="text-sm font-medium">All Columns</Label>
                  </div>
                  {baseColumns.map((col) => (
                    <div
                      key={col.key}
                      className="flex items-center space-x-2 py-1"
                    >
                      <Checkbox
                        checked={selectedColumns.includes(col.key)}
                        onCheckedChange={(checked) => {
                          if (checked) {
                            setSelectedColumns((prev) => [...prev, col.key]);
                          } else {
                            setSelectedColumns((prev) =>
                              prev.filter((c) => c !== col.key)
                            );
                          }
                        }}
                      />
                      <Label className="text-sm">{col.label}</Label>
                    </div>
                  ))}
                </div>
              </PopoverContent>
            </Popover>
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
              <p className="text-lg">No pending follow-ups</p>
            </div>
          ) : (
            <>
              {/* Top action bar - like PO Entry module */}
              <div className="mb-4 flex items-center justify-between">
                <p className="text-sm text-gray-600">
                  {selectedRecordIds.length} item{selectedRecordIds.length !== 1 ? "s" : ""} selected
                </p>
                <Button
                  onClick={handleBulkOpen}
                  disabled={selectedRecordIds.length === 0}
                  size="sm"
                >
                  Follow-Up Selected
                </Button>
              </div>

              <div className="border rounded-lg overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12">
                        <Checkbox
                          checked={
                            selectedRecordIds.length === pending.length &&
                            pending.length > 0
                          }
                          onCheckedChange={selectAll}
                        />
                      </TableHead>
                      <TableHead className="text-right">Actions</TableHead>
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
                      <TableHead>PO Number</TableHead>
                      <TableHead>Basic Value</TableHead>
                      <TableHead>Total w/Tax</TableHead>
                      <TableHead>PO Copy</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pending.map((record) => {
                      const v = getVendorData(record);
                      return (
                        <TableRow key={record.id}>
                          <TableCell>
                            <Checkbox
                              checked={selectedRecordIds.includes(record.id)}
                              onCheckedChange={() => toggleSelect(record.id)}
                            />
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setSelectedRecordIds([record.id]);
                                handleBulkOpen();
                              }}
                            >
                              Follow-Up
                            </Button>
                          </TableCell>
                          {baseColumns
                            .filter((c) => selectedColumns.includes(c.key))
                            .map((col) => (
                              <TableCell key={col.key}>
                                {record.data[col.key] || "-"}
                              </TableCell>
                            ))}
                          <TableCell className="font-medium">{v.name}</TableCell>
                          <TableCell>₹{v.rate || "-"}</TableCell>
                          <TableCell>
                            {v.terms || "-"}
                          </TableCell>
                          <TableCell>
                            {v.delivery
                              ? new Date(v.delivery).toLocaleDateString("en-IN")
                              : "-"}
                          </TableCell>
                          <TableCell>
                            {v.warrantyType ? (
                              <div className="flex items-center gap-1 text-xs">
                                {v.warrantyType === "warranty" ? (
                                  <Shield className="w-3.5 h-3.5 text-blue-600" />
                                ) : (
                                  <ShieldCheck className="w-3.5 h-3.5 text-green-600" />
                                )}
                                <span className="capitalize">
                                  {v.warrantyType}
                                </span>
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
                          <TableCell className="font-mono">
                            {v.poNumber}
                          </TableCell>
                          <TableCell>₹{v.basicValue}</TableCell>
                          <TableCell>₹{v.totalWithTax}</TableCell>
                          <TableCell>
                            {v.poCopy ? (
                              <a
                                href={typeof v.poCopy === 'string' ? v.poCopy : undefined}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-1 text-green-600 hover:underline text-xs"
                              >
                                <FileText className="w-3.5 h-3.5" />
                                <span className="truncate max-w-20">
                                  {typeof v.poCopy === 'string' ? "View PO" : (v.poCopy as any).name}
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
            </>
          )}
        </TabsContent>

        {/* HISTORY - Displays data from RECEIVING-ACCOUNTS sheet */}
        <TabsContent value="history" className="mt-6">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-24 bg-white border rounded-lg shadow-sm">
              <Loader2 className="w-12 h-12 animate-spin text-black mb-4" />
              <p className="text-lg font-medium text-gray-900">Loading History...</p>
              <p className="text-sm text-gray-500 mt-1">Fetching records from RECEIVING-ACCOUNTS</p>
            </div>
          ) : receivingAccountsData.length === 0 ? (
            <div className="text-center py-12 text-gray-500 border rounded-lg bg-gray-50">
              <p className="text-lg">No records found</p>
            </div>
          ) : (
            <div className="border rounded-lg overflow-x-auto">
              <Table>
                <TableHeader className="bg-gray-100 sticky top-0">
                  <TableRow className="border-b-2">
                    <TableHead>Indent #</TableHead>
                    <TableHead>Lift No.</TableHead>
                    <TableHead>Vendor Name</TableHead>
                    <TableHead>PO Number</TableHead>
                    <TableHead>Next Follow-Up</TableHead>
                    <TableHead>Remarks</TableHead>
                    <TableHead>Item Name</TableHead>
                    <TableHead>Lifting Qty</TableHead>
                    <TableHead>Transporter</TableHead>
                    <TableHead>Vehicle No</TableHead>
                    <TableHead>Contact No</TableHead>
                    <TableHead>LR No</TableHead>
                    <TableHead>Dispatch Date</TableHead>
                    <TableHead>Freight Amt</TableHead>
                    <TableHead>Advance Amt</TableHead>
                    <TableHead>Payment Date</TableHead>
                    <TableHead>Payment Status</TableHead>
                    <TableHead>Bilty Copy</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {receivingAccountsData.map((row) => {
                    const formatDisplayDate = (d: any) => {
                      if (!d || d === "" || d === "-") return "-";
                      const date = new Date(d);
                      if (isNaN(date.getTime())) return d; // Return as-is if parsing fails
                      return date.toLocaleDateString("en-IN");
                    };

                    return (
                      <TableRow key={row.id} className="bg-green-50/50 hover:bg-green-100/50">
                        <TableCell className="font-medium">{row.indentNumber || "-"}</TableCell>
                        <TableCell>{row.liftNo || "-"}</TableCell>
                        <TableCell>{row.vendorName || "-"}</TableCell>
                        <TableCell className="font-mono">{row.poNumber || "-"}</TableCell>
                        <TableCell className="font-medium text-blue-700">{formatDisplayDate(row.nextFollowUpDate)}</TableCell>
                        <TableCell>{row.remarks || "-"}</TableCell>
                        <TableCell>{row.itemName || "-"}</TableCell>
                        <TableCell>{row.liftingQty || "-"}</TableCell>
                        <TableCell>{row.transporterName || "-"}</TableCell>
                        <TableCell>{row.vehicleNo || "-"}</TableCell>
                        <TableCell>{row.contactNo || "-"}</TableCell>
                        <TableCell>{row.lrNo || "-"}</TableCell>
                        <TableCell>{formatDisplayDate(row.dispatchDate)}</TableCell>
                        <TableCell>{row.freightAmount ? `₹${row.freightAmount}` : "-"}</TableCell>
                        <TableCell>{row.advanceAmount ? `₹${row.advanceAmount}` : "-"}</TableCell>
                        <TableCell>{formatDisplayDate(row.paymentDate)}</TableCell>
                        <TableCell>{row.paymentStatus || "-"}</TableCell>
                        <TableCell>
                          {row.biltyCopy ? (
                            <a
                              href={row.biltyCopy}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center gap-1 text-green-600 hover:underline text-xs"
                            >
                              <FileText className="w-3.5 h-3.5" />
                              <span>View Bilty</span>
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
          )}
        </TabsContent>
      </Tabs>

      {/* BULK MODAL */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-6xl max-h-[90vh] flex flex-col">
          <DialogHeader className="flex-shrink-0">
            <DialogTitle>Bulk Follow-Up & Dispatch</DialogTitle>
            <p className="text-sm text-gray-600">
              {vendorPOMismatchError
                ? "Cannot proceed with submission."
                : isUnifiedMode
                  ? `Updating ${bulkFormData.length} indents with common details.`
                  : "Update multiple indents at once."}
            </p>
          </DialogHeader>

          {/* Mismatch Error Message */}
          {vendorPOMismatchError ? (
            <div className="flex-1 flex flex-col items-center justify-center py-12">
              <div className="bg-red-50 border border-red-200 rounded-lg p-6 max-w-md text-center">
                <X className="w-12 h-12 text-red-500 mx-auto mb-4" />
                <h4 className="text-lg font-semibold text-red-700 mb-2">Cannot Proceed</h4>
                <p className="text-red-600">{vendorPOMismatchError}</p>
                <p className="text-sm text-gray-500 mt-4">
                  Please select items with the same Vendor and PO Number to use bulk follow-up.
                </p>
              </div>
            </div>
          ) : isUnifiedMode && unifiedFormData ? (
            /* Unified Form for Multiple Items with Matching Vendor/PO */
            <form
              onSubmit={handleBulkSubmit}
              className="flex-1 overflow-y-auto space-y-6 pr-2"
            >
              {/* Summary of Selected Indents */}
              <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
                <h4 className="font-semibold text-slate-800 mb-2">Selected Indents ({bulkFormData.length})</h4>
                <div className="flex flex-wrap gap-2 mb-3">
                  {bulkFormData.map((item) => {
                    const record = sheetRecords.find((r) => r.id === item.recordId);
                    return (
                      <Badge key={item.recordId} variant="secondary" className="bg-white">
                        {record?.data.indentNumber} - {record?.data.itemName}
                      </Badge>
                    );
                  })}
                </div>
                <div className="flex gap-4 text-sm text-slate-600">
                  <span><strong>Vendor:</strong> {commonVendorPO?.vendor}</span>
                  <span><strong>PO Number:</strong> {commonVendorPO?.poNumber}</span>
                </div>
              </div>

              {/* Unified Form Fields */}
              <div className="border rounded-lg p-6 bg-white shadow-sm">
                <h4 className="font-semibold text-lg mb-4">Common Details for All Selected Items</h4>

                <div className="space-y-4">
                  {/* Always Show Lift Material Form */}
                  <div className="space-y-4">



                    <div className="space-y-4">
                      <div className="flex justify-between items-center">
                        <h5 className="font-semibold text-green-900">Lifting Details</h5>
                        <div className="font-mono text-sm text-gray-500">
                          {unifiedFormData.liftingData.liftNumber}
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 bg-green-50/50 rounded-lg border border-green-100">
                        <div>
                          <Label className="text-xs font-semibold uppercase tracking-wider text-green-800">Lifting Qty *</Label>
                          <Input
                            type="number"
                            className="bg-white border-green-200 focus:ring-green-500"
                            value={unifiedFormData.liftingData.liftingQty}
                            onChange={(e) =>
                              setUnifiedFormData((prev) => prev ? {
                                ...prev,
                                liftingData: { ...prev.liftingData, liftingQty: e.target.value }
                              } : null)
                            }
                            required
                          />
                        </div>
                        <div>
                          <Label className="text-xs font-semibold uppercase tracking-wider text-green-800">Transporter *</Label>
                          <Select
                            value={unifiedFormData.liftingData.transporterName}
                            onValueChange={(val) =>
                              setUnifiedFormData((prev) => prev ? {
                                ...prev,
                                liftingData: { ...prev.liftingData, transporterName: val }
                              } : null)
                            }
                          >
                            <SelectTrigger className="bg-white border-green-200">
                              <SelectValue placeholder="Select transporter..." />
                            </SelectTrigger>
                            <SelectContent>
                              {transporterList.map((t) => (
                                <SelectItem key={t} value={t}>{t}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <Label className="text-xs font-semibold uppercase tracking-wider text-green-800">Vehicle No *</Label>
                          <Input
                            className="bg-white border-green-200 uppercase"
                            value={unifiedFormData.liftingData.vehicleNumber}
                            onChange={(e) =>
                              setUnifiedFormData((prev) => prev ? {
                                ...prev,
                                liftingData: { ...prev.liftingData, vehicleNumber: e.target.value.toUpperCase() }
                              } : null)
                            }
                            required
                          />
                        </div>
                        <div>
                          <Label className="text-xs font-semibold uppercase tracking-wider text-green-800">Contact No *</Label>
                          <Input
                            className="bg-white border-green-200"
                            value={unifiedFormData.liftingData.contactNumber}
                            onChange={(e) =>
                              setUnifiedFormData((prev) => prev ? {
                                ...prev,
                                liftingData: { ...prev.liftingData, contactNumber: e.target.value }
                              } : null)
                            }
                            required
                            placeholder="Driver contact info"
                          />
                        </div>
                        <div>
                          <Label className="text-xs font-semibold uppercase tracking-wider text-green-800">LR No *</Label>
                          <Input
                            className="bg-white border-green-200"
                            value={unifiedFormData.liftingData.lrNumber}
                            onChange={(e) =>
                              setUnifiedFormData((prev) => prev ? {
                                ...prev,
                                liftingData: { ...prev.liftingData, lrNumber: e.target.value }
                              } : null)
                            }
                            required
                          />
                        </div>
                        <div>
                          <Label className="text-xs font-semibold uppercase tracking-wider text-green-800">Dispatch Date *</Label>
                          <Input
                            type="date"
                            className="bg-white border-green-200"
                            value={unifiedFormData.liftingData.dispatchDate}
                            onChange={(e) =>
                              setUnifiedFormData((prev) => prev ? {
                                ...prev,
                                liftingData: { ...prev.liftingData, dispatchDate: e.target.value }
                              } : null)
                            }
                            required
                          />
                        </div>
                        <div>
                          <Label className="text-xs font-semibold uppercase tracking-wider text-green-800">Expected Delivery Date</Label>
                          <Input
                            type="date"
                            className="bg-white border-green-200"
                            value={unifiedFormData.liftingData.expectedDeliveryDate}
                            onChange={(e) =>
                              setUnifiedFormData((prev) => prev ? {
                                ...prev,
                                liftingData: { ...prev.liftingData, expectedDeliveryDate: e.target.value }
                              } : null)
                            }
                          />
                        </div>
                        <div>
                          <Label className="text-xs font-semibold uppercase tracking-wider text-green-800">Freight Amt *</Label>
                          <Input
                            type="number"
                            step="0.01"
                            className="bg-white border-green-200"
                            value={unifiedFormData.liftingData.freightAmount}
                            onChange={(e) =>
                              setUnifiedFormData((prev) => prev ? {
                                ...prev,
                                liftingData: { ...prev.liftingData, freightAmount: e.target.value }
                              } : null)
                            }
                            required
                          />
                        </div>
                        <div>
                          <Label className="text-xs font-semibold uppercase tracking-wider text-green-800">Advance Amt</Label>
                          <Input
                            type="number"
                            step="0.01"
                            className="bg-white border-green-200"
                            value={unifiedFormData.liftingData.advanceAmount}
                            onChange={(e) =>
                              setUnifiedFormData((prev) => prev ? {
                                ...prev,
                                liftingData: { ...prev.liftingData, advanceAmount: e.target.value }
                              } : null)
                            }
                          />
                        </div>
                        <div>
                          <Label className="text-xs font-semibold uppercase tracking-wider text-green-800">Payment Date</Label>
                          <Input
                            type="date"
                            className="bg-white border-green-200"
                            value={unifiedFormData.liftingData.paymentDate}
                            onChange={(e) =>
                              setUnifiedFormData((prev) => prev ? {
                                ...prev,
                                liftingData: { ...prev.liftingData, paymentDate: e.target.value }
                              } : null)
                            }
                          />
                        </div>
                        <div>
                          <Label className="text-xs font-semibold uppercase tracking-wider text-green-800">Payment Status</Label>
                          <Select
                            value={unifiedFormData.liftingData.paymentStatus || ""}
                            onValueChange={(val) =>
                              setUnifiedFormData((prev) => prev ? {
                                ...prev,
                                liftingData: { ...prev.liftingData, paymentStatus: val }
                              } : null)
                            }
                          >
                            <SelectTrigger className="bg-white border-green-200">
                              <SelectValue placeholder="Select status..." />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="to_pay">To Pay</SelectItem>
                              <SelectItem value="for_pay">For Pay</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="col-span-full">
                          <Label className="text-xs font-semibold uppercase tracking-wider text-green-800">Bilty Copy *</Label>
                          <input
                            type="file"
                            accept=".pdf,.jpg,.png"
                            onChange={(e) =>
                              setUnifiedFormData((prev) => prev ? {
                                ...prev,
                                liftingData: { ...prev.liftingData, biltyCopy: e.target.files?.[0] || null }
                              } : null)
                            }
                            className="hidden"
                            id="unified-file"
                          />
                          <label
                            htmlFor="unified-file"
                            className="flex items-center justify-center w-full p-4 border-2 border-dashed border-green-300 rounded-lg cursor-pointer bg-white hover:bg-green-50 transition-colors"
                          >
                            <Upload className="w-5 h-5 mr-3 text-green-600" />
                            <span className="text-green-700 font-medium">Upload Bilty Copy</span>
                          </label>
                          {unifiedFormData.liftingData.biltyCopy && (
                            <div className="mt-2 p-2 bg-white rounded border border-green-100 text-xs text-green-700 flex items-center gap-2">
                              <FileText className="w-4 h-4" />
                              <span className="font-medium truncate">{unifiedFormData.liftingData.biltyCopy.name}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="p-4 bg-blue-50 rounded border border-blue-100 mt-4 pt-4 border-t">
                      <Label>Remarks (Optional)</Label>
                      <Textarea
                        className="bg-white"
                        value={unifiedFormData.remarks}
                        onChange={(e) =>
                          setUnifiedFormData((prev) => prev ? {
                            ...prev,
                            remarks: e.target.value
                          } : null)
                        }
                      />
                    </div>
                  </div>
                </div>
              </div>
            </form>
          ) : (
            /* Original Individual Forms for Single Item */
            <form
              onSubmit={handleBulkSubmit}
              className="flex-1 overflow-y-auto space-y-8 pr-2"
            >
              {bulkFormData.map((item, recordIdx) => {
                const record = sheetRecords.find((r) => r.id === item.recordId)!;
                const v = getVendorData(record);
                return (
                  <div
                    key={item.recordId}
                    className="border rounded-lg p-6 bg-white shadow-sm"
                  >
                    <div className="flex items-center justify-between mb-4">
                      <div>
                        <h4 className="font-semibold text-lg">
                          Lift the Material - Indent #{record.data.indentNumber}
                        </h4>
                        <p className="text-sm text-gray-600">
                          {record.data.itemName} | Qty: {record.data.quantity} |
                          Vendor: {v.name}
                        </p>
                      </div>
                    </div>

                    <div className="space-y-4">
                      {/* Always Show Lift Material Form */}
                      <div className="space-y-4">




                        <div className="space-y-4">
                          <div className="flex justify-between items-center">
                            <h5 className="font-semibold text-green-900">Lifting Details</h5>
                            <div className="font-mono text-sm text-gray-500">
                              {item.liftingData.liftNumber}
                            </div>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 bg-green-50/50 rounded-lg border border-green-100">
                            <div>
                              <Label className="text-xs font-semibold uppercase tracking-wider text-green-800">Lifting Qty *</Label>
                              <Input
                                type="number"
                                className="bg-white border-green-200 focus:ring-green-500"
                                value={item.liftingData.liftingQty}
                                onChange={(e) =>
                                  updateLiftingEntry(
                                    recordIdx,
                                    "liftingQty",
                                    e.target.value
                                  )
                                }
                                required
                              />
                            </div>
                            <div>
                              <Label className="text-xs font-semibold uppercase tracking-wider text-green-800">Transporter *</Label>
                              <Select
                                value={item.liftingData.transporterName}
                                onValueChange={(val) =>
                                  updateLiftingEntry(
                                    recordIdx,
                                    "transporterName",
                                    val
                                  )
                                }
                              >
                                <SelectTrigger className="bg-white border-green-200">
                                  <SelectValue placeholder="Select transporter..." />
                                </SelectTrigger>
                                <SelectContent>
                                  {transporterList.map((t) => (
                                    <SelectItem key={t} value={t}>
                                      {t}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                            <div>
                              <Label className="text-xs font-semibold uppercase tracking-wider text-green-800">Vehicle No *</Label>
                              <Input
                                className="bg-white border-green-200 uppercase"
                                value={item.liftingData.vehicleNumber}
                                onChange={(e) =>
                                  updateLiftingEntry(
                                    recordIdx,
                                    "vehicleNumber",
                                    e.target.value.toUpperCase()
                                  )
                                }
                                required
                              />
                            </div>
                            <div>
                              <Label className="text-xs font-semibold uppercase tracking-wider text-green-800">Contact No *</Label>
                              <Input
                                className="bg-white border-green-200"
                                value={item.liftingData.contactNumber}
                                onChange={(e) =>
                                  updateLiftingEntry(
                                    recordIdx,
                                    "contactNumber",
                                    e.target.value
                                  )
                                }
                                required
                                placeholder="Driver contact info"
                              />
                            </div>
                            <div>
                              <Label className="text-xs font-semibold uppercase tracking-wider text-green-800">LR No *</Label>
                              <Input
                                className="bg-white border-green-200"
                                value={item.liftingData.lrNumber}
                                onChange={(e) =>
                                  updateLiftingEntry(
                                    recordIdx,
                                    "lrNumber",
                                    e.target.value
                                  )
                                }
                                required
                              />
                            </div>
                            <div>
                              <Label className="text-xs font-semibold uppercase tracking-wider text-green-800">Dispatch Date *</Label>
                              <Input
                                type="date"
                                className="bg-white border-green-200"
                                value={item.liftingData.dispatchDate}
                                onChange={(e) =>
                                  updateLiftingEntry(
                                    recordIdx,
                                    "dispatchDate",
                                    e.target.value
                                  )
                                }
                                required
                              />
                            </div>
                            <div>
                              <Label className="text-xs font-semibold uppercase tracking-wider text-green-800">Expected Delivery Date</Label>
                              <Input
                                type="date"
                                className="bg-white border-green-200"
                                value={item.liftingData.expectedDeliveryDate}
                                onChange={(e) =>
                                  updateLiftingEntry(
                                    recordIdx,
                                    "expectedDeliveryDate",
                                    e.target.value
                                  )
                                }
                              />
                            </div>
                            <div>
                              <Label className="text-xs font-semibold uppercase tracking-wider text-green-800">Freight Amt *</Label>
                              <Input
                                type="number"
                                step="0.01"
                                className="bg-white border-green-200"
                                value={item.liftingData.freightAmount}
                                onChange={(e) =>
                                  updateLiftingEntry(
                                    recordIdx,
                                    "freightAmount",
                                    e.target.value
                                  )
                                }
                                required
                              />
                            </div>
                            <div>
                              <Label className="text-xs font-semibold uppercase tracking-wider text-green-800">Advance Amt</Label>
                              <Input
                                type="number"
                                step="0.01"
                                className="bg-white border-green-200"
                                value={item.liftingData.advanceAmount}
                                onChange={(e) =>
                                  updateLiftingEntry(
                                    recordIdx,
                                    "advanceAmount",
                                    e.target.value
                                  )
                                }
                              />
                            </div>
                            <div>
                              <Label className="text-xs font-semibold uppercase tracking-wider text-green-800">Payment Date</Label>
                              <Input
                                type="date"
                                className="bg-white border-green-200"
                                value={item.liftingData.paymentDate}
                                onChange={(e) =>
                                  updateLiftingEntry(
                                    recordIdx,
                                    "paymentDate",
                                    e.target.value
                                  )
                                }
                              />
                            </div>
                            <div>
                              <Label className="text-xs font-semibold uppercase tracking-wider text-green-800">Payment Status</Label>
                              <Select
                                value={item.liftingData.paymentStatus || ""}
                                onValueChange={(val) =>
                                  updateLiftingEntry(
                                    recordIdx,
                                    "paymentStatus",
                                    val
                                  )
                                }
                              >
                                <SelectTrigger className="bg-white border-green-200">
                                  <SelectValue placeholder="Select status..." />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="to_pay">To Pay</SelectItem>
                                  <SelectItem value="for_pay">For Pay</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                            <div className="col-span-full">
                              <Label className="text-xs font-semibold uppercase tracking-wider text-green-800">Bilty Copy *</Label>
                              <input
                                type="file"
                                accept=".pdf,.jpg,.png"
                                onChange={(e) =>
                                  updateLiftingEntry(
                                    recordIdx,
                                    "biltyCopy",
                                    e.target.files?.[0] || null
                                  )
                                }
                                className="hidden"
                                id={`file-${recordIdx}`}
                              />
                              <label
                                htmlFor={`file-${recordIdx}`}
                                className="flex items-center justify-center w-full p-4 border-2 border-dashed border-green-300 rounded-lg cursor-pointer bg-white hover:bg-green-50 transition-colors"
                              >
                                <Upload className="w-5 h-5 mr-3 text-green-600" />
                                <span className="text-green-700 font-medium">Upload Bilty Copy</span>
                              </label>
                              {item.liftingData.biltyCopy && (
                                <div className="mt-2 p-2 bg-white rounded border border-green-100 text-xs text-green-700 flex items-center gap-2">
                                  <FileText className="w-4 h-4" />
                                  <span className="font-medium truncate">{item.liftingData.biltyCopy.name}</span>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="p-4 bg-blue-50 rounded border border-blue-100 mt-4 pt-4 border-t">
                        <Label>
                          Remarks (Optional)
                        </Label>
                        <Textarea
                          className="bg-white"
                          value={item.remarks}
                          onChange={(e) =>
                            setBulkFormData((prev) => {
                              const updated = [...prev];
                              updated[recordIdx].remarks = e.target.value;
                              return updated;
                            })
                          }
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </form>
          )}


          <DialogFooter className="flex-shrink-0 border-t pt-4 flex justify-between items-center bg-gray-50 px-6 py-4">

            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={resetBulk}>
                Cancel
              </Button>
              <Button onClick={handleBulkSubmit} disabled={!isBulkValid || isSubmitting}>
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Saving...
                  </>
                ) : (
                  "Submit All"
                )}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div >
  );
}
