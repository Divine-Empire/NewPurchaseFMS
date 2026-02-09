"use client";

import React, { useState, useEffect } from "react";
// import { useWorkflow } from "@/lib/workflow-context";
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
import { Textarea } from "@/components/ui/textarea";
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
import { Badge } from "@/components/ui/badge";
import {
  CheckCircle2,
  XCircle,
  Package,
  Calendar,
  Warehouse,
  User,
  FileText,
  Hash,
  Clock,
  UserCheck,
  Tag,
  Upload,
  X,
  Loader2,
  Send,
  ClipboardList,
  History,
} from "lucide-react";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

export default function Stage2() {
  const [sheetRecords, setSheetRecords] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [selectedRecords, setSelectedRecords] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState<"pending" | "history">("pending");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [approverOptions, setApproverOptions] = useState<string[]>([]);

  const [approvalForm, setApprovalForm] = useState({
    approvedBy: "",
    status: "",
    approvedQty: "",
    vendorType: "",
    remarks: "",
    attachment: null as File | null,
  });

  // State for per-line overrides in the bulk modal
  const [lineItemsData, setLineItemsData] = useState<Record<string, { approvedQty: string; status: string; vendorType: string }>>({});

  // Initialize lineItemsData when modal opens
  useEffect(() => {
    if (isModalOpen) {
      const initial: Record<string, { approvedQty: string; status: string; vendorType: string }> = {};
      selectedRecords.forEach(id => {
        const item = sheetRecords.find(r => r.id === id);
        initial[id] = {
          approvedQty: item?.data.quantity || "",
          status: "approved",
          vendorType: "regular"
        };
      });
      setLineItemsData(initial);
    }
  }, [isModalOpen]);

  // const approvers = ["John Doe", "Jane Smith", "Bob Johnson"]; // Replaced by dynamic fetch

  const formatDate = (date: Date | string) => {
    if (!date) return "-";
    const d = new Date(date);
    if (isNaN(d.getTime())) return String(date);
    const day = String(d.getDate()).padStart(2, "0");
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const year = d.getFullYear();
    return `${day}/${month}/${year}`;
  };



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
      // User's script expects 'sheet' parameter
      const res = await fetch(`${SHEET_API_URL}?sheet=INDENT-LIFT&action=getAll`);
      const json = await res.json();
      if (json.success && Array.isArray(json.data)) {
        // Skip header (6 rows) -> Data starts at Row 7
        const rows = json.data.slice(6)
          .map((row: any, i: number) => ({ row, originalIndex: i + 7 }))
          .filter(({ row }: any) => row[1] && String(row[1]).trim() !== "") // CHECK COL B (Index 1 - Indent #)
          .map(({ row, originalIndex }: any) => {
            const hasPlan1 = !!row[9] && String(row[9]).trim() !== "" && String(row[9]).trim() !== "-";
            const hasActual1 = !!row[10] && String(row[10]).trim() !== "" && String(row[10]).trim() !== "-";

            let status = "not_ready";
            if (hasPlan1 && !hasActual1) {
              status = "pending";
            } else if (hasPlan1 && hasActual1) {
              status = "completed";
            }

            return {
              id: row[1] || `row-${originalIndex}`, // CHECK COL B (Index 1 - Indent #)
              rowIndex: originalIndex,
              stage: 2,
              status: status,
              createdAt: parseSheetDate(row[0]), // Index 0 is Timestamp
              history: [],
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
                // Approval fields
                plannedDate: row[9],
                actualDate: row[10],
                delay: row[11],
                approvedBy: row[12],
                status: row[13],
                approvedQty: row[14],
                vendorType: row[15],
                remarks: row[16]
              }
            };
          })
          .filter((r: any) => r.status !== "not_ready");
        setSheetRecords(rows);
      }
    } catch (e) {
      console.error("Fetch error:", e);
    }
    setIsLoading(false);
  };

  useEffect(() => {
    fetchData();

    // Fetch Approvers from Dropdown Sheet (Col F -> Index 5)
    const fetchApprovers = async () => {
      const SHEET_API_URL = process.env.NEXT_PUBLIC_API_URI;
      if (!SHEET_API_URL) return;
      try {
        const res = await fetch(`${SHEET_API_URL}?sheet=Dropdown&action=getAll`);
        const json = await res.json();
        if (json.success && Array.isArray(json.data)) {
          const opts = json.data.slice(1)
            .map((r: any) => r[5])
            .filter((x: any) => x && String(x).trim() !== "");
          setApproverOptions(opts);
        }
      } catch (e) {
        console.error("Error fetching approvers:", e);
      }
    };
    fetchApprovers();
  }, []);

  const pending = sheetRecords.filter((r) => r.status === "pending");
  const history = sheetRecords.filter((r) => r.status === "completed");

  const columns = [
    { key: "indentNumber", label: "Indent", icon: Hash },
    { key: "createdBy", label: "Created By", icon: User },
    { key: "category", label: "Category", icon: FileText },
    { key: "itemName", label: "Item", icon: Package },
    { key: "quantity", label: "Qty", icon: Package },
    { key: "approvedQty", label: "Approved Qty", icon: Package },
    { key: "warehouseLocation", label: "Warehouse", icon: Warehouse },
    { key: "itemCode", label: "Item Code", icon: Hash },
    { key: "leadTime", label: "Lead Time", icon: Calendar },
    { key: "plannedDate", label: "Planned 1", icon: Calendar },
    { key: "actualDate", label: "Actual 1", icon: Calendar },
    { key: "delay", label: "Delay", icon: Clock },
    { key: "approvedBy", label: "AppBy", icon: UserCheck },
    { key: "status", label: "Status", icon: Tag },
    { key: "remarks", label: "Remarks", icon: FileText },
  ] as const;

  // All columns selected by default
  const [selectedColumns, setSelectedColumns] = useState<string[]>(
    columns.map((c) => c.key)
  );

  const toggleRecord = (id: string) => {
    setSelectedRecords((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const toggleAll = () => {
    if (selectedRecords.length === pending.length) {
      setSelectedRecords([]);
    } else {
      setSelectedRecords(pending.map((r) => r.id));
    }
  };

  // Pre-fill first record qty when selection changes
  useEffect(() => {
    if (selectedRecords.length > 0) {
      const first = sheetRecords.find((r) => r.id === selectedRecords[0]);
      if (first) {
        setApprovalForm((prev) => ({
          ...prev,
          approvedQty: selectedRecords.length === 1 ? (first?.data.quantity ?? "") : "", // Only pre-fill if single record selected
          status: "approved",
        }));
      }
    }
  }, [selectedRecords, sheetRecords]);



  const submitToSheet = async (recordsToSubmit: any[], approvalData: any) => {
    const SHEET_API_URL = process.env.NEXT_PUBLIC_API_URI;
    if (!SHEET_API_URL) return;

    try {
      // Upload image if attachment exists
      let imageUrl = "";
      if (approvalData.attachment) {
        try {
          const toBase64 = (file: File) => new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = () => resolve(reader.result as string);
            reader.onerror = error => reject(error);
          });

          const base64Data = await toBase64(approvalData.attachment);

          const uploadParams = new URLSearchParams();
          uploadParams.append("action", "uploadFile");
          uploadParams.append("sheetName", "INDENT-LIFT");
          uploadParams.append("base64Data", base64Data);
          uploadParams.append("fileName", approvalData.attachment.name);
          uploadParams.append("mimeType", approvalData.attachment.type);
          const folderId = process.env.NEXT_PUBLIC_IMAGE_FOLDER_ID || "1SihRrPrgbuPGm-09fuB180QJhdxq5Nxy";
          uploadParams.append("folderId", folderId);

          const uploadRes = await fetch(SHEET_API_URL, {
            method: "POST",
            body: uploadParams,
          });

          const uploadJson = await uploadRes.json();
          if (uploadJson.success) {
            imageUrl = uploadJson.fileUrl;
          } else {
            console.error("Image upload failed:", uploadJson.error);
          }
        } catch (error) {
          console.error("Image processing error:", error);
        }
      }

      let successCount = 0;

      // Fetch latest data to avoid overwrites
      const refreshRes = await fetch(`${SHEET_API_URL}?sheet=INDENT-LIFT&action=getAll`);
      const refreshJson = await refreshRes.json();
      const allRows = Array.isArray(refreshJson.data) ? refreshJson.data : [];

      for (const record of recordsToSubmit) {
        const currentRowIndex = record.rowIndex - 1;
        const existingRow = allRows[currentRowIndex] || [];

        // ✅ UPDATED: sparse row (only update touched columns)
        const rowArray: any[] = [];

        const actualDate = new Date(); // Get current date as Date object

        const itemData = (approvalData as any).lineData?.[record.id];
        const finalStatus = itemData?.status || approvalData.status || "approved";
        const finalQty = itemData?.approvedQty || approvalData.approvedQty || record.data.quantity;
        const finalVendorType = itemData?.vendorType || approvalData.vendorType || "regular";

        // Send dates as JavaScript Date objects (not strings)
        // Column K (index 10): Actual 1 Date
        rowArray[10] = actualDate; // Send as Date object, not string

        rowArray[12] = approvalData.approvedBy; // M: Approved By
        rowArray[13] = finalStatus; // N: Status
        rowArray[14] = finalQty; // O: Approved Qty
        rowArray[15] = finalVendorType; // P: Vendor Type
        rowArray[16] = approvalData.remarks; // Q: Remarks
        rowArray[17] = imageUrl || ""; // R: Image URL

        const params = new URLSearchParams();
        params.append("action", "update");
        params.append("sheetName", "INDENT-LIFT");
        params.append("rowIndex", record.rowIndex.toString());
        params.append("rowData", JSON.stringify(rowArray));

        const res = await fetch(SHEET_API_URL, {
          method: "POST",
          body: params,
        });
        const result = await res.json();
        if (result.success) successCount++;
      }

      if (successCount > 0) {
        console.log(`Updated ${successCount} records successfully ✅`);
        fetchData();
      }
    } catch (e) {
      console.error("Error submitting Stage 2 data:", e);
      alert("Submission failed. Check console.");
    }
  };

  // Handle Update Logic
  const handleBulkApprove = async () => {
    const recordsToProcess = selectedRecords
      .map((id) => sheetRecords.find((r) => r.id === id))
      .filter((r) => r !== undefined);

    if (recordsToProcess.length === 0) return;

    setIsSubmitting(true);
    await submitToSheet(recordsToProcess, { ...approvalForm, lineData: lineItemsData });
    setIsSubmitting(false);

    setSelectedRecords([]);
    setApprovalForm({
      approvedBy: "",
      status: "",
      approvedQty: "",
      vendorType: "",
      remarks: "",
      attachment: null,
    });
    setIsModalOpen(false);
    setLineItemsData({});
  };

  const selectedItems = pending.filter((r) =>
    selectedRecords.includes(r.id)
  );

  const isFormValid = true; // No required fields in global footer now

  /* --------------------------------------------------------------------- */
  /* -------------------------- Column Selector -------------------------- */
  /* --------------------------------------------------------------------- */
  const ColumnSelector = () => (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" className="w-64 justify-start">
          {selectedColumns.length === columns.length
            ? "All columns"
            : `${selectedColumns.length} column${selectedColumns.length !== 1 ? "s" : ""
            } selected`}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-2">
        <div className="space-y-2">
          <div className="flex items-center space-x-2 pb-2 border-b">
            <Checkbox
              checked={selectedColumns.length === columns.length}
              onCheckedChange={(c) => {
                if (c) setSelectedColumns(columns.map((col) => col.key));
                else setSelectedColumns([]);
              }}
            />
            <Label className="text-sm font-medium">All Columns</Label>
          </div>

          {columns.map((col) => (
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
  );

  /* --------------------------------------------------------------------- */
  /* ------------------------------ Render ------------------------------- */
  /* --------------------------------------------------------------------- */
  return (
    <div className="p-6">
      {/* Header Card */}
      <div className="mb-6 p-6 bg-gradient-to-br from-slate-50 to-white border border-slate-200 rounded-xl shadow-sm">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-slate-900 rounded-lg shadow-slate-100 shadow-xl text-white">
              <UserCheck className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Stage 2: Approval</h2>
              <p className="text-slate-500 font-medium text-sm">
                Review and approve/reject indents
              </p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="flex items-center gap-3">
              <Label className="text-sm font-semibold text-slate-600">Show Columns:</Label>
              <ColumnSelector />
            </div>
          </div>
        </div>
      </div>

      <Tabs
        value={activeTab}
        onValueChange={(v) => setActiveTab(v as any)}
        className="w-full"
      >
        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
          <TabsList className="bg-slate-100/50 p-1 rounded-xl h-auto grid grid-cols-2 gap-1 border border-slate-200/50 w-full md:max-w-md">
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
                {history.length}
              </Badge>
            </TabsTrigger>
          </TabsList>

          {selectedRecords.length > 0 && activeTab === "pending" && (
            <Button
              onClick={() => setIsModalOpen(true)}
              className="bg-slate-900 hover:bg-slate-800 text-white flex items-center gap-3 px-6 h-[60px] rounded-xl shadow-md transition-all hover:scale-[1.01] active:scale-[0.99]"
            >
              <Send className="w-4 h-4" />
              <span className="text-base font-semibold">Submit Approval ({selectedRecords.length})</span>
            </Button>
          )}
        </div>

        {/* ---------- PENDING ---------- */}
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
                    <TableHead className="w-12">
                      <Checkbox
                        checked={
                          pending.length > 0 &&
                          selectedRecords.length === pending.length
                        }
                        onCheckedChange={toggleAll}
                      />
                    </TableHead>
                    {columns
                      .filter((c) => selectedColumns.includes(c.key) &&
                        !["plannedDate", "actualDate", "delay", "approvedBy", "status", "remarks", "approvedQty"].includes(c.key))
                      .map((col) => (
                        <TableHead key={col.key}>
                          <div className="flex items-center gap-2">
                            {col.icon && <col.icon className="w-4 h-4" />}
                            {col.label}
                          </div>
                        </TableHead>
                      ))}
                  </TableRow>
                </TableHeader>

                <TableBody>
                  {pending.map((record) => (
                    <TableRow
                      key={record.id}
                      className="cursor-pointer hover:bg-slate-300/50 transition-colors odd:bg-white even:bg-slate-50/50 border-b border-slate-100/80"
                      onClick={() => toggleRecord(record.id)}
                    >
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <Checkbox
                          checked={selectedRecords.includes(record.id)}
                          onCheckedChange={() => toggleRecord(record.id)}
                        />
                      </TableCell>

                      {columns
                        .filter((c) => selectedColumns.includes(c.key) &&
                          !["plannedDate", "actualDate", "delay", "approvedBy", "status", "remarks", "approvedQty"].includes(c.key))
                        .map((col) => (
                          <TableCell key={col.key}>
                            {col.key === "leadTime"
                              ? `${record.data[col.key] ?? "-"} days`
                              : String(record.data[col.key] ?? "-")}
                          </TableCell>
                        ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </TabsContent>

        <TabsContent value="history" className="mt-6">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-24 bg-white border rounded-lg shadow-sm">
              <Loader2 className="w-12 h-12 animate-spin text-black mb-4" />
              <p className="text-lg font-medium text-gray-900">Loading History...</p>
              <p className="text-sm text-gray-500 mt-1">Fetching completed records</p>
            </div>
          ) : history.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <p className="text-lg">No completed records found</p>
            </div>
          ) : (
            <div className="border rounded-lg overflow-hidden shadow-sm">
              <Table>
                <TableHeader className="bg-slate-50">
                  <TableRow>
                    <TableHead className="w-12 text-center text-[10px] font-bold text-slate-400">#</TableHead>
                    {columns
                      .filter((c) => selectedColumns.includes(c.key) && c.key !== "plannedDate" && c.key !== "actualDate" && c.key !== "delay")
                      .map((col) => (
                        <TableHead key={col.key}>
                          <div className="flex items-center gap-2 text-xs font-bold text-slate-600">
                            {col.icon && <col.icon className="w-4 h-4" />}
                            {col.label}
                          </div>
                        </TableHead>
                      ))}
                  </TableRow>
                </TableHeader>

                <TableBody>
                  {history.map((record) => (
                    <TableRow
                      key={record.id}
                      className="transition-colors odd:bg-white even:bg-slate-50/50 hover:bg-slate-300/30 font-medium"
                    >
                      <TableCell className="w-12 text-center text-xs text-slate-400">
                        {record.rowIndex}
                      </TableCell>
                      {columns
                        .filter((c) => selectedColumns.includes(c.key) && c.key !== "plannedDate" && c.key !== "actualDate" && c.key !== "delay")
                        .map((col) => (
                          <TableCell
                            key={col.key}
                            className={`text-sm ${col.key === "approvedQty" ? "text-center" : ""}`}
                          >
                            {col.key === "leadTime"
                              ? `${record.data[col.key] ?? "-"} days`
                              : String(record.data[col.key] ?? "-")}
                          </TableCell>
                        ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* ------------------- APPROVAL MODAL ------------------- */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="max-w-[90vw] w-full p-0 overflow-hidden border-none shadow-2xl border-2 border-green-500">
          <div className="bg-slate-900 px-6 py-4 flex items-center justify-between ">
            <div className="flex items-center gap-3 ">
              <div className="p-2 bg-white/10 rounded-lg">
                <UserCheck className="w-5 h-5 text-white" />
              </div>
              <div>
                <DialogTitle className="text-white text-lg font-bold leading-none">
                  Bulk Approval
                </DialogTitle>
                <p className="text-slate-400 text-xs mt-1">
                  Processing {selectedRecords.length} selected indent{selectedRecords.length > 1 ? "s" : ""}
                </p>
              </div>
            </div>
            <Badge variant="secondary" className="bg-white/10 text-white border-white/20 px-3 py-1">
              Final Review
            </Badge>
          </div>

          <div className="p-6 space-y-8 bg-slate-50/30">
            {/* Selected items summary */}
            <div className="space-y-3">
              <div className="flex items-center justify-between px-1">
                <div className="flex items-center gap-2">
                  <ClipboardList className="w-4 h-4 text-slate-500" />
                  <span className="text-sm font-bold text-slate-700 uppercase tracking-tight">Active Items</span>
                </div>
                <span className="text-[10px] font-medium text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full border border-slate-200">
                  {selectedItems.length} records to update
                </span>
              </div>

              <div className="border border-slate-200 rounded-xl overflow-hidden bg-white shadow-sm ring-1 ring-slate-900/5">
                <div className="max-h-[220px] overflow-y-auto scrollbar-thin scrollbar-thumb-slate-200">
                  <Table>
                    <TableHeader className="bg-slate-50 sticky top-0 z-10">
                      <TableRow className="hover:bg-transparent border-b border-slate-200">
                        <TableHead className="w-[120px] h-10 px-4 text-[10px] font-extrabold text-slate-500 uppercase tracking-widest">Indent ID</TableHead>
                        <TableHead className="min-w-[200px] h-10 px-4 text-[10px] font-extrabold text-slate-500 uppercase tracking-widest">Item Description</TableHead>
                        <TableHead className="w-[80px] h-10 px-4 text-[10px] font-extrabold text-slate-500 uppercase tracking-widest text-center">Req. Qty</TableHead>
                        <TableHead className="w-[120px] h-10 px-4 text-[10px] font-extrabold text-slate-500 uppercase tracking-widest text-center">Status</TableHead>
                        <TableHead className="w-[120px] h-10 px-4 text-[10px] font-extrabold text-slate-500 uppercase tracking-widest text-center">Vendor Type</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {selectedItems.map((item) => (
                        <TableRow
                          key={item.id}
                          className="transition-all border-b border-slate-100 last:border-0 odd:bg-white even:bg-slate-50/80 hover:bg-slate-100/30"
                        >
                          <TableCell className="py-3 px-4 font-mono text-xs font-bold text-slate-900">{item.data.indentNumber}</TableCell>
                          <TableCell className="py-3 px-4 text-slate-600 text-xs font-medium">{item.data.itemName}</TableCell>
                          <TableCell className="py-2 px-4 text-center">
                            <div className="flex flex-col items-center gap-1">

                              <Input
                                type="number"
                                className="h-8 w-20 text-center text-xs font-bold border-slate-200 focus:ring-slate-900"
                                value={lineItemsData[item.id]?.approvedQty || ""}
                                onChange={(e) => setLineItemsData(prev => ({
                                  ...prev,
                                  [item.id]: { ...prev[item.id], approvedQty: e.target.value }
                                }))}
                              />
                            </div>
                          </TableCell>
                          <TableCell className="py-2 px-4 text-center">
                            <Select
                              value={lineItemsData[item.id]?.status || ""}
                              onValueChange={(v) => setLineItemsData(prev => ({
                                ...prev,
                                [item.id]: { ...prev[item.id], status: v }
                              }))}
                            >
                              <SelectTrigger className={`h-8 w-28 text-[10px] font-bold border-none shadow-sm capitalize ${lineItemsData[item.id]?.status === 'approved'
                                ? "bg-emerald-500 text-white"
                                : "bg-rose-500 text-white"
                                }`}>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="approved" className="text-[10px] font-bold">Approved</SelectItem>
                                <SelectItem value="rejected" className="text-[10px] font-bold text-rose-600">Rejected</SelectItem>
                              </SelectContent>
                            </Select>
                          </TableCell>
                          <TableCell className="py-2 px-4 text-center">
                            <Select
                              value={lineItemsData[item.id]?.vendorType || ""}
                              onValueChange={(v) => setLineItemsData(prev => ({
                                ...prev,
                                [item.id]: { ...prev[item.id], vendorType: v }
                              }))}
                            >
                              <SelectTrigger className="h-8 w-28 text-[10px] font-bold border-slate-200 shadow-sm capitalize bg-white text-slate-700">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="regular" className="text-[10px] font-bold">Regular Vendor</SelectItem>
                                <SelectItem value="new vendor" className="text-[10px] font-bold">New Vendor</SelectItem>
                              </SelectContent>
                            </Select>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleBulkApprove();
              }}
              className="space-y-6"
            >
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="md:col-span-2 space-y-6">
                  <div className="grid grid-cols-2 gap-4">
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider ml-1">
                      Final Remarks {approvalForm.status === "rejected" && <span className="text-rose-500">*</span>}
                    </Label>
                    <Textarea
                      placeholder="Enter detailed approval/rejection notes..."
                      className="bg-white border-slate-200 shadow-sm resize-none min-h-[90px] focus:ring-slate-900"
                      value={approvalForm.remarks}
                      onChange={(e) => setApprovalForm((p) => ({ ...p, remarks: e.target.value }))}
                      required={approvalForm.status === "rejected"}
                    />
                  </div>
                </div>

              </div>

              <div className="flex items-center justify-between pt-4 border-t border-slate-200">
                <Button
                  type="button"
                  variant="ghost"
                  className="px-6 h-11 font-bold text-slate-400 hover:text-slate-900 border border-transparent hover:border-slate-100 hover:bg-white transition-all rounded-lg"
                  onClick={() => {
                    setIsModalOpen(false);
                    setSelectedRecords([]);
                  }}
                >
                  Discard Changes
                </Button>

                <Button
                  type="submit"
                  className={`px-10 h-11 rounded-lg font-bold shadow-xl transition-all active:scale-[0.98] ${approvalForm.status === "rejected"
                    ? "bg-rose-600 hover:bg-rose-700 shadow-rose-200/50"
                    : "bg-slate-900 hover:bg-slate-800 shadow-slate-200/50"
                    }`}
                  disabled={!isFormValid || isSubmitting}
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Processing Request...
                    </>
                  ) : (
                    <div className="flex items-center gap-2">
                      {approvalForm.status === "rejected" ? <XCircle className="w-4 h-4" /> : <Send className="w-4 h-4" />}
                      <span>{approvalForm.status === "rejected" ? "Reject Selection" : "Complete Approval"}</span>
                    </div>
                  )}
                </Button>
              </div>
            </form>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}