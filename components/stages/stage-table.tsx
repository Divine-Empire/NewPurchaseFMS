"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Clock, ClipboardList, AlertCircle } from "lucide-react";
import type { WorkflowRecord } from "@/lib/workflow-context";

interface StageTableProps {
  title: string;
  stage: number;
  pending: WorkflowRecord[];
  history: WorkflowRecord[];
  onOpenForm: () => void;
  onSelectRecord: (record: WorkflowRecord) => void;
  columns: { key: string; label: string }[];
  showPending?: boolean;
  actionLabel?: string;
}

export function StageTable({
  title,
  stage,
  pending,
  history,
  onOpenForm,
  onSelectRecord,
  columns,
  showPending = true,
}: StageTableProps) {
  // Get timestamp when THIS stage was completed
  const getStageTimestamp = (record: WorkflowRecord) => {
    try {
      // Try to find a history entry for this specific stage
      const entry = record.history.find((h) => h.stage === stage);

      // Use the entry's date if available, otherwise fall back to record's creation date
      const timestamp = entry?.date || record.createdAt;

      const d = new Date(timestamp);
      const day = String(d.getDate()).padStart(2, "0");
      const month = String(d.getMonth() + 1).padStart(2, "0");
      const year = d.getFullYear();
      return `${day}/${month}/${year}`;
    } catch (e) {
      console.error("Error formatting date:", e);
      return "—";
    }
  };

  // Mobile Card (also shows Timestamp first)
  const RecordCard = ({
    record,
    isPending = false,
    onAction,
    actionLabel = "Edit",
  }: {
    record: WorkflowRecord;
    isPending?: boolean;
    onAction: () => void;
    actionLabel?: string;
  }) => (
    <Card className="mb-3 hover:shadow-md transition-shadow">
      <CardContent className="p-4">
        <div className="flex items-start justify-between mb-3">
          <div className="flex-1 min-w-0">
            <div
              className={`inline-flex px-2 py-1 rounded-full text-xs font-medium ${record.status === "completed"
                ? "bg-green-100 text-green-800"
                : "bg-yellow-100 text-yellow-800"
                }`}
            >
              {record.status}
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={onAction}
            className="ml-2 flex-shrink-0"
          >
            {actionLabel}
          </Button>
        </div>

        <div className="grid grid-cols-1 gap-2 text-sm">
          {/* Timestamp first in mobile too */}
          {!isPending && (
            <div className="flex justify-between">
              <span className="text-muted-foreground font-medium">
                Timestamp:
              </span>
              <span className="text-right font-medium text-green-700">
                {getStageTimestamp(record)}
              </span>
            </div>
          )}

          {columns.map((col) => (
            <div key={col.key} className="flex justify-between">
              <span className="text-muted-foreground font-medium">
                {col.label}:
              </span>
              <span className="text-right break-words ml-2">
                {col.key === "leadTime"
                  ? `${record.data[col.key] || "-"} days`
                  : String(record.data[col.key] || "-")}
              </span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );

  return (
    <div className="p-4 md:p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <h2 className="text-2xl md:text-3xl font-bold text-foreground">
          {title}
        </h2>
      </div>

      <div className="space-y-6">
        {/* Pending Section */}
        {showPending && (
          <Card className="overflow-hidden">
            <CardHeader className="pb-4 bg-primary/5">
              <CardTitle className="text-lg font-semibold flex items-center justify-between">
                <div className="flex items-center gap-2 text-black">
                  <ClipboardList className="w-5 h-5 text-black" />
                  Pending ({pending.length})
                </div>
                {pending.length > 5 && (
                  <span className="text-xs font-normal text-muted-foreground animate-pulse">
                    Urgent tasks awaiting action
                  </span>
                )}
              </CardTitle>
            </CardHeader>

            <CardContent className="px-4 pb-4">
              {pending.length === 0 ? (
                <div className="text-center text-muted-foreground py-8">
                  No pending records
                </div>
              ) : (
                <>
                  {/* Mobile */}
                  <div className="block md:hidden space-y-3">
                    {pending.map((record) => (
                      <RecordCard
                        key={record.id}
                        record={record}
                        isPending={true}
                        onAction={() => onSelectRecord(record)}
                        actionLabel="Edit"
                      />
                    ))}
                  </div>

                  {/* Desktop */}
                  <div className="hidden md:block overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-[100px]">Actions</TableHead>
                          {/* Render first column (Indent #) */}
                          <TableHead className="min-w-[120px]">
                            {columns[0]?.label}
                          </TableHead>
                          {/* Date column at index 2 */}
                          <TableHead className="min-w-[120px]">
                            Date
                          </TableHead>
                          {/* Render remaining columns */}
                          {columns.slice(1).map((col) => (
                            <TableHead key={col.key} className="min-w-[120px]">
                              {col.label}
                            </TableHead>
                          ))}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {pending.map((record) => (
                          <TableRow
                            key={record.id}
                            className="odd:bg-white even:bg-slate-50/50 hover:bg-slate-100/50 transition-colors border-b border-slate-100 last:border-0"
                          >
                            <TableCell>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => onSelectRecord(record)}
                              >
                                Edit
                              </Button>
                            </TableCell>
                            {/* Render first column cell (Indent #) */}
                            <TableCell className="text-sm">
                              {String(record.data[columns[0]?.key] || "-")}
                            </TableCell>
                            {/* Date cell at index 2 */}
                            <TableCell className="text-sm">
                              {getStageTimestamp(record)}
                            </TableCell>
                            {/* Render remaining column cells */}
                            {columns.slice(1).map((col) => (
                              <TableCell key={col.key} className="text-sm">
                                {col.key === "leadTime"
                                  ? `${record.data[col.key] || "-"} days`
                                  : col.key === "attachment" && record.data[col.key]
                                    ? <a href={record.data[col.key]} target="_blank" rel="noopener noreferrer" className="text-blue-500 underline hover:text-blue-700">View</a>
                                    : String(record.data[col.key] || "-")}
                              </TableCell>
                            ))}
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        )}

        {/* History Section */}
        {!showPending && (
          <Card className="overflow-hidden shadow-sm border-muted">
            <CardHeader className="pb-4 bg-muted/30">
              <CardTitle className="text-lg font-semibold flex items-center gap-2 text-black">
                <Clock className="w-5 h-5 text-black" />
                History ({history.length})
              </CardTitle>
            </CardHeader>

            <CardContent className="px-4 pb-4">
              {history.length === 0 ? (
                <div className="text-center text-muted-foreground py-8">
                  No completed records
                </div>
              ) : (
                <>
                  {/* Mobile */}
                  <div className="block md:hidden space-y-3">
                    {history.map((record) => (
                      <RecordCard
                        key={record.id}
                        record={record}
                        isPending={false}
                        onAction={() => { }}
                        actionLabel="View"
                      />
                    ))}
                  </div>

                  {/* Desktop Table */}
                  <div className="hidden md:block overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          {/* TIMESTAMP FIRST COLUMN */}
                          <TableHead className="min-w-[180px] font-bold text-black border-b border-slate-200">
                            Timestamp
                          </TableHead>
                          {columns.map((col) => (
                            <TableHead key={col.key} className="min-w-[120px]">
                              {col.label}
                            </TableHead>
                          ))}
                          <TableHead className="w-[100px]">Status</TableHead>
                        </TableRow>
                      </TableHeader>

                      <TableBody>
                        {history.map((record) => (
                          <TableRow
                            key={record.id}
                            className="odd:bg-white even:bg-slate-50/50 hover:bg-green-50/30 transition-colors border-b border-slate-100 last:border-0"
                          >
                            {/* TIMESTAMP CELL FIRST */}
                            <TableCell className="font-medium text-black whitespace-nowrap">
                              {getStageTimestamp(record)}
                            </TableCell>

                            {columns.map((col) => (
                              <TableCell key={col.key} className="text-sm">
                                {col.key === "leadTime"
                                  ? `${record.data[col.key] || "-"} days`
                                  : col.key === "attachment" && record.data[col.key]
                                    ? <a href={record.data[col.key]} target="_blank" rel="noopener noreferrer" className="text-blue-500 underline hover:text-blue-700">View</a>
                                    : String(record.data[col.key] || "-")}
                              </TableCell>
                            ))}

                            <TableCell className="font-medium text-black">
                              Completed
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
