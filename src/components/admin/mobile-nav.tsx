"use client";

import { useState } from "react";
import { MenuIcon, XIcon } from "lucide-react";
import { AdminNav } from "@/components/admin/admin-nav";
import { Button } from "@/components/ui/button";

export function MobileNav() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        aria-label={open ? "Close menu" : "Open menu"}
        aria-expanded={open}
        aria-controls="mobile-nav"
        onClick={() => setOpen((value) => !value)}
      >
        {open ? <XIcon className="size-4" /> : <MenuIcon className="size-4" />}
      </Button>

      {open ? (
        <div id="mobile-nav" className="bg-background absolute inset-x-0 top-full border-b p-3 shadow-sm">
          <AdminNav onNavigate={() => setOpen(false)} />
        </div>
      ) : null}
    </>
  );
}
