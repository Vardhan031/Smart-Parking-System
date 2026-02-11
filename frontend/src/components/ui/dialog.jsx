import * as DialogPrimitive from "@radix-ui/react-dialog"
import { X } from "lucide-react"

export function Dialog({ open, onOpenChange, children }) {
    return (
        <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
            {children}
        </DialogPrimitive.Root>
    )
}

export function DialogContent({ children }) {
    return (
        <DialogPrimitive.Portal>
            <DialogPrimitive.Overlay
                style={{
                    position: "fixed",
                    inset: 0,
                    background: "rgba(0,0,0,0.4)",
                }}
            />
            <DialogPrimitive.Content
                style={{
                    position: "fixed",
                    top: "50%",
                    left: "50%",
                    transform: "translate(-50%, -50%)",
                    background: "#fff",
                    padding: "20px",
                    borderRadius: "8px",
                    width: "400px",
                    maxWidth: "90vw",
                }}
            >
                {children}
                <DialogPrimitive.Close
                    style={{
                        position: "absolute",
                        top: 10,
                        right: 10,
                        cursor: "pointer",
                        background: "none",
                        border: "none",
                    }}
                >
                    <X size={16} />
                </DialogPrimitive.Close>
            </DialogPrimitive.Content>
        </DialogPrimitive.Portal>
    )
}

export function DialogHeader({ children }) {
    return <div style={{ marginBottom: "12px" }}>{children}</div>
}

export function DialogTitle({ children }) {
    return <h3 style={{ fontSize: "18px", fontWeight: "600" }}>{children}</h3>
}
