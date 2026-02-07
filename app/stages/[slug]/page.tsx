"use client";

import { useParams } from "next/navigation";
import CreateIndent from "@/components/stages/create-indent";
import IndentApproval from "@/components/stages/indent-approval";
import Update3Vendors from "@/components/stages/update-3-vendors";
import Negotiation from "@/components/stages/negotiation";
import POEntry from "@/components/stages/po-entry";
import FollowUpVendor from "@/components/stages/follow-up-vendor";
import MaterialReceived from "@/components/stages/material-received";
import QCRequirement from "@/components/stages/qc-requirement";
import ReceiptInTally from "@/components/stages/receipt-in-tally";
import SubmitInvoice from "@/components/stages/submit-invoice";
import Verification from "@/components/stages/verification";
import PurchaseReturn from "@/components/stages/purchase-return";
import VendorPayment from "@/components/stages/vendor-payment";
import FreightPayments from "@/components/stages/freight-payments";
import ReturnApproval from "@/components/stages/return-approval";

const stageComponents: Record<string, React.ComponentType> = {
    "create-indent": CreateIndent,
    "indent-approval": IndentApproval,
    "update-3-vendors": Update3Vendors,
    "negotiation": Negotiation,
    "po-entry": POEntry,
    "follow-up-vendor": FollowUpVendor,
    "material-received": MaterialReceived,
    "qc-requirement": QCRequirement,
    "receipt-in-tally": ReceiptInTally,
    "submit-invoice": SubmitInvoice,
    "verification": Verification,
    "purchase-return": PurchaseReturn,
    "vendor-payment": VendorPayment,
    "freight-payments": FreightPayments,
    "return-approval": ReturnApproval,
};

export default function StagePage() {
    const params = useParams();
    const slug = params.slug as string;

    const StageComponent = stageComponents[slug];

    if (!StageComponent) {
        return <div className="p-6">Stage not found {slug}</div>;
    }

    return <StageComponent />;
}
