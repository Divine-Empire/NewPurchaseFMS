"use client";

import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Loader2, LayoutGrid, RefreshCw, AlertCircle, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export default function ImsPage() {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [filters, setFilters] = useState({
    group: "All",
    category: "All",
    name: "All"
  });

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const API_URL = process.env.NEXT_PUBLIC_IMS_API_URI;
      const SHEET_ID = process.env.NEXT_PUBLIC_IMS_SHEET_ID;
      
      if (!API_URL) throw new Error("IMS API URI not configured");

      const response = await fetch(`${API_URL}?spreadsheetId=${SHEET_ID}&sheet=IMS`);
      const result = await response.json();

      if (result.success && Array.isArray(result.data)) {
        setData(result.data);
      } else {
        throw new Error(result.error || "Failed to fetch IMS data");
      }
    } catch (err: any) {
      console.error("IMS Fetch Error:", err);
      setError(err.message);
      toast.error("Failed to load IMS data: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const exportToExcel = () => {
    if (filteredData.length === 0) {
      toast.error("No data to export");
      return;
    }

    const headers = [
      "Group",
      "Category",
      "Item Code",
      "Name of Item",
      "CG Reorder Qty",
      "NE Reorder Qty",
      "Maniquip Reorder Qty",
      "Head Office Reorder Qty"
    ];

    const csvContent = [
      headers.join(","),
      ...filteredData.map((row) => {
        const group = row[0] !== undefined ? `"${String(row[0]).replace(/"/g, '""')}"` : "";
        const category = row[1] !== undefined ? `"${String(row[1]).replace(/"/g, '""')}"` : "";
        const itemCode = row[2] !== undefined ? `"${String(row[2]).replace(/"/g, '""')}"` : "";
        const itemName = row[3] !== undefined ? `"${String(row[3]).replace(/"/g, '""')}"` : "";
        const cg = row[94] !== undefined ? `"${String(row[94]).replace(/"/g, '""')}"` : "0";
        const ne = row[95] !== undefined ? `"${String(row[95]).replace(/"/g, '""')}"` : "0";
        const mq = row[96] !== undefined ? `"${String(row[96]).replace(/"/g, '""')}"` : "0";
        const ho = row[97] !== undefined ? `"${String(row[97]).replace(/"/g, '""')}"` : "0";
        return [group, category, itemCode, itemName, cg, ne, mq, ho].join(",");
      })
    ].join("\n");

    const blob = new Blob(["\ufeff" + csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `IMS_Reorder_Report_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success("Excel report exported successfully");
  };

  const uniqueGroups = Array.from(new Set(data.slice(2).map(row => row[0]).filter(Boolean))).sort();
  const uniqueCategories = Array.from(new Set(data.slice(2).map(row => row[1]).filter(Boolean))).sort();
  const uniqueNames = Array.from(new Set(data.slice(2).map(row => row[3]).filter(Boolean))).sort();

  const filteredData = data.slice(2).filter(row => {
    const matchGroup = filters.group === "All" || row[0] === filters.group;
    const matchCategory = filters.category === "All" || row[1] === filters.category;
    const matchName = filters.name === "All" || row[3] === filters.name;
    return matchGroup && matchCategory && matchName;
  });

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-[calc(100vh-10rem)] gap-4">
        <Loader2 className="w-10 h-10 animate-spin text-blue-600" />
        <p className="text-muted-foreground animate-pulse font-medium">Fetching Inventory Data...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <Card className="border-destructive/20 bg-destructive/5">
          <CardContent className="flex flex-col items-center justify-center py-10 gap-4">
            <AlertCircle className="w-12 h-12 text-destructive" />
            <div className="text-center">
              <h3 className="text-lg font-semibold text-destructive">Error Loading Data</h3>
              <p className="text-sm text-muted-foreground mt-1">{error}</p>
            </div>
            <Button variant="outline" onClick={fetchData} className="mt-2">
              <RefreshCw className="w-4 h-4 mr-2" />
              Try Again
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 flex flex-col gap-4 animate-in fade-in duration-500">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-2">
        <div className="flex items-center gap-4">
          <div className="p-2.5 bg-slate-900 rounded-xl shadow-lg text-white">
            <LayoutGrid className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Inventory Management System (IMS)</h2>
            <p className="text-[13px] text-muted-foreground mt-0">Live stock levels and reorder status across branches</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={exportToExcel}
            size="sm"
            className="bg-white shadow-sm hover:bg-slate-50 border-slate-200 flex items-center justify-center gap-1"
          >
            <Download className="w-4 h-4 mr-1" />
            <span>Export Excel</span>
          </Button>
          <Button variant="outline" onClick={fetchData} size="sm" className="bg-white shadow-sm hover:bg-slate-50 border-slate-200">
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh Data
          </Button>
        </div>
      </div>

      <Card className="border-0 shadow-2xl bg-white overflow-hidden ring-1 ring-slate-200">
        <CardHeader className="bg-slate-50/80 border-b border-slate-100 py-3 px-6">
          <div className="flex flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-3">
              <div className="w-1.5 h-8 bg-blue-600 rounded-full" />
              <CardTitle className="text-sm font-bold text-slate-800 uppercase tracking-widest whitespace-nowrap">
                Stock Analysis
              </CardTitle>
            </div>
            
            <div className="flex-1 flex items-center justify-end gap-4 max-w-4xl">
              {/* Group Filter */}
              <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-full border border-slate-200 shadow-sm transition-all hover:border-blue-300 group">
                <span className="text-[10px] font-bold text-slate-400 uppercase">Group</span>
                <select 
                  className="bg-transparent border-none text-xs font-medium text-slate-700 focus:ring-0 outline-none cursor-pointer min-w-[100px]"
                  value={filters.group}
                  onChange={(e) => setFilters(prev => ({ ...prev, group: e.target.value }))}
                >
                  <option value="All">All Groups</option>
                  {uniqueGroups.map(g => <option key={g} value={g}>{g}</option>)}
                </select>
              </div>

              {/* Category Filter */}
              <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-full border border-slate-200 shadow-sm transition-all hover:border-blue-300 group">
                <span className="text-[10px] font-bold text-slate-400 uppercase">Category</span>
                <select 
                  className="bg-transparent border-none text-xs font-medium text-slate-700 focus:ring-0 outline-none cursor-pointer min-w-[120px]"
                  value={filters.category}
                  onChange={(e) => setFilters(prev => ({ ...prev, category: e.target.value }))}
                >
                  <option value="All">All Categories</option>
                  {uniqueCategories.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>

              {/* Item Filter */}
              <div className="flex-1 flex items-center gap-2 bg-white px-3 py-1.5 rounded-full border border-slate-200 shadow-sm transition-all hover:border-blue-300 group max-w-xs">
                <span className="text-[10px] font-bold text-slate-400 uppercase">Item</span>
                <select 
                  className="bg-transparent border-none text-xs font-medium text-slate-700 focus:ring-0 outline-none cursor-pointer w-full truncate"
                  value={filters.name}
                  onChange={(e) => setFilters(prev => ({ ...prev, name: e.target.value }))}
                >
                  <option value="All">All Items</option>
                  {uniqueNames.map(n => <option key={n} value={n}>{n}</option>)}
                </select>
              </div>

              <div className="hidden xl:flex items-center gap-2 pl-2 border-l border-slate-200">
                <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 px-2 py-0.5 text-[9px] font-bold">
                  {filteredData.length} ITEMS FOUND
                </Badge>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="max-h-[calc(100vh-18rem)] overflow-auto relative">
            <table className="w-full border-collapse text-sm">
              <thead className="bg-white">
                {/* Main Branch Headers */}
                <tr className="hover:bg-transparent border-b-0">
                  <th className="bg-slate-100 border-r border-slate-200 text-slate-700 font-bold sticky top-0 z-30 px-4 py-3 text-left" colSpan={4}>Item Details</th>
                  <th className="bg-[#004d99] text-white font-bold text-center text-lg py-3 border-r border-blue-800 shadow-inner sticky top-0 z-30">CG</th>
                  <th className="bg-[#1a0033] text-white font-bold text-center text-lg py-3 border-r border-purple-900 shadow-inner sticky top-0 z-30">NE</th>
                  <th className="bg-[#4d0000] text-white font-bold text-center text-lg py-3 border-r border-red-900 shadow-inner sticky top-0 z-30">Maniquip</th>
                  <th className="bg-[#006666] text-white font-bold text-center text-lg py-3 shadow-inner sticky top-0 z-30">Head Office</th>
                </tr>
                
                {/* Sub Headers */}
                <tr className="hover:bg-transparent border-b border-slate-200 shadow-sm">
                  <th className="bg-slate-50 border-r border-slate-200 text-[11px] font-bold text-slate-600 uppercase sticky top-[52px] z-30 px-2 py-2 text-left">Group</th>
                  <th className="bg-slate-50 border-r border-slate-200 text-[11px] font-bold text-slate-600 uppercase sticky top-[52px] z-30 px-2 py-2 text-left">Category</th>
                  <th className="bg-slate-50 border-r border-slate-200 text-[11px] font-bold text-slate-600 uppercase sticky top-[52px] z-30 px-2 py-2 text-left">Item Code</th>
                  <th className="bg-slate-50 border-r border-slate-200 text-[11px] font-bold text-slate-600 uppercase sticky top-[52px] z-30 px-2 py-2 text-left">Name of Item</th>
                  
                  <th className="bg-[#003d7a] text-blue-50 text-[10px] text-center font-medium leading-tight py-2 border-r border-blue-800 sticky top-[52px] z-30">
                    REORDER QUANTITY <br/> = MAX LEVEL - LIVE STOCK - INDENT RAISED
                  </th>
                  <th className="bg-[#130026] text-purple-50 text-[10px] text-center font-medium leading-tight py-2 border-r border-purple-900 sticky top-[52px] z-30">
                    REORDER QUANTITY <br/> = MAX LEVEL - LIVE STOCK - INDENT RAISED
                  </th>
                  <th className="bg-[#3d0000] text-red-50 text-[10px] text-center font-medium leading-tight py-2 border-r border-red-900 sticky top-[52px] z-30">
                    REORDER QUANTITY <br/> = MAX LEVEL - LIVE STOCK - INDENT RAISED
                  </th>
                  <th className="bg-[#004d4d] text-teal-50 text-[10px] text-center font-medium leading-tight py-2 sticky top-[52px] z-30">
                    REORDER QUANTITY <br/> = MAX LEVEL - LIVE STOCK - INDENT RAISED
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white">
                {filteredData.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="h-32 text-center text-muted-foreground">
                      No matching data found
                    </td>
                  </tr>
                ) : (
                  filteredData.map((row, idx) => {
                    // Check if it's an empty row
                    if (!row || row.every((cell: any) => !cell)) return null;

                    return (
                      <tr key={idx} className="hover:bg-slate-50/80 transition-colors border-b border-slate-100">
                        {/* Item Details (A-D) */}
                        <td className="border-r border-slate-100 text-[11px] px-2 py-2">{row[0]}</td>
                        <td className="border-r border-slate-100 text-[11px] px-2 py-2">{row[1]}</td>
                        <td className="border-r border-slate-100 text-[11px] px-2 py-2 font-mono text-slate-600">{row[2]}</td>
                        <td className="border-r border-slate-100 text-[11px] px-2 py-2 font-medium">{row[3]}</td>

                        {/* CG Data (Index 94) */}
                        <td className={`text-center font-medium border-r border-slate-100 px-2 py-2 ${parseFloat(row[94]) < 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                          {row[94] !== undefined ? row[94] : "0"}
                        </td>

                        {/* NE Data (Index 95) */}
                        <td className={`text-center font-medium border-r border-slate-100 px-2 py-2 ${parseFloat(row[95]) < 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                          {row[95] !== undefined ? row[95] : "0"}
                        </td>

                        {/* Maniquip Data (Index 96) */}
                        <td className={`text-center font-medium border-r border-slate-100 px-2 py-2 ${parseFloat(row[96]) < 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                          {row[96] !== undefined ? row[96] : "0"}
                        </td>

                        {/* Head Office Data (Index 97) */}
                        <td className={`text-center font-medium px-2 py-2 ${parseFloat(row[97]) < 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                          {row[97] !== undefined ? row[97] : "0"}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
        <div className="bg-slate-50 p-3 border-t border-slate-100 flex items-center justify-between">
           <p className="text-[10px] text-muted-foreground">Rows showing: {Math.max(0, data.length - 2)}</p>
           <p className="text-[10px] text-muted-foreground font-medium italic">Powered by Real-time Inventory Engine</p>
        </div>
      </Card>
    </div>
  );
}
