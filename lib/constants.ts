import {
    PlusCircle, CheckCircle2, Users, MessagesSquare, FileEdit,
    Phone, Package, ClipboardCheck, FileText, Upload, ShieldCheck,
    CornerUpLeft, CreditCard, Truck, TruckIcon
} from "lucide-react";

export const STAGES = [
    { num: 1, name: "Create Indent", slug: "create-indent", icon: PlusCircle },
    { num: 2, name: "Indent Approval", slug: "indent-approval", icon: CheckCircle2 },
    { num: 3, name: "Update 3 Vendors", slug: "update-3-vendors", icon: Users },
    { num: 4, name: "Negotiation", slug: "negotiation", icon: MessagesSquare },
    { num: 5, name: "PO Entry", slug: "po-entry", icon: FileEdit },
    { num: 6, name: "Follow-Up Vendor", slug: "follow-up-vendor", icon: Phone },
    { num: 6.1, name: "Transporter Follow-Up", slug: "transporter-follow-up", icon: TruckIcon },
    { num: 7, name: "Material Received", slug: "material-received", icon: Package },
    { num: 8, name: "Receipt in Tally", slug: "receipt-in-tally", icon: FileText },
    { num: 8.5, name: "Submit Invoice (HO)", slug: "submit-invoice-ho", icon: FileText },
    { num: 9, name: "Submit Invoice", slug: "submit-invoice", icon: Upload },
    { num: 10, name: "Verification by Accounts", slug: "verification", icon: ShieldCheck },
    { num: 11, name: "QC Requirement", slug: "qc-requirement", icon: ClipboardCheck },
    { num: 12, name: "Purchase Return", slug: "purchase-return", icon: CornerUpLeft },
    { num: 13, name: "Return Approval", slug: "return-approval", icon: CornerUpLeft },
    { num: 14, name: "Vendor Payment", slug: "vendor-payment", icon: CreditCard },
    { num: 15, name: "Freight Payments", slug: "freight-payments", icon: Truck },
];
