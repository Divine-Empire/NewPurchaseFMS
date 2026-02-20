"use client";

import { useState, useEffect } from "react";
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
  Download,
  Eye,
  Calendar,
  FileText,
  TrendingUp,
  Plus,
  Package,
  Users,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";

// === NEW DATA (DIFFERENT FROM MOCK) ===
// Mock data removed or kept for other tabs if needed, but InTransit tab will override.
const inTransitDataMock = [
  {
    erp: 892,
    material: "MS Billet",
    party: "JINDAL STEEL WORKS",
    truck: "RJ14GA1234",
    date: "02/11/2025",
    qty: 120.5,
  },
  {
    erp: 879,
    material: "Ferro Chrome",
    party: "TATA METALIKS",
    truck: "WB19AB5678",
    date: "02/11/2025",
    qty: 45.2,
  },
  {
    erp: 875,
    material: "Silico Manganese",
    party: "MAITHAN ALLOYS",
    truck: "OR05CD9012",
    date: "01/11/2025",
    qty: 88.7,
  },
  {
    erp: 861,
    material: "Sponge Iron",
    party: "RASHMI METALIKS",
    truck: "CG07XY4455",
    date: "01/11/2025",
    qty: 67.3,
  },
  {
    erp: 849,
    material: "MS Scrap",
    party: "BHUSHAN TRADERS",
    truck: "MH12PQ8899",
    date: "31/10/2025",
    qty: 29.1,
  },
  {
    erp: 837,
    material: "Pig Iron",
    party: "NEELACHAL ISPAT",
    truck: "OD02LM3344",
    date: "30/10/2025",
    qty: 55.8,
  },
  {
    erp: 824,
    material: "MS Ingot",
    party: "VANDANA STEELS",
    truck: "CG04AB1122",
    date: "29/10/2025",
    qty: 41.6,
  },
  {
    erp: 811,
    material: "Ferro Silicon",
    party: "IMFA LTD",
    truck: "OR11JK5566",
    date: "28/10/2025",
    qty: 33.9,
  },
  {
    erp: 799,
    material: "MS Billet",
    party: "ELECTROSTEEL",
    truck: "WB25MN7788",
    date: "27/10/2025",
    qty: 95.4,
  },
  {
    erp: 788,
    material: "Sponge Iron",
    party: "JAI BALAJI",
    truck: "CG10EF9900",
    date: "26/10/2025",
    qty: 72.1,
  },
];

// Mock data removed or kept for other tabs if needed, but Receive tab will override.
const receivedDataMock = [
  {
    erp: 891,
    material: "MS Billet",
    party: "JINDAL STEEL WORKS",
    truck: "RJ14GA1234",
    date: "02/11/2025",
    qty: 120.5,
  },
  {
    erp: 878,
    material: "Ferro Chrome",
    party: "TATA METALIKS",
    truck: "WB19AB5678",
    date: "01/11/2025",
    qty: 45.2,
  },
  {
    erp: 874,
    material: "Silico Manganese",
    party: "MAITHAN ALLOYS",
    truck: "OR05CD9012",
    date: "01/11/2025",
    qty: 88.7,
  },
  {
    erp: 860,
    material: "Sponge Iron",
    party: "RASHMI METALIKS",
    truck: "CG07XY4455",
    date: "31/10/2025",
    qty: 67.3,
  },
  {
    erp: 848,
    material: "MS Scrap",
    party: "BHUSHAN TRADERS",
    truck: "MH12PQ8899",
    date: "30/10/2025",
    qty: 29.1,
  },
  {
    erp: 836,
    material: "Pig Iron",
    party: "NEELACHAL ISPAT",
    truck: "OD02LM3344",
    date: "29/10/2025",
    qty: 55.8,
  },
  {
    erp: 823,
    material: "MS Ingot",
    party: "VANDANA STEELS",
    truck: "CG04AB1122",
    date: "28/10/2025",
    qty: 41.6,
  },
  {
    erp: 810,
    material: "Ferro Silicon",
    party: "IMFA LTD",
    truck: "OR11JK5566",
    date: "27/10/2025",
    qty: 33.9,
  },
  {
    erp: 798,
    material: "MS Billet",
    party: "ELECTROSTEEL",
    truck: "WB25MN7788",
    date: "26/10/2025",
    qty: 95.4,
  },
  {
    erp: 787,
    material: "Sponge Iron",
    party: "JAI BALAJI",
    truck: "CG10EF9900",
    date: "25/10/2025",
    qty: 72.1,
  },
];

