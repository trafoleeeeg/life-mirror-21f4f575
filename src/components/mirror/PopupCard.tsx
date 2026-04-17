// Reusable expandable mini-card → opens a Dialog popup with full content.
import { useState, type ReactNode } from "react";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Maximize2 } from "lucide-react";

interface Props {
  icon?: ReactNode;
  title: string;
  subtitle?: string;
  preview?: ReactNode;
  children: ReactNode;
  accentToken?: string; // CSS var name e.g. '--primary'
}

export const PopupCard = ({
  icon,
  title,
  subtitle,
  preview,
  children,
  accentToken = "--primary",
}: Props) => {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Card
        role="button"
        tabIndex={0}
        onClick={() => setOpen(true)}
        onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && setOpen(true)}
        className="ios-card p-4 cursor-pointer transition-all hover:scale-[1.01] hover:border-primary/40 active:scale-[0.99] animate-fade-in"
        style={{
          background: `linear-gradient(135deg, hsl(var(${accentToken}) / 0.08), hsl(var(--card)))`,
        }}
      >
        <div className="flex items-center gap-3">
          {icon && (
            <div
              className="size-10 rounded-xl flex items-center justify-center shrink-0"
              style={{ background: `hsl(var(${accentToken}) / 0.15)`, color: `hsl(var(${accentToken}))` }}
            >
              {icon}
            </div>
          )}
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-sm">{title}</p>
            {subtitle && (
              <p className="text-xs text-muted-foreground truncate">{subtitle}</p>
            )}
          </div>
          <Maximize2 className="size-4 text-muted-foreground" />
        </div>
        {preview && <div className="mt-3">{preview}</div>}
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto p-0 bg-background border-border animate-scale-in">
          <DialogTitle className="sr-only">{title}</DialogTitle>
          <div className="p-5">{children}</div>
        </DialogContent>
      </Dialog>
    </>
  );
};
