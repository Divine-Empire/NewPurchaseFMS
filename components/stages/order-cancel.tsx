"use client"

import { useState, useEffect, useMemo } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { RefreshCw, Search, Plus, Loader2, AlertCircle, XCircle } from "lucide-react"
import { toast } from "sonner"

export default function OrderCancelPage() {
  const [orderNumber, setOrderNumber] = useState("")
  const [cancelStage, setCancelStage] = useState("")
  const [cancelReason, setCancelReason] = useState("")
  const [qty, setQty] = useState("")
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [cancelledOrders, setCancelledOrders] = useState<any[]>([])
  const [stageOptions, setStageOptions] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const SHEET_NAME = "Order-Cancel"

  const [searchTerm, setSearchTerm] = useState("")

  // Helper function to parse Google Sheets date format and display as DD/MM/YYYY HH:MM:SS
  const parseGoogleSheetsDate = (dateString: any) => {
    if (!dateString) return "—"
    if (typeof dateString !== "string") return dateString
    if (!dateString.startsWith("Date(")) return dateString

    try {
      // Extract numbers inside Date()
      const parts = dateString.slice(5, -1).split(",")
      if (parts.length < 3) return dateString

      const year = Number(parts[0])
      const month = Number(parts[1]) // zero based
      const day = Number(parts[2])
      const hour = parts.length > 3 ? Number(parts[3]) : 0
      const minute = parts.length > 4 ? Number(parts[4]) : 0
      const second = parts.length > 5 ? Number(parts[5]) : 0

      // Format to dd/mm/yyyy hh:mm:ss
      const pad = (n: number) => String(n).padStart(2, '0')

      return `${pad(day)}/${pad(month + 1)}/${year} ${pad(hour)}:${pad(minute)}:${pad(second)}`
    } catch (error) {
      return dateString
    }
  }

  const fetchCancelledOrders = async () => {
    setLoading(true)
    setError(null)

    try {
      const SHEET_API_URL = process.env.NEXT_PUBLIC_API_URI
      if (!SHEET_API_URL) {
        throw new Error("API URI not defined in environment variables")
      }

      const response = await fetch(`${SHEET_API_URL}?sheet=${SHEET_NAME}`)
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const json = await response.json()
      if (json.success && Array.isArray(json.data)) {
        const orders: any[] = []

        json.data.slice(1).forEach((row: any, index: number) => { // Skip header row
          if (row && row.length > 0) {
            const actualRowIndex = index + 2
            const order = {
              id: `CANCEL-${actualRowIndex}`,
              rowIndex: actualRowIndex,
              timestamp: row[0] || "", // Column A - Timestamp
              orderNumber: row[1] || "", // Column B - Indent-No.
              cancelStage: row[2] || "", // Column C - Cancel Stage
              cancelReason: row[3] || "", // Column D - Cancel Reason
              qty: row[4] || "", // Column E - Qty
              fullRowData: row,
            }
            orders.push(order)
          }
        })

        setCancelledOrders(orders)
      } else {
        throw new Error(json.error || "Failed to fetch data")
      }
    } catch (err: any) {
      console.error("Error fetching cancelled orders:", err)
      setError(err.message)
      setCancelledOrders([])
    } finally {
      setLoading(false)
    }
  }

  const fetchCancelStages = async () => {
    try {
      const SHEET_API_URL = process.env.NEXT_PUBLIC_API_URI
      if (!SHEET_API_URL) return

      const response = await fetch(`${SHEET_API_URL}?sheet=Master`)
      if (!response.ok) return

      const json = await response.json()
      if (json.success && Array.isArray(json.data)) {
        const options: string[] = []
        json.data.slice(1).forEach((row: any) => { // Row 2 onwards
          if (row && row[6]) {
            options.push(String(row[6]).trim())
          }
        })
        const uniqueOptions = [...new Set(options)].filter(Boolean)
        setStageOptions(uniqueOptions)
      }
    } catch (err) {
      console.error("Error fetching cancel stages from Master:", err)
    }
  }

  useEffect(() => {
    fetchCancelledOrders()
    fetchCancelStages()
  }, [])

  // Filter orders based on search term
  const filteredCancelledOrders = useMemo(() => {
    if (!searchTerm) return cancelledOrders

    return cancelledOrders.filter((order) => {
      return (
        (order.orderNumber || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
        (order.cancelStage || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
        (order.cancelReason || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
        (order.qty || "").toString().toLowerCase().includes(searchTerm.toLowerCase())
      )
    })
  }, [cancelledOrders, searchTerm])

  const submitCancellation = async () => {
    if (!orderNumber || !cancelStage || !cancelReason || !qty) {
      toast.error("Please fill all required fields")
      return
    }

    setSubmitting(true)

    try {
      const formData = new FormData()
      formData.append("sheetName", SHEET_NAME)
      formData.append("action", "insert")

      // Create row data for the cancellation with timestamp in DD/MM/YYYY format
      const today = new Date()
      const timestamp = `${today.getDate().toString().padStart(2, '0')}/${(today.getMonth() + 1).toString().padStart(2, '0')}/${today.getFullYear()} ${today.getHours().toString().padStart(2, '0')}:${today.getMinutes().toString().padStart(2, '0')}:${today.getSeconds().toString().padStart(2, '0')}`

      const rowData = [
        timestamp,       // Column A - Timestamp (DD/MM/YYYY HH:MM:SS)
        orderNumber,     // Column B - Indent-No.
        cancelStage,     // Column C - Cancel Stage
        cancelReason,    // Column D - Cancel Reason
        qty,             // Column E - Qty
      ]

      formData.append("rowData", JSON.stringify(rowData))

      const SHEET_API_URL = process.env.NEXT_PUBLIC_API_URI
      if (!SHEET_API_URL) {
        throw new Error("API URI not defined in environment variables")
      }

      const response = await fetch(SHEET_API_URL, {
        method: "POST",
        mode: "cors",
        body: formData,
      })

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      let result
      try {
        const responseText = await response.text()
        result = JSON.parse(responseText)
      } catch (parseError) {
        result = { success: true }
      }

      if (result.success !== false) {
        // Reset form
        setOrderNumber("")
        setCancelStage("")
        setCancelReason("")
        setQty("")
        setIsDialogOpen(false)
        
        // Refresh the list
        await fetchCancelledOrders()
        
        toast.success(`Order ${orderNumber} has been cancelled successfully`)
      } else {
        throw new Error(result.error || "Cancellation failed")
      }
    } catch (err: any) {
      console.error("Error submitting cancellation:", err)
      toast.error(`Error cancelling order: ${err.message}`)
    } finally {
      setSubmitting(false)
    }
  }

  const handleNewCancellation = () => {
    setOrderNumber("")
    setCancelStage("")
    setCancelReason("")
    setQty("")
    setIsDialogOpen(true)
  }

  const handleRefresh = async () => {
    setLoading(true)
    try {
      await fetchCancelledOrders()
      await fetchCancelStages()
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  if (loading && cancelledOrders.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-[calc(100vh-10rem)] gap-4">
        <Loader2 className="w-10 h-10 animate-spin text-red-600" />
        <p className="text-muted-foreground animate-pulse font-medium">Fetching Cancelled Orders...</p>
      </div>
    )
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
            <Button variant="outline" onClick={handleRefresh} className="mt-2">
              <RefreshCw className="w-4 h-4 mr-2" />
              Try Again
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="p-6 flex flex-col gap-4 animate-in fade-in duration-500">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="p-2.5 bg-red-600 rounded-xl shadow-lg text-white">
            <XCircle className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Order Cancel</h2>
            <p className="text-[13px] text-muted-foreground mt-0">Manage and track cancelled orders</p>
          </div>
        </div>
        
        <div className="flex items-center gap-3 w-full md:w-auto">
          <div className="relative flex-1 md:w-80">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input 
              placeholder="Search cancelled orders..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 bg-white border-slate-200 shadow-sm focus:ring-red-500 focus:border-red-500 rounded-lg h-10"
            />
          </div>
          <Button variant="outline" onClick={handleRefresh} size="icon" className="bg-white shadow-sm hover:bg-slate-50 border-slate-200 h-10 w-10 shrink-0">
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
          <Button onClick={handleNewCancellation} className="bg-red-600 hover:bg-red-700 text-white font-medium rounded-lg h-10 px-4 shadow-sm flex items-center gap-2">
            <Plus className="h-4 w-4" />
            Cancel Order
          </Button>
        </div>
      </div>

      <Card className="border-0 shadow-xl bg-white overflow-hidden ring-1 ring-slate-200 rounded-xl">
        <CardHeader className="bg-slate-50/80 border-b border-slate-100 py-3 px-6">
          <div className="flex flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-3">
              <div className="w-1.5 h-6 bg-red-600 rounded-full" />
              <CardTitle className="text-xs font-bold text-slate-800 uppercase tracking-widest whitespace-nowrap">
                Cancellation Logs
              </CardTitle>
            </div>
            <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200 px-2 py-0.5 text-[10px] font-bold whitespace-nowrap">
              {filteredCancelledOrders.length} RECORDS FOUND
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="max-h-[calc(100vh-16rem)] overflow-auto relative custom-scrollbar">
            <Table>
              <TableHeader className="bg-white sticky top-0 z-20">
                <TableRow className="hover:bg-transparent border-b border-slate-200">
                  <TableHead className="font-bold text-slate-700 uppercase text-[10px]">Cancelled At</TableHead>
                  <TableHead className="font-bold text-slate-700 uppercase text-[10px]">Indent-No.</TableHead>
                  <TableHead className="font-bold text-slate-700 uppercase text-[10px]">Cancel Stage</TableHead>
                  <TableHead className="font-bold text-slate-700 uppercase text-[10px]">Cancel Reason</TableHead>
                  <TableHead className="w-[100px] text-center font-bold text-slate-700 uppercase text-[10px]">Qty</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredCancelledOrders.map((order) => (
                  <TableRow key={order.id} className="hover:bg-slate-50/50 transition-colors border-b border-slate-100 group">
                    <TableCell className="text-[11px] text-slate-500 font-mono py-4">
                      {parseGoogleSheetsDate(order.timestamp)}
                    </TableCell>
                    <TableCell className="font-medium text-slate-900 py-4">
                      {order.orderNumber}
                    </TableCell>
                    <TableCell className="py-4">
                      <Badge variant="secondary" className="bg-slate-100 text-slate-800 border-slate-200">{order.cancelStage}</Badge>
                    </TableCell>
                    <TableCell className="py-4">
                      <Badge
                        variant={
                          order.cancelReason === "Customer Request"
                            ? "default"
                            : order.cancelReason === "Quality Issues"
                            ? "destructive"
                            : "secondary"
                        }
                      >
                        {order.cancelReason}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center font-semibold text-slate-700 py-4">
                      {order.qty || "—"}
                    </TableCell>
                  </TableRow>
                ))}
                {filteredCancelledOrders.length === 0 && (
                  <TableRow>
                    <TableCell
                      colSpan={5}
                      className="text-center text-muted-foreground h-32"
                    >
                      {searchTerm
                        ? "No orders match your search criteria"
                        : "No cancelled orders found"}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

    {/* Cancel Order Dialog */}
    <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Cancel Order</DialogTitle>
          <DialogDescription>
            Fill in the details to cancel an order
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="orderNumber">Indent-No. *</Label>
            <Input
              id="orderNumber"
              value={orderNumber}
              onChange={(e) => setOrderNumber(e.target.value)}
              placeholder="Enter Indent Number"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="cancelStage">Order Cancel Stage *</Label>
            <Select value={cancelStage} onValueChange={setCancelStage}>
              <SelectTrigger>
                <SelectValue placeholder="Select cancel stage" />
              </SelectTrigger>
              <SelectContent>
                {stageOptions.map((option) => (
                  <SelectItem key={option} value={option}>
                    {option}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="cancelReason">Order Cancel Reason *</Label>
            <Input
              id="cancelReason"
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              placeholder="Enter cancel reason"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="qty">Qty *</Label>
            <Input
              id="qty"
              type="number"
              value={qty}
              onChange={(e) => setQty(e.target.value)}
              placeholder="Enter quantity..."
            />
          </div>

          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              onClick={() => setIsDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button
              onClick={submitCancellation}
              disabled={
                !orderNumber || !cancelStage || !cancelReason || !qty || submitting
              }
              variant="destructive"
            >
              {submitting ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Cancelling...
                </>
              ) : (
                "Cancel Order"
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
    
    <style jsx global>{`
      .custom-scrollbar::-webkit-scrollbar {
        width: 8px;
        height: 8px;
      }
      .custom-scrollbar::-webkit-scrollbar-track {
        background: #f1f5f9;
      }
      .custom-scrollbar::-webkit-scrollbar-thumb {
        background: #cbd5e1;
        border-radius: 4px;
      }
      .custom-scrollbar::-webkit-scrollbar-thumb:hover {
        background: #94a3b8;
      }
    `}</style>
  </div>
)
}