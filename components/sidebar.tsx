"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import {
  Menu, X, LogOut, LayoutDashboard
} from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { STAGES } from "@/lib/constants";

const SHEET_API_URL = process.env.NEXT_PUBLIC_API_URI;

export default function Sidebar() {
  const [isOpen, setIsOpen] = useState(false);
  const { pageAccess, fullName, role, logout } = useAuth();
  const pathname = usePathname();
  const [counts, setCounts] = useState<Record<string, number>>({});

  const handleLogout = () => {
    logout();
    setIsOpen(false);
  };

  // Helper to check if a page is allowed
  const isPageAllowed = useCallback((pageName: string) => {
    if (!pageAccess || pageAccess.length === 0) return true; // Show all if no restrictions
    if (pageName === "IMS" || pageName === "Damaged Records" || pageName === "Order Cancel") return true; // Always show IMS, Damaged Records, and Order Cancel
    if (pageName === "Verification by Accounts") return pageAccess.includes("Verification") || pageAccess.includes("Verification by Accounts");
    return pageAccess.includes(pageName) || (pageName === "Material Testing" && pageAccess.includes("QC Requirement"));
  }, [pageAccess]);

  const filteredStages = STAGES.filter(stage => isPageAllowed(stage.name));
  const showDashboard = isPageAllowed("Dashboard");

  // Determine active state helper
  const isActive = (path: string) => {
    if (path === "/") return pathname === "/";
    return pathname === path || pathname.startsWith(`${path}/`);
  };

  const fetchCounts = useCallback(async () => {
    if (!SHEET_API_URL) return;
    try {
      const activeStageNames = filteredStages.map(s => s.name);
      
      const needsIndentLift = activeStageNames.some(name => 
        ["Create Indent", "Indent Approval", "Update 3 Vendors", "Negotiation", "PO Entry", "Follow-Up Vendor"].includes(name)
      );
      const needsReceivingAccounts = activeStageNames.some(name => 
        ["Transporter Follow-Up", "Material Received", "Serial Generation", "Receipt in Tally", "Submit Invoice (HO)", "Submit Invoice", "Verification by Accounts", "Material Testing"].includes(name)
      );
      const needsPartialQc = activeStageNames.some(name => 
        ["Purchase Return", "Return Approval"].includes(name)
      );
      const needsVendorPayments = activeStageNames.includes("Vendor Payment");
      const needsFreightPayments = activeStageNames.includes("Freight Payments");
      const needsWarrantyClaim = activeStageNames.includes("Warranty Claim");

      const fetchPromises: Record<string, Promise<any>> = {};
      if (needsIndentLift) {
        fetchPromises["INDENT-LIFT"] = fetch(`${SHEET_API_URL}?sheet=INDENT-LIFT&action=getAll`).then(r => r.json());
      }
      if (needsReceivingAccounts) {
        fetchPromises["RECEIVING-ACCOUNTS"] = fetch(`${SHEET_API_URL}?sheet=RECEIVING-ACCOUNTS&action=getAll`).then(r => r.json());
      }
      if (needsPartialQc) {
        fetchPromises["Partial QC"] = fetch(`${SHEET_API_URL}?sheet=${encodeURIComponent("Partial QC")}&action=getAll`).then(r => r.json());
      }
      if (needsVendorPayments) {
        fetchPromises["VENDOR-PAYMENTS"] = fetch(`${SHEET_API_URL}?sheet=VENDOR-PAYMENTS&action=getAll`).then(r => r.json());
      }
      if (needsFreightPayments) {
        fetchPromises["FREIGHT-PAYMENTS"] = fetch(`${SHEET_API_URL}?sheet=FREIGHT-PAYMENTS&action=getAll`).then(r => r.json());
      }
      if (needsWarrantyClaim) {
        fetchPromises["Serial-Generation"] = fetch(`${SHEET_API_URL}?sheet=Serial-Generation&action=getAll`).then(r => r.json());
        fetchPromises["Warranty_Claim"] = fetch(`${SHEET_API_URL}?sheet=Warranty_Claim&action=getAll`).then(r => r.json());
      }

      const results = await Promise.all(
        Object.entries(fetchPromises).map(async ([key, p]) => {
          try {
            const res = await p;
            return { key, data: res.success ? res.data : null };
          } catch (e) {
            console.error(`Error fetching sheet ${key}:`, e);
            return { key, data: null };
          }
        })
      );

      const sheetData: Record<string, any[][] | null> = {};
      results.forEach(r => {
        sheetData[r.key] = r.data;
      });

      const newCounts: Record<string, number> = {};

      const has = (row: any[], idx: number) => {
        if (!row) return false;
        const val = row[idx];
        if (val === null || val === undefined) return false;
        if (typeof val === 'string') return val.trim() !== "" && val.trim() !== "-";
        return val !== "";
      };

      const missing = (row: any[], idx: number) => !has(row, idx);

      // 1. INDENT-LIFT dependent counts
      const indentLiftRows = sheetData["INDENT-LIFT"];
      if (indentLiftRows && Array.isArray(indentLiftRows)) {
        const dataRows = indentLiftRows.slice(6);
        let createIndentCount = 0;
        let indentApprovalCount = 0;
        let update3VendorsCount = 0;
        let negotiationCount = 0;
        let poEntryCount = 0;
        let followUpVendorCount = 0;

        dataRows.forEach((row) => {
          if (!row || !row[1] || String(row[1]).trim() === "") return;

          const isApproved = !!row[13] &&
            String(row[13]).trim() !== "" &&
            String(row[13]).trim() !== "-" &&
            String(row[13]).trim().toLowerCase() !== "pending";
          if (!isApproved) {
            createIndentCount++;
          }

          if (has(row, 9) && missing(row, 10)) {
            indentApprovalCount++;
          }

          const rawStatus = String(row[13] || "").toLowerCase();
          const isApprovedForStage3 = rawStatus === "approved";
          const hasVendorData = has(row, 18) && has(row, 19);
          if (isApprovedForStage3 && !hasVendorData) {
            update3VendorsCount++;
          }

          if (has(row, 45) && missing(row, 46)) {
            negotiationCount++;
          }

          if (has(row, 51) && missing(row, 52)) {
            poEntryCount++;
          }

          if (has(row, 60) && String(row[67] || "").trim() === "Pending") {
            followUpVendorCount++;
          }
        });

        newCounts["Create Indent"] = createIndentCount;
        newCounts["Indent Approval"] = indentApprovalCount;
        newCounts["Update 3 Vendors"] = update3VendorsCount;
        newCounts["Negotiation"] = negotiationCount;
        newCounts["PO Entry"] = poEntryCount;
        newCounts["Follow-Up Vendor"] = followUpVendorCount;
      }

      // 2. RECEIVING-ACCOUNTS dependent counts
      const receivingAccountsRows = sheetData["RECEIVING-ACCOUNTS"];
      if (receivingAccountsRows && Array.isArray(receivingAccountsRows)) {
        const dataRows = receivingAccountsRows.slice(6);
        let transporterFollowUpCount = 0;
        let materialReceivedCount = 0;
        let serialGenerationCount = 0;
        let tallyEntryCount = 0;
        let submitInvoiceHoCount = 0;
        let submitInvoiceCount = 0;
        let verificationCount = 0;
        let materialTestingCount = 0;

        dataRows.forEach((row) => {
          if (!row || !row[1] || String(row[1]).trim() === "") return;

          if (has(row, 88) && missing(row, 89)) {
            transporterFollowUpCount++;
          }

          if (has(row, 19) && missing(row, 20)) {
            materialReceivedCount++;
          }

          if (has(row, 108) && missing(row, 109)) {
            serialGenerationCount++;
          }

          if (has(row, 35) && missing(row, 36)) {
            tallyEntryCount++;
          }

          if (has(row, 43) && missing(row, 44)) {
            submitInvoiceHoCount++;
          }

          if (has(row, 48) && missing(row, 49)) {
            submitInvoiceCount++;
          }

          if (has(row, 54) && missing(row, 55)) {
            verificationCount++;
          }

          if (has(row, 61) && missing(row, 62)) {
            materialTestingCount++;
          }
        });

        newCounts["Transporter Follow-Up"] = transporterFollowUpCount;
        newCounts["Material Received"] = materialReceivedCount;
        newCounts["Serial Generation"] = serialGenerationCount;
        newCounts["Receipt in Tally"] = tallyEntryCount;
        newCounts["Submit Invoice (HO)"] = submitInvoiceHoCount;
        newCounts["Submit Invoice"] = submitInvoiceCount;
        newCounts["Verification by Accounts"] = verificationCount;
        newCounts["Material Testing"] = materialTestingCount;
      }

      // 3. Partial QC dependent counts
      const partialQcRows = sheetData["Partial QC"];
      if (partialQcRows && Array.isArray(partialQcRows)) {
        const dataRows = partialQcRows.slice(7);
        let purchaseReturnCount = 0;
        let returnApprovalCount = 0;

        dataRows.forEach((row) => {
          if (!row || !row[1] || String(row[1]).trim() === "") return;

          const isRejected = String(row[5] || "").toLowerCase() === "rejected";
          const isReturn = String(row[12] || "").toLowerCase().includes("return");
          if (isRejected && isReturn && has(row, 13) && missing(row, 14)) {
            purchaseReturnCount++;
          }

          if (has(row, 23) && missing(row, 24)) {
            returnApprovalCount++;
          }
        });

        newCounts["Purchase Return"] = purchaseReturnCount;
        newCounts["Return Approval"] = returnApprovalCount;
      }

      // 4. VENDOR-PAYMENTS dependent counts
      const vendorPaymentsRows = sheetData["VENDOR-PAYMENTS"];
      if (vendorPaymentsRows && Array.isArray(vendorPaymentsRows)) {
        const dataRows = vendorPaymentsRows.slice(6);
        let vendorPaymentCount = 0;

        const parseNumVal = (v: any) => parseFloat(String(v || "0").replace(/[^0-9.-]/g, "")) || 0;

        dataRows.forEach((row) => {
          if (!row || !row[1] || String(row[1]).trim() === "") return;

          const plan1 = row[13];
          const actual1 = row[14];
          const totalVal = parseNumVal(row[11]);
          const pendingRaw = row[17];
          const currentPending = (pendingRaw !== undefined && pendingRaw !== "" && pendingRaw !== "-")
              ? parseNumVal(pendingRaw)
              : totalVal;

          const hasPlan = !!plan1 && String(plan1).trim() !== "" && String(plan1).trim() !== "-";
          const isPending = !actual1 || String(actual1).trim() === "" || String(actual1).trim() === "-" || currentPending > 1;

          if (hasPlan && isPending) {
            vendorPaymentCount++;
          }
        });

        newCounts["Vendor Payment"] = vendorPaymentCount;
      }

      // 5. FREIGHT-PAYMENTS dependent counts
      const freightPaymentsRows = sheetData["FREIGHT-PAYMENTS"];
      if (freightPaymentsRows && Array.isArray(freightPaymentsRows)) {
        const dataRows = freightPaymentsRows.slice(6);
        let freightPaymentsCount = 0;

        const parseNumVal = (v: any) => parseFloat(String(v || "0").replace(/[^0-9.-]/g, "")) || 0;

        dataRows.forEach((row) => {
          if (!row || !row[1] || String(row[1]).trim() === "") return;

          const freightAmt = parseNumVal(row[3]);
          const pendingRaw = row[13];
          const currentPending = (pendingRaw !== undefined && pendingRaw !== "" && pendingRaw !== "-")
              ? parseNumVal(pendingRaw)
              : freightAmt;

          if (currentPending > 1) {
            freightPaymentsCount++;
          }
        });

        newCounts["Freight Payments"] = freightPaymentsCount;
      }

      // 6. Warranty Claim dependent counts
      const serialGenRows = sheetData["Serial-Generation"];
      const warrantyClaimRows = sheetData["Warranty_Claim"];
      if (activeStageNames.includes("Warranty Claim")) {
        let warrantyClaimCount = 0;

        if (serialGenRows && Array.isArray(serialGenRows)) {
          serialGenRows.slice(6).forEach((row) => {
            if (!row || !row[0] || String(row[0]).trim() === "") return;
            const hasPlan = has(row, 8);
            const hasActual = has(row, 9);
            if (hasPlan && !hasActual) {
              warrantyClaimCount++;
            }
          });
        }

        if (warrantyClaimRows && Array.isArray(warrantyClaimRows)) {
          warrantyClaimRows.slice(6).forEach((row) => {
            if (!row || !row[0] || String(row[0]).trim() === "") return;
            const status = String(row[10] || "Pending").trim().toLowerCase();
            if (status !== "closure") {
              warrantyClaimCount++;
            }
          });
        }

        newCounts["Warranty Claim"] = warrantyClaimCount;
      }

      setCounts(newCounts);
    } catch (e) {
      console.error("Failed to fetch sidebar counts:", e);
    }
  }, [filteredStages]);

  useEffect(() => {
    fetchCounts();
  }, [pathname, fetchCounts]);

  useEffect(() => {
    const interval = setInterval(() => {
      fetchCounts();
    }, 60000);
    return () => clearInterval(interval);
  }, [fetchCounts]);

  return (
    <>
      {/* Mobile top bar */}
      <div className="lg:hidden fixed top-0 left-0 right-0 z-40 flex items-center justify-between px-4 py-3 bg-sidebar border-b border-sidebar-border">
        <h1 className="text-lg font-semibold text-sidebar-foreground">
          Purchase Workflow
        </h1>
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="text-sidebar-foreground focus:outline-none"
          aria-label="Toggle menu"
        >
          {isOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
        </button>
      </div>

      {/* Sidebar */}
      <aside
        className={`fixed lg:static top-0 left-0 h-full lg:h-auto w-64 bg-sidebar border-r border-sidebar-border transform transition-transform duration-300 ease-in-out z-40 
        ${isOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}`}
      >
        <div className="p-4 overflow-y-auto h-full scrollbar-hide">
          <div className="hidden lg:block">
            <h1 className="text-xl font-bold text-sidebar-foreground mb-6">
              Purchase Workflow
            </h1>
          </div>

          {/* Dashboard Button */}
          {showDashboard && (
            <Button
              variant={pathname === "/" ? "default" : "ghost"}
              className="w-full justify-start mb-4"
              asChild
              onClick={() => setIsOpen(false)}
            >
              <Link href="/">
                <LayoutDashboard className="w-5 h-5 mr-3" />
                Dashboard
              </Link>
            </Button>
          )}

          {/* Stage Buttons */}
          <div className="space-y-1">
            {filteredStages.map((stage) => {
              const stagePath = `/stages/${stage.slug}`;
              const Icon = stage.icon;
              const count = counts[stage.name] || 0;
              return (
                <Button
                  key={stage.num}
                  variant={isActive(stagePath) ? "default" : "ghost"}
                  className="w-full justify-start text-sm transition-colors duration-200"
                  asChild
                  onClick={() => setIsOpen(false)}
                >
                  <Link href={stagePath} className="flex items-center w-full">
                    <Icon className="w-5 h-5 mr-3 flex-shrink-0" />
                    <span className="truncate flex-grow text-left">{stage.name}</span>
                    {count > 0 && (
                      <span className={`ml-auto text-[10px] rounded-full px-2 py-0.5 font-bold leading-none min-w-[20px] text-center flex-shrink-0 transition-all ${
                        isActive(stagePath)
                          ? "bg-white text-slate-900 shadow-sm"
                          : "bg-blue-500 text-white shadow-sm"
                      }`}>
                        {count}
                      </span>
                    )}
                  </Link>
                </Button>
              );
            })}
          </div>

          {/* User Info & Logout */}
          <div className="mt-auto pt-6 border-t border-sidebar-border">
            <div className="px-3 py-2 mb-3">
              <p className="text-sm text-sidebar-foreground/80">
                Logged in as:
              </p>
              <p className="font-medium truncate" title={fullName || "User"}>{fullName}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{role}</p>
            </div>
            <Button
              variant="outline"
              className="w-full justify-start text-sm border-sidebar-border hover:bg-destructive hover:text-destructive-foreground transition-colors duration-200"
              onClick={handleLogout}
            >
              <LogOut className="w-4 h-4 mr-2" />
              Logout
            </Button>
          </div>
        </div>
      </aside>

      {/* Mobile backdrop (click to close) */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/40 z-30 lg:hidden"
          onClick={() => setIsOpen(false)}
        />
      )}
    </>
  );
}
