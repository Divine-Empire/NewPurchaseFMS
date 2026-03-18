"use client";

import { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
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
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";
import {
  Truck,
  CheckCircle,
  Clock,
  Filter,
  Calendar,
  FileText,
  TrendingUp,
  Plus,
  Loader2,
  Download,
  Eye,
  Package,
  Users,
  ShieldAlert,
  Settings2,
} from "lucide-react";
import { toast } from "sonner";
import { parseSheetDate, formatDate } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

// Define all purchase order stages with pending counts (Excluding Create Indent)
const purchaseStages = [
  { id: 2, name: "Indent Approval", color: "bg-purple-500" },
  { id: 3, name: "Update 3 Vendors", color: "bg-indigo-500" },
  { id: 4, name: "Negotiation", color: "bg-cyan-500" },
  { id: 5, name: "PO Entry", color: "bg-teal-500" },
  { id: 6, name: "Follow-Up Vendor", color: "bg-emerald-500" },
  { id: 7, name: "Transporter Follow-Up", color: "bg-green-500" },
  { id: 8, name: "Material Received", color: "bg-lime-500" },
  { id: 9, name: "Warranty Information", color: "bg-yellow-500" },
  { id: 11, name: "Receipt in Tally", color: "bg-orange-500" },
  { id: 12, name: "Submit Invoice (HO)", color: "bg-red-500" },
  { id: 13, name: "Submit Invoice", color: "bg-rose-500" },
  { id: 14, name: "Verification by Accounts", color: "bg-pink-500" },
  { id: 15, name: "QC Requirement", color: "bg-fuchsia-500" },
  { id: 16, name: "Purchase Return", color: "bg-violet-500" },
  { id: 17, name: "Return Approval", color: "bg-indigo-600" },
  { id: 18, name: "Vendor Payment", color: "bg-slate-500" },
  { id: 19, name: "Freight Payments", color: "bg-zinc-500" },
];

export default function PurchaseDashboard() {
  const [activeTab, setActiveTab] = useState("overview");

  // Filter states
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [selectedParty, setSelectedParty] = useState("all");
  const [selectedMaterial, setSelectedMaterial] = useState("all");
  const [selectedStatus, setSelectedStatus] = useState("all");

  // Search states
  const [inTransitSearch, setInTransitSearch] = useState("");
  const [receivedSearch, setReceivedSearch] = useState("");
  const [pendingSearch, setPendingSearch] = useState("");
  const [warrantySearch, setWarrantySearch] = useState("");

  // Forms modal states
  const [formsMenuOpen, setFormsMenuOpen] = useState(false);
  const [itemFormOpen, setItemFormOpen] = useState(false);
  const [vendorFormOpen, setVendorFormOpen] = useState(false);
  const [transporterFormOpen, setTransporterFormOpen] = useState(false);

  // Form data states
  const [itemForm, setItemForm] = useState({
    category: "",
    itemName: "",
    uom: "",
  });

  const [vendorForm, setVendorForm] = useState({
    vendorName: "",
    contactPerson: "",
    phone: "",
    email: "",
    address: "",
  });

  const [transporterForm, setTransporterForm] = useState({
    transporterName: "",
    contactPerson: "",
    phone: "",
    vehicleType: "",
  });

  // Sort states
  const [inTransitSort, setInTransitSort] = useState({
    key: "date",
    direction: "desc",
  });
  const [receivedSort, setReceivedSort] = useState({
    key: "date",
    direction: "desc",
  });
  const [pendingSort, setPendingSort] = useState({
    key: "erp",
    direction: "asc",
  });
  const [warrantySort, setWarrantySort] = useState({
    key: "indentNo",
    direction: "desc",
  });

  const [warrantyVisibleColumns, setWarrantyVisibleColumns] = useState<string[]>([
    "indentNo",
    "liftNo",
    "serialNo",
    "vendorName",
    "itemName",
    "invoiceDate",
    "warrantyEnd"
  ]);

  const [warrantyMonthsFilter, setWarrantyMonthsFilter] = useState<string>("");

  const [totalPurchaseOrders, setTotalPurchaseOrders] = useState<number | null>(null);
  const [pendingPOs, setPendingPOs] = useState<number | null>(null);
  const [completedPOs, setCompletedPOs] = useState<number | null>(null);
  const [completionRate, setCompletionRate] = useState<number | null>(null);

  const [receivedItems, setReceivedItems] = useState<any[]>([]);
  const [inTransitItems, setInTransitItems] = useState<any[]>([]);
  const [purchaseItems, setPurchaseItems] = useState<any[]>([]);
  const [warrantyItems, setWarrantyItems] = useState<any[]>([]);
  const [overviewItems, setOverviewItems] = useState<any[]>([]);
  const [stageCounts, setStageCounts] = useState<any>({});
  const [stageOverdueCounts, setStageOverdueCounts] = useState<any>({});
  const [topReceivedOrders, setTopReceivedOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isGeneratingReport, setIsGeneratingReport] = useState(false);

  useEffect(() => {
    const fetchPOData = async () => {
      try {
        const response = await fetch(`${process.env.NEXT_PUBLIC_API_URI}?sheet=INDENT-LIFT`);
        const result = await response.json();

        if (result.success && result.data) {
          // Data starts from row 7, so we subtract 6 from the total rows if rows are >= 7
          // Assuming result.data contains all rows including empty leading ones if fetched by range,
          // OR if fetched by getDataRange(), it might exclude empty leading rows if they are truly empty.
          // However, user said "data is count from the INDENT-LIFT sheet... count is started from the row 7"
          // Let's assume result.data is the array of rows.

          // If the sheet has headers and data starting from row 7 properly structured:
          // We can just use result.data.length if the backend returns only the data range.
          // But based on "entries ... started from row 7", likely we need to be careful.
          // If the backend returns `sheet.getDataRange().getValues()`, it returns everything.
          // If the sheet is completely empty above row 7, getDataRange might start from row 7.

          // Let's use the user's specific logic: "total entries of this sheet will show and the count is started from the row 7"
          // If we get an array of rows, and we want to count items starting from implied row 7:
          // It's safest to assume the backend `fetchSheetData` (which I saw in the user prompt) uses `sheet.getDataRange().getDisplayValues()`.

          // Actually, let's look at the backend code provided in the prompt:
          // function fetchSheetData(sheetName) { ... var data = sheet.getDataRange().getDisplayValues(); ... }
          // This returns a 2D array of the used range.

          // If the sheet has data starting at row 7, and say row 1-6 are headers/empty... 
          // Implementation: Just show the length of the data array?
          // Wait, "count is started from the row 7". This implies row 1-6 are NOT query data.
          // A simple `data.length` might include the top 6 rows if they have content (headers etc).
          // So `Math.max(0, result.data.length - 6)` is a reasonable interpretation if the data range starts at A1.

          // BUT, `getDataRange()` shrinks to the actual data. If A1:A6 is empty, it starts at A7.
          // Given the ambiguity, I'll stick to the count of actual data rows returned, 
          // but if the user implies there's a strict "start from row 7" rule (meaning header/meta is above),
          // subtracting 6 is the explicit instruction derived from "count is started from the row 7".
          // HOWEVER, looking at the provided snippet: `const data = sheet.getDataRange().getValues();`

          // Let's go with the user's explicit instruction about row 7.
          // If the sheet has headers in row 1-6, `getDataRange` returns them.
          // So `result.data.length - 6` is the correct logic for "entries... started from row 7".

          const totalRows = result.data.length;
          const count = Math.max(0, totalRows - 6);
          setTotalPurchaseOrders(count);

          // Calculate Pending & Completed POs
          let pendingCount = 0;
          let completedCount = 0;
          const parsedPurchaseItems = [];
          const parsedOverviewItems = [];

          if (totalRows > 6) {
            for (let i = 6; i < totalRows; i++) {
              const row = result.data[i];
              // Skip empty rows (Indent No is in Column B, index 1)
              if (!row || !row[1]) continue;

              // Ensure row has enough columns just in case
              if (row.length > 51) {
                const azValue = row[51];
                const baValue = row[52]; // Might be undefined

                const isAzNotNull = azValue !== null && azValue !== undefined && String(azValue).trim() !== "";
                const isBaNotNull = baValue !== null && baValue !== undefined && String(baValue).trim() !== "";
                const isBaNull = !isBaNotNull;

                // Pending: AZ present, BA missing (This is also the "Purchase Data" list)
                // AZ = Index 51
                // BA = Index 52

                if (isAzNotNull && isBaNull) {
                  pendingCount++;
                  parsedPurchaseItems.push({
                    erp: row[54],          // Col BC - ERP PO Number
                    material: row[4],      // Col E - Material Name
                    party: row[3],         // Col D - Party Name
                    qty: row[5],           // Col F - Quantity
                    warehouse: row[6],     // Col G - Warehouse Location
                    leadTime: row[8],      // Col I - Lead Time
                    expDelivery: row[7],   // Col H - Expected Delivery Date
                  });
                }

                // Completed: AZ present AND BA present (Keeping original logic for completed count if not asked to change)
                // User only specified Purchase Data tab logic changes, assuming Completed logic remains based on BA or should it be BZ?
                // User said "dont change anything in other tabs like overview...", so I will leave completed logic as is (BA check).
                if (isAzNotNull && isBaNotNull) {
                  completedCount++;
                }

                // Overview Data: All valid rows (Unfiltered)
                if (row[1]) {
                  // Calculate Status based on Col J (9) and Col K (10)
                  // J present, K missing -> Pending Indent
                  // J present, K present -> Approved Indent

                  // Re-use has/missing helpers if possible, but they are defined inside the stage loop which isn't creating these closures for this scope yet.
                  // We'll implement inline strict checks.

                  const colJ = row[9];
                  const colK = row[10];

                  const hasJ = colJ !== null && colJ !== undefined && (typeof colJ === 'string' ? colJ.trim() !== "" : colJ !== "");
                  const hasK = colK !== null && colK !== undefined && (typeof colK === 'string' ? colK.trim() !== "" : colK !== "");

                  let computedStatus = row[13] || "Pending"; // Default fallback

                  if (hasJ) {
                    if (!hasK) {
                      computedStatus = "Pending Indent";
                    } else {
                      computedStatus = "Approved Indent";
                    }
                  }

                  parsedOverviewItems.push({
                    indent: row[1],        // Col B
                    createdBy: row[2],     // Col C
                    category: row[3],      // Col D
                    item: row[4],          // Col E
                    qty: row[5],           // Col F
                    warehouse: row[6],     // Col G
                    expDelivery: row[7],   // Col H
                    leadTime: row[8],      // Col I
                    status: computedStatus,
                  });
                }
              }
            }
          }
          setPendingPOs(pendingCount);
          setCompletedPOs(completedCount);
          setPurchaseItems(parsedPurchaseItems);
          setOverviewItems(parsedOverviewItems);

          // Calculate Pending Items by Stage (Only PO Stages)
          const poStages = ["Indent Approval", "Update 3 Vendors", "Negotiation", "PO Entry", "Follow-Up Vendor"];
          const counts: Record<string, number> = {};
          const overdueCounts: Record<string, number> = {};
          poStages.forEach(name => {
            counts[name] = 0;
            overdueCounts[name] = 0;
          });

          if (totalRows > 6) {
            for (let i = 6; i < totalRows; i++) {
              const row = result.data[i];
              if (!row || !row[1]) continue;

              const has = (idx: number) => {
                const val = row[idx];
                if (val === null || val === undefined) return false;
                if (typeof val === 'string') return val.trim() !== "" && val.trim() !== "-";
                return val !== "";
              };

              const missing = (idx: number) => !has(idx);

              const check = (name: string, start: number, actual: number, delayIdx: number) => {
                if (has(start) && missing(actual)) {
                  counts[name]++;
                  if (has(delayIdx)) overdueCounts[name]++;
                }
              };

              // Indices verified against stage components
              check("Indent Approval", 9, 10, 11);
              check("Update 3 Vendors", 18, 19, 20);
              check("Negotiation", 45, 46, 45); // Negotiation delay is same as start
              check("PO Entry", 51, 52, 53);
              check("Follow-Up Vendor", 60, 61, 62);
            }
          }

          setStageCounts((prev: any) => ({ ...prev, ...counts }));
          setStageOverdueCounts((prev: any) => ({ ...prev, ...overdueCounts }));

          // Calculate Completion Rate
          const rate = count > 0 ? (completedCount / count) * 100 : 0;
          setCompletionRate(Math.round(rate));
        }
      } catch (error) {
        console.error("Error fetching purchase orders:", error);
      }
    };



    const fetchReceivedData = async () => {
      try {
        const response = await fetch(`${process.env.NEXT_PUBLIC_API_URI}?sheet=RECEIVING-ACCOUNTS`);
        const result = await response.json();

        if (result.success && result.data) {
          const rows = result.data;

          const parsedReceived = [];
          const parsedInTransit = [];
          const vendorStats: Record<string, { totalCount: number; totalValue: number; products: Record<string, number> }> = {};

          // Data starts from row 7 (index 6)
          for (let i = 6; i < rows.length; i++) {
            const row = rows[i];
            // Safety check for row length
            if (!row || row.length < 21) continue;

            const colT = row[19]; // Index 19 = T
            const colU = row[20]; // Index 20 = U

            // Common item structure
            const item = {
              erp: row[4],       // Col E
              material: row[7],  // Col H
              party: row[3],     // Col D
              billImage: row[18],// Col S
              truck: row[10],    // Col K
              date: row[16],     // Col Q
              qty: row[8],       // Col I
            };

            // Check if column T is not null/empty
            if (colT) {
              if (colU) {
                // Received: Both T and U present
                parsedReceived.push(item);

                // --- TOP RECEIVED ORDER LOGIC ---
                // Aggregate statistics ONLY for fully received items
                const vendorName = row[3]; // Col D
                const productName = row[7]; // Col H
                // Value from Col O (Index 14) - Freight Amount
                const valStr = String(row[14] || "0").replace(/,/g, '');
                const value = parseFloat(valStr) || 0;

                if (vendorName && productName) {
                  if (!vendorStats[vendorName]) {
                    vendorStats[vendorName] = { totalCount: 0, totalValue: 0, products: {} };
                  }
                  vendorStats[vendorName].totalCount++;
                  vendorStats[vendorName].totalValue += value;

                  if (!vendorStats[vendorName].products[productName]) {
                    vendorStats[vendorName].products[productName] = 0;
                  }
                  vendorStats[vendorName].products[productName]++;
                }

              } else {
                // In-Transit: T present, U missing
                parsedInTransit.push(item);
              }
            }
          }
          setReceivedItems(parsedReceived);
          setInTransitItems(parsedInTransit);

          // Process Top Orders
          const processedOrders = Object.entries(vendorStats).map(([vendor, stats]) => {
            // Find top product for this vendor
            let topProduct = "";
            let maxProdCount = 0;

            Object.entries(stats.products).forEach(([prod, count]) => {
              if (count > maxProdCount) {
                maxProdCount = count;
                topProduct = prod;
              }
            });

            return {
              vendor,
              product: topProduct,
              count: stats.products[topProduct] || 0, // Product Count
              vendorTotalCount: stats.totalCount,     // For sorting
              value: stats.totalValue                 // Vendor Total Value
            };
          });

          // Sort by Vendor Total Received Count (Desc)
          processedOrders.sort((a, b) => b.vendorTotalCount - a.vendorTotalCount);
          setTopReceivedOrders(processedOrders.slice(0, 10));

          // Calculate Pending Items by Stage (Only RA Stages)
          const raStages = ["Transporter Follow-Up", "Material Received", "Warranty Information", "QC Requirement", "Receipt in Tally", "Submit Invoice (HO)", "Submit Invoice", "Verification by Accounts", "Purchase Return"];
          const recCounts: Record<string, number> = {};
          const overdueRecCounts: Record<string, number> = {};
          raStages.forEach(name => {
            recCounts[name] = 0;
            overdueRecCounts[name] = 0;
          });

          if (rows.length > 6) {
            for (let i = 6; i < rows.length; i++) {
              const r = rows[i];
              if (!r || !r[1]) continue;

              const has = (idx: number) => r[idx] !== null && r[idx] !== undefined && String(r[idx]).trim() !== "" && String(r[idx]).trim() !== "-";
              const missing = (idx: number) => !has(idx);

              const check = (name: string, start: number, actual: number, plan: number) => {
                if (has(start) && missing(actual)) {
                  recCounts[name]++;
                  if (has(plan)) overdueRecCounts[name]++;
                }
              };

              // Indices verified against specialized stage components:
              check("Transporter Follow-Up", 88, 89, 88);
              check("Material Received", 19, 20, 19);
              check("Warranty Information", 104, 109, 108);
              check("QC Requirement", 61, 62, 61);
              check("Receipt in Tally", 35, 36, 35);
              check("Submit Invoice (HO)", 43, 44, 43);
              check("Submit Invoice", 48, 49, 48);
              check("Verification by Accounts", 54, 55, 54);
              check("Purchase Return", 63, 64, 63);
            }
          }

          setStageCounts((prev: any) => ({ ...prev, ...recCounts }));
          setStageOverdueCounts((prev: any) => ({ ...prev, ...overdueRecCounts }));
        }
      } catch (error) {
        console.error("Error fetching received data:", error);
      }
    };

    const fetchVendorPayments = async () => {
      try {
        const response = await fetch(`${process.env.NEXT_PUBLIC_API_URI}?sheet=VENDOR-PAYMENTS`);
        const result = await response.json();

        if (result.success && result.data) {
          const rows = result.data;
          let count = 0;
          let overdue = 0;

          for (let i = 6; i < rows.length; i++) {
            const row = rows[i];
            if (!row || !row[1]) continue;
            const has = (idx: number) => row[idx] !== null && row[idx] !== undefined && String(row[idx]).trim() !== "" && String(row[idx]).trim() !== "-";
            const missing = (idx: number) => !has(idx);

            if (has(13) && missing(14)) {
              count++;
              if (has(13)) overdue++; // Payment is usually overdue if planned exists but actual doesn't
            }
          }
          setStageCounts((prev: any) => ({ ...prev, "Vendor Payment": count }));
          setStageOverdueCounts((prev: any) => ({ ...prev, "Vendor Payment": overdue }));
        }
      } catch (error) {
        console.error("Error fetching vendor payments:", error);
      }
    };

    const fetchFreightPayments = async () => {
      try {
        const response = await fetch(`${process.env.NEXT_PUBLIC_API_URI}?sheet=FREIGHT-PAYMENTS`);
        const result = await response.json();

        if (result.success && result.data) {
          const rows = result.data;
          let count = 0;
          let overdue = 0;

          for (let i = 6; i < rows.length; i++) {
            const row = rows[i];
            if (!row || !row[1]) continue;
            const has = (idx: number) => row[idx] !== null && row[idx] !== undefined && String(row[idx]).trim() !== "" && String(row[idx]).trim() !== "-";
            const missing = (idx: number) => !has(idx);

            if (has(9) && missing(10)) {
              count++;
              if (has(9)) overdue++;
            }
          }
          setStageCounts((prev: any) => ({ ...prev, "Freight Payments": count }));
          setStageOverdueCounts((prev: any) => ({ ...prev, "Freight Payments": overdue }));
        }
      } catch (error) {
        console.error("Error fetching freight payments:", error);
      }
    };

    const fetchSpecializedStages = async () => {
      try {
        const API = process.env.NEXT_PUBLIC_API_URI;
        const [warrantyRes, partialRes] = await Promise.all([
          fetch(`${API}?sheet=WARRANTY`),
          fetch(`${API}?sheet=${encodeURIComponent("Partial QC")}`)
        ]);
        const [warrantyJson, partialJson] = await Promise.all([warrantyRes.json(), partialRes.json()]);

        const counts: Record<string, number> = { "Return Approval": 0 };
        const overdue: Record<string, number> = { "Return Approval": 0 };

        if (partialJson.success && Array.isArray(partialJson.data)) {
          partialJson.data.slice(1).forEach((row: any) => {
            const has = (idx: number) => row[idx] !== null && row[idx] !== undefined && String(row[idx]).trim() !== "" && String(row[idx]).trim() !== "-";
            // Check for valid Indent Number (index 1) to avoid counting empty rows
            if (has(1) && has(23) && !has(24)) {
              counts["Return Approval"]++;
              overdue["Return Approval"]++;
            }
          });
        }

        setStageCounts((prev: any) => ({ ...prev, ...counts }));
        setStageOverdueCounts((prev: any) => ({ ...prev, ...overdue }));
      } catch (error) {
        console.error("Error specialized stages:", error);
      }
    };

    const fetchWarrantyData = async () => {
      try {
        const response = await fetch(`${process.env.NEXT_PUBLIC_API_URI}?sheet=WARRANTY`);
        const result = await response.json();

        if (result.success && result.data) {
          const rows = result.data;
          const parsedWarranty = [];

          // Data starts from row 7 (index 6)
          for (let i = 6; i < rows.length; i++) {
            const row = rows[i];
            if (!row || row.length < 8) continue;

            // Filter out empty rows (check Indent No and Vendor Name)
            const indentNo = row[0] ? String(row[0]).trim() : "";
            const vendorName = row[4] ? String(row[4]).trim() : "";

            if (!indentNo && !vendorName) continue;

            parsedWarranty.push({
              indentNo: indentNo,
              liftNo: row[1] ? String(row[1]).trim() : "",
              serialCode: row[2] ? String(row[2]).trim() : "",
              serialNo: row[3] ? String(row[3]).trim() : "",
              vendorName: vendorName,
              itemName: row[5] ? String(row[5]).trim() : "",
              invoiceDate: row[6] ? String(row[6]).trim() : "",
              warrantyEnd: row[7] ? String(row[7]).trim() : "",
              // Map to common fields for filters
              party: vendorName,
              material: row[5] ? String(row[5]).trim() : "",
              date: row[6] ? String(row[6]).trim() : "",
              erp: indentNo
            });
          }
          setWarrantyItems(parsedWarranty);
        }
      } catch (error) {
        console.error("Error fetching warranty data:", error);
      }
    };

    const fetchAll = async () => {
      setLoading(true);
      await Promise.all([
        fetchPOData(),
        fetchReceivedData(),
        fetchVendorPayments(),
        fetchFreightPayments(),
        fetchWarrantyData(),
        fetchSpecializedStages()
      ]);
      setLoading(false);
    };

    fetchAll();
  }, []);

  // Compute unique values for filters
  const allData = useMemo(() => [...inTransitItems, ...receivedItems, ...purchaseItems, ...warrantyItems], [inTransitItems, receivedItems, purchaseItems, warrantyItems]);

  const uniqueParties = useMemo(() =>
    [...new Set(allData.map((item) => item.party))].filter(Boolean).sort()
    , [allData]);

  const uniqueMaterials = useMemo(() =>
    [...new Set(allData.map((item) => item.material))].filter(Boolean).sort()
    , [allData]);

  // Filtering function
  const applyFilters = (data: any[], dataType: string) => {
    return data.filter((item: any) => {
      // Date filter
      if (dateFrom || dateTo) {
        const itemDate = parseSheetDate(item.date);
        if (!itemDate) return false;
        if (dateFrom) {
          const fromDate = parseSheetDate(dateFrom);
          if (fromDate && itemDate < fromDate) return false;
        }
        if (dateTo) {
          const toDate = parseSheetDate(dateTo);
          if (toDate && itemDate > toDate) return false;
        }
      }

      // Party filter
      if (
        selectedParty &&
        selectedParty !== "all" &&
        item.party !== selectedParty
      )
        return false;

      // Material filter
      if (
        selectedMaterial &&
        selectedMaterial !== "all" &&
        item.material !== selectedMaterial
      )
        return false;

      // Status filter
      if (
        selectedStatus &&
        selectedStatus !== "all" &&
        selectedStatus !== dataType
      )
        return false;

      // Warranty Months Left filter
      if (dataType === "warranty" && warrantyMonthsFilter) {
        const months = parseInt(warrantyMonthsFilter);
        if (!isNaN(months)) {
          const itemDate = new Date(item.warrantyEnd);
          if (isNaN(itemDate.getTime())) return false;

          const maxDate = new Date();
          maxDate.setMonth(maxDate.getMonth() + months);

          if (itemDate > maxDate) return false;
          // Also filter out past dates if strictly "months left" means future? 
          // Usually "months left" implies filter <= X months from now.
          if (itemDate < new Date()) return false;
        }
      }

      return true;
    });
  };

  // Apply filters to data
  const filteredInTransitData = useMemo(() => applyFilters(inTransitItems, "intransit"), [inTransitItems, dateFrom, dateTo, selectedParty, selectedMaterial, selectedStatus]);
  const filteredReceivedData = useMemo(() => applyFilters(receivedItems, "received"), [receivedItems, dateFrom, dateTo, selectedParty, selectedMaterial, selectedStatus]);
  const filteredPendingData = useMemo(() => applyFilters(purchaseItems, "pending"), [purchaseItems, dateFrom, dateTo, selectedParty, selectedMaterial, selectedStatus]);
  const filteredWarrantyData = useMemo(() => applyFilters(warrantyItems, "warranty"), [warrantyItems, dateFrom, dateTo, selectedParty, selectedMaterial, selectedStatus, warrantyMonthsFilter]);

  // Sorting function
  const sortData = (data: any[], sortConfig: any) => {
    return [...data].sort((a: any, b: any) => {
      let aVal = a[sortConfig.key];
      let bVal = b[sortConfig.key];

      if (sortConfig.key === "date") {
        aVal = parseSheetDate(aVal);
        bVal = parseSheetDate(bVal);
      } else if (typeof aVal === "string") {
        aVal = aVal.toLowerCase();
        bVal = bVal.toLowerCase();
      }

      const aTime = aVal instanceof Date ? aVal.getTime() : aVal;
      const bTime = bVal instanceof Date ? bVal.getTime() : bVal;

      if (aTime < bTime) return sortConfig.direction === "asc" ? -1 : 1;
      if (aTime > bTime) return sortConfig.direction === "asc" ? 1 : -1;
      return 0;
    });
  };

  // Apply sorting
  const sortedInTransitData = useMemo(() => sortData(filteredInTransitData, inTransitSort), [filteredInTransitData, inTransitSort]);
  const sortedReceivedData = useMemo(() => sortData(filteredReceivedData, receivedSort), [filteredReceivedData, receivedSort]);
  const sortedPendingData = useMemo(() => sortData(filteredPendingData, pendingSort), [filteredPendingData, pendingSort]);
  const sortedWarrantyData = useMemo(() => sortData(filteredWarrantyData, warrantySort), [filteredWarrantyData, warrantySort]);

  // Apply search
  const searchData = (data: any[], searchTerm: string) => {
    if (!searchTerm) return data;
    const term = searchTerm.toLowerCase();
    return data.filter(
      (item: any) =>
        (item.erp && item.erp.toString().toLowerCase().includes(term)) ||
        (item.material && item.material.toLowerCase().includes(term)) ||
        (item.party && item.party.toLowerCase().includes(term)) ||
        // Warranty specific fields
        (item.indentNo && item.indentNo.toString().toLowerCase().includes(term)) ||
        (item.liftNo && item.liftNo.toString().toLowerCase().includes(term)) ||
        (item.serialNo && item.serialNo.toString().toLowerCase().includes(term))
    );
  };

  const finalInTransitData = useMemo(() => searchData(sortedInTransitData, inTransitSearch), [sortedInTransitData, inTransitSearch]);
  const finalReceivedData = useMemo(() => searchData(sortedReceivedData, receivedSearch), [sortedReceivedData, receivedSearch]);
  const finalPendingData = useMemo(() => searchData(sortedPendingData, pendingSearch), [sortedPendingData, pendingSearch]);
  const finalWarrantyData = useMemo(() => searchData(sortedWarrantyData, warrantySearch), [sortedWarrantyData, warrantySearch]);

  // Export to CSV function
  const exportToCSV = (data: any[], filename: string, visibleColumns?: string[]) => {
    if (data.length === 0) return;

    const allHeaders = Object.keys(data[0]);
    // If visibleColumns is provided, only use those. Otherwise use all headers.
    const headers = visibleColumns ? allHeaders.filter(h => visibleColumns.includes(h)) : allHeaders;

    const csvContent = [
      headers.map(h => h.toUpperCase()).join(","),
      ...data.map((row: any) =>
        headers.map((header) => {
          let val = row[header];
          // Format date fields in CSV if they look like dates
          if (header.toLowerCase().includes("date") || header.toLowerCase().includes("end")) {
            val = formatDate(val);
          }
          return `"${val}"`;
        }).join(",")
      ),
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", filename);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleGenerateReport = async () => {
    setIsGeneratingReport(true);
    try {
      const { pdf } = await import("@react-pdf/renderer");
      const { ReportDocument } = await import("./report-pdf");

      const API = process.env.NEXT_PUBLIC_API_URI;
      const [fmsRes, raRes, masterRes, warrantyRes, partialRes, vendorRes, freightRes, transportRes] = await Promise.all([
        fetch(`${API}?sheet=INDENT-LIFT`),
        fetch(`${API}?sheet=RECEIVING-ACCOUNTS`),
        fetch(`${API}?sheet=Master`),
        fetch(`${API}?sheet=WARRANTY`),
        fetch(`${API}?sheet=${encodeURIComponent("Partial QC")}`),
        fetch(`${API}?sheet=VENDOR-PAYMENTS`),
        fetch(`${API}?sheet=FREIGHT-PAYMENTS`),
        fetch(`${API}?sheet=${encodeURIComponent("Transport Flw-Up")}`),
      ]);
      const [fmsJson, raJson, masterJson, warrantyJson, partialJson, vendorJson, freightJson, transportJson] = await Promise.all([
        fmsRes.json(), raRes.json(), masterRes.json(), warrantyRes.json(), partialRes.json(), vendorRes.json(), freightRes.json(), transportRes.json()
      ]);

      if (!fmsJson.success || !raJson.success || !masterJson.success || !warrantyJson.success || !partialJson.success || !vendorJson.success || !freightJson.success || !transportJson.success) {
        throw new Error("Failed fetching comprehensive data for report");
      }

      const fmsRows = fmsJson.data;
      const raRows = raJson.data;
      const masterRows = masterJson.data;
      const warrantyRows = warrantyJson.data;
      const partialRows = partialJson.data;
      const vendorRows = vendorJson.data;
      const freightRows = freightJson.data;

      // Map Responsible Persons from Master sheet (Col G -> Stage, Col H -> Responsible)
      const respMap: Record<string, string> = {};
      if (Array.isArray(masterRows)) {
        masterRows.slice(1).forEach((row: any) => {
          const stageName = row[6]; // Col G
          const respPerson = row[7]; // Col H
          if (stageName && respPerson) {
            respMap[String(stageName).trim()] = String(respPerson).trim();
          }
        });
      }

      // Build transport lookup
      const transportMap = new Map<string, string>();
      if (transportJson.success && Array.isArray(transportJson.data)) {
        transportJson.data.slice(1).forEach((row: any) => {
          const liftNo = row[1]; // Column B
          const exDate = row[4]; // Column E
          if (liftNo) transportMap.set(String(liftNo).trim(), String(exDate || ""));
        });
      }

      const totalCounts: Record<string, number> = {};
      const overdueCounts: Record<string, number> = {};
      purchaseStages.forEach(s => {
        totalCounts[s.name] = 0;
        overdueCounts[s.name] = 0;
      });

      const detailed: any[] = [];
      const fmsHas = (r: any, idx: number) => r[idx] !== null && r[idx] !== undefined && String(r[idx]).trim() !== "" && String(r[idx]).trim() !== "-";
      const fmsMiss = (r: any, idx: number) => !fmsHas(r, idx);

      // Track unique POs for Follow-Up Vendor
      const followUpVendorPOs = new Set<string>();

      // FMS loop logic
      for (let i = 6; i < fmsRows.length; i++) {
        const r = fmsRows[i];
        if (!r || !r[1]) continue;

        const checkStage = (name: string, start: number, actual: number, plan: number, delayIdx: number, mode: 'category' | 'vendor' | 'default' = 'default') => {
          if (fmsHas(r, start) && fmsMiss(r, actual)) {
            totalCounts[name]++;
            if (fmsHas(r, delayIdx)) {
              overdueCounts[name]++;

              let party = "-";
              if (name === "Indent Approval") {
                party = r[2] || "-"; // Created By
              } else if (mode === 'category') {
                party = r[3] || "-";
              } else if (mode === 'vendor') {
                const awName = String(r[48] || "").trim();
                const axName = String(r[49] || "").trim();
                const avName = String(r[47] || "").trim();
                const selectedId = avName.toLowerCase();

                if (awName && awName !== "-") {
                  party = awName;
                } else if (selectedId.includes("vendor1") || selectedId === "1" || selectedId === "vendor 1") {
                  party = r[21] || "-";
                } else if (selectedId.includes("vendor2") || selectedId === "2" || selectedId === "vendor 2") {
                  party = r[29] || "-";
                } else if (selectedId.includes("vendor3") || selectedId === "3" || selectedId === "vendor 3") {
                  party = r[37] || "-";
                } else if (axName && axName !== "-" && isNaN(Date.parse(axName)) && isNaN(Number(axName))) {
                  party = axName;
                } else if (avName && avName !== "-" && isNaN(Date.parse(avName)) && isNaN(Number(avName))) {
                  party = avName;
                } else {
                  party = r[3] || "-"; // Fallback to category
                }
              } else {
                party = r[3] || "-";
              }

              const qty = (name === "PO Entry" || name === "Follow-Up Vendor" || name === "Negotiation") ? (r[14] || r[5] || "-") : (r[5] || "-");

              detailed.push({
                indent: r[1] || "-",
                party,
                item: r[4] || "-",
                qty: qty,
                stage: name,
                delay: r[delayIdx] || "0",
                poNumber: r[54] || "-"
              });
            }
          }
        };

        checkStage("Indent Approval", 9, 10, 11, 11, 'category');
        checkStage("PO Entry", 51, 52, 51, 53, 'vendor');

        // Follow-Up Vendor: unique PO deduplication logic
        const fuvIsOverdue = fmsHas(r, 60) && fmsMiss(r, 61) && fmsHas(r, 62);
        const fuvRawPo = String(r[54] || "").trim();
        if (fuvIsOverdue && fuvRawPo && fuvRawPo !== "-") {
          const poNumKey = fuvRawPo.toUpperCase().replace(/\s+/g, '');
          totalCounts["Follow-Up Vendor"]++;
          overdueCounts["Follow-Up Vendor"]++;
          if (!followUpVendorPOs.has(poNumKey)) {
            followUpVendorPOs.add(poNumKey);
            let fuvParty = "-";
            const awName = String(r[48] || "").trim();
            const axName = String(r[49] || "").trim();
            const avName = String(r[47] || "").trim();
            const selectedId = avName.toLowerCase();
            if (awName && awName !== "-") fuvParty = awName;
            else if (selectedId.includes("vendor1") || selectedId === "1" || selectedId === "vendor 1") fuvParty = r[21] || "-";
            else if (selectedId.includes("vendor2") || selectedId === "2" || selectedId === "vendor 2") fuvParty = r[29] || "-";
            else if (selectedId.includes("vendor3") || selectedId === "3" || selectedId === "vendor 3") fuvParty = r[37] || "-";
            else if (axName && axName !== "-" && isNaN(Date.parse(axName)) && isNaN(Number(axName))) fuvParty = axName;
            else if (avName && avName !== "-" && isNaN(Date.parse(avName)) && isNaN(Number(avName))) fuvParty = avName;
            else fuvParty = r[3] || "-";
            detailed.push({
              indent: r[1] || "-",
              party: fuvParty,
              item: r[4] || "-",
              qty: r[14] || r[5] || "-",
              stage: "Follow-Up Vendor",
              delay: r[62] || "0",
              poNumber: fuvRawPo
            });
          }
        }
      }

      // RA loop logic
      for (let i = 6; i < raRows.length; i++) {
        const r = raRows[i];
        if (!r || !r[1]) continue;

        const checkStageRA = (name: string, start: number, actual: number, plan: number, delayIdx: number, itemIdx = 7) => {
          if (fmsHas(r, start) && fmsMiss(r, actual)) {
            totalCounts[name]++;
            if (fmsHas(r, plan)) {
              overdueCounts[name]++;
              const detail: any = {
                indent: r[1] || "-", 
                party: r[3] || "-", 
                item: r[itemIdx] || "-", 
                qty: r[8] || "-", 
                stage: name, 
                delay: r[delayIdx] || "0",
                poNumber: r[54] || "-"
              };

              if (name === "Transporter Follow-Up") {
                const liftNo = String(r[2] || "").trim();
                detail.expectedDate = transportMap.get(liftNo) || "-";
                detail.transporterName = r[9] || "-";
              }
              
              detailed.push(detail);
            }
          }
        };

        checkStageRA("Transporter Follow-Up", 88, 89, 88, 90, 7);
      }

      // Filter summary to only stages with overdueCount > 0 and only the 4 requested stages
      const allowedStages = ["Indent Approval", "PO Entry", "Follow-Up Vendor", "Transporter Follow-Up"];
      const summaryData = purchaseStages
        .filter(s => allowedStages.includes(s.name) && overdueCounts[s.name] > 0)
        .map(s => ({
          stage: s.name,
          pending: overdueCounts[s.name],
          responsible: respMap[s.name] || "-",
        }));

      // Sort detailed data by stage sequence to match summary
      detailed.sort((a, b) => {
        const indexA = allowedStages.indexOf(a.stage);
        const indexB = allowedStages.indexOf(b.stage);
        return indexA - indexB;
      });

      const blob = await pdf(<ReportDocument summaryData={summaryData} detailedData={detailed} />).toBlob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `Purchase_Report_${new Date().toISOString().split('T')[0]}.pdf`;
      link.click();
      URL.revokeObjectURL(url);

    } catch (e: any) {
      console.error(e);
      toast.error(e.message || "Failed to generate report");
    } finally {
      setIsGeneratingReport(false);
    }
  };

  return (
    <div className="p-4 md:p-6 space-y-6 bg-gray-50 min-h-screen">
      {/* Header with Forms Button */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Purchase Dashboard</h1>
          <p className="text-sm text-muted-foreground">
            Monitor and manage your purchase orders
          </p>
        </div>
        <Button
          onClick={() => {
            console.log("Forms button clicked");
            setFormsMenuOpen(true);
          }}
          className="flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          Forms
        </Button>
      </div>

      {/* Smart Filters */}
      <Card className="border shadow-sm">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-blue-600" />
            <CardTitle className="text-sm font-medium">Smart Filters</CardTitle>
          </div>
          <p className="text-xs text-muted-foreground">
            Refine your data view with advanced filtering options
          </p>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
            <div className="sm:col-span-2 lg:col-span-1">
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                <Input
                  placeholder="dd-mm-yyyy"
                  className="h-9 text-xs"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                />
                <span className="text-xs text-muted-foreground flex-shrink-0">
                  to
                </span>
                <Input
                  placeholder="dd-mm-yyyy"
                  className="h-9 text-xs"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                />
              </div>
            </div>
            <Select value={selectedParty} onValueChange={setSelectedParty}>
              <SelectTrigger className="h-9 text-xs">
                <SelectValue placeholder="All Party Names" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Party Names</SelectItem>
                {uniqueParties.map((party) => (
                  <SelectItem key={party} value={party}>
                    {party}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={selectedMaterial}
              onValueChange={setSelectedMaterial}
            >
              <SelectTrigger className="h-9 text-xs">
                <SelectValue placeholder="All Materials" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Materials</SelectItem>
                {uniqueMaterials.map((material) => (
                  <SelectItem key={material} value={material}>
                    {material}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={selectedStatus} onValueChange={setSelectedStatus}>
              <SelectTrigger className="h-9 text-xs">
                <SelectValue placeholder="All Statuses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="intransit">In-Transit</SelectItem>
                <SelectItem value="received">Received</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
              </SelectContent>
            </Select>
            <Button
              variant="outline"
              size="sm"
              className="h-9 text-xs"
              onClick={() => {
                setDateFrom("");
                setDateTo("");
                setSelectedParty("all");
                setSelectedMaterial("all");
                setSelectedStatus("all");
              }}
            >
              Clear All
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Tabs */}
      <Tabs
        value={activeTab}
        onValueChange={setActiveTab}
        className="space-y-6"
      >
        <TabsList className="grid w-full grid-cols-2 sm:grid-cols-5 h-11">
          <TabsTrigger value="overview" className="text-xs sm:text-sm">
            Overview
          </TabsTrigger>
          <TabsTrigger value="purchase" className="text-xs sm:text-sm">
            Purchase Data
          </TabsTrigger>
          <TabsTrigger value="intransit" className="text-xs sm:text-sm">
            In-Transit
          </TabsTrigger>
          <TabsTrigger value="received" className="text-xs sm:text-sm">
            Received
          </TabsTrigger>
          <TabsTrigger value="warranty" className="text-xs sm:text-sm">
            Warranty
          </TabsTrigger>
        </TabsList>

        {/* OVERVIEW TAB */}
        <TabsContent value="overview" className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  Total Purchase Orders
                </CardTitle>
                <FileText className="h-4 w-4 text-blue-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {loading ? "..." : totalPurchaseOrders !== null ? totalPurchaseOrders : 0}
                </div>
                <p className="text-xs text-muted-foreground">Active Orders</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  Pending PO's
                </CardTitle>
                <Clock className="h-4 w-4 text-orange-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {loading ? "..." : pendingPOs !== null ? pendingPOs : 0}
                </div>
                <p className="text-xs text-muted-foreground">Awaiting Action</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  Completed PO's
                </CardTitle>
                <CheckCircle className="h-4 w-4 text-green-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {loading ? "..." : completedPOs !== null ? completedPOs : 0}
                </div>
                <p className="text-xs text-muted-foreground">Delivered</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  Completion Rate
                </CardTitle>
                <TrendingUp className="h-4 w-4 text-purple-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {loading ? "..." : completionRate !== null ? `${completionRate}%` : "0%"}
                </div>
                <Progress value={completionRate || 0} className="mt-2 h-2" />
              </CardContent>
            </Card>
          </div>

          {/* Pending Items by Stage */}
          <Card>
            <CardHeader className="pb-3 flex flex-row items-start justify-between">
              <div>
                <CardTitle className="text-sm font-medium">
                  Pending Items by Stage
                </CardTitle>
                <p className="text-xs text-muted-foreground mt-1">
                  Track all pending items across different purchase stages
                </p>
              </div>
              <Button
                variant="default"
                className="bg-blue-600 hover:bg-blue-700 h-8 text-xs flex items-center"
                onClick={handleGenerateReport}
                disabled={isGeneratingReport}
              >
                {isGeneratingReport ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <FileText className="w-3.5 h-3.5 mr-1.5" />}
                {isGeneratingReport ? "Generating..." : "Generate Report"}
              </Button>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs w-[200px]">Stage</TableHead>
                    <TableHead className="text-xs text-right w-[80px]">
                      Pending
                    </TableHead>
                    <TableHead className="text-xs text-center w-[120px] pl-6">
                      Pending Overdue
                    </TableHead>
                    <TableHead className="text-xs w-[200px]">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {purchaseStages.map((stage) => {
                    let dynamicCount = stageCounts[stage.name] || 0;

                    let overdueCount = stageOverdueCounts[stage.name] || 0;

                    return (
                      <TableRow key={stage.id} className="hover:bg-gray-50">
                        <TableCell className="text-xs font-medium">
                          <div className="flex items-center gap-2">
                            <div
                              className={`w-2 h-2 rounded-full ${stage.color}`}
                            ></div>
                            {stage.name}
                          </div>
                        </TableCell>
                        <TableCell className="text-xs text-right text-muted-foreground">
                          {dynamicCount}
                        </TableCell>
                        <TableCell className="text-xs text-center text-red-500 font-medium pl-6">
                          {overdueCount > 0 ? overdueCount : "-"}
                        </TableCell>
                        <TableCell className="text-xs">
                          <div className="flex items-center gap-2">
                            <div className="w-full bg-gray-100 rounded-full h-1.5">
                              <div
                                className={`h-1.5 rounded-full ${stage.color}`}
                                style={{
                                  width: `${Math.min(
                                    (dynamicCount / 20) * 100,
                                    100
                                  )}%`,
                                }}
                              ></div>
                            </div>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/*  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <PieChart className="h-4 w-4 text-purple-600" />
                  PO Quantity by Status
                </CardTitle>
                <p className="text-xs text-muted-foreground">
                  Distribution of quantities across order statuses
                </p>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={180}>
                  <PieChart>
                    <Pie
                      data={pieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={70}
                      paddingAngle={5}
                      dataKey="value"
                    >
                      {pieData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
                <div className="flex flex-wrap justify-center gap-4 mt-2 text-xs">
                  <div className="flex items-center gap-1">
                    <div className="w-3 h-3 rounded-full bg-green-500"></div>
                    <span>Complete: 88%</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <div className="w-3 h-3 rounded-full bg-orange-500"></div>
                    <span>Pending: 12%</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
          */}
          {/* BEST PRICE PER MATERIAL – NEW MODERN SECTION */}
          {/* TOP RECEIVED ORDERS - REPLACED BEST PRICE SECTION */}
          <Card className="border-0 shadow-sm bg-white">
            <CardHeader className="pb-4">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-lg font-semibold flex items-center gap-2">
                    <TrendingUp className="w-5 h-5 text-emerald-600" />
                    Top Received Orders
                  </CardTitle>
                  <p className="text-sm text-muted-foreground mt-1">
                    Vendors with highest order volume (Prioritized by Count)
                  </p>
                </div>
                <Badge
                  variant="secondary"
                  className="bg-emerald-50 text-emerald-700"
                >
                  Live Data
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="pt-2">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Product</TableHead>
                      <TableHead className="text-center">Count</TableHead>
                      <TableHead className="text-right">Value</TableHead>
                      <TableHead className="text-right">Vendor Name</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {topReceivedOrders.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                          No received orders data available
                        </TableCell>
                      </TableRow>
                    ) : (
                      topReceivedOrders.map((item: any, idx: number) => (
                        <TableRow key={idx} className="hover:bg-muted/50">
                          <TableCell className="font-medium">
                            <div className="flex items-center gap-2">
                              <Package className="w-4 h-4 text-muted-foreground" />
                              {item.product}
                            </div>
                          </TableCell>
                          <TableCell className="text-center">
                            <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                              {item.count}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right font-medium text-emerald-600">
                            ₹{item.value.toLocaleString('en-IN')}
                          </TableCell>
                          <TableCell className="text-right text-muted-foreground text-sm">
                            {item.vendor}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
          {/* <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium">
                  Top Materials
                </CardTitle>
                <p className="text-xs text-muted-foreground">
                  Most ordered materials by quantity
                </p>
              </CardHeader>
              <CardContent className="space-y-2 text-xs">
                {topMaterials.slice(0, 5).map((m) => (
                  <div
                    key={m.rank}
                    className="flex items-center justify-between"
                  >
                    <div className="flex items-center gap-2">
                      <Badge
                        variant="secondary"
                        className="w-6 h-6 p-0 flex items-center justify-center text-[10px] font-bold"
                      >
                        {m.rank}
                      </Badge>
                      <span className="truncate max-w-32 sm:max-w-none">
                        {m.material}
                      </span>
                    </div>
                    <span className="font-medium">{m.qty.toFixed(2)}</span>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>

          <Card className="lg:hidden">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Top Vendors</CardTitle>
              <p className="text-xs text-muted-foreground">
                Leading suppliers by order count
              </p>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={vendorBarData.slice(0, 5)} layout="horizontal">
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" hide />
                  <YAxis
                    dataKey="name"
                    type="category"
                    width={80}
                    tick={{ fontSize: 10 }}
                  />
                  <Tooltip />
                  <Bar dataKey="qty" fill="#3b82f6" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card className="hidden lg:block">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Top Vendors</CardTitle>
              <p className="text-xs text-muted-foreground">
                Leading suppliers by order count
              </p>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={vendorBarData} layout="horizontal">
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" hide />
                  <YAxis
                    dataKey="name"
                    type="category"
                    width={80}
                    tick={{ fontSize: 10 }}
                  />
                  <Tooltip />
                  <Bar dataKey="qty" fill="#3b82f6" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card className="lg:hidden">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">
                Top Vendors by Quantity
              </CardTitle>
              <p className="text-xs text-muted-foreground">
                Leading suppliers by total quantity
              </p>
            </CardHeader>
            <CardContent className="space-y-2 text-xs">
              {topVendors.slice(0, 5).map((v) => (
                <div key={v.rank} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Badge
                      variant="secondary"
                      className="w-6 h-6 p-0 flex items-center justify-center text-[10px] font-bold"
                    >
                      {v.rank}
                    </Badge>
                    <span className="truncate max-w-32">
                      {v.vendor.split(" ").slice(0, 2).join(" ")}
                    </span>
                  </div>
                  <span className="font-medium">{v.qty.toFixed(2)}</span>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* New Overview Table */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">
                Purchase Order Overview
              </CardTitle>
              <p className="text-xs text-muted-foreground">
                Detailed view of all purchase orders
              </p>
            </CardHeader>
            <CardContent className="p-0 overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs">Indent #</TableHead>
                    <TableHead className="text-xs">Created By</TableHead>
                    <TableHead className="text-xs">
                      Warehouse Location
                    </TableHead>
                    <TableHead className="text-xs">Lead Time</TableHead>
                    <TableHead className="text-xs">Category</TableHead>
                    <TableHead className="text-xs">Item</TableHead>
                    <TableHead className="text-xs text-right">Qty</TableHead>
                    <TableHead className="text-xs">Exp. Delivery</TableHead>
                    <TableHead className="text-xs">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {overviewItems.map((item, idx) => (
                    <TableRow key={idx}>
                      <TableCell className="text-xs">IND-{item.indent}</TableCell>
                      <TableCell className="text-xs">
                        {item.createdBy || "-"}
                      </TableCell>
                      <TableCell className="text-xs">
                        {item.warehouse || "-"}
                      </TableCell>
                      <TableCell className="text-xs">
                        {item.leadTime || "-"}
                      </TableCell>
                      <TableCell className="text-xs">
                        {item.category}
                      </TableCell>
                      <TableCell className="text-xs">{item.item}</TableCell>
                      <TableCell className="text-xs text-right">
                        {typeof item.qty === 'number' ? item.qty.toFixed(2) : item.qty}
                      </TableCell>
                      <TableCell className="text-xs">
                        {item.expDelivery || "-"}
                      </TableCell>
                      <TableCell className="text-xs">
                        <Badge
                          variant="outline"
                          className={`
                            ${item.status?.includes("Approved")
                              ? "bg-green-50 text-green-700 border-green-200"
                              : item.status?.includes("Pending")
                                ? "bg-yellow-50 text-yellow-700 border-yellow-200"
                                : "bg-gray-50 text-gray-700 border-gray-200"
                            }
                          `}
                        >
                          {item.status || "Pending"}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* IN-TRANSIT TAB */}
        <TabsContent value="intransit" className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Truck className="h-5 w-5 text-blue-600" />
              <h3 className="text-lg font-semibold">Materials In-Transit</h3>
            </div>
            <Badge variant="secondary" className="bg-blue-50 text-blue-700">
              {finalInTransitData.length} Items
            </Badge>
          </div>

          {/* Search */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
            <Input
              placeholder="Search by ERP, material, or party..."
              value={inTransitSearch}
              onChange={(e) => setInTransitSearch(e.target.value)}
              className="flex-1 sm:max-w-sm"
            />
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                exportToCSV(finalInTransitData, "in-transit-data.csv")
              }
              className="flex items-center justify-center gap-1"
            >
              <Download className="h-3 w-3" />
              <span className="hidden sm:inline">Export CSV</span>
              <span className="sm:hidden">Export</span>
            </Button>
          </div>

          <Card>
            <CardContent className="p-0 overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead
                      className="text-xs cursor-pointer hover:bg-gray-50"
                      onClick={() =>
                        setInTransitSort({
                          key: "erp",
                          direction:
                            inTransitSort.key === "erp" &&
                              inTransitSort.direction === "asc"
                              ? "desc"
                              : "asc",
                        })
                      }
                    >
                      ERP PO Number{" "}
                      {inTransitSort.key === "erp" &&
                        (inTransitSort.direction === "asc" ? "↑" : "↓")}
                    </TableHead>
                    <TableHead
                      className="text-xs cursor-pointer hover:bg-gray-50"
                      onClick={() =>
                        setInTransitSort({
                          key: "material",
                          direction:
                            inTransitSort.key === "material" &&
                              inTransitSort.direction === "asc"
                              ? "desc"
                              : "asc",
                        })
                      }
                    >
                      Material Name{" "}
                      {inTransitSort.key === "material" &&
                        (inTransitSort.direction === "asc" ? "↑" : "↓")}
                    </TableHead>
                    <TableHead
                      className="text-xs cursor-pointer hover:bg-gray-50"
                      onClick={() =>
                        setInTransitSort({
                          key: "party",
                          direction:
                            inTransitSort.key === "party" &&
                              inTransitSort.direction === "asc"
                              ? "desc"
                              : "asc",
                        })
                      }
                    >
                      Party Name{" "}
                      {inTransitSort.key === "party" &&
                        (inTransitSort.direction === "asc" ? "↑" : "↓")}
                    </TableHead>
                    <TableHead className="text-xs">Truck No.</TableHead>
                    <TableHead
                      className="text-xs cursor-pointer hover:bg-gray-50"
                      onClick={() =>
                        setInTransitSort({
                          key: "date",
                          direction:
                            inTransitSort.key === "date" &&
                              inTransitSort.direction === "asc"
                              ? "desc"
                              : "asc",
                        })
                      }
                    >
                      Date{" "}
                      {inTransitSort.key === "date" &&
                        (inTransitSort.direction === "asc" ? "↑" : "↓")}
                    </TableHead>
                    <TableHead className="text-xs text-right">
                      Quantity
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {finalInTransitData.map((item: any, idx: number) => (
                    <TableRow key={idx}>
                      <TableCell className="font-medium text-xs">
                        {item.erp}
                      </TableCell>
                      <TableCell className="text-xs">{item.material}</TableCell>
                      <TableCell className="text-xs max-w-48 truncate">
                        {item.party}
                      </TableCell>
                      <TableCell className="text-xs">{item.truck}</TableCell>
                      <TableCell className="text-xs">{item.date}</TableCell>
                      <TableCell className="text-right font-medium text-xs">
                        {item.qty}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* RECEIVED TAB */}
        <TabsContent value="received" className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-green-600" />
              <h3 className="text-lg font-semibold">Received Materials</h3>
            </div>
            <Badge variant="secondary" className="bg-green-50 text-green-700">
              {finalReceivedData.length} Items
            </Badge>
          </div>

          {/* Search */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
            <Input
              placeholder="Search by ERP, material, or party..."
              value={receivedSearch}
              onChange={(e) => setReceivedSearch(e.target.value)}
              className="flex-1 sm:max-w-sm"
            />
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                exportToCSV(finalReceivedData, "received-data.csv")
              }
              className="flex items-center justify-center gap-1"
            >
              <Download className="h-3 w-3" />
              <span className="hidden sm:inline">Export CSV</span>
              <span className="sm:hidden">Export</span>
            </Button>
          </div>

          <Card>
            <CardContent className="p-0 overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead
                      className="text-xs cursor-pointer hover:bg-gray-50"
                      onClick={() =>
                        setReceivedSort({
                          key: "erp",
                          direction:
                            receivedSort.key === "erp" &&
                              receivedSort.direction === "asc"
                              ? "desc"
                              : "asc",
                        })
                      }
                    >
                      ERP PO Number{" "}
                      {receivedSort.key === "erp" &&
                        (receivedSort.direction === "asc" ? "↑" : "↓")}
                    </TableHead>
                    <TableHead
                      className="text-xs cursor-pointer hover:bg-gray-50"
                      onClick={() =>
                        setReceivedSort({
                          key: "material",
                          direction:
                            receivedSort.key === "material" &&
                              receivedSort.direction === "asc"
                              ? "desc"
                              : "asc",
                        })
                      }
                    >
                      Material Name{" "}
                      {receivedSort.key === "material" &&
                        (receivedSort.direction === "asc" ? "↑" : "↓")}
                    </TableHead>
                    <TableHead
                      className="text-xs cursor-pointer hover:bg-gray-50"
                      onClick={() =>
                        setReceivedSort({
                          key: "party",
                          direction:
                            receivedSort.key === "party" &&
                              receivedSort.direction === "asc"
                              ? "desc"
                              : "asc",
                        })
                      }
                    >
                      Party Name{" "}
                      {receivedSort.key === "party" &&
                        (receivedSort.direction === "asc" ? "↑" : "↓")}
                    </TableHead>
                    <TableHead className="text-xs">Bill Image</TableHead>
                    <TableHead className="text-xs">Truck No.</TableHead>
                    <TableHead
                      className="text-xs cursor-pointer hover:bg-gray-50"
                      onClick={() =>
                        setReceivedSort({
                          key: "date",
                          direction:
                            receivedSort.key === "date" &&
                              receivedSort.direction === "asc"
                              ? "desc"
                              : "asc",
                        })
                      }
                    >
                      Date{" "}
                      {receivedSort.key === "date" &&
                        (receivedSort.direction === "asc" ? "↑" : "↓")}
                    </TableHead>
                    <TableHead className="text-xs text-right">
                      Quantity
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {finalReceivedData.map((item: any, idx: number) => (
                    <TableRow key={idx}>
                      <TableCell className="font-medium text-xs">
                        {item.erp}
                      </TableCell>
                      <TableCell className="text-xs">{item.material}</TableCell>
                      <TableCell className="text-xs max-w-48 truncate">
                        {item.party}
                      </TableCell>
                      <TableCell className="text-xs">
                        {item.billImage ? (
                          <a
                            href={item.billImage}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center justify-center h-6 w-6 rounded-full hover:bg-gray-100 text-blue-600"
                          >
                            <Eye className="h-3 w-3" />
                          </a>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell className="text-xs">{item.truck}</TableCell>
                      <TableCell className="text-xs">
                        {item.date ? new Date(item.date).toLocaleDateString() : "-"}
                      </TableCell>
                      <TableCell className="text-right font-medium text-xs">
                        {item.qty}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* PURCHASE DATA → PENDING TAB */}
        <TabsContent value="purchase" className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-orange-500" />
              <h3 className="text-lg font-semibold">
                Pending Orders from PO Sheet
              </h3>
            </div>
            <Badge variant="secondary" className="bg-orange-50 text-orange-700">
              {finalPendingData.length} Orders
            </Badge>
          </div>

          {/* Search */}
          <div className="flex items-center gap-2">
            <Input
              placeholder="Search by ERP, material, or party..."
              value={pendingSearch}
              onChange={(e) => setPendingSearch(e.target.value)}
              className="max-w-sm"
            />
            <Button
              variant="outline"
              size="sm"
              onClick={() => exportToCSV(finalPendingData, "pending-data.csv")}
              className="flex items-center gap-1"
            >
              <Download className="h-3 w-3" />
              Export CSV
            </Button>
          </div>

          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs">ERP PO Number</TableHead>
                    <TableHead className="text-xs">Material Name</TableHead>
                    <TableHead className="text-xs">Party Name</TableHead>
                    <TableHead className="text-xs text-right">Quantity</TableHead>
                    <TableHead className="text-xs">Warehouse</TableHead>
                    <TableHead className="text-xs">Lead Time</TableHead>
                    <TableHead className="text-xs">Exp. Delivery</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {finalPendingData.map((item: any, idx: number) => (
                    <TableRow key={idx}>
                      <TableCell className="font-medium text-xs">
                        {item.erp}
                      </TableCell>
                      <TableCell className="text-xs">{item.material}</TableCell>
                      <TableCell className="text-xs">{item.party}</TableCell>
                      <TableCell className="text-right text-xs">
                        {typeof item.qty === 'number' ? item.qty.toFixed(2) : item.qty}
                      </TableCell>
                      <TableCell className="text-xs">{item.warehouse}</TableCell>
                      <TableCell className="text-xs">{item.leadTime}</TableCell>
                      <TableCell className="text-xs">
                        {item.expDelivery}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* WARRANTY TAB */}
        <TabsContent value="warranty" className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ShieldAlert className="h-5 w-5 text-amber-600" />
              <h3 className="text-lg font-semibold">Warranty Information</h3>
            </div>
            <Badge variant="secondary" className="bg-amber-50 text-amber-700">
              {finalWarrantyData.length} Items
            </Badge>
          </div>

          {/* Search */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
            <Input
              placeholder="Search by Indent, serial, or vendor..."
              value={warrantySearch}
              onChange={(e) => setWarrantySearch(e.target.value)}
              className="flex-1 sm:max-w-sm"
            />
            <div className="flex items-center gap-2">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="flex items-center gap-1">
                    <Settings2 className="h-3 w-3" />
                    <span>Columns</span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuLabel>Toggle Columns</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  {[
                    { id: "indentNo", label: "Indent No." },
                    { id: "liftNo", label: "Lift No." },
                    { id: "serialNo", label: "Serial No." },
                    { id: "vendorName", label: "Vendor Name" },
                    { id: "itemName", label: "Item-Name" },
                    { id: "invoiceDate", label: "Invoice Date" },
                    { id: "warrantyEnd", label: "Warranty End" },
                  ].map((col) => (
                    <DropdownMenuCheckboxItem
                      key={col.id}
                      checked={warrantyVisibleColumns.includes(col.id)}
                      onCheckedChange={(checked) => {
                        if (checked) {
                          setWarrantyVisibleColumns([...warrantyVisibleColumns, col.id]);
                        } else {
                          setWarrantyVisibleColumns(warrantyVisibleColumns.filter(c => c !== col.id));
                        }
                      }}
                    >
                      {col.label}
                    </DropdownMenuCheckboxItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  exportToCSV(finalWarrantyData, "warranty-data.csv", warrantyVisibleColumns)
                }
                className="flex items-center justify-center gap-1"
              >
                <Download className="h-3 w-3" />
                <span className="hidden sm:inline">Export CSV</span>
                <span className="sm:hidden">Export</span>
              </Button>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground whitespace-nowrap">Months Left:</span>
                <Input
                  type="number"
                  placeholder="e.g. 6"
                  className="h-8 w-20 text-xs"
                  value={warrantyMonthsFilter}
                  onChange={(e) => setWarrantyMonthsFilter(e.target.value)}
                />
              </div>
            </div>
          </div>

          <Card>
            <CardContent className="p-0 overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    {warrantyVisibleColumns.includes("indentNo") && (
                      <TableHead
                        className="text-xs cursor-pointer hover:bg-gray-50"
                        onClick={() =>
                          setWarrantySort({
                            key: "indentNo",
                            direction:
                              warrantySort.key === "indentNo" &&
                                warrantySort.direction === "asc"
                                ? "desc"
                                : "asc",
                          })
                        }
                      >
                        Indent No.{" "}
                        {warrantySort.key === "indentNo" &&
                          (warrantySort.direction === "asc" ? "↑" : "↓")}
                      </TableHead>
                    )}
                    {warrantyVisibleColumns.includes("liftNo") && <TableHead className="text-xs">Lift No.</TableHead>}
                    {warrantyVisibleColumns.includes("serialNo") && (
                      <TableHead
                        className="text-xs cursor-pointer hover:bg-gray-50"
                        onClick={() =>
                          setWarrantySort({
                            key: "serialNo",
                            direction:
                              warrantySort.key === "serialNo" &&
                                warrantySort.direction === "asc"
                                ? "desc"
                                : "asc",
                          })
                        }
                      >
                        Serial No.{" "}
                        {warrantySort.key === "serialNo" &&
                          (warrantySort.direction === "asc" ? "↑" : "↓")}
                      </TableHead>
                    )}
                    {warrantyVisibleColumns.includes("vendorName") && (
                      <TableHead
                        className="text-xs cursor-pointer hover:bg-gray-50"
                        onClick={() =>
                          setWarrantySort({
                            key: "vendorName",
                            direction:
                              warrantySort.key === "vendorName" &&
                                warrantySort.direction === "asc"
                                ? "desc"
                                : "asc",
                          })
                        }
                      >
                        Vendor Name{" "}
                        {warrantySort.key === "vendorName" &&
                          (warrantySort.direction === "asc" ? "↑" : "↓")}
                      </TableHead>
                    )}
                    {warrantyVisibleColumns.includes("itemName") && (
                      <TableHead
                        className="text-xs cursor-pointer hover:bg-gray-50"
                        onClick={() =>
                          setWarrantySort({
                            key: "itemName",
                            direction:
                              warrantySort.key === "itemName" &&
                                warrantySort.direction === "asc"
                                ? "desc"
                                : "asc",
                          })
                        }
                      >
                        Item-Name{" "}
                        {warrantySort.key === "itemName" &&
                          (warrantySort.direction === "asc" ? "↑" : "↓")}
                      </TableHead>
                    )}
                    {warrantyVisibleColumns.includes("invoiceDate") && <TableHead className="text-xs">Invoice Date</TableHead>}
                    {warrantyVisibleColumns.includes("warrantyEnd") && <TableHead className="text-xs">Warranty End</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {finalWarrantyData.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={warrantyVisibleColumns.length} className="text-center py-8 text-muted-foreground">
                        No warranty data available
                      </TableCell>
                    </TableRow>
                  ) : (
                    finalWarrantyData.map((item: any, idx: number) => (
                      <TableRow key={idx}>
                        {warrantyVisibleColumns.includes("indentNo") && (
                          <TableCell className="font-medium text-xs">
                            {item.indentNo}
                          </TableCell>
                        )}
                        {warrantyVisibleColumns.includes("liftNo") && <TableCell className="text-xs">{item.liftNo}</TableCell>}
                        {warrantyVisibleColumns.includes("serialNo") && <TableCell className="text-xs">{item.serialNo}</TableCell>}
                        {warrantyVisibleColumns.includes("vendorName") && <TableCell className="text-xs">{item.vendorName}</TableCell>}
                        {warrantyVisibleColumns.includes("itemName") && <TableCell className="text-xs">{item.itemName}</TableCell>}
                        {warrantyVisibleColumns.includes("invoiceDate") && (
                          <TableCell className="text-xs">
                            {formatDate(item.invoiceDate)}
                          </TableCell>
                        )}
                        {warrantyVisibleColumns.includes("warrantyEnd") && (
                          <TableCell className="text-xs">
                            {(() => {
                              const date = new Date(item.warrantyEnd);
                              const today = new Date();
                              const nextMonth = new Date();
                              nextMonth.setMonth(today.getMonth() + 1);

                              const isExpiringSoon = !isNaN(date.getTime()) && date > today && date <= nextMonth;
                              const formattedDate = formatDate(item.warrantyEnd);

                              if (isExpiringSoon) {
                                return (
                                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-red-100 text-red-800 border border-red-200">
                                    {formattedDate}
                                  </span>
                                );
                              }
                              return formattedDate;
                            })()}
                          </TableCell>
                        )}
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Debug - Remove after testing */}
      {formsMenuOpen && (
        <div className="fixed top-0 left-0 bg-red-500 text-white p-2 z-50">
          Modal State: OPEN
        </div>
      )}

      {/* Forms Menu Modal */}
      <Dialog open={formsMenuOpen} onOpenChange={setFormsMenuOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Select Form Type</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <Button
              variant="outline"
              className="h-20 flex items-center justify-start gap-4"
              onClick={() => {
                setFormsMenuOpen(false);
                setItemFormOpen(true);
              }}
            >
              <Package className="w-8 h-8 text-blue-600" />
              <div className="text-left">
                <div className="font-semibold">Item Form</div>
                <div className="text-xs text-muted-foreground">
                  Add new item details
                </div>
              </div>
            </Button>
            <Button
              variant="outline"
              className="h-20 flex items-center justify-start gap-4"
              onClick={() => {
                setFormsMenuOpen(false);
                setVendorFormOpen(true);
              }}
            >
              <Users className="w-8 h-8 text-green-600" />
              <div className="text-left">
                <div className="font-semibold">Vendor Form</div>
                <div className="text-xs text-muted-foreground">
                  Add new vendor details
                </div>
              </div>
            </Button>
            <Button
              variant="outline"
              className="h-20 flex items-center justify-start gap-4"
              onClick={() => {
                setFormsMenuOpen(false);
                setTransporterFormOpen(true);
              }}
            >
              <Truck className="w-8 h-8 text-orange-600" />
              <div className="text-left">
                <div className="font-semibold">Transporter Form</div>
                <div className="text-xs text-muted-foreground">
                  Add new transporter details
                </div>
              </div>
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Item Form Modal */}
      <Dialog open={itemFormOpen} onOpenChange={setItemFormOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Add New Item</DialogTitle>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              console.log("Item Form:", itemForm);
              setItemFormOpen(false);
              setItemForm({ category: "", itemName: "", uom: "" });
            }}
          >
            <div className="grid gap-4 py-4">
              <div>
                <Label htmlFor="category">Category *</Label>
                <Input
                  id="category"
                  value={itemForm.category}
                  onChange={(e) =>
                    setItemForm({ ...itemForm, category: e.target.value })
                  }
                  required
                  placeholder="e.g. Electronics, Hardware"
                />
              </div>
              <div>
                <Label htmlFor="itemName">Item Name *</Label>
                <Input
                  id="itemName"
                  value={itemForm.itemName}
                  onChange={(e) =>
                    setItemForm({ ...itemForm, itemName: e.target.value })
                  }
                  required
                  placeholder="e.g. Laptop, Screwdriver"
                />
              </div>
              <div>
                <Label htmlFor="uom">UOM (Unit of Measurement) *</Label>
                <Select
                  value={itemForm.uom}
                  onValueChange={(v) => setItemForm({ ...itemForm, uom: v })}
                >
                  <SelectTrigger id="uom">
                    <SelectValue placeholder="Select UOM" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pcs">Pieces (PCS)</SelectItem>
                    <SelectItem value="kg">Kilogram (KG)</SelectItem>
                    <SelectItem value="ltr">Liter (LTR)</SelectItem>
                    <SelectItem value="mtr">Meter (MTR)</SelectItem>
                    <SelectItem value="box">Box</SelectItem>
                    <SelectItem value="set">Set</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setItemFormOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit">Save Item</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Vendor Form Modal */}
      <Dialog open={vendorFormOpen} onOpenChange={setVendorFormOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Add New Vendor</DialogTitle>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              console.log("Vendor Form:", vendorForm);
              setVendorFormOpen(false);
              setVendorForm({
                vendorName: "",
                contactPerson: "",
                phone: "",
                email: "",
                address: "",
              });
            }}
          >
            <div className="grid gap-4 py-4">
              <div>
                <Label htmlFor="vendorName">Vendor Name *</Label>
                <Input
                  id="vendorName"
                  value={vendorForm.vendorName}
                  onChange={(e) =>
                    setVendorForm({ ...vendorForm, vendorName: e.target.value })
                  }
                  required
                  placeholder="e.g. ABC Suppliers"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="contactPerson">Contact Person *</Label>
                  <Input
                    id="contactPerson"
                    value={vendorForm.contactPerson}
                    onChange={(e) =>
                      setVendorForm({
                        ...vendorForm,
                        contactPerson: e.target.value,
                      })
                    }
                    required
                    placeholder="e.g. John Doe"
                  />
                </div>
                <div>
                  <Label htmlFor="phone">Phone *</Label>
                  <Input
                    id="phone"
                    value={vendorForm.phone}
                    onChange={(e) =>
                      setVendorForm({ ...vendorForm, phone: e.target.value })
                    }
                    required
                    placeholder="e.g. 9876543210"
                  />
                </div>
              </div>
              <div>
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={vendorForm.email}
                  onChange={(e) =>
                    setVendorForm({ ...vendorForm, email: e.target.value })
                  }
                  placeholder="e.g. vendor@example.com"
                />
              </div>
              <div>
                <Label htmlFor="address">Address *</Label>
                <textarea
                  id="address"
                  value={vendorForm.address}
                  onChange={(e) =>
                    setVendorForm({ ...vendorForm, address: e.target.value })
                  }
                  required
                  rows={3}
                  className="w-full px-3 py-2 border rounded resize-none"
                  placeholder="Enter complete address"
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setVendorFormOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit">Save Vendor</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Transporter Form Modal */}
      <Dialog open={transporterFormOpen} onOpenChange={setTransporterFormOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Add New Transporter</DialogTitle>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              console.log("Transporter Form:", transporterForm);
              setTransporterFormOpen(false);
              setTransporterForm({
                transporterName: "",
                contactPerson: "",
                phone: "",
                vehicleType: "",
              });
            }}
          >
            <div className="grid gap-4 py-4">
              <div>
                <Label htmlFor="transporterName">Transporter Name *</Label>
                <Input
                  id="transporterName"
                  value={transporterForm.transporterName}
                  onChange={(e) =>
                    setTransporterForm({
                      ...transporterForm,
                      transporterName: e.target.value,
                    })
                  }
                  required
                  placeholder="e.g. Fast Logistics"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="transporterContact">Contact Person *</Label>
                  <Input
                    id="transporterContact"
                    value={transporterForm.contactPerson}
                    onChange={(e) =>
                      setTransporterForm({
                        ...transporterForm,
                        contactPerson: e.target.value,
                      })
                    }
                    required
                    placeholder="e.g. Jane Smith"
                  />
                </div>
                <div>
                  <Label htmlFor="transporterPhone">Phone *</Label>
                  <Input
                    id="transporterPhone"
                    value={transporterForm.phone}
                    onChange={(e) =>
                      setTransporterForm({
                        ...transporterForm,
                        phone: e.target.value,
                      })
                    }
                    required
                    placeholder="e.g. 9876543210"
                  />
                </div>
              </div>
              <div>
                <Label htmlFor="vehicleType">Vehicle Type *</Label>
                <Select
                  value={transporterForm.vehicleType}
                  onValueChange={(v) =>
                    setTransporterForm({ ...transporterForm, vehicleType: v })
                  }
                >
                  <SelectTrigger id="vehicleType">
                    <SelectValue placeholder="Select Vehicle Type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="truck">Truck</SelectItem>
                    <SelectItem value="van">Van</SelectItem>
                    <SelectItem value="trailer">Trailer</SelectItem>
                    <SelectItem value="container">Container</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setTransporterFormOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit">Save Transporter</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
