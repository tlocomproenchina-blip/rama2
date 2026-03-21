"use client"

import * as React from "react"
import * as SelectPrimitive from "@radix-ui/react-select"
import { Check, ChevronDown, ChevronUp, Circle } from "lucide-react"

import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui/drawer"
import { usePlatform } from "@/hooks/usePlatform"
import { cn } from "@/lib/utils"

const NativeSelectContext = React.createContext(null)

function getTextContent(children) {
  let text = ""

  React.Children.forEach(children, (child) => {
    if (typeof child === "string" || typeof child === "number") {
      text += child
      return
    }

    if (React.isValidElement(child)) {
      text += getTextContent(child.props.children)
    }
  })

  return text.trim()
}

function collectNativeOptions(children, options = []) {
  React.Children.forEach(children, (child) => {
    if (!React.isValidElement(child)) return

    if (
      child.type?.displayName === SelectPrimitive.Item.displayName &&
      child.props?.value !== undefined
    ) {
      options.push({
        value: child.props.value,
        label: getTextContent(child.props.children),
        disabled: !!child.props.disabled,
      })
    }

    if (child.props?.children) {
      collectNativeOptions(child.props.children, options)
    }
  })

  return options
}

function findPlaceholder(children) {
  let placeholder = ""

  React.Children.forEach(children, (child) => {
    if (placeholder || !React.isValidElement(child)) return

    if (
      child.type?.displayName === SelectPrimitive.Value.displayName &&
      child.props?.placeholder
    ) {
      placeholder = child.props.placeholder
      return
    }

    if (child.props?.children) {
      const nestedPlaceholder = findPlaceholder(child.props.children)
      if (nestedPlaceholder) {
        placeholder = nestedPlaceholder
      }
    }
  })

  return placeholder
}

function findSelectedOption(options, value) {
  return options.find((option) => option.value === value) || null
}

function Select({ children, value, defaultValue, onValueChange, disabled, ...props }) {
  const { isNative, isIOS, isAndroid } = usePlatform()
  const isControlled = value !== undefined
  const [internalValue, setInternalValue] = React.useState(defaultValue ?? "")

  const options = React.useMemo(() => collectNativeOptions(children), [children])
  const placeholder = React.useMemo(() => findPlaceholder(children), [children])
  const currentValue = isControlled ? (value ?? "") : internalValue

  const handleValueChange = React.useCallback((nextValue) => {
    if (!isControlled) {
      setInternalValue(nextValue)
    }
    onValueChange?.(nextValue)
  }, [isControlled, onValueChange])

  const useMobilePicker = isIOS || isAndroid || isNative

  if (!useMobilePicker) {
    return (
      <SelectPrimitive.Root
        value={value}
        defaultValue={defaultValue}
        onValueChange={onValueChange}
        disabled={disabled}
        {...props}
      >
        {children}
      </SelectPrimitive.Root>
    )
  }

  return (
    <NativeSelectContext.Provider
      value={{
        mode: "mobile",
        value: currentValue,
        onValueChange: handleValueChange,
        options,
        placeholder,
        disabled,
      }}
    >
      {children}
    </NativeSelectContext.Provider>
  )
}

const SelectGroup = SelectPrimitive.Group

const SelectValue = React.forwardRef((props, ref) => {
  const nativeSelect = React.useContext(NativeSelectContext)

  if (nativeSelect) return null

  return <SelectPrimitive.Value ref={ref} {...props} />
})
SelectValue.displayName = SelectPrimitive.Value.displayName

const SelectTrigger = React.forwardRef(({ className, children, ...props }, ref) => {
  const nativeSelect = React.useContext(NativeSelectContext)
  const [open, setOpen] = React.useState(false)

  if (nativeSelect?.mode === "mobile") {
    const isDisabled = nativeSelect.disabled || props.disabled
    const selectedOption = findSelectedOption(nativeSelect.options, nativeSelect.value)

    return (
      <>
        <button
          type="button"
          ref={ref}
          disabled={isDisabled}
          onClick={() => setOpen(true)}
          className={cn(
            "flex min-h-[48px] w-full touch-manipulation items-center justify-between whitespace-nowrap rounded-xl border border-border/80 bg-white/90 px-4 py-3 text-base shadow-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring/25 focus:border-ring disabled:cursor-not-allowed disabled:opacity-50 sm:h-10 sm:min-h-10 sm:px-3 sm:py-2 sm:text-sm",
            !selectedOption && "text-muted-foreground",
            className
          )}
          {...props}
        >
          <span className="line-clamp-1">{selectedOption?.label || nativeSelect.placeholder}</span>
          <ChevronDown className="h-4 w-4 opacity-50" />
        </button>

        <Drawer open={open} onOpenChange={setOpen}>
          <DrawerContent className="rounded-t-[28px] bg-white">
            <DrawerHeader className="border-b border-slate-200 pb-4">
              <DrawerTitle className="text-left text-2xl font-medium text-slate-900">
                {nativeSelect.placeholder || "Selecciona una opción"}
              </DrawerTitle>
            </DrawerHeader>
            <div className="max-h-[70vh] overflow-y-auto pb-[calc(env(safe-area-inset-bottom)+1rem)]">
              {nativeSelect.options.map((option) => {
                const isSelected = option.value === nativeSelect.value

                return (
                  <button
                    key={option.value}
                    type="button"
                    disabled={option.disabled}
                    onClick={() => {
                      nativeSelect.onValueChange(option.value)
                      setOpen(false)
                    }}
                    className="flex w-full items-center justify-between border-b border-slate-200 px-5 py-4 text-left text-xl text-slate-900 disabled:opacity-40"
                  >
                    <span>{option.label}</span>
                    {isSelected ? (
                      <Check className="h-6 w-6 text-slate-700" />
                    ) : (
                      <Circle className="h-6 w-6 text-slate-500" />
                    )}
                  </button>
                )
              })}
            </div>
          </DrawerContent>
        </Drawer>
      </>
    )
  }

  return (
    <SelectPrimitive.Trigger
      ref={ref}
      className={cn(
        "flex min-h-[48px] w-full touch-manipulation items-center justify-between whitespace-nowrap rounded-xl border border-border/80 bg-white/90 px-4 py-3 text-base shadow-sm ring-offset-background data-[placeholder]:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/25 focus:border-ring disabled:cursor-not-allowed disabled:opacity-50 sm:h-10 sm:min-h-10 sm:px-3 sm:py-2 sm:text-sm [&>span]:line-clamp-1",
        className
      )}
      {...props}
    >
      {children}
      <SelectPrimitive.Icon asChild>
        <ChevronDown className="h-4 w-4 opacity-50" />
      </SelectPrimitive.Icon>
    </SelectPrimitive.Trigger>
  )
})
SelectTrigger.displayName = SelectPrimitive.Trigger.displayName

