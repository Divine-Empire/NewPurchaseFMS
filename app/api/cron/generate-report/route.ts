import { NextRequest, NextResponse } from "next/server";
import { pdf } from "@react-pdf/renderer";
import React from "react";
import { ReportDocument } from "@/components/report-pdf";

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

        console.log("Fetching data for automated report...");

        // 1. Fetch data from Google Sheets (Reusing dashboard logic)
        // Note: For simplicity, we are fetching INDENT-LIFT here. 
        // In a real scenario, you might want to fetch all necessary sheets.
        const response = await fetch(`${API_URI}?sheet=INDENT-LIFT&action=getAll`);
        const result = await response.json();

        if (!result.success) throw new Error("Failed to fetch data from Sheets");

        // 2. Prepare data for the PDF (Mocking the transformation logic from dashboard.tsx)
        // This is a simplified version. In production, you'd replicate the dashboard's calc logic.
        const summaryData = [
            { stage: "Total Orders", pending: result.data.length - 6, responsible: "System" }
        ];
        const detailedData = result.data.slice(6).map((row: any) => ({
            stage: "Overview",
            indent: row[1],
            party: row[3],
            item: row[4],
            qty: row[5]
        }));

        // 3. Generate PDF Buffer
        console.log("Generating PDF document...");
        const doc = React.createElement(ReportDocument, { summaryData, detailedData }) as any;
        const pdfStream = await pdf(doc).toBuffer();
        const base64Pdf = (pdfStream as any).toString('base64');

        // 4. Upload to Google Drive & Log to Sheet via GAS
        console.log("Uploading to Drive via GAS...");
        const uploadParams = new URLSearchParams();
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const filename = `Daily_Report_${timestamp}.pdf`;

        uploadParams.append("action", "uploadReport");
        uploadParams.append("base64Data", base64Pdf);
        uploadParams.append("fileName", filename);
        uploadParams.append("folderId", process.env.NEXT_PUBLIC_IMAGE_FOLDER_ID || "");

        const uploadRes = await fetch(API_URI, {
            method: "POST",
            body: uploadParams
        });
        const uploadResult = await uploadRes.json();

        if (!uploadResult.success) {
            throw new Error(`GAS Upload failed: ${uploadResult.error}`);
        }

        return NextResponse.json({
            success: true,
            message: "Report generated and uploaded successfully",
            fileUrl: uploadResult.fileUrl
        });

    } catch (error: any) {
        console.error("Cron Error:", error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