// Mock data removed or kept for other tabs if needed, but Purchase Data tab will override.
const pendingDataMock = [
  {
    erp: 701,
    material: "MS Billet",
    party: "JINDAL STEEL WORKS",
    qty: 150,
    rate: 48500,
    pending: 150,
    lifted: 0,
    received: 0,
    returned: 0,
    cancelled: 0,
  },
  {
    erp: 702,
    material: "Sponge Iron",
    party: "RASHMI METALIKS",
    qty: 200,
    rate: 28500,
    pending: 180,
    lifted: 20,
    received: 20,
    returned: 0,
    cancelled: 0,
  },
  {
    erp: 703,
    material: "Ferro Chrome",
    party: "TATA METALIKS",
    qty: 50,
    rate: 125000,
    pending: 30,
    lifted: 20,
    received: 15,
    returned: 5,
    cancelled: 0,
  },
  {
    erp: 704,
    material: "MS Scrap",
    party: "BHUSHAN TRADERS",
    qty: 80,
    rate: 32000,
    pending: 80,
    lifted: 0,
    received: 0,
    returned: 0,
    cancelled: 0,
  },
  {
    erp: 705,
    material: "Silico Manganese",
    party: "MAITHAN ALLOYS",
    qty: 100,
    rate: 78000,
    pending: 70,
    lifted: 30,
    received: 25,
    returned: 5,
    cancelled: 0,
  },
];

const topMaterials = [
  { rank: 1, material: "MS Billet", qty: 18950.5 },
  { rank: 2, material: "Sponge Iron", qty: 14230.75 },
  { rank: 3, material: "Ferro Chrome", qty: 8750.2 },
  { rank: 4, material: "Silico Manganese", qty: 7210.4 },
  { rank: 5, material: "MS Scrap", qty: 4855.3 },
  { rank: 6, material: "Pig Iron", qty: 3900.1 },
  { rank: 7, material: "MS Ingot", qty: 3200.8 },
  { rank: 8, material: "Ferro Silicon", qty: 2100.6 },
  { rank: 9, material: "TMT Bar", qty: 1800.9 },
  { rank: 10, material: "Wire Rod", qty: 1500.25 },
];

const topVendors = [
  {
    rank: 1,
    vendor: "JINDAL STEEL WORKS",
    qty: 18950.5,
    price: 42500,
    material: "MS Billet",
  },
  {
    rank: 2,
    vendor: "RASHMI METALIKS",
    qty: 14230.75,
    price: 41800,
    material: "MS Billet",
  },
  {
    rank: 3,
    vendor: "TATA METALIKS",
    qty: 8750.2,
    price: 42200,
    material: "Sponge Iron",
  },
  {
    rank: 4,
    vendor: "MAITHAN ALLOYS",
    qty: 7210.4,
    price: 42800,
    material: "Ferro Chrome",
  },
  {
    rank: 5,
    vendor: "BHUSHAN TRADERS",
    qty: 4855.3,
    price: 41500,
    material: "MS Scrap",
  },
  {
    rank: 6,
    vendor: "NEELACHAL ISPAT",
    qty: 3900.1,
    price: 42300,
    material: "MS Billet",
  },
  {
    rank: 7,
    vendor: "VANDANA STEELS",
    qty: 3200.8,
    price: 42700,
    material: "Sponge Iron",
  },
  {
    rank: 8,
    vendor: "IMFA LTD",
    qty: 2100.6,
    price: 42900,
    material: "Ferro Chrome",
  },
  {
    rank: 9,
    vendor: "JAI BALAJI",
    qty: 1800.9,
    price: 41600,
    material: "MS Scrap",
  },
  {
    rank: 10,
    vendor: "ELECTROSTEEL",
    qty: 1500.25,
    price: 43000,
    material: "MS Billet",
  },
];

// Define all purchase order stages with pending counts
const purchaseStages = [
  { id: 1, name: "Indent Approval", pending: 12, color: "bg-blue-500" },
  { id: 2, name: "Update 3 Vendors", pending: 8, color: "bg-purple-500" },
  { id: 3, name: "Negotiation", pending: 15, color: "bg-indigo-500" },
  { id: 4, name: "PO Entry", pending: 6, color: "bg-cyan-500" },
  { id: 5, name: "Follow-Up Vendor", pending: 10, color: "bg-teal-500" },
  { id: 6, name: "Material Received", pending: 5, color: "bg-green-500" },
  { id: 7, name: "QC Requirement", pending: 7, color: "bg-lime-500" },
  { id: 8, name: "Receipt in Tally", pending: 4, color: "bg-amber-500" },
  { id: 9, name: "Submit Invoice", pending: 9, color: "bg-orange-500" },
  { id: 11, name: "Verification by Accounts", pending: 11, color: "bg-red-500" },
  { id: 12, name: "Purchase Return", pending: 2, color: "bg-rose-500" },
  { id: 13, name: "Vendor Payments", pending: 3, color: "bg-pink-500" },
  { id: 14, name: "Freight Payments", pending: 5, color: "bg-fuchsia-500" },
];

