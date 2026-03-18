import { NextRequest, NextResponse } from "next/server";
import { renderToBuffer } from "@react-pdf/renderer";
import React from "react";
import { ReportDocument } from "@/components/report-pdf";

export const maxDuration = 60;
export const dynamic = "force-dynamic";

// We can set a secret to protect this endpoint from manual calls
const CRON_SECRET = process.env.CRON_SECRET;

export async function GET(request: NextRequest) {
    // Basic security check (Optional but recommended)
    const authHeader = request.headers.get('authorization');
    if (CRON_SECRET && authHeader !== `Bearer ${CRON_SECRET}`) {
        return new NextResponse('Unauthorized', { status: 401 });
    }

    try {
        const API_URI = process.env.NEXT_PUBLIC_API_URI;
        if (!API_URI) throw new Error("API URI not configured");

        console.log("Fetching comprehensive data for synced report...");

        // 1. Fetch required sheets in parallel
        const [fmsRes, raRes, masterRes, transportRes] = await Promise.all([
            fetch(`${API_URI}?sheet=INDENT-LIFT`),
            fetch(`${API_URI}?sheet=RECEIVING-ACCOUNTS`),
            fetch(`${API_URI}?sheet=Master`),
            fetch(`${API_URI}?sheet=${encodeURIComponent("Transport Flw-Up")}`),
        ]);

        const [fmsJson, raJson, masterJson, transportJson] = await Promise.all([
            fmsRes.json(), raRes.json(), masterRes.json(), transportRes.json()
        ]);

        if (!fmsJson.success || !raJson.success || !masterJson.success || !transportJson.success) {
            throw new Error("Failed fetching comprehensive data for report");
        }

        const fmsRows = fmsJson.data;
        const raRows = raJson.data;
        const masterRows = masterJson.data;
        const transportRows = transportJson.data;

        // 2. Prepare mapping lookups
        const respMap: Record<string, string> = {};
        if (Array.isArray(masterRows)) {
            masterRows.slice(1).forEach((row: any) => {
                const stageName = row[6]; // Col G
                const respPerson = row[7]; // Col H
                if (stageName && respPerson) respMap[String(stageName).trim()] = String(respPerson).trim();
            });
        }

        const transportMap = new Map<string, string>();
        if (Array.isArray(transportRows)) {
            transportRows.slice(1).forEach((row: any) => {
                const liftNo = row[1]; // Column B
                const exDate = row[4]; // Column E
                if (liftNo) transportMap.set(String(liftNo).trim(), String(exDate || ""));
            });
        }

        // 3. Transformation Logic (Mirroring dashboard.tsx)
        const allowedStages = ["Indent Approval", "PO Entry", "Follow-Up Vendor", "Transporter Follow-Up"];
        const totalCounts: Record<string, number> = {};
        const overdueCounts: Record<string, number> = {};
        allowedStages.forEach(name => {
            totalCounts[name] = 0;
            overdueCounts[name] = 0;
        });

        const detailed: any[] = [];
        const has = (r: any, idx: number) => r[idx] !== null && r[idx] !== undefined && String(r[idx]).trim() !== "" && String(r[idx]).trim() !== "-";
        const missing = (r: any, idx: number) => !has(r, idx);

        const followUpVendorPOs = new Set<string>();

        // FMS Loop
        for (let i = 6; i < fmsRows.length; i++) {
            const r = fmsRows[i];
            if (!r || !r[1]) continue;

            const checkStage = (name: string, start: number, actual: number, plan: number, delayIdx: number, mode: 'category' | 'vendor' | 'default' = 'default') => {
                // "Follow-Up Vendor" has unique logic: Planned (60) NOT NULL, Actual (61) NULL, Delay (62) NOT NULL, PO (54) NOT NULL + UNIQUE
                if (name === "Follow-Up Vendor") {
                    const isOverdue = has(r, 60) && missing(r, 61) && has(r, 62);
                    const rawPo = String(r[54] || "").trim();

                    if (isOverdue && rawPo && rawPo !== "-") {
                        const poNumKey = rawPo.toUpperCase().replace(/\s+/g, '');
                        const isUnique = !followUpVendorPOs.has(poNumKey);
                        
                        totalCounts[name]++;
                        overdueCounts[name]++;

                        if (isUnique) {
                            followUpVendorPOs.add(poNumKey);

                            let party = "-";
                            const awName = String(r[48] || "").trim();
                            const axName = String(r[49] || "").trim();
                            const avName = String(r[47] || "").trim();
                            const selectedId = avName.toLowerCase();
                            if (awName && awName !== "-") party = awName;
                            else if (selectedId.includes("vendor1") || selectedId === "1" || selectedId === "vendor 1") party = r[21] || "-";
                            else if (selectedId.includes("vendor2") || selectedId === "2" || selectedId === "vendor 2") party = r[29] || "-";
                            else if (selectedId.includes("vendor3") || selectedId === "3" || selectedId === "vendor 3") party = r[37] || "-";
                            else if (axName && axName !== "-" && isNaN(Date.parse(axName)) && isNaN(Number(axName))) party = axName;
                            else if (avName && avName !== "-" && isNaN(Date.parse(avName)) && isNaN(Number(avName))) party = avName;
                            else party = r[3] || "-";

                            detailed.push({
                                indent: r[1] || "-",
                                party,
                                item: r[4] || "-",
                                qty: r[14] || r[5] || "-",
                                stage: name,
                                delay: r[62] || "0",
                                poNumber: rawPo // Keep original formatting for display
                            });
                        }
                    }
                    return;
                }

                if (has(r, start) && missing(r, actual)) {
                    totalCounts[name]++;
                    if (has(r, delayIdx)) {
                        overdueCounts[name]++;
                        let party = "-";
                        if (name === "Indent Approval") {
                            party = r[2] || "-"; // Created By
                        } else if (mode === 'vendor') {
                            const awName = String(r[48] || "").trim();
                            const axName = String(r[49] || "").trim();
                            const avName = String(r[47] || "").trim();
                            const selectedId = avName.toLowerCase();
                            if (awName && awName !== "-") party = awName;
                            else if (selectedId.includes("vendor1") || selectedId === "1" || selectedId === "vendor 1") party = r[21] || "-";
                            else if (selectedId.includes("vendor2") || selectedId === "2" || selectedId === "vendor 2") party = r[29] || "-";
                            else if (selectedId.includes("vendor3") || selectedId === "3" || selectedId === "vendor 3") party = r[37] || "-";
                            else if (axName && axName !== "-" && isNaN(Date.parse(axName)) && isNaN(Number(axName))) party = axName;
                            else if (avName && avName !== "-" && isNaN(Date.parse(avName)) && isNaN(Number(avName))) party = avName;
                            else party = r[3] || "-";
                        } else {
                            party = r[3] || "-";
                        }

                        detailed.push({
                            indent: r[1] || "-",
                            party,
                            item: r[4] || "-",
                            qty: (name === "PO Entry") ? (r[14] || r[5] || "-") : (r[5] || "-"),
                            stage: name,
                            delay: r[delayIdx] || "0",
                            poNumber: r[54] || "-"
                        });
                    }
                }
            };

            checkStage("Indent Approval", 9, 10, 11, 11, 'category');
            checkStage("PO Entry", 51, 52, 51, 53, 'vendor');
            checkStage("Follow-Up Vendor", 60, 61, 60, 62, 'vendor');
        }

        // RA Loop
        for (let i = 6; i < raRows.length; i++) {
            const r = raRows[i];
            if (!r || !r[1]) continue;

            if (has(r, 88) && missing(r, 89)) {
                totalCounts["Transporter Follow-Up"]++;
                if (has(r, 88)) {
                    overdueCounts["Transporter Follow-Up"]++;
                    const liftNo = String(r[2] || "").trim();
                    detailed.push({
                        indent: r[1] || "-",
                        party: r[3] || "-",
                        item: r[7] || "-",
                        qty: r[8] || "-",
                        stage: "Transporter Follow-Up",
                        delay: r[90] || "0",
                        expectedDate: transportMap.get(liftNo) || "-",
                        transporterName: r[9] || "-",
                        poNumber: r[54] || "-"
                    });
                }
            }
        }

        const summaryData = allowedStages
            .filter(name => overdueCounts[name] > 0)
            .map(name => ({
                stage: name,
                pending: overdueCounts[name],
                responsible: respMap[name] || "-",
            }));

        // Sort detailed data by stage sequence to match summary
        detailed.sort((a, b) => {
            const indexA = allowedStages.indexOf(a.stage);
            const indexB = allowedStages.indexOf(b.stage);
            return indexA - indexB;
        });

        // 4. Generate PDF Document
        console.log(`Generating Sync Report with ${detailed.length} total items...`);
        const doc = React.createElement(ReportDocument, { summaryData, detailedData: detailed }) as any;
        const buffer = await renderToBuffer(doc);
        const base64Pdf = buffer.toString('base64');
        const filename = `Purchase_Report_${new Date().toISOString().split('T')[0]}.pdf`;

        // 5. Upload via GAS
        console.log(`Uploading ${filename} to Drive...`);
        const payload = {
            action: "uploadReport",
            base64Data: base64Pdf,
            fileName: filename,
            folderId: process.env.NEXT_PUBLIC_IMAGE_FOLDER_ID || ""
        };

        const uploadRes = await fetch(API_URI, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
        });
        const uploadResult = await uploadRes.json();

        if (!uploadResult.success) throw new Error(`GAS Upload failed: ${uploadResult.error}`);

        return NextResponse.json({
            success: true,
            message: "Purchase Report synced with frontend and uploaded successfully",
            fileUrl: uploadResult.fileUrl
        });

    } catch (error: any) {
        console.error("Cron Error:", error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
