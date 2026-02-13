"use client";

import { useAuth } from "@/lib/auth-context";
import Sidebar from "@/components/sidebar";
import Footer from "@/components/footer";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { Loader2 } from "lucide-react";
import { STAGES } from "@/lib/constants";

export default function LayoutWrapper({ children }: { children: React.ReactNode }) {
    const { isAuthenticated, isLoading, pageAccess } = useAuth();
    const pathname = usePathname();
    const router = useRouter();

    useEffect(() => {
        if (isLoading) return;

        // 1. Auth Check
        if (!isAuthenticated && pathname !== "/login") {
            router.push("/login");
            return;
        } else if (isAuthenticated && pathname === "/login") {
            router.push("/");
            return;
        }

        // 2. Access Control Check
        if (isAuthenticated && pathname.startsWith("/stages/")) {
            const currentStage = STAGES.find(s => pathname.startsWith(`/stages/${s.slug}`));

            // If we found a matching stage definition
            if (currentStage) {
                // Check if user has access (or if stage is public/whitelisted)
                const hasAccess =
                    currentStage.name === "Return Approval" ||
                    currentStage.name === "Transporter Follow-Up" ||
                    currentStage.name === "Submit Invoice (HO)" ||
                    (!pageAccess || pageAccess.length === 0) ||
                    pageAccess.includes(currentStage.name);

                if (!hasAccess) {
                    console.warn(`Access denied to ${currentStage.name}. Redirecting to dashboard.`);
                    router.push("/");
                }
            }
        }
    }, [isLoading, isAuthenticated, pathname, router, pageAccess]);

    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-screen bg-background">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
        );
    }

    // specific routing for login page
    if (pathname === "/login") {
        if (isAuthenticated) return null; // Wait for redirect
        return <>{children}</>;
    }

    if (!isAuthenticated) return null;

    return (
        <div className="flex flex-col h-screen bg-background">
            <div className="flex flex-1 overflow-hidden">
                <Sidebar />
                <main className="flex-1 overflow-auto pt-16 lg:pt-0">
                    {children}
                </main>
            </div>
            <Footer />
        </div>
    );
}