const vendorBarData = topVendors.map((v) => ({
  name: v.vendor.split(" ").slice(0, 2).join(" "),
  qty: v.qty,
}));
const pieData = [
  { name: "Complete", value: 88, color: "#10b981" },
  { name: "Pending", value: 12, color: "#f59e0b" },
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

  const [totalPurchaseOrders, setTotalPurchaseOrders] = useState<number | null>(null);
  const [pendingPOs, setPendingPOs] = useState<number | null>(null);
  const [completedPOs, setCompletedPOs] = useState<number | null>(null);
  const [completionRate, setCompletionRate] = useState<number | null>(null);

  const [receivedItems, setReceivedItems] = useState<any[]>([]);
  const [inTransitItems, setInTransitItems] = useState<any[]>([]);
  const [purchaseItems, setPurchaseItems] = useState<any[]>([]);
  const [overviewItems, setOverviewItems] = useState<any[]>([]);
  const [stageCounts, setStageCounts] = useState<any>({});
  const [topReceivedOrders, setTopReceivedOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

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

          // Calculate Pending Items by Stage
          const counts = {
            "Indent Approval": 0,
            "Update 3 Vendors": 0,
            "Negotiation": 0,
            "PO Entry": 0,
            "Follow-Up Vendor": 0,
          };

          if (totalRows > 6) {
            for (let i = 6; i < totalRows; i++) {
              const row = result.data[i];
              if (!row) continue;

              // Helper to check Not Null (exists) and Null (empty) with strict trimming
              const has = (idx: number) => {
                const val = row[idx];
                if (val === null || val === undefined) return false;
                if (typeof val === 'string') return val.trim() !== "";
                return val !== "";
              };

              const missing = (idx: number) => {
                const val = row[idx];
                if (val === null || val === undefined) return true;
                if (typeof val === 'string') return val.trim() === "";
                return val === "";
              };

              // Indent Approval: J (9) yes, K (10) no
              if (has(9) && missing(10)) counts["Indent Approval"]++;

              // Update 3 Vendors: S (18) yes, T (19) no
              if (has(18) && missing(19)) counts["Update 3 Vendors"]++;

              // Negotiation: AT (45) yes, AU (46) no
              if (has(45) && missing(46)) counts["Negotiation"]++;

              // PO Entry: AZ (51) yes, BA (52) no
              if (has(51) && missing(52)) counts["PO Entry"]++;

              // Follow-Up Vendor: BI (60) yes, BJ (61) no
              if (has(60) && missing(61)) counts["Follow-Up Vendor"]++;
            }
          }
          setStageCounts((prev: any) => ({ ...prev, ...counts }));

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

          // Calculate Pending Items by Stage from RECEIVING-ACCOUNTS
          const recCounts = {
            "QC Requirement": 0,
            "Receipt in Tally": 0,
            "Submit Invoice": 0,
            "Verification by Accounts": 0,
            "Purchase Return": 0,
          };

          // Data starts from row 7 (index 6)
          for (let i = 6; i < rows.length; i++) {
            const row = rows[i];
            if (!row) continue;

            const has = (idx: number) => row[idx] !== null && row[idx] !== "" && row[idx] !== undefined;
            const missing = (idx: number) => row[idx] === null || row[idx] === "" || row[idx] === undefined;

            // QC Requirement: AI (34) yes, AJ (35) no
            if (has(34) && missing(35)) recCounts["QC Requirement"]++;

            // Receipt in Tally: AS (44) yes, AT (45) no
            if (has(44) && missing(45)) recCounts["Receipt in Tally"]++;

            // Submit Invoice: AY (50) yes, AZ (51) no
            if (has(50) && missing(51)) recCounts["Submit Invoice"]++;

            // Verification: BE (56) yes, BF (57) no
            if (has(56) && missing(57)) recCounts["Verification by Accounts"]++;

            // Purchase Return: BL (63) yes, BM (64) no
            if (has(63) && missing(64)) recCounts["Purchase Return"]++;
          }
          setStageCounts((prev: any) => ({ ...prev, ...recCounts }));
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

          // Data starts from row 7 (index 6)
          for (let i = 6; i < rows.length; i++) {
            const row = rows[i];
            if (!row) continue;

            const has = (idx: number) => row[idx] !== null && row[idx] !== "" && row[idx] !== undefined;
            const missing = (idx: number) => row[idx] === null || row[idx] === "" || row[idx] === undefined;

            // Vendor Payments: R (17) yes, S (18) no
            if (has(17) && missing(18)) count++;
          }
          setStageCounts((prev: any) => ({ ...prev, "Vendor Payments": count }));
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

          // Data starts from row 7 (index 6)
          for (let i = 6; i < rows.length; i++) {
            const row = rows[i];
            if (!row) continue;

            const has = (idx: number) => row[idx] !== null && row[idx] !== "" && row[idx] !== undefined;
            const missing = (idx: number) => row[idx] === null || row[idx] === "" || row[idx] === undefined;

            // Freight Payments: N (13) yes, O (14) no
            if (has(13) && missing(14)) count++;
          }
          setStageCounts((prev: any) => ({ ...prev, "Freight Payments": count }));
        }
      } catch (error) {
        console.error("Error fetching freight payments:", error);
      }
    };

    const fetchAll = async () => {
      setLoading(true);
      await Promise.all([
        fetchPOData(),
        fetchReceivedData(),
        fetchVendorPayments(),
        fetchFreightPayments()
      ]);
      setLoading(false);
    };

    fetchAll();
  }, []);

  // Compute unique values for filters
  const allData = [...inTransitItems, ...receivedItems, ...purchaseItems];
  const uniqueParties = [...new Set(allData.map((item) => item.party))].filter(Boolean).sort();
  const uniqueMaterials = [
    ...new Set(allData.map((item) => item.material)),
  ].filter(Boolean).sort();

  // Helper function to parse date dd-mm-yyyy
  const parseDate = (dateStr: string) => {
    if (!dateStr) return null;
    const [day, month, year] = dateStr.split("-").map(Number);
    return new Date(year, month - 1, day);
  };

  // Filtering function
  const applyFilters = (data: any[], dataType: string) => {
    return data.filter((item: any) => {
      // Date filter
      if (dateFrom || dateTo) {
        const itemDate = parseDate(item.date);
        if (!itemDate) return false;
        if (dateFrom) {
          const fromDate = parseDate(dateFrom);
          if (fromDate && itemDate < fromDate) return false;
        }
        if (dateTo) {
          const toDate = parseDate(dateTo);
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

      return true;
    });
  };

  // Apply filters to data
  const filteredInTransitData = applyFilters(inTransitItems, "intransit");
  // const filteredReceivedData = applyFilters(receivedData, "received"); // Replacing with dynamic
  const filteredReceivedData = applyFilters(receivedItems, "received");
  const filteredPendingData = applyFilters(purchaseItems, "pending");

  // Sorting function
  const sortData = (data: any[], sortConfig: any) => {
    return [...data].sort((a: any, b: any) => {
      let aVal = a[sortConfig.key];
      let bVal = b[sortConfig.key];

      if (sortConfig.key === "date") {
        aVal = parseDate(aVal);
        bVal = parseDate(bVal);
      } else if (typeof aVal === "string") {
        aVal = aVal.toLowerCase();
        bVal = bVal.toLowerCase();
      }

      if (aVal < bVal) return sortConfig.direction === "asc" ? -1 : 1;
      if (aVal > bVal) return sortConfig.direction === "asc" ? 1 : -1;
      return 0;
    });
  };

  // Apply sorting
  const sortedInTransitData = sortData(filteredInTransitData, inTransitSort);
  const sortedReceivedData = sortData(filteredReceivedData, receivedSort);
  const sortedPendingData = sortData(filteredPendingData, pendingSort);

  // Apply search
  const searchData = (data: any[], searchTerm: string) => {
    if (!searchTerm) return data;
    return data.filter(
      (item: any) =>
        item.erp.toString().includes(searchTerm.toLowerCase()) ||
        item.material.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.party.toLowerCase().includes(searchTerm.toLowerCase())
    );
  };

  const finalInTransitData = searchData(sortedInTransitData, inTransitSearch);
  const finalReceivedData = searchData(sortedReceivedData, receivedSearch);
  const finalPendingData = searchData(sortedPendingData, pendingSearch);

  // Export to CSV function
  const exportToCSV = (data: any[], filename: string) => {
    if (data.length === 0) return;

    const headers = Object.keys(data[0]);
    const csvContent = [
      headers.join(","),
      ...data.map((row: any) =>
        headers.map((header) => `"${row[header]}"`).join(",")
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
        <TabsList className="grid w-full grid-cols-2 sm:grid-cols-4 h-11">
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
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">
                Pending Items by Stage
              </CardTitle>
              <p className="text-xs text-muted-foreground">
                Track all pending items across different purchase stages
              </p>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs w-[200px]">Stage</TableHead>
                    <TableHead className="text-xs text-right w-[100px]">
                      Pending
                    </TableHead>
                    <TableHead className="text-xs w-[200px]">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {purchaseStages.map((stage) => {
                    let dynamicCount = 0;
                    if (stage.name === "Material Received") {
                      dynamicCount = inTransitItems.length;
                    } else if (stageCounts[stage.name] !== undefined) {
                      dynamicCount = stageCounts[stage.name];
                    }

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