const SelectScrollUpButton = React.forwardRef(({ className, ...props }, ref) => (
  <SelectPrimitive.ScrollUpButton
    ref={ref}
    className={cn("hidden cursor-default items-center justify-center py-1 sm:flex", className)}
    {...props}>
    <ChevronUp className="h-4 w-4" />
  </SelectPrimitive.ScrollUpButton>
))
SelectScrollUpButton.displayName = SelectPrimitive.ScrollUpButton.displayName

const SelectScrollDownButton = React.forwardRef(({ className, ...props }, ref) => (
  <SelectPrimitive.ScrollDownButton
    ref={ref}
    className={cn("hidden cursor-default items-center justify-center py-1 sm:flex", className)}
    {...props}>
    <ChevronDown className="h-4 w-4" />
  </SelectPrimitive.ScrollDownButton>
))
SelectScrollDownButton.displayName =
  SelectPrimitive.ScrollDownButton.displayName

const SelectContent = React.forwardRef(({ className, children, position = "popper", ...props }, ref) => {
  const nativeSelect = React.useContext(NativeSelectContext)

  if (nativeSelect) return null

  return (
    <SelectPrimitive.Portal>
      <SelectPrimitive.Content
        ref={ref}
        className={cn(
          "fixed inset-x-3 bottom-[max(12px,env(safe-area-inset-bottom))] z-[70] max-h-[70vh] overflow-hidden rounded-2xl border bg-white text-popover-foreground shadow-2xl data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 sm:relative sm:inset-auto sm:block sm:max-h-96 sm:min-w-[8rem] sm:rounded-md sm:bg-popover sm:shadow-md sm:z-50 sm:data-[state=closed]:zoom-out-95 sm:data-[state=open]:zoom-in-95 sm:data-[side=bottom]:slide-in-from-top-2 sm:data-[side=left]:slide-in-from-right-2 sm:data-[side=right]:slide-in-from-left-2 sm:data-[side=top]:slide-in-from-bottom-2",
          position === "popper" &&
            "sm:data-[side=bottom]:translate-y-1 sm:data-[side=left]:-translate-x-1 sm:data-[side=right]:translate-x-1 sm:data-[side=top]:-translate-y-1",
          className
        )}
        position={position}
        {...props}>
        <SelectScrollUpButton />
        <SelectPrimitive.Viewport
          className={cn("overflow-y-auto bg-white p-2 sm:bg-transparent sm:p-1", position === "popper" &&
            "sm:h-[var(--radix-select-trigger-height)] sm:w-full sm:min-w-[var(--radix-select-trigger-width)]")}
        >
          {children}
        </SelectPrimitive.Viewport>
        <SelectScrollDownButton />
      </SelectPrimitive.Content>
    </SelectPrimitive.Portal>
  )
})
SelectContent.displayName = SelectPrimitive.Content.displayName

const SelectLabel = React.forwardRef(({ className, ...props }, ref) => {
  const nativeSelect = React.useContext(NativeSelectContext)

  if (nativeSelect) return null

  return (
    <SelectPrimitive.Label
      ref={ref}
      className={cn("px-2 py-1.5 text-sm font-semibold", className)}
      {...props}
    />
  )
})
SelectLabel.displayName = SelectPrimitive.Label.displayName

const SelectItem = React.forwardRef(({ className, children, ...props }, ref) => {
  const nativeSelect = React.useContext(NativeSelectContext)

  if (nativeSelect) return null

  return (
    <SelectPrimitive.Item
      ref={ref}
      className={cn(
        "relative flex min-h-[48px] w-full cursor-default select-none items-center rounded-xl py-3 pl-3 pr-10 text-sm outline-none focus:bg-accent focus:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50 sm:min-h-0 sm:rounded-sm sm:py-1.5 sm:pl-2 sm:pr-8",
        className
      )}
      {...props}>
      <span className="absolute right-2 flex h-3.5 w-3.5 items-center justify-center">
        <SelectPrimitive.ItemIndicator>
          <Check className="h-4 w-4" />
        </SelectPrimitive.ItemIndicator>
      </span>
      <SelectPrimitive.ItemText>{children}</SelectPrimitive.ItemText>
    </SelectPrimitive.Item>
  )
})
SelectItem.displayName = SelectPrimitive.Item.displayName

const SelectSeparator = React.forwardRef(({ className, ...props }, ref) => {
  const nativeSelect = React.useContext(NativeSelectContext)

  if (nativeSelect) return null

  return (
    <SelectPrimitive.Separator
      ref={ref}
      className={cn("-mx-1 my-1 h-px bg-muted", className)}
      {...props}
    />
  )
})
SelectSeparator.displayName = SelectPrimitive.Separator.displayName

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