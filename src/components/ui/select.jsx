"use client"

import * as React from "react"
import * as SelectPrimitive from "@radix-ui/react-select"
import { Check, ChevronDown, ChevronUp } from "lucide-react"

import { cn } from "@/lib/utils"

/* ------------------------------------------------------------------ */
/*  Detect mobile once (< 640px = sm breakpoint)                      */
/* ------------------------------------------------------------------ */
function useIsMobile() {
  const [mobile, setMobile] = React.useState(() =>
    typeof window !== "undefined" ? window.innerWidth < 640 : false
  );
  React.useEffect(() => {
    const mq = window.matchMedia("(max-width: 639px)");
    const handler = (e) => setMobile(e.matches);
    setMobile(mq.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);
  return mobile;
}

/* ------------------------------------------------------------------ */
/*  Context to pass isMobile + collected items to native <select>     */
/* ------------------------------------------------------------------ */
const NativeMobileCtx = React.createContext({ isMobile: false, items: null, registerItem: null });

/* ------------------------------------------------------------------ */
/*  Root – on mobile wraps a native <select>, on desktop uses Radix   */
/* ------------------------------------------------------------------ */
const Select = ({ children, value, defaultValue, onValueChange, ...props }) => {
  const isMobile = useIsMobile();
  const itemsRef = React.useRef([]);
  const [items, setItems] = React.useState([]);

  const registerItem = React.useCallback((val, label) => {
    itemsRef.current = itemsRef.current.filter(i => i.value !== val);
    itemsRef.current.push({ value: val, label });
    // batch update
    clearTimeout(registerItem._t);
    registerItem._t = setTimeout(() => setItems([...itemsRef.current]), 0);
  }, []);

  if (isMobile) {
    return (
      <NativeMobileCtx.Provider value={{ isMobile: true, items, registerItem, value, defaultValue, onValueChange }}>
        {children}
      </NativeMobileCtx.Provider>
    );
  }

  return (
    <NativeMobileCtx.Provider value={{ isMobile: false }}>
      <SelectPrimitive.Root value={value} defaultValue={defaultValue} onValueChange={onValueChange} {...props}>
        {children}
      </SelectPrimitive.Root>
    </NativeMobileCtx.Provider>
  );
};

const SelectGroup = ({ children, ...props }) => {
  const { isMobile } = React.useContext(NativeMobileCtx);
  if (isMobile) return <>{children}</>;
  return <SelectPrimitive.Group {...props}>{children}</SelectPrimitive.Group>;
};

const SelectValue = React.forwardRef(({ placeholder, ...props }, ref) => {
  const { isMobile, items, value, defaultValue } = React.useContext(NativeMobileCtx);
  if (isMobile) {
    const current = value || defaultValue;
    const found = items.find(i => i.value === current);
    return <span ref={ref} className={!found ? "text-muted-foreground" : ""}>{found ? found.label : (placeholder || "")}</span>;
  }
  return <SelectPrimitive.Value ref={ref} placeholder={placeholder} {...props} />;
});
SelectValue.displayName = "SelectValue";

/* ------------------------------------------------------------------ */
/*  Trigger – on mobile renders a div with hidden native <select>     */
/* ------------------------------------------------------------------ */
const SelectTrigger = React.forwardRef(({ className, children, ...props }, ref) => {
  const { isMobile, items, value, defaultValue, onValueChange } = React.useContext(NativeMobileCtx);

  if (isMobile) {
    const currentVal = value || defaultValue || "";
    return (
      <div
        ref={ref}
        className={cn(
          "relative flex min-h-[48px] w-full touch-manipulation items-center justify-between whitespace-nowrap rounded-xl border border-border/80 bg-white/90 px-4 py-3 text-base shadow-sm",
          className
        )}
        {...props}
      >
        {children}
        <ChevronDown className="h-4 w-4 opacity-50 flex-shrink-0" />
        <select
          value={currentVal}
          onChange={(e) => onValueChange?.(e.target.value)}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
          aria-hidden="false"
        >
          {(!currentVal) && <option value="" disabled>Seleccionar...</option>}
          {items.map((item) => (
            <option key={item.value} value={item.value}>
              {item.label}
            </option>
          ))}
        </select>
      </div>
    );
  }

  return (
    <SelectPrimitive.Trigger
      ref={ref}
      className={cn(
        "flex h-10 min-h-10 w-full touch-manipulation items-center justify-between whitespace-nowrap rounded-xl border border-border/80 bg-white/90 px-3 py-2 text-sm shadow-sm ring-offset-background data-[placeholder]:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/25 focus:border-ring disabled:cursor-not-allowed disabled:opacity-50 [&>span]:line-clamp-1",
        className
      )}
      {...props}
    >
      {children}
      <SelectPrimitive.Icon asChild>
        <ChevronDown className="h-4 w-4 opacity-50" />
      </SelectPrimitive.Icon>
    </SelectPrimitive.Trigger>
  );
});
SelectTrigger.displayName = "SelectTrigger";

/* ------------------------------------------------------------------ */
/*  Content – on mobile renders nothing (native picker handles it)    */
/* ------------------------------------------------------------------ */
const SelectScrollUpButton = React.forwardRef(({ className, ...props }, ref) => (
  <SelectPrimitive.ScrollUpButton
    ref={ref}
    className={cn("flex cursor-default items-center justify-center py-1", className)}
    {...props}>
    <ChevronUp className="h-4 w-4" />
  </SelectPrimitive.ScrollUpButton>
))
SelectScrollUpButton.displayName = SelectPrimitive.ScrollUpButton.displayName

const SelectScrollDownButton = React.forwardRef(({ className, ...props }, ref) => (
  <SelectPrimitive.ScrollDownButton
    ref={ref}
    className={cn("flex cursor-default items-center justify-center py-1", className)}
    {...props}>
    <ChevronDown className="h-4 w-4" />
  </SelectPrimitive.ScrollDownButton>
))
SelectScrollDownButton.displayName = SelectPrimitive.ScrollDownButton.displayName

const SelectContent = React.forwardRef(({ className, children, position = "popper", ...props }, ref) => {
  const { isMobile } = React.useContext(NativeMobileCtx);

  // On mobile, still render children so items register themselves, but no portal/popup
  if (isMobile) return <div className="hidden">{children}</div>;

  return (
    <SelectPrimitive.Portal>
      <SelectPrimitive.Content
        ref={ref}
        className={cn(
          "relative z-50 max-h-96 min-w-[8rem] overflow-hidden rounded-md border bg-popover text-popover-foreground shadow-md data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2",
          position === "popper" &&
            "data-[side=bottom]:translate-y-1 data-[side=left]:-translate-x-1 data-[side=right]:translate-x-1 data-[side=top]:-translate-y-1",
          className
        )}
        position={position}
        {...props}
      >
        <SelectScrollUpButton />
        <SelectPrimitive.Viewport
          className={cn("p-1", position === "popper" &&
            "h-[var(--radix-select-trigger-height)] w-full min-w-[var(--radix-select-trigger-width)]")}
        >
          {children}
        </SelectPrimitive.Viewport>
        <SelectScrollDownButton />
      </SelectPrimitive.Content>
    </SelectPrimitive.Portal>
  );
});
SelectContent.displayName = "SelectContent";

/* ------------------------------------------------------------------ */
/*  Item – on mobile registers itself, on desktop normal Radix item   */
/* ------------------------------------------------------------------ */
const SelectItem = React.forwardRef(({ className, children, value, ...props }, ref) => {
  const { isMobile, registerItem } = React.useContext(NativeMobileCtx);

  React.useEffect(() => {
    if (isMobile && registerItem && value != null) {
      const label = typeof children === "string" ? children : String(children);
      registerItem(value, label);
    }
  }, [isMobile, registerItem, value, children]);

  if (isMobile) return null;

  return (
    <SelectPrimitive.Item
      ref={ref}
      value={value}
      className={cn(
        "relative flex w-full cursor-default select-none items-center rounded-sm py-1.5 pl-2 pr-8 text-sm outline-none focus:bg-accent focus:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
        className
      )}
      {...props}
    >
      <span className="absolute right-2 flex h-3.5 w-3.5 items-center justify-center">
        <SelectPrimitive.ItemIndicator>
          <Check className="h-4 w-4" />
        </SelectPrimitive.ItemIndicator>
      </span>
      <SelectPrimitive.ItemText>{children}</SelectPrimitive.ItemText>
    </SelectPrimitive.Item>
  );
});
SelectItem.displayName = "SelectItem";

const SelectLabel = React.forwardRef(({ className, ...props }, ref) => {
  const { isMobile } = React.useContext(NativeMobileCtx);
  if (isMobile) return null;
  return (
    <SelectPrimitive.Label
      ref={ref}
      className={cn("px-2 py-1.5 text-sm font-semibold", className)}
      {...props} />
  );
});
SelectLabel.displayName = "SelectLabel";

const SelectSeparator = React.forwardRef(({ className, ...props }, ref) => {
  const { isMobile } = React.useContext(NativeMobileCtx);
  if (isMobile) return null;
  return (
    <SelectPrimitive.Separator
      ref={ref}
      className={cn("-mx-1 my-1 h-px bg-muted", className)}
      {...props} />
  );
});
SelectSeparator.displayName = "SelectSeparator";

export {
  Select,
  SelectGroup,
  SelectValue,
  SelectTrigger,
  SelectContent,
  SelectLabel,
  SelectItem,
  SelectSeparator,
  SelectScrollUpButton,
  SelectScrollDownButton,
}