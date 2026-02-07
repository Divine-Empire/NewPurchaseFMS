"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Menu, X, LogOut, LayoutDashboard
} from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { STAGES } from "@/lib/constants";

export default function Sidebar() {
  const [isOpen, setIsOpen] = useState(false);
  const { pageAccess, fullName, role, logout } = useAuth();
  const pathname = usePathname();

  const handleLogout = () => {
    logout();
    setIsOpen(false);
  };

  // Helper to check if a page is allowed
  const isPageAllowed = (pageName: string) => {
    if (pageName === "Return Approval") return true; // Always show new stage
    if (!pageAccess || pageAccess.length === 0) return true; // Show all if no restrictions
    return pageAccess.includes(pageName);
  };

  const filteredStages = STAGES.filter(stage => isPageAllowed(stage.name));
  const showDashboard = isPageAllowed("Dashboard");

  // Determine active state helper
  const isActive = (path: string) => pathname === path || (path !== "/" && pathname.startsWith(path));

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
              return (
                <Button
                  key={stage.num}
                  variant={isActive(stagePath) ? "default" : "ghost"}
                  className="w-full justify-start text-sm transition-colors duration-200"
                  asChild
                  onClick={() => setIsOpen(false)}
                >
                  <Link href={stagePath}>
                    <Icon className="w-5 h-5 mr-3" />
                    <span className="truncate">{stage.name}</span>
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
